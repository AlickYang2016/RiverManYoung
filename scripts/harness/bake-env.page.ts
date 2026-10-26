// Served by the dev server for scripts/harness/bake-env.ts: the studio's prefiltered environment, read back as half floats.
import * as THREE from "three";
import { prefilteredStudio } from "../../src/book/pmrem";
import { studioScene } from "../../src/book/scene";
export async function bake(): Promise<string> {
  const r = new THREE.WebGLRenderer();
  const rt = await prefilteredStudio(r, studioScene(), 0.02);
  const px = new Uint16Array(rt.width * rt.height * 4);
  r.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, px);
  let s = "";
  const b = new Uint8Array(px.buffer);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return `${rt.width}x${rt.height}:` + btoa(s);
}
