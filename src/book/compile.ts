/*
 * sasshi (2026-10-25, the arrival's stalls): compiling the scene's programs without the main thread waiting on the GPU.
 *
 * compileAsync (KHR_parallel_shader_compile) compiles off the main thread, but asks at once — and every 10 ms after — whether each
 * program is ready, and on Chrome's ANGLE / D3D11 that question is a synchronous call into the GPU process, answered only once it
 * has worked through everything queued before it: the links themselves. Measured on a cold cache (RTX 2060): 1.1 s in one poll.
 * Here the compile is issued first (renderer.compile only queues the work), then a fence is waited for (its status is answered
 * without blocking: Chrome hands sync-object results back between tasks), and only then does compileAsync poll — the GPU has
 * caught up and each answer is quick.
 *
 * The shadow pass's materials are three's own (WebGLShadowMap), made and compiled the first time a caster is drawn into a shadow
 * map; shadowPassStandIns takes copies of them from a run of that pass in which nothing is drawn, and compiles those.
 */
import * as THREE from "three";

/** Where and how the programs will be used: a target bound while compiling (a render target: linear output), the tone mapping */
export type CompileState = { target?: THREE.WebGLRenderTarget | null; toneMapping?: THREE.ToneMapping };

function within<T>(r: THREE.WebGLRenderer, st: CompileState | undefined, fn: () => T): T {
  if (!st) return fn();
  const prevTarget = r.getRenderTarget();
  const prevTone = r.toneMapping;
  if (st.target !== undefined) r.setRenderTarget(st.target);
  if (st.toneMapping !== undefined) r.toneMapping = st.toneMapping;
  try {
    return fn();
  } finally {
    r.toneMapping = prevTone;
    r.setRenderTarget(prevTarget);
  }
}

/** Once the GPU process has worked through every command issued so far (a fence; never a blocking call) */
export function gpuCaughtUp(r: THREE.WebGLRenderer): Promise<void> {
  const gl = r.getContext() as WebGL2RenderingContext;
  const sync = typeof gl.fenceSync === "function" ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
  if (!sync) return new Promise((go) => setTimeout(go, 50));
  gl.flush();
  return new Promise((go) => {
    const poll = () => {
      if (gl.isContextLost() || gl.getSyncParameter(sync, gl.SYNC_STATUS) === gl.SIGNALED) {
        if (!gl.isContextLost()) gl.deleteSync(sync);
        go();
      } else setTimeout(poll, 16);
    };
    setTimeout(poll, 16);
  });
}

/*
 * Every compile on a renderer counted until its fence is through: they are issued at once (the GPU process compiles them in
 * parallel), and readiness is polled only once none is left in flight — a status query waits behind everything issued before it,
 * so a poll made while other compiles are still being worked through would wait for them too.
 */
const inFlight = new WeakMap<THREE.WebGLRenderer, number>();
async function issue(r: THREE.WebGLRenderer, fn: () => void): Promise<void> {
  inFlight.set(r, (inFlight.get(r) ?? 0) + 1);
  try {
    fn();
    await gpuCaughtUp(r);
  } finally {
    inFlight.set(r, (inFlight.get(r) ?? 1) - 1);
  }
}
async function drained(r: THREE.WebGLRenderer): Promise<void> {
  while ((inFlight.get(r) ?? 0) > 0) await new Promise((go) => setTimeout(go, 16));
}

/** compileAsync, its readiness polled only once the GPU has caught up with every compile issued (see above) */
export async function compileQuiet(r: THREE.WebGLRenderer, object: THREE.Object3D, camera: THREE.Camera, targetScene: THREE.Scene | null = null, st?: CompileState): Promise<void> {
  await issue(r, () => within(r, st, () => r.compile(object, camera, targetScene)));
  await drained(r);
  await within(r, st, () => r.compileAsync(object, camera, targetScene));
}

const meshMaterials = (o: THREE.Object3D): THREE.Material[] => {
  const m = (o as THREE.Mesh).material;
  return !m ? [] : Array.isArray(m) ? m : [m];
};

/**
 * The shadow pass's own materials, for compiling ahead: three's VSM shadow pass (WebGLShadowMap) is run once with every draw call
 * taken down instead of made — so nothing is drawn and nothing compiled — and each material it would have drawn with (the depth
 * material in the state it is given for that caster, the blur passes with that light's width) is copied onto a mesh of the caster's
 * geometry. Compiled into a render target (the shadow map's linear output) with `scene`'s lights, they are the very programs the first
 * frame's shadow pass asks for. Keep them until it has drawn (the program goes with the last material using it), then dispose().
 * The run also settles three's shadow type (its first VSM pass marks every material for an update): before the first frame, not in it.
 */
export function shadowPassStandIns(r: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, everything = true): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  const made: THREE.Material[] = [];
  const sm = r.shadowMap;
  const lights: THREE.Light[] = [];
  scene.traverseVisible((o) => {
    const l = o as THREE.DirectionalLight;
    if (l.isLight && l.castShadow && l.shadow) lights.push(l);
  });
  if (sm.enabled && lights.length) {
    const draw = r.renderBufferDirect;
    const needs = sm.needsUpdate;
    const each = lights.map((l) => (l as THREE.DirectionalLight).shadow.needsUpdate);
    const seen = new Set<string>();
    r.renderBufferDirect = (_cam, _scene, geometry, material) => {
      const m = material.clone();
      // clone() leaves out a material's shader patch, which is part of its program
      m.onBeforeCompile = material.onBeforeCompile;
      m.customProgramCacheKey = material.customProgramCacheKey;
      // the clone keeps what three set on the shared material for this caster (side, maps, the blur's width)
      const key = `${material.uuid}|${geometry.uuid}|${m.side}|${JSON.stringify((m as THREE.ShaderMaterial).defines ?? {})}|${!!(m as THREE.MeshDepthMaterial).map}|${!!(m as THREE.MeshDepthMaterial).alphaMap}`;
      if (seen.has(key)) return m.dispose();
      seen.add(key);
      made.push(m);
      const ghost = new THREE.Mesh(geometry as THREE.BufferGeometry, m);
      ghost.frustumCulled = false;
      group.add(ghost);
    };
    sm.needsUpdate = true;
    for (const l of lights) (l as THREE.DirectionalLight).shadow.needsUpdate = true;
    // every caster, whatever the shadow cameras' frames are now (they may not be framed yet), and every mesh that may cast or show
    // later (a page casts only while it moves; the window's bars show with the sun; `everything` false: the visible ones only).
    // Nothing is drawn: it is only a census.
    const culled: THREE.Object3D[] = [];
    const casting: THREE.Object3D[] = [];
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (everything && !o.visible && !(o as THREE.Light).isLight) {
        hidden.push(o);
        o.visible = true;
      }
      if (o.frustumCulled) {
        culled.push(o);
        o.frustumCulled = false;
      }
      if ((o as THREE.Mesh).isMesh && !o.castShadow) {
        casting.push(o);
        o.castShadow = true;
      }
    });
    try {
      scene.updateMatrixWorld();
      sm.render(lights, scene, camera);
    } catch {
      // nothing captured: the first frame compiles them
    } finally {
      for (const o of culled) o.frustumCulled = true;
      for (const o of casting) o.castShadow = false;
      for (const o of hidden) o.visible = false;
      r.renderBufferDirect = draw;
      sm.needsUpdate = needs;
      lights.forEach((l, k) => ((l as THREE.DirectionalLight).shadow.needsUpdate = each[k]!));
    }
  }
  return {
    group,
    dispose() {
      for (const m of made) m.dispose();
      group.clear();
    },
  };
}

/**
 * The frames' guard against compiling in a frame: before a frame, hold() takes out of it whatever is about to be drawn with a material that
 * has no program yet (an addon's thing just made, a page's new print) and compiles it in the background (compileQuiet, its shadow
 * stand-ins too, and `extra` — the frosted pass's variants); once compiled, `ready` asks for a frame, which draws it. release()
 * after the frame shows the held things again. A material whose program merely changes (needsUpdate) still compiles in its frame.
 */
/** The layer a held thing sits on for a frame: one no camera here enables */
const HELD_LAYER = 31;
export function programGuard(r: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, ready: () => void, extra?: (o: THREE.Object3D) => Promise<unknown> | null) {
  const shadowsOf = (o: THREE.Object3D) => shadowStandInsFor(r, scene, camera, o);
  // held things sit the frame out on a layer nothing draws (hidden, compile would skip them too: it walks the visible objects)
  const held: { o: THREE.Object3D; mask: number }[] = [];
  const compiling = new WeakSet<THREE.Material>();
  const probe = new THREE.WebGLRenderTarget(1, 1);
  let jobs = 0;
  const unready = (m: THREE.Material) => m.visible && (r.properties.get(m) as { currentProgram?: unknown }).currentProgram === undefined;
  return {
    hold() {
      const fresh: THREE.Object3D[] = [];
      scene.traverseVisible((o) => {
        const ms = meshMaterials(o).filter(unready);
        if (!ms.length) return;
        held.push({ o, mask: o.layers.mask });
        if (ms.some((m) => !compiling.has(m))) {
          for (const m of ms) compiling.add(m);
          fresh.push(o);
        }
      });
      for (const o of fresh) {
        jobs++;
        const shadows = shadowsOf(o);
        void Promise.all([compileQuiet(r, o, camera, scene), compileQuiet(r, shadows.group, camera, scene, { target: probe }), extra?.(o)])
          .catch(() => {})
          .then(() => {
            jobs--;
            for (const m of meshMaterials(o)) compiling.delete(m);
            ready();
            setTimeout(() => shadows.dispose(), 5000);
          });
      }
      for (const h of held) h.o.layers.set(HELD_LAYER);
      return held.length;
    },
    release() {
      for (const h of held) h.o.layers.mask = h.mask;
      held.length = 0;
    },
    get busy() {
      return jobs > 0;
    },
    dispose() {
      probe.dispose();
    },
  };
}

/**
 * shadowPassStandIns for `o` alone (in `scene` or about to join it: added for the run, then taken out again), everything else
 * hidden for the run.
 */
export function shadowStandInsFor(r: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, o: THREE.Object3D): { group: THREE.Group; dispose(): void } {
  const added = !isWithin(o, scene);
  if (added) scene.add(o);
  const others: THREE.Object3D[] = [];
  scene.traverseVisible((x) => {
    if ((x as THREE.Mesh).isMesh && !isWithin(x, o)) others.push(x);
  });
  for (const x of others) x.visible = false;
  try {
    return shadowPassStandIns(r, scene, camera, false);
  } finally {
    for (const x of others) x.visible = true;
    if (added) scene.remove(o);
  }
}
function isWithin(x: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = x; p; p = p.parent) if (p === root) return true;
  return false;
}
