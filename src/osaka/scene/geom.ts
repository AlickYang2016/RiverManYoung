import * as THREE from "three";

/*
 * Geometry primitives for the miniature, all writing into one growing buffer so a whole layer (every building, every road,
 * every rail) becomes a single mesh and a single draw call.
 *
 * Rings are [x, z] pairs in scene metres. A data ring is counter-clockwise seen from the north-up map, which is counter-clockwise
 * seen from above in the scene (x right, -z up the screen), so caps triangulated from it face up; walls face outward. Winding is
 * still checked per triangle against the face's intended normal, so a mapper's clockwise ring cannot turn a wall inside out.
 */

export type XZ = [number, number];

export class Builder {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly uv: number[] = [];
  /** optional per-vertex extras (e.g. aInfo vec4); `extra` is appended for every vertex written while it is set */
  readonly ext: number[] = [];
  extra: number[] | null = null;
  readonly extSize: number;

  constructor(extSize = 0) {
    this.extSize = extSize;
  }

  get count(): number {
    return this.pos.length / 3;
  }

  private v(x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, w: number): void {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.uv.push(u, w);
    if (this.extSize) {
      const e = this.extra;
      for (let k = 0; k < this.extSize; k++) this.ext.push(e?.[k] ?? 0);
    }
  }

  /** One triangle with a flat normal; flips it if it faces away from `want` (when given). */
  tri(a: THREE.Vector3Like, b: THREE.Vector3Like, c: THREE.Vector3Like, ua: [number, number], ub: [number, number], uc: [number, number], want?: THREE.Vector3Like): void {
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const ez = b.z - a.z;
    const fx = c.x - a.x;
    const fy = c.y - a.y;
    const fz = c.z - a.z;
    let nx = ey * fz - ez * fy;
    let ny = ez * fx - ex * fz;
    let nz = ex * fy - ey * fx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    if (want && nx * want.x + ny * want.y + nz * want.z < 0) {
      this.v(a.x, a.y, a.z, -nx, -ny, -nz, ua[0], ua[1]);
      this.v(c.x, c.y, c.z, -nx, -ny, -nz, uc[0], uc[1]);
      this.v(b.x, b.y, b.z, -nx, -ny, -nz, ub[0], ub[1]);
      return;
    }
    this.v(a.x, a.y, a.z, nx, ny, nz, ua[0], ua[1]);
    this.v(b.x, b.y, b.z, nx, ny, nz, ub[0], ub[1]);
    this.v(c.x, c.y, c.z, nx, ny, nz, uc[0], uc[1]);
  }

  /** A quad a-b-c-d (in order around it), facing `want`. */
  quad(a: THREE.Vector3Like, b: THREE.Vector3Like, c: THREE.Vector3Like, d: THREE.Vector3Like, uvs: [number, number][], want?: THREE.Vector3Like): void {
    this.tri(a, b, c, uvs[0]!, uvs[1]!, uvs[2]!, want);
    this.tri(a, c, d, uvs[0]!, uvs[2]!, uvs[3]!, want);
  }

  build(extName = "aInfo"): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.extSize) g.setAttribute(extName, new THREE.Float32BufferAttribute(this.ext, this.extSize));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

const UP = { x: 0, y: 1, z: 0 };
const DOWN = { x: 0, y: -1, z: 0 };

function signedArea(r: XZ[]): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i]!;
    const q = r[(i + 1) % r.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Triangulates a polygon (exterior + holes) as a horizontal cap at height y, facing up (or down). */
export function cap(b: Builder, rings: XZ[][], y: number, faceDown = false, uvScale = 1): void {
  const outer = rings[0];
  if (!outer || outer.length < 3) return;
  const contour = outer.map(([x, z]) => new THREE.Vector2(x, z));
  const holes = rings.slice(1).map((r) => r.map(([x, z]) => new THREE.Vector2(x, z)));
  let faces: number[][];
  try {
    faces = THREE.ShapeUtils.triangulateShape(contour, holes);
  } catch {
    return;
  }
  const all = [...contour, ...holes.flat()];
  const want = faceDown ? DOWN : UP;
  for (const [i, j, k] of faces) {
    const a = all[i!]!;
    const c = all[j!]!;
    const d = all[k!]!;
    b.tri({ x: a.x, y, z: a.y }, { x: c.x, y, z: c.y }, { x: d.x, y, z: d.y }, [a.x * uvScale, a.y * uvScale], [c.x * uvScale, c.y * uvScale], [d.x * uvScale, d.y * uvScale], want);
  }
}

/**
 * Walls of every ring from y0 to y1, facing out of the solid (holes face into the courtyard). uv = (distance along the ring,
 * absolute height), so a facade shader can lay floors and bays in metres.
 */
export function walls(b: Builder, rings: XZ[][], y0: number, y1: number): void {
  rings.forEach((ring, ri) => {
    const ccw = signedArea(ring) > 0; // in (x, z) with z south, data-CCW rings come out negative
    let u = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i]!;
      const q = ring[(i + 1) % ring.length]!;
      const dx = q[0] - p[0];
      const dz = q[1] - p[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      // outward normal of an exterior ring that is clockwise in (x, z): (-dz, dx)/len; flip for the other winding and for holes
      let nx = -dz / len;
      let nz = dx / len;
      if (ccw) {
        nx = -nx;
        nz = -nz;
      }
      if (ri > 0) {
        nx = -nx;
        nz = -nz;
      }
      const want = { x: nx, y: 0, z: nz };
      b.quad({ x: p[0], y: y0, z: p[1] }, { x: q[0], y: y0, z: q[1] }, { x: q[0], y: y1, z: q[1] }, { x: p[0], y: y1, z: p[1] }, [[u, y0], [u + len, y0], [u + len, y1], [u, y1]], want);
      u += len;
    }
  });
}

/** A prism: walls + top cap (+ bottom cap when it floats). */
export function prism(b: Builder, rings: XZ[][], y0: number, y1: number, bottom = y0 > 0.01): void {
  walls(b, rings, y0, y1);
  cap(b, rings, y1);
  if (bottom) cap(b, rings, y0, true);
}

/**
 * A flat ribbon along a polyline (mitred joins, capped mitre), `width` wide at height y. uv = (distance along, -0.5…0.5 across).
 * With `depth`, it also gets side walls down to y - depth (a deck, a ballast bed).
 */
/** `y`: the top, one height or one per point (a track on a grade). */
export function ribbon(b: Builder, pts: XZ[], width: number, y: number | readonly number[], depth = 0, offset = 0): void {
  const n = pts.length;
  const Y = (i: number) => (typeof y === "number" ? y : y[i]!);
  if (n < 2) return;
  const L: XZ[] = [];
  const R: XZ[] = [];
  const hw = width / 2;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const a = pts[Math.max(0, i - 1)]!;
    const c = pts[Math.min(n - 1, i + 1)]!;
    let d0x = p[0] - a[0];
    let d0z = p[1] - a[1];
    let d1x = c[0] - p[0];
    let d1z = c[1] - p[1];
    const l0 = Math.hypot(d0x, d0z) || 1;
    const l1 = Math.hypot(d1x, d1z) || 1;
    d0x /= l0;
    d0z /= l0;
    d1x /= l1;
    d1z /= l1;
    if (i === 0) {
      d0x = d1x;
      d0z = d1z;
    }
    if (i === n - 1) {
      d1x = d0x;
      d1z = d0z;
    }
    let tx = d0x + d1x;
    let tz = d0z + d1z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    // the left normal of the mean tangent (seen from above: left of (dx, dz) is (dz, -dx)), stretched by the mitre 1/cos(½ turn)
    const nx = tz;
    const nz = -tx;
    const k = 1 / Math.max(0.35, tx * d1x + tz * d1z);
    L.push([p[0] + nx * k * (offset + hw), p[1] + nz * k * (offset + hw)]);
    R.push([p[0] + nx * k * (offset - hw), p[1] + nz * k * (offset - hw)]);
  }
  let u = 0;
  for (let i = 0; i + 1 < n; i++) {
    const seg = Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]);
    const l0 = L[i]!;
    const l1 = L[i + 1]!;
    const r0 = R[i]!;
    const r1 = R[i + 1]!;
    const y0 = Y(i);
    const y1 = Y(i + 1);
    b.quad({ x: l0[0], y: y0, z: l0[1] }, { x: l1[0], y: y1, z: l1[1] }, { x: r1[0], y: y1, z: r1[1] }, { x: r0[0], y: y0, z: r0[1] }, [[u, 0.5], [u + seg, 0.5], [u + seg, -0.5], [u, -0.5]], UP);
    if (depth > 0) {
      for (const [s0, s1, sign] of [[l0, l1, 1], [r0, r1, -1]] as const) {
        const ex = s1[0] - s0[0];
        const ez = s1[1] - s0[1];
        const el = Math.hypot(ex, ez) || 1;
        const want = { x: (ez / el) * sign, y: 0, z: (-ex / el) * sign };
        b.quad({ x: s0[0], y: y0 - depth, z: s0[1] }, { x: s1[0], y: y1 - depth, z: s1[1] }, { x: s1[0], y: y1, z: s1[1] }, { x: s0[0], y: y0, z: s0[1] }, [[u, y0 - depth], [u + seg, y1 - depth], [u + seg, y1], [u, y0]], want);
      }
    }
    u += seg;
  }
}

export type Frame = ReturnType<typeof frameOf>;

/** A box in a frame: local u0…u1 along, v0…v1 left, y0…y1 up. */
export function frameBox(b: Builder, f: Frame, u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, bottom = y0 > 0.01): void {
  prism(b, [[f.at(u0, v0), f.at(u1, v0), f.at(u1, v1), f.at(u0, v1)]], y0, y1, bottom);
}

/** The local frame of an oriented box (data centre [x, n], data bearing a) in scene space: unit along, unit left. */
export function frameOf(c: readonly [number, number], a: number) {
  const ax = Math.cos(a);
  const az = -Math.sin(a);
  return {
    cx: c[0],
    cz: -c[1],
    ax,
    az,
    /** left of the along axis, seen from above */
    lx: az,
    lz: -ax,
    /** scene (x, z) of local (u along, v left) */
    at(u: number, v: number): XZ {
      return [c[0] + ax * u + az * v, -c[1] + az * u - ax * v];
    },
  };
}
