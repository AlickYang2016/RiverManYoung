import * as THREE from "three";
import type { Operator, UmedaData } from "../data/types";
import { GAUGE, PLATFORM_ABOVE_RAIL, RAIL_TOP, m, ringXZ } from "../geo/frame";
import { Builder, prism, ribbon, type XZ } from "./geom";
import { PALETTE, ballastMaterial, type Shared, nightGlow } from "./materials";
import { platformFrame } from "../rail/services";

/*
 * The railway: every OSM track above ground as a concrete viaduct deck on rigid-frame piers, a ballast bed with its sleepers
 * (drawn by the ballast shader), and two steel rails at the operator's true gauge — JR's 1,067 mm narrow gauge, Hankyu's 1,435 mm
 * standard gauge. Platforms stand 1.1 m above the rail with the yellow tactile line along their edges; JR's platforms outside the
 * great roof have their canopies on posts; Hankyu's tracks end at buffer stops; masts carry the contact wire.
 *
 * Nothing is placed where a train runs or a car drives: masts need clearance from every other track, piers from every road.
 *
 * The one line below the street, the Umeda freight line through Osaka Station's Umekita platforms (21–24), is drawn in its tunnel:
 * a concrete box under the city, seen only when the ground is made see-through (the underground view). Where it comes up near
 * Fukushima it runs in an open cutting between retaining walls, out of a portal, and the ground has a hole for it.
 */

export type Track = { group: THREE.Group; dispose(): void };

/** Rail top of every point of every way (m): its node's level (the Umekita line) or its operator's. */
export function wayHeights(data: UmedaData): number[][] {
  const el = new Map(data.rail.el ?? []);
  return data.rail.ways.map((w) => w.n.map((i) => (el.has(i) ? el.get(i)! / 10 : RAIL_TOP[w.op])));
}

const CUT_HALF = 3.4; // half the open cutting's width between its retaining walls

/** The open cuttings (surface track below the street) as rings in scene (x, z): the holes the ground leaves for them. */
export function cuttings(data: UmedaData): XZ[][] {
  const N = data.rail.nodes;
  const hs = wayHeights(data);
  const out: XZ[][] = [];
  data.rail.ways.forEach((w, wi) => {
    if (w.ug) return;
    let run: XZ[] = [];
    const flush = () => {
      if (run.length >= 2) {
        const L: XZ[] = [];
        const R: XZ[] = [];
        for (let i = 0; i < run.length; i++) {
          const a = run[Math.max(0, i - 1)]!;
          const b = run[Math.min(run.length - 1, i + 1)]!;
          const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const nx = (b[1] - a[1]) / l;
          const nz = -(b[0] - a[0]) / l;
          L.push([run[i]![0] + nx * CUT_HALF, run[i]![1] + nz * CUT_HALF]);
          R.push([run[i]![0] - nx * CUT_HALF, run[i]![1] - nz * CUT_HALF]);
        }
        out.push([...L, ...R.reverse()]);
      }
      run = [];
    };
    w.n.forEach((i, k) => {
      // a point belongs to the cutting while its rail is below the street, and the next one up joins it to close the slope
      if (hs[wi]![k]! < -0.15 || (k > 0 && hs[wi]![k - 1]! < -0.15)) run.push([N[i]![0] / 10, -N[i]![1] / 10]);
      else flush();
    });
    flush();
  });
  return out;
}

/** A coarse spatial index of segments for clearance tests. */
export class SegmentGrid {
  private cells = new Map<number, [number, number, number, number, number][]>();
  constructor(private size = 24) {}
  private key(i: number, j: number) {
    return i * 100003 + j;
  }
  add(a: XZ, b: XZ, r: number): void {
    const s = this.size;
    const i0 = Math.floor((Math.min(a[0], b[0]) - r) / s);
    const i1 = Math.floor((Math.max(a[0], b[0]) + r) / s);
    const j0 = Math.floor((Math.min(a[1], b[1]) - r) / s);
    const j1 = Math.floor((Math.max(a[1], b[1]) + r) / s);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const k = this.key(i, j);
        const list = this.cells.get(k);
        const seg: [number, number, number, number, number] = [a[0], a[1], b[0], b[1], r];
        if (list) list.push(seg);
        else this.cells.set(k, [seg]);
      }
  }
  /** true if (x, z) lies within any segment's radius (+ pad) */
  hits(x: number, z: number, pad = 0): boolean {
    const list = this.cells.get(this.key(Math.floor(x / this.size), Math.floor(z / this.size)));
    if (!list) return false;
    for (const [ax, az, bx, bz, r] of list) {
      const ex = bx - ax;
      const ez = bz - az;
      const l2 = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
      if ((ax + ex * t - x) ** 2 + (az + ez * t - z) ** 2 < (r + pad) ** 2) return true;
    }
    return false;
  }
}

/** Points along a polyline every `step` metres: position, unit direction. */
function* along(pts: XZ[], step: number, start = step / 2): Generator<[number, number, number, number]> {
  let acc = start;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (seg < 1e-6) continue;
    const dx = (b[0] - a[0]) / seg;
    const dz = (b[1] - a[1]) / seg;
    while (acc <= seg) {
      yield [a[0] + dx * acc, a[1] + dz * acc, dx, dz];
      acc += step;
    }
    acc -= seg;
  }
}

/** Is (x, z) inside one of the station blocks (where the station building, not piers, carries the tracks)? */
export type Inside = (x: number, z: number) => boolean;

/** A clearance test against every track centreline: true when (x, z) is within `pad` of a train's envelope. */
export function railIndex(data: UmedaData): (x: number, z: number, pad?: number) => boolean {
  const grid = new SegmentGrid();
  const N = data.rail.nodes;
  for (const w of data.rail.ways)
    for (let k = 0; !w.ug && k + 1 < w.n.length; k++) grid.add([N[w.n[k]!]![0] / 10, -N[w.n[k]!]![1] / 10], [N[w.n[k + 1]!]![0] / 10, -N[w.n[k + 1]!]![1] / 10], 1.6);
  return (x, z, pad = 0) => grid.hits(x, z, pad);
}

export function buildTrack(data: UmedaData, shared: Shared, opts: { mobile: boolean; insideStation: Inside; clip: THREE.Plane[] }): Track {
  const group = new THREE.Group();
  group.name = "track";
  const disposables: { dispose(): void }[] = [];
  // every material here ends at the base's cut faces
  const keep = <T extends { dispose(): void }>(x: T): T => {
    if (x instanceof THREE.Material) x.clippingPlanes = opts.clip;
    disposables.push(x);
    return x;
  };

  const N = data.rail.nodes;
  const wayPts = data.rail.ways.map((w) => w.n.map((i) => [N[i]![0] / 10, -N[i]![1] / 10] as XZ));

  const rails = new SegmentGrid();
  wayPts.forEach((pts) => {
    for (let i = 0; i + 1 < pts.length; i++) rails.add(pts[i]!, pts[i + 1]!, 1.6);
  });
  const roads = new SegmentGrid();
  for (const r of data.roads) {
    if (r.e) continue;
    const w = m(r.w);
    for (let k = 0; k + 3 < r.p.length; k += 2) roads.add([r.p[k]! / 10, -r.p[k + 1]! / 10], [r.p[k + 2]! / 10, -r.p[k + 3]! / 10], w / 2 + 0.5);
  }

  const heights = wayHeights(data);
  const deckB = new Builder();
  const ballastB = new Builder();
  const railB = new Builder();
  const boxB = new Builder(); // tunnel and cutting: floor slab and side walls
  const ugBallastB = new Builder();
  const ugRailB = new Builder();
  const wire: number[] = [];
  const piers: THREE.Matrix4[] = [];
  const masts: THREE.Matrix4[] = [];
  const arms: THREE.Matrix4[] = [];
  const tmp = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();

  data.rail.ways.forEach((w, wi) => {
    const pts = wayPts[wi]!;
    if (pts.length < 2) return;
    const ys = heights[wi]!;
    const g = GAUGE[w.op];
    const level = ys.every((y) => y === RAIL_TOP[w.op]);
    if (!level) {
      // the Umekita line: in its tunnel, its open cutting, at grade by Fukushima, then up onto its viaduct
      const below = ys.map((y) => y < -0.15);
      const bal = w.ug ? ugBallastB : ballastB;
      const rl = w.ug ? ugRailB : railB;
      ribbon(bal, pts, 3.0, ys.map((y) => y - 0.16), 0.42);
      for (const side of [-1, 1]) ribbon(rl, pts, 0.075, ys, 0.17, side * (g / 2 + 0.035));
      if (w.ug || below.some(Boolean)) {
        const lo = Math.min(...ys) - 0.6;
        ribbon(boxB, pts, 2 * CUT_HALF + 0.8, ys.map((y) => y - 0.6), 0.5);
        // retaining walls: up to the street (a low parapet) in the cutting, a metre and a half above the rail in the tunnel
        const wallTop = ys.map((y) => (w.ug ? y + 1.5 : 0.45));
        for (const side of [-1, 1]) ribbon(boxB, pts, 0.4, wallTop, Math.max(...wallTop) - lo, side * CUT_HALF);
      }
      if (!w.ug) {
        ribbon(deckB, pts, 5.2, ys.map((y) => Math.max(y, 0) - 0.55), 1.5);
        let s0 = 0;
        for (let i = 0; i + 1 < pts.length; i++) {
          const a = pts[i]!;
          const b = pts[i + 1]!;
          const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
          for (let s = (12 - (s0 % 12)) % 12; s < seg; s += 12) {
            const y = ys[i]! + ((ys[i + 1]! - ys[i]!) * s) / (seg || 1);
            if (y < 2.6) continue;
            const x = a[0] + ((b[0] - a[0]) * s) / seg;
            const z = a[1] + ((b[1] - a[1]) * s) / seg;
            if (roads.hits(x, z, 0.6)) continue;
            q.setFromAxisAngle(up, -Math.atan2(b[1] - a[1], b[0] - a[0]));
            tmp.compose(new THREE.Vector3(x, (y - 2.05) / 2, z), q, new THREE.Vector3(0.9, y - 2.05, 4.2));
            piers.push(tmp.clone());
          }
          s0 += seg;
        }
        for (let i = 0; i + 1 < pts.length; i++) if (ys[i]! > -0.15) wire.push(pts[i]![0], ys[i]! + 5.1, pts[i]![1], pts[i + 1]![0], ys[i + 1]! + 5.1, pts[i + 1]![1]);
      }
      return;
    }
    const top = RAIL_TOP[w.op];
    ribbon(deckB, pts, 5.2, top - 0.55, 1.5);
    ribbon(ballastB, pts, w.op === "hankyu" ? 3.3 : 3.0, top - 0.16, 0.42);
    for (const side of [-1, 1]) ribbon(railB, pts, 0.075, top, 0.17, side * (g / 2 + 0.035));
    // piers: a rigid-frame bent every 12 m, not inside the station blocks, not on a road
    for (const [x, z, dx, dz] of along(pts, 12)) {
      if (opts.insideStation(x, z) || roads.hits(x, z, 0.6)) continue;
      q.setFromAxisAngle(up, -Math.atan2(dz, dx));
      const h = top - 2.05;
      tmp.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(0.9, h, 4.2));
      piers.push(tmp.clone());
    }
    // contact wire 5.1 m over the rail, masts every 48 m where there is room beside the track
    for (let i = 0; i + 1 < pts.length; i++) wire.push(pts[i]![0], top + 5.1, pts[i]![1], pts[i + 1]![0], top + 5.1, pts[i + 1]![1]);
    if (w.cov) return;
    for (const [x, z, dx, dz] of along(pts, 48, 20)) {
      for (const side of [1, -1]) {
        const off = 2.9 * side;
        const mx = x + dz * off;
        const mz = z - dx * off;
        if (rails.hits(mx, mz, 0.4)) continue;
        q.setFromAxisAngle(up, -Math.atan2(dz, dx));
        tmp.compose(new THREE.Vector3(mx, top + 3.4, mz), q, new THREE.Vector3(0.3, 7.6, 0.3));
        masts.push(tmp.clone());
        tmp.compose(new THREE.Vector3(x + dz * off * 0.5, top + 6.2, z - dx * off * 0.5), q, new THREE.Vector3(0.14, 0.14, Math.abs(off)));
        arms.push(tmp.clone());
        break;
      }
    }
  });

  const concrete = keep(new THREE.MeshStandardMaterial({ color: PALETTE.viaduct, roughness: 0.9 }));
  const deck = new THREE.Mesh(keep(deckB.build()), concrete);
  deck.castShadow = true;
  deck.receiveShadow = true;
  const ballastMat = keep(ballastMaterial());
  const railMat = keep(new THREE.MeshStandardMaterial({ color: PALETTE.rail, roughness: 0.4, metalness: 0.7 }));
  const ballast = new THREE.Mesh(keep(ballastB.build()), ballastMat);
  ballast.receiveShadow = true;
  const railMesh = new THREE.Mesh(keep(railB.build()), railMat);
  group.add(deck, ballast, railMesh);
  // the Umekita line below the street: tunnel box and cutting walls, its ballast and rails
  const boxMesh = new THREE.Mesh(keep(boxB.build()), keep(new THREE.MeshStandardMaterial({ color: 0x9a9b96, roughness: 0.92 })));
  boxMesh.receiveShadow = true;
  const ugBallast = new THREE.Mesh(keep(ugBallastB.build()), ballastMat);
  const ugRail = new THREE.Mesh(keep(ugRailB.build()), railMat);
  group.add(boxMesh, ugBallast, ugRail);
  // the south portal: a headwall over the tunnel mouth, from the top of the train's envelope up to the street
  const ugNode = new Set(data.rail.ways.filter((w) => w.ug).flatMap((w) => w.n));
  data.rail.ways.forEach((w, wi) => {
    if (w.ug) return;
    w.n.forEach((i, k) => {
      const y = heights[wi]![k]!;
      if (!ugNode.has(i) || y > -0.15) return;
      const pts = wayPts[wi]!;
      const a = pts[Math.max(0, k - 1)]!;
      const b = pts[Math.min(pts.length - 1, k + 1)]!;
      q.setFromAxisAngle(up, -Math.atan2(b[1] - a[1], b[0] - a[0]));
      const top = 0.45;
      const bottom = y + 5.2;
      tmp.compose(new THREE.Vector3(pts[k]![0], (top + bottom) / 2, pts[k]![1]), q, new THREE.Vector3(1.4, top - bottom, 2 * CUT_HALF + 0.8));
      piers.push(tmp.clone());
    });
  });

  const box = keep(new THREE.BoxGeometry(1, 1, 1));
  const inst = (list: THREE.Matrix4[], mat: THREE.Material, shadow = true) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(box, mat, list.length);
    list.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.castShadow = shadow;
    im.receiveShadow = true;
    group.add(im);
  };
  inst(piers, concrete);
  const steel = keep(new THREE.MeshStandardMaterial({ color: 0x9a9d9f, roughness: 0.5, metalness: 0.6 }));
  inst(masts, steel, !opts.mobile);
  inst(arms, steel, false);
  const wireGeo = keep(new THREE.BufferGeometry());
  wireGeo.setAttribute("position", new THREE.Float32BufferAttribute(wire, 3));
  const wireMat = keep(new THREE.LineBasicMaterial({ color: PALETTE.catenary, transparent: true, opacity: 0.45 }));
  const wires = new THREE.LineSegments(wireGeo, wireMat);
  wires.name = "catenary";
  group.add(wires);

  // ---------------------------------------------------------------- platforms, tactile lines, canopies
  const platB = new Builder();
  const tactB = new Builder();
  const canB = new Builder();
  const posts: THREE.Matrix4[] = [];
  for (const p of data.platforms) {
    const top = p.y !== undefined ? p.y / 10 : RAIL_TOP[p.op] + PLATFORM_ABOVE_RAIL;
    const rings = p.r.map(ringXZ);
    prism(platB, rings, top - PLATFORM_ABOVE_RAIL - 0.55, top, false);
    for (const t of p.t) {
      const r = ringXZ(t);
      r.push(r[0]!);
      ribbon(tactB, r, 0.3, top + 0.02);
    }
    for (const cv of p.cv ?? []) {
      const rr = cv.map(ringXZ);
      prism(canB, rr, top + 3.3, top + 3.6, true);
      const f = platformFrame(cv[0]!);
      for (let u = -f.half + 4; u <= f.half - 4; u += 11) {
        tmp.compose(new THREE.Vector3(f.cx + f.ax * u, top + 1.65, f.cz + f.az * u), new THREE.Quaternion(), new THREE.Vector3(0.28, 3.3, 0.28));
        posts.push(tmp.clone());
      }
    }
  }
  const platMat = keep(new THREE.MeshStandardMaterial({ color: PALETTE.platform, roughness: 0.85 }));
  const plat = new THREE.Mesh(keep(platB.build()), platMat);
  plat.castShadow = true;
  plat.receiveShadow = true;
  const tact = new THREE.Mesh(keep(tactB.build()), keep(new THREE.MeshStandardMaterial({ color: PALETTE.tactile, roughness: 0.7 })));
  const canMat = keep(nightGlow(0xfff1d6, 0.22, shared, { color: PALETTE.canopy, roughness: 0.45, metalness: 0.3 }));
  const can = new THREE.Mesh(keep(canB.build()), canMat);
  can.castShadow = true;
  can.receiveShadow = true;
  group.add(plat, tact, can);
  inst(posts, steel, false);

  // ---------------------------------------------------------------- buffer stops (Hankyu's terminal tracks)
  const adj = new Map<number, number>();
  for (const w of data.rail.ways)
    for (let k = 0; k < w.n.length; k++) {
      if (k > 0) adj.set(w.n[k]!, w.n[k - 1]!);
      if (k + 1 < w.n.length && !adj.has(w.n[k]!)) adj.set(w.n[k]!, w.n[k + 1]!);
    }
  const stops: THREE.Matrix4[] = [];
  for (const b of data.rail.bufferStops) {
    const nb = adj.get(b);
    if (nb === undefined) continue;
    const op: Operator = data.rail.ways.find((w) => w.n.includes(b))?.op ?? "jr";
    const bx = N[b]![0] / 10;
    const bz = -N[b]![1] / 10;
    const dx = bx - N[nb]![0] / 10;
    const dz = bz + N[nb]![1] / 10;
    const l = Math.hypot(dx, dz) || 1;
    q.setFromAxisAngle(up, -Math.atan2(dz / l, dx / l));
    tmp.compose(new THREE.Vector3(bx + (dx / l) * 0.6, RAIL_TOP[op] + 0.55, bz + (dz / l) * 0.6), q, new THREE.Vector3(1.0, 1.3, 2.6));
    stops.push(tmp.clone());
  }
  inst(stops, keep(new THREE.MeshStandardMaterial({ color: 0xb8322e, roughness: 0.6 })));

  return {
    group,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
