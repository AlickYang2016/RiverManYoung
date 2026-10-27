import * as THREE from "three";
import dataUrl from "./data/umeda.json?url";
import type { LandmarkId, Operator, UmedaData } from "./data/types";
import { BOUNDS } from "./geo/frame";
import { HOME, HOME_PHONE, INTRO, LANDMARKS, sceneTarget, type View } from "./content";
import { PERIOD, resolve } from "./rail/services";
import { STOCK } from "./rail/stock";
import { buildCity } from "./scene/city";
import { buildLandmarks } from "./scene/landmarks";
import { createShared, LANDMARK_INDEX } from "./scene/materials";
import { buildTrack, railIndex } from "./scene/track";
import { buildFleet } from "./scene/trains";
import { createRig } from "./view/camera";
import { createLighting } from "./view/lighting";

/*
 * The Osaka-Umeda miniature: one function that builds the whole thing into a host element and hands back a small control surface.
 *
 *   const osaka = await createOsaka(host, { mode: "explore", reducedMotion, intro: true, onSelect, onLabel });
 *   osaka.setNight(true); osaka.focus("hep-five"); osaka.setSpeed(2); osaka.dispose();
 *
 * Two modes. "showcase" is the preview for a home page: the camera turns slowly round the district, nothing to click. "explore" is
 * the full page: orbit, pan, zoom, pick a landmark, follow a train, day and night.
 *
 * The simulation clock is simulated seconds (speed × wall time while playing); trains, doors and the wheel are pure functions
 * of it, so the picture does not depend on the frame rate. Frames are drawn only while something moves — a paused, untouched model
 * draws nothing — and not at all in a hidden tab.
 *
 * Quality adapts to the device: phones start at a lower pixel ratio, a smaller shadow map and half the trees; after the first two
 * seconds of continuous drawing the measured frame time steps the pixel ratio down (and, last, the shadows off) until it holds.
 */

export type OsakaMode = "showcase" | "explore";

export type Stats = { fps: number; ms: number; calls: number; triangles: number; pixelRatio: number; shadows: boolean; level: number };

export type ServiceInfo = { index: number; id: string; label: string; labelJa: string; op: Operator; stock: string; cars: number };

/** Whether a service's train is on the base now, and if not, in how many seconds (wall time, at the current speed) it comes. */
export type TrainStatus = { index: number; onBase: boolean; nextIn: number };

export type OsakaOptions = {
  mode: OsakaMode;
  reducedMotion: boolean;
  intro: boolean;
  onProgress?(p: number, what: string): void;
  onSelect?(id: LandmarkId | null): void;
  /** where the selected landmark's label goes, in CSS px from the host's top left (called every drawn frame) */
  onLabel?(x: number, y: number, visible: boolean): void;
  onStats?(s: Stats): void;
  onIntroEnd?(): void;
};

export type OsakaHandle = {
  setNight(on: boolean): void;
  setPlaying(on: boolean): void;
  setSpeed(x: number): void;
  setOperatorVisible(op: Operator, on: boolean): void;
  focus(id: LandmarkId | null): void;
  follow(service: number | null): void;
  resetView(): void;
  playIntro(): Promise<void>;
  skipIntro(): void;
  services: ServiceInfo[];
  trains(): TrainStatus[];
  dropped: { id: string; why: string }[];
  stats(): Stats;
  dispose(): void;
};

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

/** Yields to the browser between build stages; a background tab draws no frames, so a timer stands in for the frame there. */
const nextFrame = () =>
  new Promise<void>((r) => {
    const t = setTimeout(r, 50);
    requestAnimationFrame(() => (clearTimeout(t), r()));
  });

export async function createOsaka(host: HTMLElement, opts: OsakaOptions): Promise<OsakaHandle> {
  if (!webglAvailable()) throw new Error("webgl2 unavailable");
  const phone = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 820;
  const progress = opts.onProgress ?? (() => {});

  progress(0.05, "map data");
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error(`the district's data did not load (${res.status})`);
  const data = (await res.json()) as UmedaData;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: false });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.localClippingEnabled = true;
  const canvas = renderer.domElement;
  canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none";
  canvas.setAttribute("aria-label", "A 3D miniature of Osaka-Umeda with moving trains");
  canvas.tabIndex = 0;
  host.append(canvas);

  const scene = new THREE.Scene();
  const shared = createShared();
  // the base's four cut faces: trains, track and roads end there as on an exhibition layout's section
  const clip = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -BOUNDS.x0),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), BOUNDS.x1),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), BOUNDS.n1),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), -BOUNDS.n0),
  ];
  // glass and paint reflect the scene's sky environment (scene.environment, dimmed at night), so no material carries its own
  const { lighting } = createLighting(scene, renderer, shared, { shadowSize: phone ? 2048 : 4096, shadows: true });

  progress(0.2, "streets and buildings");
  await nextFrame();
  const city = buildCity(data, shared, null, { mobile: phone, clip });
  scene.add(city.group);

  progress(0.45, "stations and landmarks");
  await nextFrame();
  const nearRail = railIndex(data);
  const landmarks = buildLandmarks(data, shared, null, nearRail);
  scene.add(landmarks.group);

  progress(0.6, "track");
  await nextFrame();
  const track = buildTrack(data, shared, { mobile: phone, insideStation: landmarks.insideStation, clip });
  scene.add(track.group);

  progress(0.75, "timetable and trains");
  await nextFrame();
  const resolved = resolve(data);
  if (resolved.dropped.length) console.warn("[osaka] services left out:", resolved.dropped);
  const fleet = buildFleet(resolved.services, data, shared, clip);
  scene.add(fleet.group);

  // ---------------------------------------------------------------- camera
  const rig = createRig(canvas, { reducedMotion: opts.reducedMotion, interactive: opts.mode === "explore" });
  const home = (): View => (host.clientWidth / Math.max(1, host.clientHeight) < 0.8 ? HOME_PHONE : HOME);
  if (opts.mode === "showcase") {
    rig.controls.autoRotate = !opts.reducedMotion;
    rig.controls.autoRotateSpeed = 0.28;
  }
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    rig.resize(w, h);
    dirty = true;
  };
  let dirty = true;
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  rig.cut(opts.intro && !opts.reducedMotion ? INTRO[0]!.view : home());

  progress(0.9, "first light");
  await nextFrame();
  renderer.shadowMap.needsUpdate = true;
  renderer.compile(scene, rig.camera);

  // ---------------------------------------------------------------- state
  let simT = 9 * 60; // start nine minutes into the timetable, so every service is already somewhere
  let playing = !opts.reducedMotion || opts.mode === "showcase" ? true : false;
  let speed = 1;
  let selected: LandmarkId | null = null;
  let hovered: LandmarkId | null = null;
  let intro: { cancelled: boolean } | null = null;
  let level = 0; // quality steps taken
  let lastShadow = 0;
  const shown = { jr: true, hankyu: true };
  const ops = (stock: keyof typeof STOCK) => shown[STOCK[stock].op];
  fleet.update(simT);

  const setHighlight = () => {
    const id = hovered ?? selected;
    shared.highlight.value = id ? LANDMARK_INDEX[id]! : 0;
    dirty = true;
  };

  // ---------------------------------------------------------------- picking
  const pickables: THREE.Object3D[] = [...city.landmarkMeshes.values(), ...landmarks.pickables];
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pick = (e: PointerEvent): LandmarkId | null => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, rig.camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return (hit?.object.userData.landmark as LandmarkId | undefined) ?? null;
  };
  let down: { x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (intro) handle.skipIntro();
  };
  const onUp = (e: PointerEvent) => {
    if (!down || opts.mode !== "explore") return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    down = null;
    if (moved < 6 && quick) handle.focus(pick(e));
  };
  let lastHover = 0;
  const onMove = (e: PointerEvent) => {
    if (opts.mode !== "explore" || e.pointerType !== "mouse" || e.buttons) return;
    const now = performance.now();
    if (now - lastHover < 90) return;
    lastHover = now;
    const id = pick(e);
    if (id !== hovered) {
      hovered = id;
      canvas.style.cursor = id ? "pointer" : "";
      setHighlight();
    }
  };
  const onLeave = () => {
    if (hovered) {
      hovered = null;
      canvas.style.cursor = "";
      setHighlight();
    }
  };
  const skipOnInput = () => {
    if (intro) handle.skipIntro();
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", skipOnInput, { passive: true });
  rig.controls.addEventListener("change", () => (dirty = true));

  // ---------------------------------------------------------------- the loop
  const anchor = new THREE.Vector3();
  const times: number[] = [];
  let fpsFrames = 0;
  let fpsT = performance.now();
  let fps = 0;
  let lastMs = 0;
  let last = performance.now();
  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    let moving = false;
    if (playing) {
      simT += dt * speed;
      fleet.update(simT);
      landmarks.update(simT);
      moving = true;
      if (simT - lastShadow > 6 && !phone) {
        lastShadow = simT;
        renderer.shadowMap.needsUpdate = true; // the wheel turns; refresh its shadow now and then
      }
    }
    if (lighting.update(dt)) moving = true;
    if (rig.update(dt)) moving = true;
    if (!moving && !dirty) return;
    dirty = false;
    const t0 = performance.now();
    renderer.render(scene, rig.camera);
    lastMs = performance.now() - t0;
    if (selected && opts.onLabel) {
      const info = LANDMARKS.find((l) => l.id === selected)!;
      const t = sceneTarget(info.view);
      anchor.set(t[0], t[1] + 18, t[2]).project(rig.camera);
      const vis = anchor.z < 1 && Math.abs(anchor.x) < 1.1 && Math.abs(anchor.y) < 1.1;
      opts.onLabel(((anchor.x + 1) / 2) * host.clientWidth, ((1 - anchor.y) / 2) * host.clientHeight, vis);
    }
    // frame-rate bookkeeping and the quality steps
    fpsFrames++;
    times.push(dt * 1000);
    if (now - fpsT >= 1000) {
      fps = (fpsFrames * 1000) / (now - fpsT);
      fpsFrames = 0;
      fpsT = now;
      opts.onStats?.(stats());
    }
    if (times.length >= 120) {
      const sorted = [...times].sort((a, b) => a - b);
      const median = sorted[60]!;
      times.length = 0;
      if (median > 24 && level < 4) {
        level++;
        if (pixelRatio > 1) {
          pixelRatio = Math.max(1, pixelRatio - 0.5);
          renderer.setPixelRatio(pixelRatio);
          resize();
        } else if (renderer.shadowMap.enabled) {
          renderer.shadowMap.enabled = false;
          scene.traverse((o) => {
            const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
            if (mat) for (const mm of Array.isArray(mat) ? mat : [mat]) mm.needsUpdate = true;
          });
        }
        console.info(`[osaka] quality step ${level}: pixel ratio ${pixelRatio}, shadows ${renderer.shadowMap.enabled}`);
      }
    }
  };
  const stats = (): Stats => ({ fps: Math.round(fps), ms: Math.round(lastMs * 10) / 10, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio, shadows: renderer.shadowMap.enabled, level });
  renderer.setAnimationLoop(loop);
  const onVis = () => {
    renderer.setAnimationLoop(document.hidden ? null : loop);
    last = performance.now();
  };
  document.addEventListener("visibilitychange", onVis);
  progress(1, "ready");

  const handle: OsakaHandle = {
    setNight(on) {
      lighting.setNight(on ? 1 : 0);
      dirty = true;
    },
    setPlaying(on) {
      playing = on;
      dirty = true;
    },
    setSpeed(x) {
      speed = x;
    },
    setOperatorVisible(op, on) {
      shown[op] = on;
      fleet.setVisible(op, on);
      fleet.update(simT);
      dirty = true;
    },
    focus(id) {
      selected = id;
      setHighlight();
      opts.onSelect?.(id);
      if (!id) {
        opts.onLabel?.(0, 0, false);
        return;
      }
      rig.follow(null);
      const info = LANDMARKS.find((l) => l.id === id)!;
      void rig.fly(info.view, 2.2);
    },
    follow(i) {
      if (i === null) {
        rig.follow(null);
        return;
      }
      selected = null;
      setHighlight();
      opts.onSelect?.(null);
      opts.onLabel?.(0, 0, false);
      const p = { pos: new THREE.Vector3(), dir: new THREE.Vector3() };
      rig.follow(() => (fleet.pose(i, p) ? p.pos.clone().addScaledVector(p.dir, -40) : null));
    },
    resetView() {
      rig.follow(null);
      handle.focus(null);
      void rig.fly(home(), 2.0);
    },
    async playIntro() {
      if (opts.reducedMotion) {
        rig.cut(home());
        opts.onIntroEnd?.();
        return;
      }
      const me = { cancelled: false };
      intro = me;
      rig.controls.enabled = false;
      for (const shot of INTRO) {
        if (me.cancelled) break;
        await rig.fly(shot.view, shot.fly);
        if (me.cancelled) break;
        await new Promise((r) => setTimeout(r, shot.hold * 1000));
      }
      if (intro === me) intro = null;
      rig.controls.enabled = opts.mode === "explore";
      opts.onIntroEnd?.();
    },
    skipIntro() {
      if (!intro) return;
      intro.cancelled = true;
      intro = null;
      rig.cut(home());
      rig.controls.enabled = opts.mode === "explore";
      dirty = true;
    },
    services: resolved.services.map((s, index) => ({ index, id: s.def.id, label: s.def.label, labelJa: s.def.labelJa, op: STOCK[s.def.stock].op, stock: STOCK[s.def.stock].name, cars: s.def.cars })),
    trains: () =>
      resolved.services.map((s, index) => {
        const tc = (((simT - s.plan.offset) % PERIOD) + PERIOD) % PERIOD;
        const onBase = tc < s.plan.duration && ops(s.def.stock);
        return { index, onBase, nextIn: onBase ? 0 : (PERIOD - tc) / Math.max(speed, 0.01) };
      }),
    dropped: resolved.dropped,
    stats,
    dispose() {
      renderer.setAnimationLoop(null);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", skipOnInput);
      rig.dispose();
      city.dispose();
      landmarks.dispose();
      track.dispose();
      fleet.dispose();
      lighting.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
  return handle;
}
