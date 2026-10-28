import type { UmedaData } from "../data/types";
import { BOUNDS, ringXZ } from "./frame";

/*
 * A coarse height field of the district: the tallest building over each 8 m cell. The camera reads it to stay out of the
 * buildings (OrbitControls knows nothing about them), at the cost of one lookup a frame instead of a raycast through 600k
 * triangles.
 */

const CELL = 8;

export function heightField(data: UmedaData): (x: number, z: number) => number {
  const nx = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / CELL);
  const nz = Math.ceil((BOUNDS.n1 - BOUNDS.n0) / CELL);
  const h = new Float32Array(nx * nz);
  const inside = (x: number, z: number, r: [number, number][]) => {
    let ins = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i]!;
      const b = r[j]!;
      if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1] || 1e-9) + a[0]) ins = !ins;
    }
    return ins;
  };
  const stamp = (ring: [number, number][], top: number) => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const [x, z] of ring) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
    for (let i = Math.max(0, Math.floor((x0 - BOUNDS.x0) / CELL)); i <= Math.min(nx - 1, Math.floor((x1 - BOUNDS.x0) / CELL)); i++)
      for (let j = Math.max(0, Math.floor((z0 + BOUNDS.n1) / CELL)); j <= Math.min(nz - 1, Math.floor((z1 + BOUNDS.n1) / CELL)); j++) {
        const cx = BOUNDS.x0 + (i + 0.5) * CELL;
        const cz = -BOUNDS.n1 + (j + 0.5) * CELL;
        if (inside(cx, cz, ring) && h[j * nx + i]! < top) h[j * nx + i] = top;
      }
  };
  for (const b of data.buildings) stamp(ringXZ(b.r[0]!), b.h / 10);
  for (const poly of data.landmarks["sky-building"].rings) stamp(ringXZ(poly[0]!), 175);
  return (x, z) => {
    const i = Math.floor((x - BOUNDS.x0) / CELL);
    const j = Math.floor((z + BOUNDS.n1) / CELL);
    if (i < 0 || j < 0 || i >= nx || j >= nz) return 0;
    return h[j * nx + i]!;
  };
}
