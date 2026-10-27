import * as THREE from "three";
import type { BuildingRec, LandmarkId, UmedaData } from "../data/types";
import { BOUNDS, m, ringXZ } from "../geo/frame";
import { Builder, cap, prism, ribbon, type XZ } from "./geom";
import { LANDMARK_INDEX, PALETTE, facadeMaterial, nightGlow, roadMaterial, type Shared } from "./materials";

/*
 * The city on the base: the plinth and its nameplate, the paved ground, roads (with their markings drawn by the road shader),
 * the elevated expressway and the footbridge decks on their piers, zebra crossings, parks and building sites, every OSM
 * building as one merged mesh per landmark plus one for the rest, rooftop plant and helipad marks, and the trees.
 *
 * Detail follows importance: landmarks get their own meshes (pickable, highlightable), every other building gets the shared facade
 * shader and nothing more; trees and crossings are instanced.
 */

export const PLINTH_DEPTH = 24;

export type City = {
  group: THREE.Group;
  /** pickable meshes, one per landmark that has OSM buildings */
  landmarkMeshes: Map<LandmarkId, THREE.Mesh>;
  dispose(): void;
};

export function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pointInRing(x: number, z: number, r: XZ[]): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i]!;
    const b = r[j]!;
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1] || 1e-9) + a[0]) inside = !inside;
  }
  return inside;
}

function ringArea(r: XZ[]): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i]!;
    const q = r[(i + 1) % r.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a / 2);
}

/** Principal axis of a ring: centroid and angle (scene yaw) of the long side. */
function ringAxis(r: XZ[]): { cx: number; cz: number; yaw: number; long: number; short: number } {
  const cx = r.reduce((s, p) => s + p[0], 0) / r.length;
  const cz = r.reduce((s, p) => s + p[1], 0) / r.length;
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (const [x, z] of r) {
    sxx += (x - cx) ** 2;
    szz += (z - cz) ** 2;
    sxz += (x - cx) * (z - cz);
  }
  const th = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const [x, z] of r) {
    const u = (x - cx) * Math.cos(th) + (z - cz) * Math.sin(th);
    const v = -(x - cx) * Math.sin(th) + (z - cz) * Math.cos(th);
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  return { cx, cz, yaw: -th, long: u1 - u0, short: v1 - v0 };
}

/** Writes one building record into a builder with its aInfo (use, seed, top, landmark). */
export function addBuilding(b: Builder, rec: BuildingRec, rings = rec.r.map(ringXZ)): void {
  const top = m(rec.h);
  const bottom = rec.b ? m(rec.b) : 0;
  b.extra = [rec.u, seedOf(rec.i), top, rec.lm ? LANDMARK_INDEX[rec.lm]! : 0];
  prism(b, rings, bottom, top, bottom > 0.01);
}

function facadeMesh(b: Builder, mat: THREE.Material): THREE.Mesh {
  const g = b.build();
  g.setAttribute("aFac", g.getAttribute("uv"));
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function helipadTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  x.clearRect(0, 0, 128, 128);
  x.strokeStyle = "rgba(245,244,238,0.95)";
  x.lineWidth = 7;
  x.beginPath();
  x.arc(64, 64, 54, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = "rgba(245,244,238,0.95)";
  x.fillRect(42, 34, 10, 60);
  x.fillRect(76, 34, 10, 60);
  x.fillRect(42, 59, 44, 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function nameplateTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = "#2a2f35";
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#d9cfae";
  x.textBaseline = "middle";
  x.font = '500 46px "Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", serif';
  x.fillText("大阪・梅田", 70, 66);
  x.font = '400 30px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
  x.fillText("OSAKA  UMEDA   —   A MINIATURE RAILWAY CITY", 330, 68);
  x.textAlign = "right";
  x.fillText("34.7024° N  135.4959° E   ·   1.6 × 1.5 km", c.width - 70, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildCity(data: UmedaData, shared: Shared, env: THREE.Texture | null, opts: { mobile: boolean; clip: THREE.Plane[] }): City {
  const group = new THREE.Group();
  group.name = "city";
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => (disposables.push(x), x);

  const W = BOUNDS.x1 - BOUNDS.x0;
  const D = BOUNDS.n1 - BOUNDS.n0;
  const cx = (BOUNDS.x0 + BOUNDS.x1) / 2;
  const cz = -(BOUNDS.n0 + BOUNDS.n1) / 2;

  // ---------------------------------------------------------------- plinth, nameplate, the table's shadow
  const plinthMat = keep(new THREE.MeshStandardMaterial({ color: PALETTE.plinth, roughness: 0.55, metalness: 0.05 }));
  const plinth = new THREE.Mesh(keep(new THREE.BoxGeometry(W, PLINTH_DEPTH, D)), plinthMat);
  plinth.position.set(cx, -PLINTH_DEPTH / 2 - 0.02, cz);
  plinth.receiveShadow = true;
  group.add(plinth);
  const trimMat = keep(new THREE.MeshStandardMaterial({ color: PALETTE.plinthTrim, roughness: 0.5 }));
  const trim = new THREE.Mesh(keep(new THREE.BoxGeometry(W + 0.8, 1.2, D + 0.8)), trimMat);
  trim.position.set(cx, -0.62, cz);
  group.add(trim);
  const plate = new THREE.Mesh(keep(new THREE.PlaneGeometry(W * 0.62, (W * 0.62) / 16)), keep(new THREE.MeshStandardMaterial({ map: keep(nameplateTexture()), roughness: 0.6 })));
  plate.position.set(cx, -PLINTH_DEPTH * 0.5, cz + D / 2 + 0.05);
  group.add(plate);
  const shadowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(128, 128, 60, 128, 128, 128);
    g.addColorStop(0, "rgba(21,35,58,0.35)");
    g.addColorStop(1, "rgba(21,35,58,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return keep(new THREE.CanvasTexture(c));
  })();
  const tableShadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(W * 1.5, D * 1.5)), keep(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })));
  tableShadow.rotation.x = -Math.PI / 2;
  tableShadow.position.set(cx + 40, -PLINTH_DEPTH - 0.1, cz + 40);
  tableShadow.renderOrder = -1;
  group.add(tableShadow);

  // ---------------------------------------------------------------- ground: paving, greens, building sites
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(W, D)), keep(new THREE.MeshStandardMaterial({ color: PALETTE.paving, roughness: 0.95 })));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0, cz);
  ground.receiveShadow = true;
  group.add(ground);

  const gb = new Builder();
  for (const gr of data.greens) cap(gb, gr.r.map(ringXZ), gr.k ? 0.07 : 0.06);
  const greens = new THREE.Mesh(keep(gb.build()), keep(new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 1 })));
  greens.receiveShadow = true;
  group.add(greens);
  const wb = new Builder();
  for (const w of data.works) cap(wb, w.r.map(ringXZ), 0.05);
  const works = new THREE.Mesh(keep(wb.build()), keep(new THREE.MeshStandardMaterial({ color: PALETTE.works, roughness: 1 })));
  works.receiveShadow = true;
  group.add(works);

  // ---------------------------------------------------------------- roads
  const up0 = new THREE.Vector3(0, 1, 0);
  const rb = new Builder(2);
  const piers: THREE.Matrix4[] = [];
  const deckB = new Builder();
  const tmp = new THREE.Matrix4();
  for (const r of data.roads) {
    const pts: XZ[] = [];
    for (let k = 0; k + 1 < r.p.length; k += 2) pts.push([r.p[k]! / 10, -r.p[k + 1]! / 10]);
    const w = m(r.w);
    const e = r.e ? m(r.e) : 0;
    const deck = r.c === 8 || r.c === 7;
    const kind = deck ? 3 : r.c >= 6 ? 0 : r.o && w >= 6 ? 2 : r.c <= 5 && w >= 5.5 ? 1 : 0;
    rb.extra = [w, kind];
    const y = e > 0 ? e : 0.03 + 0.006 * (8 - r.c);
    ribbon(rb, pts, w, y, e > 0 ? (deck ? 0.6 : 1.4) : 0);
    if (e > 0) {
      // parapets and piers
      ribbon(deckB, pts, 0.35, y + (deck ? 1.1 : 0.9), deck ? 1.1 : 0.9, w / 2 - 0.18);
      ribbon(deckB, pts, 0.35, y + (deck ? 1.1 : 0.9), deck ? 1.1 : 0.9, -(w / 2 - 0.18));
      let acc = 0;
      const step = deck ? 18 : 26;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i]!;
        const c = pts[i + 1]!;
        const seg = Math.hypot(c[0] - a[0], c[1] - a[1]);
        while (acc < seg) {
          const t = acc / seg;
          const px = a[0] + (c[0] - a[0]) * t;
          const pz = a[1] + (c[1] - a[1]) * t;
          const h = y - (deck ? 0.6 : 1.4);
          tmp.compose(new THREE.Vector3(px, h / 2, pz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(c[1] - a[1], c[0] - a[0])), new THREE.Vector3(deck ? 0.6 : 2.2, h, deck ? 0.6 : Math.min(w * 0.6, 8)));
          piers.push(tmp.clone());
          acc += step;
        }
        acc -= seg;
      }
    }
  }
  const roadGeo = keep(rb.build("aRoad"));
  const roadMat = keep(roadMaterial());
  roadMat.clippingPlanes = opts.clip;
  const roads = new THREE.Mesh(roadGeo, roadMat);
  roads.receiveShadow = true;
  group.add(roads);
  const concrete = keep(new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.85, clippingPlanes: opts.clip }));
  const parapets = new THREE.Mesh(keep(deckB.build()), concrete);
  parapets.castShadow = true;
  parapets.receiveShadow = true;
  group.add(parapets);
  if (piers.length) {
    const pm = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1, 1, 1)), concrete, piers.length);
    piers.forEach((mm, i) => pm.setMatrixAt(i, mm));
    pm.castShadow = true;
    pm.receiveShadow = true;
    group.add(pm);
  }

  // ---------------------------------------------------------------- street lamps (their light pools on the pavement at night)
  const lampPosts: THREE.Matrix4[] = [];
  const lampHeads: THREE.Matrix4[] = [];
  const pools: THREE.Matrix4[] = [];
  for (const r of data.roads) {
    if (r.e || r.c < 1 || r.c > 4) continue;
    const w = m(r.w);
    let acc = 14;
    let side = 1;
    for (let k = 0; k + 3 < r.p.length; k += 2) {
      const ax = r.p[k]! / 10;
      const az = -r.p[k + 1]! / 10;
      const bx = r.p[k + 2]! / 10;
      const bz = -r.p[k + 3]! / 10;
      const seg = Math.hypot(bx - ax, bz - az);
      if (seg < 1e-3) continue;
      const dx = (bx - ax) / seg;
      const dz = (bz - az) / seg;
      while (acc < seg) {
        const off = side * (w / 2 + 1.0);
        const px = ax + dx * acc + dz * off;
        const pz = az + dz * acc - dx * off;
        if (px > BOUNDS.x0 + 3 && px < BOUNDS.x1 - 3 && -pz > BOUNDS.n0 + 3 && -pz < BOUNDS.n1 - 3) {
          lampPosts.push(new THREE.Matrix4().compose(new THREE.Vector3(px, 4, pz), new THREE.Quaternion(), new THREE.Vector3(0.18, 8, 0.18)));
          lampHeads.push(new THREE.Matrix4().compose(new THREE.Vector3(px - dz * off * 0.25, 8.05, pz + dx * off * 0.25), new THREE.Quaternion().setFromAxisAngle(up0, Math.atan2(-dz, dx)), new THREE.Vector3(0.9, 0.22, 0.42)));
          pools.push(new THREE.Matrix4().compose(new THREE.Vector3(px - dz * off * 0.25, 0.12, pz + dx * off * 0.25), new THREE.Quaternion(), new THREE.Vector3(15, 1, 15)));
        }
        side = -side;
        acc += 34;
      }
      acc -= seg;
    }
  }
  if (lampPosts.length) {
    const box = keep(new THREE.BoxGeometry(1, 1, 1));
    const posts = new THREE.InstancedMesh(box, keep(new THREE.MeshStandardMaterial({ color: 0x8d9195, roughness: 0.5, metalness: 0.5 })), lampPosts.length);
    lampPosts.forEach((mm, i) => posts.setMatrixAt(i, mm));
    const heads = new THREE.InstancedMesh(box, keep(nightGlow(0xffd9a0, 3.2, shared, { color: 0xb9b8b2 })), lampHeads.length);
    lampHeads.forEach((mm, i) => heads.setMatrixAt(i, mm));
    const poolTex = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const x = c.getContext("2d")!;
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(255,214,150,0.9)");
      g.addColorStop(0.45, "rgba(255,196,120,0.35)");
      g.addColorStop(1, "rgba(255,190,110,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      return keep(new THREE.CanvasTexture(c));
    })();
    const poolMat = keep(new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
    poolMat.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = shared.night;
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uNight;").replace("#include <opaque_fragment>", "diffuseColor.a *= uNight;\n#include <opaque_fragment>");
    };
    poolMat.customProgramCacheKey = () => "osaka-lamp-pool";
    const poolsMesh = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), poolMat, pools.length);
    pools.forEach((mm, i) => poolsMesh.setMatrixAt(i, mm));
    poolsMesh.renderOrder = 1;
    posts.castShadow = !opts.mobile;
    group.add(posts, heads, poolsMesh);
  }

  // ---------------------------------------------------------------- zebra crossings
  const stripes: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion();
  const up = up0;
  for (const [x, n, ang, wdm] of data.crossings) {
    const w = m(wdm);
    const px = x / 10;
    const pz = -n / 10;
    // road direction in scene: (cos ang, -sin ang); stripes run along it, stepping across the carriageway
    const dx = Math.cos(ang);
    const dz = -Math.sin(ang);
    const ax = dz;
    const az = -dx;
    q.setFromAxisAngle(up, ang);
    const count = Math.max(2, Math.floor((w - 0.8) / 0.9));
    for (let i = 0; i < count; i++) {
      const off = -((count - 1) * 0.9) / 2 + i * 0.9;
      tmp.compose(new THREE.Vector3(px + ax * off, 0.085, pz + az * off), q, new THREE.Vector3(3.6, 0.02, 0.45));
      stripes.push(tmp.clone());
    }
  }
  if (stripes.length) {
    const zm = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1, 1, 1)), keep(new THREE.MeshStandardMaterial({ color: PALETTE.roadLine, roughness: 0.8 })), stripes.length);
    stripes.forEach((mm, i) => zm.setMatrixAt(i, mm));
    zm.receiveShadow = true;
    group.add(zm);
  }

  // ---------------------------------------------------------------- buildings
  const facade = keep(facadeMaterial(shared, env));
  const cityB = new Builder(4);
  const byLm = new Map<LandmarkId, Builder>();
  const plant: THREE.Matrix4[] = [];
  const pads: THREE.Matrix4[] = [];
  for (const rec of data.buildings) {
    const rings = rec.r.map(ringXZ);
    const b = rec.lm ? (byLm.get(rec.lm) ?? byLm.set(rec.lm, new Builder(4)).get(rec.lm)!) : cityB;
    addBuilding(b, rec, rings);
    const top = m(rec.h);
    const outer = rings[0]!;
    const area = ringArea(outer);
    if (top >= 24 && area > 180 && !rec.b) {
      const ax = ringAxis(outer);
      const r = rng(Math.floor(seedOf(rec.i) * 1e6));
      if (top >= 100 && area > 650 && ax.short > 22) {
        if (pointInRing(ax.cx, ax.cz, outer)) {
          tmp.compose(new THREE.Vector3(ax.cx, top + 0.08, ax.cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, ax.yaw, "YXZ")), new THREE.Vector3(17, 17, 1));
          pads.push(tmp.clone());
        }
      } else {
        const n = Math.min(4, 1 + Math.floor(area / 600));
        for (let i = 0; i < n; i++) {
          const u = (r() - 0.5) * ax.long * 0.6;
          const v = (r() - 0.5) * ax.short * 0.6;
          const px = ax.cx + u * Math.cos(-ax.yaw) - v * Math.sin(-ax.yaw);
          const pz = ax.cz + u * Math.sin(-ax.yaw) + v * Math.cos(-ax.yaw);
          if (!pointInRing(px, pz, outer)) continue;
          const h = 1.6 + r() * 2.6;
          tmp.compose(new THREE.Vector3(px, top + h / 2, pz), new THREE.Quaternion().setFromAxisAngle(up, ax.yaw), new THREE.Vector3(2.5 + r() * 5, h, 2.5 + r() * 4));
          plant.push(tmp.clone());
        }
      }
    }
  }
  const cityMesh = facadeMesh(cityB, facade);
  keep(cityMesh.geometry);
  group.add(cityMesh);
  const landmarkMeshes = new Map<LandmarkId, THREE.Mesh>();
  for (const [lm, b] of byLm) {
    const mesh = facadeMesh(b, facade);
    keep(mesh.geometry);
    mesh.userData.landmark = lm;
    landmarkMeshes.set(lm, mesh);
    group.add(mesh);
  }
  if (plant.length) {
    const pm = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1, 1, 1)), keep(new THREE.MeshStandardMaterial({ color: 0xb4b3ad, roughness: 0.8 })), plant.length);
    plant.forEach((mm, i) => pm.setMatrixAt(i, mm));
    pm.castShadow = true;
    pm.receiveShadow = true;
    group.add(pm);
  }
  if (pads.length) {
    const pm = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(1, 1)), keep(new THREE.MeshBasicMaterial({ map: keep(helipadTexture()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })), pads.length);
    pads.forEach((mm, i) => pm.setMatrixAt(i, mm));
    group.add(pm);
  }

  // ---------------------------------------------------------------- trees
  const r = rng(1874);
  const trees = opts.mobile ? data.trees.filter((_, i) => i % 2 === 0) : data.trees;
  const crownGeo = keep(new THREE.IcosahedronGeometry(1, 1));
  const trunkGeo = keep(new THREE.CylinderGeometry(0.12, 0.18, 1, 5));
  trunkGeo.translate(0, 0.5, 0);
  const crowns = new THREE.InstancedMesh(crownGeo, keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true })), trees.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, keep(new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 1 })), trees.length);
  const greensPal = [0x5f7f4f, 0x6b8a55, 0x56764a, 0x7a9a5c, 0x68874e, 0x839f5f];
  const col = new THREE.Color();
  trees.forEach(([x, n, kind], i) => {
    const px = x / 10;
    const pz = -n / 10;
    const street = kind === 2;
    const rad = street ? 1.7 + r() * 0.7 : 2.2 + r() * 1.6;
    const h = street ? 5.5 + r() * 2 : 5 + r() * 4;
    const trunkH = street ? 2.6 : 1.8 + r();
    tmp.compose(new THREE.Vector3(px, 0, pz), new THREE.Quaternion(), new THREE.Vector3(1, trunkH, 1));
    trunks.setMatrixAt(i, tmp);
    tmp.compose(new THREE.Vector3(px, trunkH + (h - trunkH) / 2, pz), new THREE.Quaternion().setFromAxisAngle(up, r() * 6.28), new THREE.Vector3(rad, (h - trunkH) / 1.7, rad));
    crowns.setMatrixAt(i, tmp);
    col.setHex(greensPal[Math.floor(r() * greensPal.length)]!);
    if (street && r() < 0.35) col.lerp(new THREE.Color(0xb8a24a), 0.35); // late-October ginkgo just turning
    crowns.setColorAt(i, col);
  });
  crowns.castShadow = true;
  crowns.receiveShadow = true;
  trunks.castShadow = false;
  group.add(trunks, crowns);

  return {
    group,
    landmarkMeshes,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

