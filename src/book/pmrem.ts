/*
 * sasshi (2026-10-25, the arrival's stalls): the studio's prefiltered environment without a frame-long stall. PMREMGenerator.fromScene
 * compiles its programs (the studio's materials as the cube camera draws them, its blur and GGX passes) with renderer.compile and
 * then draws at once, so the main thread waits on the GPU's shader compiler (≈ 1.2 s on a cold cache, RTX 2060 / D3D11). Here the
 * same programs are compiled first (compileQuiet: off the main thread, polled without blocking), on the very generator
 * fromScene then uses (its blur and GGX materials are made once per size and kept), so fromScene finds them compiled.
 *
 * It reaches into the generator's private parts (_setSize, _allocateTargets, _blurMaterial, _ggxMaterial, _lodMeshes; three r186):
 * should a later three rename them, the warm-up compiles less and fromScene does the rest as before — never wrong, only slower.
 */
import * as THREE from "three";
import { compileQuiet } from "./compile";

type Private = {
  _setSize(size: number): void;
  _allocateTargets(): THREE.WebGLRenderTarget;
  _blurMaterial: THREE.Material | null;
  _ggxMaterial: THREE.Material | null;
  _lodMeshes: THREE.Mesh[];
};

/** fromScene's size (its default) */
const SIZE = 256;

export async function prefilteredStudio(renderer: THREE.WebGLRenderer, studio: THREE.Scene, sigma: number): Promise<THREE.WebGLRenderTarget> {
  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    const g = pmrem as unknown as Private;
    const warm: Promise<unknown>[] = [];
    let target: THREE.WebGLRenderTarget | null = null;
    try {
      g._setSize(SIZE);
      target = g._allocateTargets();
    } catch {
      // three moved on: fromScene compiles its own passes
    }
    // the program variants fromScene draws with: into a half-float target (linear output), no tone mapping
    const st = { target, toneMapping: THREE.NoToneMapping };
    const cube = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    warm.push(compileQuiet(renderer, studio, cube, null, st));
    // the solid backdrop fromScene draws behind a scene without a background (a back-faced basic box)
    const box = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false }));
    warm.push(compileQuiet(renderer, box, cube, null, st));
    const flat = new THREE.OrthographicCamera(0, 1, 0, 1, 0, 1);
    const geo = g._lodMeshes?.[0]?.geometry;
    for (const m of [g._blurMaterial, g._ggxMaterial]) if (m && geo) warm.push(compileQuiet(renderer, new THREE.Mesh(geo, m), flat, null, st));
    await Promise.all(warm).catch(() => {});
    target?.dispose();
    // the box goes only after fromScene: disposed before, its program would be released and fromScene's own box compile it again
    const rt = pmrem.fromScene(studio, sigma);
    box.geometry.dispose();
    box.material.dispose();
    return rt;
  } finally {
    pmrem.dispose();
  }
}
