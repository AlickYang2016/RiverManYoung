import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { UmedaData } from "../data/types";
import { PLATFORM_ABOVE_RAIL, RAIL_TOP, ringXZ } from "../geo/frame";
import { PERIOD, type Service } from "../rail/services";
import { headAt } from "../rail/sim";
import { STOCK, type StockId } from "../rail/stock";
import type { Shared } from "./materials";

/*
 * The fleet: rolling stock modelled in Blender (scripts/osaka/blender/rolling_stock.py → assets/rolling-stock.glb), placed every
 * frame by the timetable.
 *
 * Each series comes as a cab car, a middle car, a motor car with its pantograph (electric stock) and one door leaf, every
 * surface a flat colour named for what it is. Here each model becomes one geometry with its colours in the vertices and two more
 * attributes — how much it glows at night (windows: lit interiors) and how metallic it is (stainless bodies) — and the whole
 * fleet, every car and every door leaf of every train, is drawn by one BatchedMesh: one draw call.
 *
 * A car is placed by its two bogie centres, each a point on the track path at its own arc length (and its own height: the
 * Umekita line climbs out of its tunnel); the body is the chord between them. Through a curve the bogies follow the rails and the
 * body overhangs as a real car's does; on a grade it pitches. The first car is a cab facing forward with white headlights, the
 * last a cab facing back with red tail lights; at Hankyu's terminal the train reverses and the same rule makes the old tail the
 * new head. Trains are clipped by the base's four cut faces, so they slide in out of the model's edge as on an exhibition layout.
 */

type Variant = "cab" | "mid" | "pan";

export type Models = {
  geometry: Map<string, THREE.BufferGeometry>;
  /** the right headlamp of each series' cab, car-local (the left is its mirror) */
  lamp: Map<StockId, THREE.Vector3>;
};

/** Loads the Blender rolling stock: one geometry per "<series>:<variant>" with colour, glow and metalness per vertex. */
export async function loadModels(url: string): Promise<Models> {
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const geometry = new Map<string, THREE.BufferGeometry>();
  const lamp = new Map<StockId, THREE.Vector3>();
  for (const node of gltf.scene.children) {
    const m = /^([a-z0-9]+)__(cab|mid|pan|door|lamp)$/.exec(node.name);
    if (!m) continue;
    const id = m[1] as StockId;
    if (m[2] === "lamp") {
      lamp.set(id, node.position.clone());
      continue;
    }
    const parts: THREE.BufferGeometry[] = [];
    node.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
      const n = g.getAttribute("position").count;
      const col = new Float32Array(n * 3);
      const glow = new Float32Array(n);
      const metal = new Float32Array(n);
      const name = mat.name;
      const lit = name.startsWith("glass") ? 1 : name.startsWith("cab_glass") ? 0.3 : 0;
      for (let i = 0; i < n; i++) {
        col[i * 3] = mat.color.r;
        col[i * 3 + 1] = mat.color.g;
        col[i * 3 + 2] = mat.color.b;
        glow[i] = lit;
        metal[i] = mat.metalness;
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.setAttribute("aGlow", new THREE.BufferAttribute(glow, 1));
      g.setAttribute("aMetal", new THREE.BufferAttribute(metal, 1));
      parts.push(g);
    });
    if (parts.length) geometry.set(`${id}:${m[2]}`, mergeGeometries(parts, false)!);
    for (const p of parts) p.dispose();
  }
  for (const node of gltf.scene.children) node.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  return { geometry, lamp };
}

/** Car material: vertex colours under a clear lacquer, metal where the body is stainless, windows lit at night. */
function carMaterial(shared: Shared, clip: THREE.Plane[]): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.22, clippingPlanes: clip });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = shared.night;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aGlow;\nattribute float aMetal;\nvarying float vGlow;\nvarying float vMetal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;\nvMetal = aMetal;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight;\nvarying float vGlow;\nvarying float vMetal;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = vMetal;")
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = mix(0.38, 0.3, vMetal);")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow * uNight * vec3(1.0, 0.93, 0.8) * 1.1;");
  };
  mat.customProgramCacheKey = () => "osaka-fleet";
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

export function buildFleet(services: Service[], data: UmedaData, shared: Shared, clip: THREE.Plane[], models: Models): Fleet {
  const group = new THREE.Group();
  group.name = "trains";
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => (disposables.push(x), x);

  // which cars carry a pantograph (8-car: the 3rd and the 3rd from the end); diesels have none
  const variantOf = (id: StockId, i: number, n: number): Variant =>
    i === 0 || i === n - 1 ? "cab" : (i === 2 || i === n - 3) && STOCK[id].electric ? "pan" : "mid";
  const geo = (id: StockId, v: Variant | "door") => {
    const g = models.geometry.get(`${id}:${v}`) ?? models.geometry.get(`${id}:mid`);
    if (!g) throw new Error(`no model for ${id}:${v}`);
    return g;
  };

  // one batch for every car body and door leaf of the fleet
  const used = new Set<string>();
  let instances = 0;
  for (const svc of services) {
    const s = STOCK[svc.def.stock];
    for (let i = 0; i < svc.def.cars; i++) used.add(`${s.id}:${variantOf(s.id, i, svc.def.cars)}`);
    used.add(`${s.id}:door`);
    instances += svc.def.cars * (1 + s.doors * 4);
  }
  let verts = 0;
  let index = 0;
  for (const k of used) {
    const [id, v] = k.split(":") as [StockId, Variant | "door"];
    const g = geo(id, v);
    verts += g.getAttribute("position").count;
    index += g.index!.count;
  }
  const batch = new THREE.BatchedMesh(instances, verts, index, keep(carMaterial(shared, clip)));
  batch.name = "fleet";
  batch.receiveShadow = true;
  const gid = new Map<string, number>();
  for (const k of used) {
    const [id, v] = k.split(":") as [StockId, Variant | "door"];
    gid.set(k, batch.addGeometry(geo(id, v)));
  }
  // the batch holds its own copy: the loaded models' arrays can go
  for (const g of models.geometry.values()) g.dispose();
  models.geometry.clear();
  // every service's instances, in car order: [body, its door leaves…] per car
  const slots = services.map((svc) => {
    const s = STOCK[svc.def.stock];
    return Array.from({ length: svc.def.cars }, (_, i) => ({
      body: batch.addInstance(gid.get(`${s.id}:${variantOf(s.id, i, svc.def.cars)}`)!),
      doors: Array.from({ length: s.doors * 4 }, () => batch.addInstance(gid.get(`${s.id}:door`)!)),
    }));
  });
  group.add(batch);

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

  // which side each stop's doors open on: the side a platform at the train's own level is on (both at Hankyu's terminal)
  const platforms = data.platforms.map((p) => ({ r: ringXZ(p.r[0]!), top: p.y !== undefined ? p.y / 10 : RAIL_TOP[p.op] + PLATFORM_ABOVE_RAIL }));
  const inPlatform = (x: number, z: number, rail: number) =>
    platforms.some(({ r, top }) => {
      if (Math.abs(top - PLATFORM_ABOVE_RAIL - rail) > 2.5) return false;
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
      const left = inPlatform(p.x + p.dz * 2.7, p.z - p.dx * 2.7, p.y) ? 1 : 0;
      const right = inPlatform(p.x - p.dz * 2.7, p.z + p.dx * 2.7, p.y) ? 1 : 0;
      return [left, right];
    }),
  );

  const hidden = new Set<string>();
  const m4 = new THREE.Matrix4();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const qa = new THREE.Quaternion();
  const eu = new THREE.Euler(0, 0, 0, "YZX");
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3(1, 1, 1);
  const pf = { x: 0, y: 0, z: 0, dx: 1, dz: 0 };
  const pr = { x: 0, y: 0, z: 0, dx: 1, dz: 0 };
  const leafM = new THREE.Matrix4();
  const leafL = new THREE.Matrix4();
  const noTurn = new THREE.Quaternion();
  const leafScale = new THREE.Vector3();
  const leafPos = new THREE.Vector3();
  const lead: { pos: THREE.Vector3; dir: THREE.Vector3; on: boolean }[] = services.map(() => ({ pos: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0), on: false }));

  function update(t: number): void {
    let hi = 0;
    let ti = 0;
    let bi = 0;
    services.forEach((svc, si) => {
      const s = STOCK[svc.def.stock];
      const n = svc.def.cars;
      const h = hidden.has(s.op) ? null : headAt(svc.plan, t, PERIOD);
      lead[si]!.on = !!h;
      const cars = slots[si]!;
      if (!h) {
        for (const c of cars) {
          batch.setVisibleAt(c.body, false);
          for (const d of c.doors) batch.setVisibleAt(d, false);
          blobs.setMatrixAt(bi++, zero);
        }
        for (let k = 0; k < 2; k++) {
          heads.setMatrixAt(hi++, zero);
          tails.setMatrixAt(ti++, zero);
        }
        return;
      }
      const leg = svc.plan.legs[h.leg]!;
      const [dl, dr] = doorSides[si]![h.leg]!;
      const lampAt = models.lamp.get(s.id) ?? new THREE.Vector3(s.body / 2 + 0.08, 1.45, s.width / 2 - 0.45);
      for (let i = 0; i < n; i++) {
        const c = h.s - s.pitch * i - s.pitch / 2;
        leg.path.at(c + s.bogies / 2, pf);
        leg.path.at(c - s.bogies / 2, pr);
        const dx = pf.x - pr.x;
        const dz = pf.z - pr.z;
        let yaw = Math.atan2(-dz, dx);
        let pitch = Math.atan2(pf.y - pr.y, Math.hypot(dx, dz));
        const back = i === n - 1 && n > 1;
        if (back) {
          yaw += Math.PI;
          pitch = -pitch;
        }
        qa.setFromEuler(eu.set(0, yaw, pitch));
        v.set((pf.x + pr.x) / 2, (pf.y + pr.y) / 2, (pf.z + pr.z) / 2);
        m4.compose(v, qa, sc);
        const car = cars[i]!;
        batch.setMatrixAt(car.body, m4);
        batch.setVisibleAt(car.body, true);
        if (i === 0) {
          lead[si]!.pos.copy(v);
          lead[si]!.dir.set(Math.cos(yaw), 0, -Math.sin(yaw));
        }
        // blob shadow
        leafL.compose(leafPos.set(v.x, v.y + 0.04, v.z), qa, leafScale.set(s.body + 0.8, 1, s.width + 1.2));
        blobs.setMatrixAt(bi++, leafL);
        // doors: two leaves per doorway, sliding apart by up to half the doorway each
        let d = 0;
        for (const f of s.doorAt) {
          const xd = s.body / 2 - f * s.body; // car-local: the matrix already turns the back car round
          for (const side of [-1, 1]) {
            const open = (side === -1 ? (back ? dr : dl) : back ? dl : dr) ? h.doors : 0;
            for (const lr of [-1, 1]) {
              const x = xd + lr * (s.doorWidth / 4 + open * (s.doorWidth / 2));
              leafL.compose(leafPos.set(x, 0, side * (s.width / 2 + 0.012)), noTurn, leafScale.set(s.doorWidth / 2 - 0.02, 1, 1));
              leafM.multiplyMatrices(m4, leafL);
              batch.setMatrixAt(car.doors[d]!, leafM);
              batch.setVisibleAt(car.doors[d]!, true);
              d++;
            }
          }
        }
        if (i === 0 || i === n - 1) {
          for (const side of [-1, 1]) {
            leafL.makeTranslation(lampAt.x + 0.02, lampAt.y, side * Math.abs(lampAt.z));
            leafM.multiplyMatrices(m4, leafL);
            if (i === 0) heads.setMatrixAt(hi++, leafM);
            else tails.setMatrixAt(ti++, leafM);
          }
        }
      }
      if (n === 1) for (let k = 0; k < 2; k++) tails.setMatrixAt(ti++, zero);
    });
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
      batch.dispose();
      for (const d of disposables) d.dispose();
    },
  };
}
