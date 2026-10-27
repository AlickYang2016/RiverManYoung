import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BOUNDS } from "../geo/frame";
import { sceneTarget, type View } from "../content";

/*
 * The camera: a long lens (a narrow field of view from far away, so the city reads almost as an axonometric model), orbit /
 * pan / zoom with damping, kept above the base and pointed at it. Flights between views ease the target, the log of the
 * distance and the shortest way round in azimuth together, so a long flight neither swings wide nor dives through a tower. With
 * reduced motion a flight is a cut.
 *
 * Following a train moves the camera with it, by the same step as the train, so the visitor can still orbit around it.
 */

export type Rig = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  /** advances flights and following; returns true while the camera is moving */
  update(dt: number): boolean;
  fly(view: View, seconds: number): Promise<void>;
  cut(view: View): void;
  follow(target: (() => THREE.Vector3 | null) | null): void;
  cancel(): void;
  get flying(): boolean;
  resize(w: number, h: number): void;
  dispose(): void;
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function createRig(dom: HTMLElement, opts: { reducedMotion: boolean; interactive: boolean }): Rig {
  const camera = new THREE.PerspectiveCamera(26, 1, 2, 12000);
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 22;
  controls.maxDistance = 4200;
  controls.minPolarAngle = 0.06;
  controls.maxPolarAngle = 1.36;
  controls.zoomSpeed = 0.9;
  controls.rotateSpeed = 0.55;
  controls.panSpeed = 0.9;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.enabled = opts.interactive;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  let flight: { from: View; to: View; t: number; dur: number; done: () => void } | null = null;
  let following: (() => THREE.Vector3 | null) | null = null;
  const prevFollow = new THREE.Vector3();
  let hasPrev = false;
  let jump = false; // fly to the train when it is (back) on the base

  const current = (): View => {
    const off = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    return { target: [controls.target.x, controls.target.y, -controls.target.z], distance: sph.radius, azimuth: sph.theta, polar: sph.phi };
  };
  const apply = (v: View) => {
    const t = sceneTarget(v);
    controls.target.set(t[0], t[1], t[2]);
    camera.position.setFromSpherical(new THREE.Spherical(v.distance, v.polar, v.azimuth)).add(controls.target);
    camera.lookAt(controls.target);
  };
  const clampTarget = () => {
    const t = controls.target;
    const x = THREE.MathUtils.clamp(t.x, BOUNDS.x0, BOUNDS.x1);
    const z = THREE.MathUtils.clamp(t.z, -BOUNDS.n1, -BOUNDS.n0);
    const y = THREE.MathUtils.clamp(t.y, 0, 180);
    if (x !== t.x || y !== t.y || z !== t.z) {
      camera.position.x += x - t.x;
      camera.position.y += y - t.y;
      camera.position.z += z - t.z;
      t.set(x, y, z);
    }
  };
  const planes = () => {
    const d = camera.position.distanceTo(controls.target);
    camera.near = THREE.MathUtils.clamp(d * 0.012, 0.4, 40);
    camera.far = d * 3 + 4500;
    camera.updateProjectionMatrix();
  };

  return {
    camera,
    controls,
    update(dt) {
      let moving = false;
      if (flight) {
        flight.t += dt;
        const k = ease(Math.min(1, flight.t / flight.dur));
        const a = flight.from;
        const b = flight.to;
        apply({
          target: [a.target[0] + (b.target[0] - a.target[0]) * k, a.target[1] + (b.target[1] - a.target[1]) * k, a.target[2] + (b.target[2] - a.target[2]) * k],
          distance: Math.exp(Math.log(a.distance) + (Math.log(b.distance) - Math.log(a.distance)) * k),
          azimuth: a.azimuth + wrap(b.azimuth - a.azimuth) * k,
          polar: a.polar + (b.polar - a.polar) * k,
        });
        moving = true;
        if (flight.t >= flight.dur) {
          const done = flight.done;
          flight = null;
          controls.update();
          done();
        }
      } else {
        if (following) {
          const p = following();
          if (!p) {
            hasPrev = false;
            jump = true;
          } else if (jump) {
            jump = false;
            const v = current();
            flight = { from: v, to: { target: [p.x, p.y + 2, -p.z], distance: Math.min(v.distance, 150), azimuth: v.azimuth, polar: Math.min(v.polar, 1.12) }, t: 0, dur: opts.reducedMotion ? 1e-3 : 1.6, done: () => {} };
          } else {
            if (hasPrev) {
              const dx = p.x - prevFollow.x;
              const dy = p.y - prevFollow.y;
              const dz = p.z - prevFollow.z;
              controls.target.x += dx;
              controls.target.y += dy;
              controls.target.z += dz;
              camera.position.x += dx;
              camera.position.y += dy;
              camera.position.z += dz;
              moving = moving || Math.abs(dx) + Math.abs(dz) > 1e-4;
            }
            prevFollow.copy(p);
            hasPrev = true;
          }
        }
        moving = controls.update(dt) || moving;
        clampTarget();
      }
      planes();
      return moving;
    },
    fly(view, seconds) {
      this.cancel();
      if (opts.reducedMotion || seconds <= 0) {
        apply(view);
        controls.update();
        planes();
        return Promise.resolve();
      }
      return new Promise<void>((done) => {
        flight = { from: current(), to: view, t: 0, dur: seconds, done };
      });
    },
    cut(view) {
      this.cancel();
      apply(view);
      controls.update();
      planes();
    },
    follow(fn) {
      // close in on the train at a railway photographer's angle (keeping the visitor's azimuth) whenever it is on the base
      this.cancel();
      following = fn;
      hasPrev = false;
      jump = !!fn;
    },
    cancel() {
      if (flight) {
        const done = flight.done;
        flight = null;
        controls.update();
        done();
      }
    },
    get flying() {
      return !!flight;
    },
    resize(w, h) {
      camera.aspect = w / Math.max(1, h);
      // a narrow screen gets a wider lens so the district still fits across it
      camera.fov = camera.aspect < 0.8 ? 34 : 26;
      // on a desk the words column takes the left: draw the model centred in the room to its right
      if (w >= 900) camera.setViewOffset(w, h, -Math.min(190, w * 0.12), 0, w, h);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    },
    dispose() {
      controls.dispose();
    },
  };
}
