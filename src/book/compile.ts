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
 * The shadow pass's depth materials are three's own (WebGLShadowMap), made and compiled the first time a caster is drawn into a
 * shadow map; programs are shared by their parameters, so a stand-in depth material with the same parameters (shadowStandIns)
 * compiles the very program three's will use.
 */
import * as THREE from "three";
// the VSM blur pass's shader text, as WebGLShadowMap uses it (vsmStandIns)
import * as vsm from "three/src/renderers/shaders/ShaderLib/vsm.glsl.js";

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
 * One queue for every compile on a renderer: a status query waits behind everything issued before it, so a poll made while another
 * compile is still being worked through waits for that one too. Each compile is issued in its turn, a fence after it; polling starts
 * only once the queue has drained and the last fence is through.
 */
const queues = new WeakMap<THREE.WebGLRenderer, { tail: Promise<void>; pending: number }>();
function queueOf(r: THREE.WebGLRenderer) {
  let q = queues.get(r);
  if (!q) queues.set(r, (q = { tail: Promise.resolve(), pending: 0 }));
  return q;
}
async function issue(r: THREE.WebGLRenderer, fn: () => void): Promise<void> {
  const q = queueOf(r);
  q.pending++;
  const turn = q.tail.then(async () => {
    fn();
    await gpuCaughtUp(r);
  });
  q.tail = turn.catch(() => {});
  try {
    await turn;
  } finally {
    q.pending--;
  }
}
async function drained(r: THREE.WebGLRenderer): Promise<void> {
  const q = queueOf(r);
  while (q.pending) await q.tail;
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
 * Stand-ins for the depth materials three's VSM shadow pass will draw `root`'s casters with (WebGLShadowMap.getDepthMaterial: one
 * depth material, or a variant per alpha-tested / displaced material, its side the material's shadowSide or side), one mesh per
 * distinct program, sharing the casters' geometry; compile them into a render target (the shadow map's linear output). Keep them until the shadow pass has drawn (the program is released with the last
 * material using it), then dispose().
 */
export function shadowStandIns(root: THREE.Object3D): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  const made: THREE.Material[] = [];
  const seen = new Set<string>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.castShadow) return;
    // instanced and skinned casters would need stand-ins of their kind: none in the folio, so they compile as they are drawn
    if ((mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    for (const m of meshMaterials(mesh)) {
      const custom = mesh.customDepthMaterial;
      const own = !!custom || (m.alphaTest > 0 && !!((m as THREE.MeshStandardMaterial).map || (m as THREE.MeshStandardMaterial).alphaMap)) || !!(m as THREE.MeshStandardMaterial).displacementMap;
      const side = m.shadowSide ?? m.side;
      const key = [custom?.uuid ?? "", own ? m.uuid : "", side, Object.keys(mesh.geometry.morphAttributes).length].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      let d: THREE.Material;
      if (custom) d = custom;
      else {
        const dm = new THREE.MeshDepthMaterial();
        const src = m as THREE.MeshStandardMaterial;
        dm.side = side;
        dm.alphaTest = m.alphaTest;
        dm.alphaMap = src.alphaMap ?? null;
        dm.map = src.map ?? null;
        dm.displacementMap = src.displacementMap ?? null;
        dm.displacementScale = src.displacementScale ?? 1;
        dm.displacementBias = src.displacementBias ?? 0;
        made.push(dm);
        d = dm;
      }
      const ghost = new THREE.Mesh(mesh.geometry, d);
      ghost.frustumCulled = false;
      group.add(ghost);
    }
  });
  return {
    group,
    dispose() {
      for (const m of made) m.dispose();
      group.clear();
    },
  };
}

/**
 * Stand-ins for the VSM shadow pass's blur materials (WebGLShadowMap's own are out of reach): the same shader text and defines, so
 * the same programs — a vertical and a horizontal pass for each blur width among `root`'s shadow-casting lights. Compile them into
 * a render target (the shadow pass's linear output).
 */
export function vsmStandIns(root: THREE.Object3D): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  const made: THREE.ShaderMaterial[] = [];
  const widths = new Set<number>();
  root.traverse((o) => {
    const l = o as THREE.DirectionalLight;
    if (l.isLight && l.castShadow && l.shadow) widths.add(l.shadow.blurSamples);
  });
  const tri = new THREE.BufferGeometry();
  tri.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0.5, 3, -1, 0.5, -1, 3, 0.5]), 3));
  for (const n of widths)
    for (const horizontal of [false, true]) {
      const m = new THREE.ShaderMaterial({
        defines: horizontal ? { VSM_SAMPLES: n, HORIZONTAL_PASS: 1 } : { VSM_SAMPLES: n },
        uniforms: { shadow_pass: { value: null }, resolution: { value: new THREE.Vector2() }, radius: { value: 4 } },
        vertexShader: vsm.vertex,
        fragmentShader: vsm.fragment,
      });
      made.push(m);
      const q = new THREE.Mesh(tri, m);
      q.frustumCulled = false;
      group.add(q);
    }
  return {
    group,
    dispose() {
      for (const m of made) m.dispose();
      tri.dispose();
      group.clear();
    },
  };
}

/**
 * The frames' guard against compiling in a frame: before a frame, hold() hides whatever is about to be drawn with a material that
 * has no program yet (an addon's thing just made, a page's new print) and compiles it in the background (compileQuiet, its shadow
 * stand-ins too, and `extra` — the frosted pass's variants); once compiled, `ready` asks for a frame, which draws it. release()
 * after the frame shows the held things again. A material whose program merely changes (needsUpdate) still compiles in its frame.
 */
export function programGuard(r: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, ready: () => void, extra?: (o: THREE.Object3D) => Promise<unknown> | null) {
  const held: THREE.Object3D[] = [];
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
        held.push(o);
        if (ms.some((m) => !compiling.has(m))) {
          for (const m of ms) compiling.add(m);
          fresh.push(o);
        }
      });
      for (const o of held) o.visible = false;
      for (const o of fresh) {
        jobs++;
        const shadows = shadowStandIns(o);
        void Promise.all([compileQuiet(r, o, camera, scene), compileQuiet(r, shadows.group, camera, null, { target: probe }), extra?.(o)])
          .catch(() => {})
          .then(() => {
            jobs--;
            for (const m of meshMaterials(o)) compiling.delete(m);
            ready();
            setTimeout(() => shadows.dispose(), 5000);
          });
      }
      return held.length;
    },
    release() {
      for (const o of held) o.visible = true;
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
