import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { UmedaData } from "../data/types";
import { RAIL_TOP, ringXZ } from "../geo/frame";
import { PERIOD, type Service } from "../rail/services";
import { headAt } from "../rail/sim";
import { STOCK, type Stock, type StockId } from "../rail/stock";
import { PALETTE, type Shared } from "./materials";

/*
 * Rolling stock, drawn in code from each series' published dimensions, and the fleet that places it every frame.
 *
 * A car is one merged geometry with vertex colours (body bands at the heights the livery puts them, windows, cab panels, roof
 * equipment, bogies) in three variants — cab, middle, pantograph car — instanced per series, so the whole fleet is a dozen draw
 * calls. Door leaves are their own instances so they can slide.
 *
 * A car is placed by its two bogie centres, each a point on the track path at its own arc length; the body is the chord between
 * them. Through a curve the bogies follow the rails and the body overhangs as a real car's does; consecutive cars keep their
 * coupler gap. The first car is a cab facing forward with white headlights, the last a cab facing back with red tail lights; at
 * Hankyu's terminal the train reverses and the same rule makes the old tail the new head.
 *
 * Trains are clipped by the base's four cut faces, so they slide in out of the model's edge as on an exhibition layout.
 */

type Variant = "cab" | "mid" | "pan";

type Livery = {
  body: number;
  /** horizontal colour bands on the sides: [y0, y1, colour] (rail top = 0) */
  bands: [number, number, number][];
  roof: number;
  face: number; // the cab's lower front
  faceTop: number; // the cab's top cap
  door: number;
  accent?: number;
  metal: number;
};

const LIVERY: Record<StockId, Livery> = {
  hankyu1000: { body: PALETTE.hankyuMaroon, bands: [[3.12, 3.42, PALETTE.hankyuIvory]], roof: 0x8d8f91, face: PALETTE.hankyuMaroon, faceTop: PALETTE.hankyuIvory, door: PALETTE.hankyuMaroon, metal: 0.1 },
  hankyu1300: { body: PALETTE.hankyuMaroon, bands: [[3.12, 3.42, PALETTE.hankyuIvory]], roof: 0x8d8f91, face: PALETTE.hankyuMaroon, faceTop: PALETTE.hankyuIvory, door: PALETTE.hankyuMaroon, metal: 0.1 },
  jr323: { body: PALETTE.stainless, bands: [[2.92, 3.1, PALETTE.loopOrange]], roof: 0x9a9da0, face: 0x1d1f22, faceTop: PALETTE.loopOrange, door: PALETTE.stainless, accent: PALETTE.loopOrange, metal: 0.55 },
  jr225: { body: PALETTE.stainless, bands: [[1.8, 1.95, PALETTE.rapidBlue], [1.68, 1.8, PALETTE.rapidBrown]], roof: 0x9a9da0, face: 0xc9ccd0, faceTop: 0x1d1f22, door: PALETTE.stainless, accent: PALETTE.rapidBlue, metal: 0.55 },
};

const GLASS = 0x1e2328;
const UNDER = 0x2e3134;
const FLOOR = 1.08; // body bottom above the rail
const WIN0 = 1.98;
const WIN1 = 2.86;

/** Adds the colour and night-glow attributes to a part and makes it non-indexed (so parts merge). */
function part(g: THREE.BufferGeometry, color: number, glow = 0): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute("uv");
  const n = ng.getAttribute("position").count;
  const c = new THREE.Color(color);
  const col = new Float32Array(n * 3);
  const gl = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    gl[i] = glow;
  }
  ng.setAttribute("color", new THREE.BufferAttribute(col, 3));
  ng.setAttribute("aGlow", new THREE.BufferAttribute(gl, 1));
  return ng;
}

const boxAt = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);

const RAKE = 0.16; // the cab front leans back this much per metre above the waist
const WAIST = 1.9;

/** Inserts a vertex wherever the profile crosses one of the heights `ys`, so livery bands get crisp edges. */
function splitAt(profile: [number, number][], ys: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i]!;
    out.push(a);
    const b = profile[i + 1];
    if (!b) continue;
    const cross = ys.filter((y) => (y - a[1]) * (y - b[1]) < 0).sort((p, q) => (b[1] > a[1] ? p - q : q - p));
    for (const y of cross) {
      const t = (y - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, y]);
    }
  }
  return out;
}

/** The body: the cross-section extruded along the car, each face coloured by the livery band its middle falls in. */
function bodyShell(s: Stock, lv: Livery, cab: boolean): THREE.BufferGeometry {
  const hw = s.width / 2;
  const H = s.height;
  const bandYs = lv.bands.flatMap(([a, b]) => [a, b]);
  const right = splitAt(
    [
      [hw - 0.08, FLOOR],
      [hw, FLOOR + 0.16],
      [hw, 3.12],
      [hw - 0.07, 3.36],
      [hw - 0.28, H - 0.16],
      [hw - 0.7, H - 0.04],
      [hw - 1.15, H],
    ],
    bandYs,
  );
  const pts = [...right, ...right.map(([z, y]) => [-z, y] as [number, number]).reverse()];
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: s.body, bevelEnabled: false, steps: 1 });
  // extruded along +z from 0: centre it and turn it so the car runs along +x
  g.translate(0, 0, -s.body / 2);
  g.rotateY(Math.PI / 2);
  if (cab) {
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) if (p.getX(i) > s.body / 2 - 0.01 && p.getY(i) > WAIST) p.setX(i, p.getX(i) - (p.getY(i) - WAIST) * RAKE);
  }
  const ng = g.toNonIndexed();
  g.dispose();
  ng.deleteAttribute("uv");
  ng.computeVertexNormals();
  const pos = ng.getAttribute("position");
  const nrm = ng.getAttribute("normal");
  const roofFrom = Math.max(3.3, ...lv.bands.map((b) => b[1]));
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let f = 0; f < n; f += 3) {
    const y = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    const end = Math.abs(nrm.getX(f)) > 0.6; // the car's two end faces
    let hex = lv.body;
    if (!end) for (const [a, b, h] of lv.bands) if (y >= a && y <= b) hex = h;
    if (y > roofFrom || (!end && nrm.getY(f) > 0.6)) hex = lv.roof;
    c.setHex(hex);
    for (let k = 0; k < 3; k++) {
      col[(f + k) * 3] = c.r;
      col[(f + k) * 3 + 1] = c.g;
      col[(f + k) * 3 + 2] = c.b;
    }
  }
  ng.setAttribute("color", new THREE.BufferAttribute(col, 3));
  ng.setAttribute("aGlow", new THREE.BufferAttribute(new Float32Array(n), 1));
  return ng;
}

/** A panel on the raked cab front, centred at height y (h tall, w wide), leaning with the face. */
function onFace(s: Stock, y: number, h: number, w: number, color: number, glow = 0, proud = 0.03): THREE.BufferGeometry {
  const lean = y > WAIST ? Math.atan(RAKE) : 0;
  const x = s.body / 2 - Math.max(0, y - WAIST) * RAKE + proud;
  return part(new THREE.BoxGeometry(0.05, h, w).rotateZ(lean).translate(x, y, 0), color, glow);
}

function carGeometry(s: Stock, variant: Variant): THREE.BufferGeometry {
  const lv = LIVERY[s.id];
  const L = s.body;
  const hw = s.width / 2;
  const parts: THREE.BufferGeometry[] = [bodyShell(s, lv, variant === "cab")];
  // windows between the doors, both sides (glass glows at night: lit interiors)
  const doorsX = s.doorAt.map((f) => L / 2 - f * L);
  const edges = [L / 2 - (variant === "cab" ? 2.4 : 0.9), ...doorsX.flatMap((x) => [x + s.doorWidth / 2 + 0.35, x - s.doorWidth / 2 - 0.35]), -L / 2 + 0.9];
  for (let k = 0; k + 1 < edges.length; k += 2) {
    const x0 = edges[k]!;
    const x1 = edges[k + 1]!;
    if (x0 - x1 < 0.6) continue;
    for (const side of [-1, 1]) parts.push(part(boxAt(x0 - x1, WIN1 - WIN0, 0.04, (x0 + x1) / 2, (WIN0 + WIN1) / 2, side * (hw + 0.005)), GLASS, 1));
  }
  // door openings (dark; the leaves slide over the body to reveal them)
  for (const x of doorsX) for (const side of [-1, 1]) parts.push(part(boxAt(s.doorWidth, 1.95, 0.03, x, FLOOR + 0.12 + 0.975, side * (hw - 0.005)), 0x15171a, 1));
  if (lv.accent && s.id === "jr323") for (const x of doorsX) for (const side of [-1, 1]) parts.push(part(boxAt(s.doorWidth + 0.5, 2.05, 0.03, x, FLOOR + 0.1 + 1.0, side * (hw - 0.015)), lv.accent));
  // cab: windscreen, lower face, top cap, coupler and skirt
  if (variant === "cab") {
    const fx = L / 2;
    parts.push(onFace(s, 2.47, 1.08, s.width - 0.5, GLASS, 0.4));
    parts.push(onFace(s, 1.5, 0.84, s.width - 0.16, lv.face));
    parts.push(onFace(s, 3.17, 0.24, s.width - 0.62, lv.faceTop));
    if (s.id === "jr225") parts.push(part(boxAt(0.5, 0.75, s.width - 0.3, fx + 0.25, 1.45, 0), PALETTE.stainless)); // the 225's crash-absorbing nose
    parts.push(part(boxAt(0.4, 0.3, 1.6, fx + 0.2, 0.95, 0), UNDER));
  }
  // underfloor equipment and bogies
  parts.push(part(boxAt(L - 7.2, 0.5, s.width - 0.5, 0, FLOOR - 0.28, 0), UNDER));
  for (const bx of [s.bogies / 2, -s.bogies / 2]) {
    parts.push(part(boxAt(2.7, 0.36, 2.0, bx, 0.62, 0), 0x26282b));
    for (const ax of [-1.05, 1.05])
      for (const side of [-1, 1]) {
        const wheel = new THREE.CylinderGeometry(0.43, 0.43, 0.13, 10).rotateX(Math.PI / 2).translate(bx + ax, 0.43, side * (s.op === "hankyu" ? 0.72 : 0.54));
        parts.push(part(wheel, 0x3a3c3f));
      }
  }
  // roof: air-conditioning units; a single-arm pantograph reaching the 5.1 m contact wire on the motor cars
  if (s.op === "hankyu") parts.push(part(boxAt(L - 5.5, 0.32, 1.7, 0, s.height + 0.12, 0), 0xa3a5a7));
  else for (const x of [L * 0.22, -L * 0.22]) parts.push(part(boxAt(3.2, 0.36, 1.9, x, s.height + 0.14, 0), 0xa9acae));
  if (variant === "pan") {
    const px = L * 0.36;
    const top = s.height;
    parts.push(part(boxAt(1.4, 0.18, 1.3, px, top + 0.12, 0), 0x3c3f42));
    const lower = boxAt(1.25, 0.07, 0.07, 0, 0, 0).rotateZ(0.62).translate(px - 0.45, top + 0.6, 0);
    const upper = boxAt(1.2, 0.06, 0.06, 0, 0, 0).rotateZ(-0.55).translate(px - 0.35, top + 1.0 + 0.2, 0);
    parts.push(part(lower, 0x55595d), part(upper, 0x55595d), part(boxAt(0.12, 0.05, 1.7, px - 0.86, 5.05, 0), 0x2b2d30));
  }
  const g = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return g;
}

/** Car material: vertex colours, a little clear lacquer, windows lit at night through aGlow. */
function carMaterial(lv: Livery, shared: Shared, clip: THREE.Plane[]): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: lv.metal > 0.3 ? 0.32 : 0.38, metalness: lv.metal, clearcoat: lv.metal > 0.3 ? 0.2 : 0.7, clearcoatRoughness: 0.2, clippingPlanes: clip });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = shared.night;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aGlow;\nvarying float vGlow;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight;\nvarying float vGlow;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow * uNight * vec3(1.0, 0.93, 0.8) * 1.1;");
  };
  mat.customProgramCacheKey = () => `osaka-car-${lv.body}-${lv.metal}`;
  return mat;
}

export type Fleet = {
  group: THREE.Group;
  update(t: number): void;
  /** where a service's leading car is (for "follow this train"), or null while it is off the base */
  pose(i: number, out: { pos: THREE.Vector3; dir: THREE.Vector3 }): boolean;
  setVisible(op: "jr" | "hankyu", on: boolean): void;
  dispose(): void;
};

export function buildFleet(services: Service[], data: UmedaData, shared: Shared, clip: THREE.Plane[]): Fleet {
  const group = new THREE.Group();
  group.name = "trains";
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => (disposables.push(x), x);

  // which cars carry a pantograph (Hankyu 8-car: the 2nd and 7th; JR: the 3rd and the 3rd from the end)
  const variantOf = (i: number, n: number): Variant => (i === 0 || i === n - 1 ? "cab" : i === 2 || i === n - 3 ? "pan" : "mid");

  type Bucket = { mesh: THREE.InstancedMesh; next: number };
  const buckets = new Map<string, Bucket>();
  const doorBuckets = new Map<StockId, Bucket>();
  const count = new Map<string, number>();
  const doorCount = new Map<StockId, number>();
  for (const svc of services) {
    const s = STOCK[svc.def.stock];
    for (let i = 0; i < svc.def.cars; i++) {
      const k = `${s.id}:${variantOf(i, svc.def.cars)}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    doorCount.set(s.id, (doorCount.get(s.id) ?? 0) + svc.def.cars * s.doors * 4);
  }
  const mats = new Map<StockId, THREE.Material>();
  for (const [k, n] of count) {
    const [id, variant] = k.split(":") as [StockId, Variant];
    const s = STOCK[id];
    const mat = mats.get(id) ?? keep(carMaterial(LIVERY[id], shared, clip));
    mats.set(id, mat);
    const mesh = new THREE.InstancedMesh(keep(carGeometry(s, variant)), mat, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.op = s.op;
    group.add(mesh);
    buckets.set(k, { mesh, next: 0 });
  }
  for (const [id, n] of doorCount) {
    const s = STOCK[id];
    const lv = LIVERY[id];
    // a door leaf: body colour below, a tall window above
    const leaf = mergeGeometries([part(new THREE.BoxGeometry(1, 1, 1), lv.door), part(boxAt(0.62, 0.42, 1.1, 0, 0.2, 0), GLASS, 1)], false)!;
    const mesh = new THREE.InstancedMesh(keep(leaf), mats.get(id)!, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.userData.op = s.op;
    group.add(mesh);
    doorBuckets.set(id, { mesh, next: 0 });
  }
  // lamps: unlit, always bright (Japanese trains run with their headlights on by day too)
  const lampGeo = keep(new THREE.BoxGeometry(0.06, 0.2, 0.34));
  const heads = new THREE.InstancedMesh(lampGeo, keep(new THREE.MeshBasicMaterial({ color: 0xfff6dc, clippingPlanes: clip })), services.length * 2);
  const tails = new THREE.InstancedMesh(lampGeo, keep(new THREE.MeshBasicMaterial({ color: 0xff2a1a, clippingPlanes: clip })), services.length * 2);
  for (const im of [heads, tails]) {
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    group.add(im);
  }
  // a soft contact shadow under each car (cars do not cast into the city's shadow map)
  const blobTex = (() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 16;
    const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 0, 0, 16);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.5, "rgba(0,0,0,0.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 16);
    return keep(new THREE.CanvasTexture(c));
  })();
  const totalCars = services.reduce((a, s) => a + s.def.cars, 0);
  const blobs = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), keep(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.55, clippingPlanes: clip })), totalCars);
  blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  blobs.frustumCulled = false;
  group.add(blobs);

  // which side each stop's doors open on: the side a platform is on (both at Hankyu's terminal, which has platforms either side)
  const platforms = data.platforms.map((p) => ringXZ(p.r[0]!));
  const inPlatform = (x: number, z: number) =>
    platforms.some((r) => {
      let inside = false;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const a = r[i]!;
        const b = r[j]!;
        if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1] || 1e-9) + a[0]) inside = !inside;
      }
      return inside;
    });
  const doorSides = services.map((svc) =>
    svc.plan.legs.map((leg) => {
      if (leg.stop === null) return [0, 0];
      const p = leg.path.at(leg.stop - svc.plan.trainLength / 2);
      const left = inPlatform(p.x + p.dz * 2.7, p.z - p.dx * 2.7) ? 1 : 0;
      const right = inPlatform(p.x - p.dz * 2.7, p.z + p.dx * 2.7) ? 1 : 0;
      return [left, right];
    }),
  );

  const hidden = new Set<string>();
  const m4 = new THREE.Matrix4();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const qa = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3(1, 1, 1);
  const pf = { x: 0, z: 0, dx: 1, dz: 0 };
  const pr = { x: 0, z: 0, dx: 1, dz: 0 };
  const leafM = new THREE.Matrix4();
  const leafL = new THREE.Matrix4();
  const lead: { pos: THREE.Vector3; dir: THREE.Vector3; on: boolean }[] = services.map(() => ({ pos: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0), on: false }));

  function update(t: number): void {
    for (const b of buckets.values()) b.next = 0;
    for (const b of doorBuckets.values()) b.next = 0;
    let hi = 0;
    let ti = 0;
    let bi = 0;
    services.forEach((svc, si) => {
      const s = STOCK[svc.def.stock];
      const n = svc.def.cars;
      const h = hidden.has(s.op) ? null : headAt(svc.plan, t, PERIOD);
      lead[si]!.on = !!h;
      const doorB = doorBuckets.get(s.id)!;
      if (!h) {
        for (let i = 0; i < n; i++) {
          const b = buckets.get(`${s.id}:${variantOf(i, n)}`)!;
          b.mesh.setMatrixAt(b.next++, zero);
          blobs.setMatrixAt(bi++, zero);
          for (let k = 0; k < s.doors * 4; k++) doorB.mesh.setMatrixAt(doorB.next++, zero);
        }
        for (let k = 0; k < 2; k++) {
          heads.setMatrixAt(hi++, zero);
          tails.setMatrixAt(ti++, zero);
        }
        return;
      }
      const leg = svc.plan.legs[h.leg]!;
      const y = RAIL_TOP[s.op];
      const [dl, dr] = doorSides[si]![h.leg]!;
      for (let i = 0; i < n; i++) {
        const c = h.s - s.pitch * i - s.pitch / 2;
        leg.path.at(c + s.bogies / 2, pf);
        leg.path.at(c - s.bogies / 2, pr);
        const dx = pf.x - pr.x;
        const dz = pf.z - pr.z;
        let yaw = Math.atan2(-dz, dx);
        const variant = variantOf(i, n);
        const back = i === n - 1 && n > 1;
        if (back) yaw += Math.PI;
        qa.setFromAxisAngle(up, yaw);
        v.set((pf.x + pr.x) / 2, y, (pf.z + pr.z) / 2);
        m4.compose(v, qa, sc);
        const b = buckets.get(`${s.id}:${variant}`)!;
        b.mesh.setMatrixAt(b.next++, m4);
        if (i === 0) {
          lead[si]!.pos.copy(v);
          lead[si]!.dir.set(Math.cos(yaw), 0, -Math.sin(yaw));
        }
        // blob shadow
        leafL.compose(new THREE.Vector3(v.x, y + 0.04, v.z), qa, new THREE.Vector3(s.body + 0.8, 1, s.width + 1.2));
        blobs.setMatrixAt(bi++, leafL);
        // doors: two leaves per doorway, sliding apart by up to half the doorway each
        for (const f of s.doorAt) {
          const xd = s.body / 2 - f * s.body; // car-local: the matrix already turns the back car round
          for (const side of [-1, 1]) {
            const open = (side === -1 ? (back ? dr : dl) : back ? dl : dr) ? h.doors : 0;
            for (const lr of [-1, 1]) {
              const x = xd + lr * (s.doorWidth / 4 + open * (s.doorWidth / 2));
              leafL.compose(new THREE.Vector3(x, FLOOR + 0.12 + 0.975, side * (s.width / 2 + 0.012)), new THREE.Quaternion(), new THREE.Vector3(s.doorWidth / 2 - 0.02, 1.95, 0.025));
              leafM.multiplyMatrices(m4, leafL);
              doorB.mesh.setMatrixAt(doorB.next++, leafM);
            }
          }
        }
        if (i === 0 || i === n - 1) {
          for (const side of [-1, 1]) {
            leafL.makeTranslation(s.body / 2 + 0.08, 1.45, side * (s.width / 2 - 0.45));
            leafM.multiplyMatrices(m4, leafL);
            if (i === 0) heads.setMatrixAt(hi++, leafM);
            else tails.setMatrixAt(ti++, leafM);
          }
        }
      }
      if (n === 1) for (let k = 0; k < 2; k++) tails.setMatrixAt(ti++, zero);
    });
    for (const b of buckets.values()) {
      b.mesh.instanceMatrix.needsUpdate = true;
      b.mesh.count = b.next;
    }
    for (const b of doorBuckets.values()) {
      b.mesh.instanceMatrix.needsUpdate = true;
      b.mesh.count = b.next;
    }
    heads.instanceMatrix.needsUpdate = true;
    tails.instanceMatrix.needsUpdate = true;
    blobs.instanceMatrix.needsUpdate = true;
    heads.count = hi;
    tails.count = ti;
    blobs.count = bi;
  }

  return {
    group,
    update,
    pose(i, out) {
      const l = lead[i];
      if (!l?.on) return false;
      out.pos.copy(l.pos);
      out.dir.copy(l.dir);
      return true;
    },
    setVisible(op, on) {
      if (on) hidden.delete(op);
      else hidden.add(op);
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
