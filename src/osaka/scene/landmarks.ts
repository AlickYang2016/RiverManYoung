import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { LandmarkId, UmedaData } from "../data/types";
import { PLATFORM_ABOVE_RAIL, RAIL_TOP, ringXZ } from "../geo/frame";
import { Builder, frameBox, frameOf, prism, ribbon, type XZ } from "./geom";
import { LANDMARK_INDEX, PALETTE, facadeMaterial, nightGlow, roofGlassMaterial, type Shared } from "./materials";
import { rng, seedOf } from "./city";

/*
 * The landmarks the city is known by, built in code on the footprints and frames the data gives them.
 *
 * - JR Osaka: the station block under the tracks; the great roof as a segmental glass vault (180 m along the tracks, spanning the
 *   98.5 m between the North and South Gate buildings' facing facades), its arched ribs, edge girders and columns; the bridge
 *   concourse across the tracks with Toki-no-Hiroba (時空の広場) on top.
 * - Hankyu Osaka-Umeda: the terminal block, the concourse at the buffer-stop end, the hall roof laid over the platforms (open over
 *   the tracks, so the trains stay in view from above), its trusses and the hall's side walls.
 * - Umeda Sky Building: two 31 × 56 m towers 50 m apart, their crowns stepping up toward the gap (38F, 39F, 40F parts in OSM), the
 *   Floating Garden bridging them with its 36 m round opening, and the escalator tube crossing the void.
 * - HEP FIVE: the red wheel, 75 m across with its top 106 m above the street, in the plane OSM maps it in, gondolas hanging level.
 * - Grand Green Osaka: SANAA's undulating canopy over the south park (OSM outline, 13 m roof height).
 * - Tower cranes on Umekita's remaining building sites (completion 2027).
 *
 * Heights and shapes not in the data are estimates, listed in docs/osaka/DATA_SOURCES.md under "approximated geometry".
 */

export type Landmarks = {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  /** inside the two station blocks (the station carries the tracks; no viaduct piers there) */
  insideStation(x: number, z: number): boolean;
  update(t: number): void;
  dispose(): void;
};

export const JR_ROOF = { springing: 32, crown: 50 } as const; // m above the street, estimated (see header)

export function buildLandmarks(data: UmedaData, shared: Shared, env: THREE.Texture | null, nearRail: (x: number, z: number, pad?: number) => boolean): Landmarks {
  const group = new THREE.Group();
  group.name = "landmarks";
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => (disposables.push(x), x);
  const pickables: THREE.Object3D[] = [];
  const facade = keep(facadeMaterial(shared, env));
  const tag = (o: THREE.Object3D, id: LandmarkId) => {
    o.userData.landmark = id;
    pickables.push(o);
    return o;
  };
  const facadeMesh = (b: Builder, id: LandmarkId) => {
    const g = keep(b.build());
    g.setAttribute("aFac", g.getAttribute("uv"));
    const mesh = new THREE.Mesh(g, facade);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(tag(mesh, id));
    return mesh;
  };
  const white = keep(new THREE.MeshStandardMaterial({ color: PALETTE.steelWhite, roughness: 0.38, metalness: 0.35, envMap: env, envMapIntensity: 0.6 }));
  const concrete = keep(new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.85 }));
  const stone = keep(new THREE.MeshStandardMaterial({ color: 0xdedad1, roughness: 0.8 }));

  // ---------------------------------------------------------------- JR Osaka
  const jr = data.landmarks["jr-osaka"];
  const jrP = frameOf(jr.platforms.c, jr.platforms.a);
  const jrDeck = RAIL_TOP.jr - 0.55;
  {
    const b = new Builder(4);
    b.extra = [2, seedOf("jr-osaka"), jrDeck, LANDMARK_INDEX["jr-osaka"]!];
    frameBox(b, jrP, -jr.platforms.l / 2, jr.platforms.l / 2, -jr.platforms.w / 2, jr.platforms.w / 2, 0, jrDeck, false);
    // the bridge concourse across the tracks under the roof (3F), Toki-no-Hiroba on its roof (5F)
    const R = frameOf(jr.roof.c, jr.roof.a);
    b.extra = [1, seedOf("jr-bridge"), 22.2, LANDMARK_INDEX["jr-osaka"]!];
    frameBox(b, R, -17, 17, -jr.roof.w / 2, jr.roof.w / 2, 13.6, 22.2, true);
    facadeMesh(b, "jr-osaka");
    const plaza = new Builder();
    frameBox(plaza, R, -18, 18, -jr.roof.w / 2, jr.roof.w / 2, 22.2, 22.8, false);
    const plazaMesh = new THREE.Mesh(keep(plaza.build()), stone);
    plazaMesh.receiveShadow = true;
    group.add(tag(plazaMesh, "jr-osaka"));
    // glass balustrades round the plaza
    const rail = new Builder();
    const ring: XZ[] = [R.at(-18, -jr.roof.w / 2 + 0.3), R.at(18, -jr.roof.w / 2 + 0.3), R.at(18, jr.roof.w / 2 - 0.3), R.at(-18, jr.roof.w / 2 - 0.3), R.at(-18, -jr.roof.w / 2 + 0.3)];
    ribbon(rail, ring, 0.08, 24.0, 1.2);
    group.add(new THREE.Mesh(keep(rail.build()), keep(new THREE.MeshStandardMaterial({ color: 0xcfe0e6, transparent: true, opacity: 0.45, roughness: 0.1 }))));

    // the great roof: a segmental vault across the tracks
    const half = jr.roof.w / 2;
    const rise = JR_ROOF.crown - JR_ROOF.springing;
    const radius = (half * half + rise * rise) / (2 * rise);
    const yc = JR_ROOF.crown - radius;
    const phi0 = Math.asin(half / radius);
    const NU = 36;
    const NV = 28;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= NU; i++) {
      const u = -jr.roof.l / 2 + (jr.roof.l * i) / NU;
      for (let j = 0; j <= NV; j++) {
        const phi = -phi0 + (2 * phi0 * j) / NV;
        const [x, z] = R.at(u, radius * Math.sin(phi));
        pos.push(x, yc + radius * Math.cos(phi), z);
        uv.push(u, radius * phi);
      }
    }
    for (let i = 0; i < NU; i++)
      for (let j = 0; j < NV; j++) {
        const a = i * (NV + 1) + j;
        idx.push(a, a + NV + 1, a + 1, a + 1, a + NV + 1, a + NV + 2);
      }
    const roofGeo = keep(new THREE.BufferGeometry());
    roofGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    roofGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    roofGeo.setIndex(idx);
    roofGeo.computeVertexNormals();
    const roof = new THREE.Mesh(roofGeo, keep(roofGlassMaterial(3.0, shared, env)));
    roof.renderOrder = 2;
    roof.castShadow = false; // glass: the sun comes through; only the ribs and girders throw shadow
    group.add(tag(roof, "jr-osaka"));
    // ribs every 15 m and the two gable arches, the edge girders, the columns (only where they stand clear of the tracks)
    const ribs: THREE.BufferGeometry[] = [];
    for (let u = -jr.roof.l / 2; u <= jr.roof.l / 2 + 0.01; u += 15) {
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 24; j++) {
        const phi = -phi0 + (2 * phi0 * j) / 24;
        const [x, z] = R.at(u, radius * Math.sin(phi));
        pts.push(new THREE.Vector3(x, yc + radius * Math.cos(phi) - 0.5, z));
      }
      const end = Math.abs(Math.abs(u) - jr.roof.l / 2) < 0.1;
      ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, end ? 0.75 : 0.45, 6, false));
    }
    const edges = new Builder();
    for (const v of [-half, half]) frameBox(edges, R, -jr.roof.l / 2, jr.roof.l / 2, v - 0.8, v + 0.8, JR_ROOF.springing - 1.8, JR_ROOF.springing, true);
    for (let u = -jr.roof.l / 2 + 15; u < jr.roof.l / 2; u += 30)
      for (const v of [-half + 1, half - 1]) {
        const [x, z] = R.at(u, v);
        if (nearRail(x, z, 1.0)) continue;
        const col = new THREE.CylinderGeometry(0.85, 1.0, JR_ROOF.springing - jrDeck, 10).translate(x, (JR_ROOF.springing + jrDeck) / 2, z);
        ribs.push(col);
      }
    const ribGeo = keep(mergeGeometries([...ribs.map((g) => g.index ? g.toNonIndexed() : g).map((g) => (g.deleteAttribute("uv"), g)), edges.build().deleteAttribute("uv")], false)!);
    for (const g of ribs) g.dispose();
    const ribMesh = new THREE.Mesh(ribGeo, white);
    ribMesh.castShadow = true;
    ribMesh.receiveShadow = true;
    group.add(tag(ribMesh, "jr-osaka"));
  }

  // ---------------------------------------------------------------- Hankyu Osaka-Umeda
  const hk = data.landmarks["hankyu-umeda"].platforms;
  const hkF = frameOf(hk.c, hk.a);
  const hkDeck = RAIL_TOP.hankyu - 0.55;
  const hkTop = RAIL_TOP.hankyu + PLATFORM_ABOVE_RAIL;
  // the frame's +u end is the north (the a bearing points north-north-west), so the buffer stops are at −u
  const south = -hk.l / 2;
  {
    const b = new Builder(4);
    b.extra = [2, seedOf("hankyu-umeda"), hkDeck, LANDMARK_INDEX["hankyu-umeda"]!];
    frameBox(b, hkF, south - 14, hk.l / 2, -hk.w / 2, hk.w / 2, 0, hkDeck, false);
    // the 3F concourse with the ticket gates, along the buffer-stop end
    b.extra = [2, seedOf("hankyu-concourse"), hkTop + 7.4, LANDMARK_INDEX["hankyu-umeda"]!];
    frameBox(b, hkF, south - 14, south + 1.5, -hk.w / 2, hk.w / 2, hkDeck, hkTop + 7.4, false);
    // the hall's flanks
    for (const v of [-hk.w / 2, hk.w / 2 - 1.2]) frameBox(b, hkF, south + 1.5, hk.l / 2 - 2, v, v + 1.2, hkDeck, hkTop + 7.0, false);
    facadeMesh(b, "hankyu-umeda");
    // the hall roof: a slab over each platform, open over the tracks; trusses across every 15 m
    const roofB = new Builder();
    for (const p of data.platforms) {
      if (p.op !== "hankyu") continue;
      const rings = p.r.map(ringXZ);
      const [x0, z0] = rings[0]![0]!;
      const local = (x0 - hkF.cx) * hkF.ax + (z0 - hkF.cz) * hkF.az;
      if (Math.abs(local) > hk.l) continue; // not this station's (Nakatsu)
      prism(roofB, rings, hkTop + 6.6, hkTop + 6.85, true);
    }
    for (let u = south + 8; u < hk.l / 2; u += 15) frameBox(roofB, hkF, u - 0.25, u + 0.25, -hk.w / 2, hk.w / 2, hkTop + 6.3, hkTop + 6.85, true);
    const roof = new THREE.Mesh(keep(roofB.build()), keep(nightGlow(0xffe6c0, 0.2, shared, { color: 0xefece5, roughness: 0.55 })));
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(tag(roof, "hankyu-umeda"));
  }

  // ---------------------------------------------------------------- Umeda Sky Building
  {
    const sk = data.landmarks["sky-building"].frame;
    // centred on the Floating Garden's opening (OSM: the hole in the 39–40F parts), long axis along the frame
    const F = frameOf([-528, 321.5], sk.a);
    const b = new Builder(4);
    const tower = (u0: number, u1: number, top: number, key: string) => {
      b.extra = [1, seedOf(key), 173, LANDMARK_INDEX["sky-building"]!];
      frameBox(b, F, u0, u1, -28, 28, 0, top, false);
    };
    tower(-56, -40, 160, "sky-w1");
    tower(-40, -25, 164, "sky-w2");
    tower(25, 34, 168, "sky-e1");
    tower(34, 44, 164, "sky-e2");
    tower(44, 56, 160, "sky-e3");
    // the Floating Garden Observatory: a 56 m square bridging the towers, a 36 m round opening through its middle
    const square: XZ[] = [F.at(-28, -28), F.at(28, -28), F.at(28, 28), F.at(-28, 28)];
    const hole: XZ[] = [];
    for (let k = 0; k < 48; k++) {
      const t = (k / 48) * Math.PI * 2;
      hole.push(F.at(18 * Math.cos(t), 18 * Math.sin(t)));
    }
    b.extra = [1, seedOf("sky-garden"), 173, LANDMARK_INDEX["sky-building"]!];
    prism(b, [square, hole], 157, 173, true);
    facadeMesh(b, "sky-building");
    // the escalator tube across the void, from the east tower up into the garden
    const a = F.at(25, -6);
    const c = F.at(-4, -6);
    const tube = new THREE.Mesh(
      keep(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(a[0], 141, a[1]), new THREE.Vector3(c[0], 157.5, c[1])), 8, 2.3, 12, false)),
      keep(new THREE.MeshStandardMaterial({ color: 0xbfd3dc, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.7, envMap: env })),
    );
    group.add(tag(tube, "sky-building"));
    // the rooftop Sky Walk ring rail
    const rail = new Builder();
    ribbon(rail, [...hole, hole[0]!], 0.25, 174.1, 1.1);
    ribbon(rail, [...square, square[0]!], 0.25, 174.1, 1.1);
    group.add(new THREE.Mesh(keep(rail.build()), white));
  }

  // ---------------------------------------------------------------- HEP FIVE's wheel
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  const gondolas: THREE.InstancedMesh | null = (() => {
    const w = data.landmarks["hep-five"].wheel;
    if (!w) return null;
    const R = 36.5;
    const hubY = 106 - 37.5;
    wheel.position.set(w.c[0], hubY, -w.c[1]);
    wheel.rotation.y = w.a; // local x along the wheel's plane (OSM), local z along the axle
    const red = keep(nightGlow(0xff3b3b, 0.8, shared, { color: PALETTE.hepRed, roughness: 0.42, metalness: 0.25 }));
    const parts: THREE.BufferGeometry[] = [];
    for (const z of [-1.6, 1.6]) {
      parts.push(new THREE.TorusGeometry(R, 0.55, 6, 120).translate(0, 0, z));
      parts.push(new THREE.TorusGeometry(R - 3, 0.35, 6, 120).translate(0, 0, z));
    }
    for (let k = 0; k < 26; k++) {
      const t = (k / 26) * Math.PI * 2;
      for (const z of [-1.6, 1.6]) parts.push(new THREE.BoxGeometry(R - 2, 0.28, 0.28).translate((R - 2) / 2, 0, 0).rotateZ(t).translate(0, 0, z));
      parts.push(new THREE.BoxGeometry(0.3, 0.3, 3.4).translate(R - 1.5, 0, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(t)));
    }
    parts.push(new THREE.CylinderGeometry(2.6, 2.6, 5, 16).rotateX(Math.PI / 2));
    const rim = keep(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => (g.deleteAttribute("uv"), g)), false)!);
    for (const g of parts) g.dispose();
    const rimMesh = new THREE.Mesh(rim, red);
    rimMesh.castShadow = true;
    spin.add(rimMesh);
    wheel.add(spin);
    // the A-frame legs down to the roof, on both sides of the wheel
    const roofY = -hubY + 44.5;
    const legParts: THREE.BufferGeometry[] = [];
    for (const z of [-3.2, 3.2])
      for (const dir of [-1, 1]) {
        const len = Math.hypot(15, roofY);
        legParts.push(new THREE.BoxGeometry(1.3, len, 1.3).translate(0, -len / 2, 0).rotateZ(Math.atan2(15, -roofY) * dir).translate(0, 0, z));
      }
    const legGeo = keep(mergeGeometries(legParts, false)!);
    for (const g of legParts) g.dispose();
    const legMesh = new THREE.Mesh(legGeo, red);
    legMesh.castShadow = true;
    wheel.add(legMesh);
    const gon = new THREE.InstancedMesh(keep(new THREE.CapsuleGeometry(1.0, 1.0, 3, 8)), keep(nightGlow(0xfff0d0, 0.6, shared, { color: 0xc8202a, roughness: 0.35, metalness: 0.2 })), 52);
    wheel.add(gon);
    tag(rimMesh, "hep-five");
    tag(legMesh, "hep-five");
    group.add(wheel);
    return gon;
  })();
  const gm = new THREE.Matrix4();
  const updateWheel = (t: number) => {
    if (!gondolas) return;
    const ang = (t / 900) * Math.PI * 2; // one turn in 15 minutes
    spin.rotation.z = ang;
    for (let k = 0; k < 52; k++) {
      const a = ang + (k / 52) * Math.PI * 2;
      gm.makeTranslation(Math.cos(a) * 36.5, Math.sin(a) * 36.5 - 1.8, 0);
      gondolas.setMatrixAt(k, gm);
    }
    gondolas.instanceMatrix.needsUpdate = true;
  };
  updateWheel(0);

  // ---------------------------------------------------------------- Grand Green Osaka: SANAA's canopy
  const canopy = data.landmarks["grand-green"].canopy;
  if (canopy) {
    const ring = ringXZ(canopy.r[0]!);
    const inside = (x: number, z: number) => {
      let ins = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i]!;
        const c = ring[j]!;
        if (a[1] > z !== c[1] > z && x < ((c[0] - a[0]) * (z - a[1])) / (c[1] - a[1] || 1e-9) + a[0]) ins = !ins;
      }
      return ins;
    };
    const height = (x: number, z: number) => canopy.h - 3.6 + 3.6 * (0.5 + 0.5 * Math.sin(x * 0.11 + z * 0.05)) * (0.55 + 0.45 * Math.cos(z * 0.09 - x * 0.04));
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const [x, z] of ring) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
    const step = 1.5;
    const b = new Builder();
    const posts: THREE.Matrix4[] = [];
    for (let x = x0; x < x1; x += step)
      for (let z = z0; z < z1; z += step) {
        if (!inside(x + step / 2, z + step / 2)) continue;
        const p = (px: number, pz: number) => ({ x: px, y: height(px, pz), z: pz });
        b.quad(p(x, z), p(x + step, z), p(x + step, z + step), p(x, z + step), [[x, z], [x + step, z], [x + step, z + step], [x, z + step]], { x: 0, y: 1, z: 0 });
      }
    const r = rng(2024);
    for (let x = x0 + 6; x < x1; x += 13)
      for (let z = z0 + 6; z < z1; z += 13) {
        const px = x + (r() - 0.5) * 4;
        const pz = z + (r() - 0.5) * 4;
        if (!inside(px, pz)) continue;
        const h = height(px, pz);
        posts.push(new THREE.Matrix4().compose(new THREE.Vector3(px, h / 2, pz), new THREE.Quaternion(), new THREE.Vector3(0.22, h, 0.22)));
      }
    const roof = new THREE.Mesh(keep(b.build()), keep(new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.3, metalness: 0.35, side: THREE.DoubleSide, envMap: env, envMapIntensity: 0.8 })));
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(tag(roof, "grand-green"));
    if (posts.length) {
      const im = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(1, 1, 1, 6)), white, posts.length);
      posts.forEach((mm, i) => im.setMatrixAt(i, mm));
      group.add(im);
    }
  }

  // ---------------------------------------------------------------- tower cranes on Umekita's building sites
  {
    const sites = data.works
      .map((w) => ringXZ(w.r[0]!))
      .map((r) => {
        let a = 0;
        let cx = 0;
        let cz = 0;
        for (let i = 0; i < r.length; i++) {
          const p = r[i]!;
          const q = r[(i + 1) % r.length]!;
          const k = p[0] * q[1] - q[0] * p[1];
          a += k;
          cx += (p[0] + q[0]) * k;
          cz += (p[1] + q[1]) * k;
        }
        return { area: Math.abs(a / 2), cx: cx / (3 * a), cz: cz / (3 * a) };
      })
      .filter((s) => s.area > 2500 && s.cx > -700 && s.cx < 100 && s.cz < 0)
      .sort((p, q) => q.area - p.area)
      .slice(0, 3);
    const b = new Builder();
    const red = new Builder();
    sites.forEach((s, i) => {
      const r = rng(77 + i);
      const h = 62 + r() * 22;
      const yaw = r() * Math.PI * 2;
      const F = frameOf([s.cx, -s.cz], yaw);
      frameBox(b, F, -1, 1, -1, 1, 0, h, false);
      frameBox(b, F, -14, 46, -0.7, 0.7, h, h + 1.6, true);
      frameBox(b, F, -1.4, 1.4, -1.4, 1.4, h + 1.6, h + 6.5, true);
      frameBox(red, F, -15, -9, -1.3, 1.3, h - 1.5, h + 1.2, true);
      frameBox(red, F, 1, 3.5, -1.2, 1.2, h - 2.6, h, true);
    });
    if (sites.length) {
      const crane = new THREE.Mesh(keep(b.build()), keep(new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6 })));
      crane.castShadow = true;
      const tip = new THREE.Mesh(keep(red.build()), keep(new THREE.MeshStandardMaterial({ color: 0xc23a2c, roughness: 0.6 })));
      tip.castShadow = true;
      group.add(crane, tip);
    }
  }

  const inJr = (x: number, z: number) => {
    const dx = x - jrP.cx;
    const dz = z - jrP.cz;
    return Math.abs(dx * jrP.ax + dz * jrP.az) < jr.platforms.l / 2 && Math.abs(dx * jrP.lx + dz * jrP.lz) < jr.platforms.w / 2;
  };
  const inHk = (x: number, z: number) => {
    const dx = x - hkF.cx;
    const dz = z - hkF.cz;
    const u = dx * hkF.ax + dz * hkF.az;
    return u > south - 14 && u < hk.l / 2 && Math.abs(dx * hkF.lx + dz * hkF.lz) < hk.w / 2;
  };

  return {
    group,
    pickables,
    insideStation: (x, z) => inJr(x, z) || inHk(x, z),
    update: updateWheel,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

