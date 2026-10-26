/*
 * sasshi (2026-10-26, owner: "Folio still loads a little slowly"): the studio's prefiltered environment, baked once
 * (scripts/harness/bake-env.ts) into public/env/studio.bin.gz — so a first visit does not compile and run PMREM's blur and GGX
 * passes (about 1.5 s of the GPU's time on the way to the first frame). The file: RGBA half floats, 768 × 1024, CubeUV, rows bottom
 * to top as WebGL reads them (so they upload as they are), gzipped (inflated here unless the server already did). Anything amiss
 * (no file, no DecompressionStream, a short read):
 * the caller makes the environment itself (pmrem.ts).
 */
import * as THREE from "three";

const W = 768;
const H = 1024;

export type StudioEnv = { texture: THREE.Texture; dispose(): void };

export async function bakedStudio(url: string): Promise<StudioEnv> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  let buf = await res.arrayBuffer();
  // a server may already have undone the gzip (Content-Encoding: gzip): only bytes that still start with its magic are inflated here
  const head = new Uint8Array(buf, 0, 2);
  if (head[0] === 0x1f && head[1] === 0x8b) {
    if (typeof DecompressionStream !== "function") throw new Error("no DecompressionStream");
    buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  }
  if (buf.byteLength !== W * H * 4 * 2) throw new Error(`${url}: ${buf.byteLength} bytes`);
  const tex = new THREE.DataTexture(new Uint16Array(buf), W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  // as PMREMGenerator's own target: CubeUV, linear, filtered, no mipmaps, not flipped
  tex.mapping = THREE.CubeUVReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  return { texture: tex, dispose: () => tex.dispose() };
}
