/*
 * A track path: the polyline a train's head runs along, in scene metres (x, z), with arc length. Positions past either end
 * continue straight along the end segments, so a train can be placed with its tail still "before" the path (sliding in from the
 * diorama's cut edge) or its head already past it.
 *
 * Cars are placed by their two bogie centres (trains.ts), each a point on this polyline: the body is the chord between them, so
 * it turns continuously as the bogies run through the polyline's vertices, and overhangs a curve the way a real car does.
 */

export type PathSample = { x: number; z: number; dx: number; dz: number };

export class Path {
  readonly xs: Float64Array;
  readonly zs: Float64Array;
  /** cum[i] = arc length from the start to vertex i. */
  readonly cum: Float64Array;
  readonly length: number;

  /** `nodes`: the rail-graph node of every vertex (for block occupancy), when the path came from the graph. */
  constructor(points: readonly (readonly [number, number])[], readonly nodes: readonly number[] = []) {
    const n = points.length;
    if (n < 2) throw new Error("a path needs two points");
    this.xs = new Float64Array(n);
    this.zs = new Float64Array(n);
    this.cum = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      this.xs[i] = points[i]![0];
      this.zs[i] = points[i]![1];
      if (i > 0) this.cum[i] = this.cum[i - 1]! + Math.hypot(this.xs[i]! - this.xs[i - 1]!, this.zs[i]! - this.zs[i - 1]!);
    }
    this.length = this.cum[n - 1]!;
  }

  /** The segment (i, i+1) that holds arc length s, clamped to the first / last segment. */
  segmentAt(s: number): number {
    const c = this.cum;
    if (s <= 0) return 0;
    if (s >= this.length) return c.length - 2;
    let lo = 0;
    let hi = c.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (c[mid]! <= s) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  at(s: number, out: PathSample = { x: 0, z: 0, dx: 1, dz: 0 }): PathSample {
    const i = this.segmentAt(s);
    const x0 = this.xs[i]!;
    const z0 = this.zs[i]!;
    const seg = this.cum[i + 1]! - this.cum[i]!;
    const dx = seg > 0 ? (this.xs[i + 1]! - x0) / seg : 1;
    const dz = seg > 0 ? (this.zs[i + 1]! - z0) / seg : 0;
    const t = s - this.cum[i]!;
    out.x = x0 + dx * t;
    out.z = z0 + dz * t;
    out.dx = dx;
    out.dz = dz;
    return out;
  }
}
