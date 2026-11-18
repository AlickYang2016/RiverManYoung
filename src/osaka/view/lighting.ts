import * as THREE from "three";
import { BOUNDS } from "../geo/frame";
import type { Shared } from "../scene/materials";

/*
 * Light: a low late-October sun from the south-west over Osaka (azimuth 215°, elevation 36°), soft sky light, and a studio
 * environment for the glass to catch. One shadow map covers the whole base and is redrawn only when the light changes — the city
 * stands still; the trains carry their own contact shadows.
 *
 * Night lowers the sun to a cool moon, darkens the sky light and the background, and raises uNight, which every custom material
 * reads: windows, shopfronts, platform canopies, the wheel, the train interiors.
 */

export const DAY_BG = new THREE.Color(0xe3e8eb); // 朝霧, the folio's desk
export const NIGHT_BG = new THREE.Color(0x0d141c);

/**
 * The environment the glass reflects: a sky graded from a pale horizon to a soft blue zenith over a dun ground, with the sun's
 * disc in it, so a curtain wall turns blue-grey and catches a highlight instead of mirroring a white studio.
 */
function skyEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(100, 48, 24);
  const pos = geo.getAttribute("position");
  const col = new Float32Array(pos.count * 3);
  const zenith = new THREE.Color(0x7d9fbe);
  const horizon = new THREE.Color(0xe7edf0);
  const ground = new THREE.Color(0x5d5a53);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 100;
    if (t < 0) c.copy(horizon).lerp(ground, THREE.MathUtils.smoothstep(-t, 0, 0.25));
    else c.copy(horizon).lerp(zenith, THREE.MathUtils.smoothstep(t, 0.02, 0.85));
    c.toArray(col, i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  scene.add(new THREE.Mesh(geo, skyMat));
  const sunGeo = new THREE.SphereGeometry(5, 16, 8);
  const sunMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 5) });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  const az = (215 * Math.PI) / 180;
  const el = (36 * Math.PI) / 180;
  sun.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).multiplyScalar(80);
  scene.add(sun);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  for (const d of [geo, skyMat, sunGeo, sunMat]) d.dispose();
  return tex;
}

export type Lighting = {
  setNight(target: number): void;
  /** eases toward the target; returns true while changing */
  update(dt: number): boolean;
  readonly night: number;
  dispose(): void;
};

export function createLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer, shared: Shared, opts: { shadowSize: number; shadows: boolean }): { lighting: Lighting; env: THREE.Texture } {
  const env = skyEnvironment(renderer);
  scene.environment = env;

  const hemi = new THREE.HemisphereLight(0xdce7f0, 0xa89e88, 0.8);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0db, 2.9);
  const az = (215 * Math.PI) / 180;
  const el = (36 * Math.PI) / 180;
  const cx = (BOUNDS.x0 + BOUNDS.x1) / 2;
  const cz = -(BOUNDS.n0 + BOUNDS.n1) / 2;
  // toward the sun in scene axes: east = sin(az), north = cos(az) → z = −cos(az)
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  sun.position.set(cx, 0, cz).addScaledVector(dir, 2400);
  sun.target.position.set(cx, 0, cz);
  sun.castShadow = opts.shadows;
  sun.shadow.mapSize.set(opts.shadowSize, opts.shadowSize);
  const half = Math.hypot(BOUNDS.x1 - BOUNDS.x0, BOUNDS.n1 - BOUNDS.n0) / 2 + 20;
  const sc = sun.shadow.camera;
  sc.left = -half;
  sc.right = half;
  sc.top = half;
  sc.bottom = -half;
  sc.near = 1100;
  sc.far = 3700;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.9;
  scene.add(sun, sun.target);

  scene.background = DAY_BG.clone();
  scene.fog = new THREE.Fog(DAY_BG.clone(), 4200, 10000);

  let night = 0;
  let target = 0;
  const dayCol = new THREE.Color(0xfff0db);
  const moonCol = new THREE.Color(0x9cb3d6);
  const apply = () => {
    const k = night;
    sun.intensity = THREE.MathUtils.lerp(2.9, 0.28, k);
    sun.color.copy(dayCol).lerp(moonCol, k);
    hemi.intensity = THREE.MathUtils.lerp(0.8, 0.16, k);
    hemi.color.setHex(0xdce7f0).lerp(new THREE.Color(0x2a3c58), k);
    hemi.groundColor.setHex(0xa89e88).lerp(new THREE.Color(0x14181d), k);
    scene.environmentIntensity = THREE.MathUtils.lerp(0.55, 0.05, k);
    (scene.background as THREE.Color).copy(DAY_BG).lerp(NIGHT_BG, k);
    (scene.fog as THREE.Fog).color.copy(scene.background as THREE.Color);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.0, 1.15, k);
    shared.night.value = k;
    renderer.shadowMap.needsUpdate = true;
  };
  apply();

  return {
    env,
    lighting: {
      setNight(t) {
        target = t;
      },
      update(dt) {
        if (Math.abs(target - night) < 1e-3) {
          if (night !== target) {
            night = target;
            apply();
          }
          return false;
        }
        night += Math.sign(target - night) * Math.min(Math.abs(target - night), dt / 1.4);
        apply();
        return true;
      },
      get night() {
        return night;
      },
      dispose() {
        env.dispose();
        sun.dispose();
        hemi.dispose();
      },
    },
  };
}
