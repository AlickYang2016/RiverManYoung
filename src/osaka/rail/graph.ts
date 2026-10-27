import type { Operator, UmedaData } from "../data/types";
import { Path } from "./path";

/*
 * The railway graph: OSM track ways joined at their shared nodes. A node where more than two edges meet is a switch (or a
 * crossing); a node with one edge is a buffer stop or the cut edge of the data.
 *
 * Routing is a shortest path over *directed* states (the edge you came along, the node you are at), so a route can only leave a
 * switch on a branch within MAX_TURN of where it arrived from: a train cannot reverse in a switch or take a diverging leg backwards,
 * which an undirected shortest path happily does. Reversing happens only where a service says so (the Hankyu terminal).
 */

export const MAX_TURN = (32 * Math.PI) / 180;

export type RailGraph = {
  x: Float64Array;
  z: Float64Array;
  op: Operator[];
  adj: number[][];
  bufferStops: Set<number>;
};

export function buildGraph(rail: UmedaData["rail"]): RailGraph {
  const n = rail.nodes.length;
  const x = new Float64Array(n);
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = rail.nodes[i]![0] / 10;
    z[i] = -rail.nodes[i]![1] / 10;
  }
  const adj: Set<number>[] = Array.from({ length: n }, () => new Set());
  const op: Operator[] = new Array(n).fill("jr");
  for (const w of rail.ways) {
    for (let k = 0; k < w.n.length; k++) {
      op[w.n[k]!] = w.op;
      if (k > 0 && w.n[k] !== w.n[k - 1]) {
        adj[w.n[k]!]!.add(w.n[k - 1]!);
        adj[w.n[k - 1]!]!.add(w.n[k]!);
      }
    }
  }
  return { x, z, op, adj: adj.map((s) => [...s]), bufferStops: new Set(rail.bufferStops) };
}

export function nearestNode(g: RailGraph, px: number, pz: number, op?: Operator): number {
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < g.x.length; i++) {
    if (op && g.op[i] !== op) continue;
    if (g.adj[i]!.length === 0) continue;
    const d = (g.x[i]! - px) ** 2 + (g.z[i]! - pz) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

function turnOk(g: RailGraph, a: number, b: number, c: number): boolean {
  const ux = g.x[b]! - g.x[a]!;
  const uz = g.z[b]! - g.z[a]!;
  const vx = g.x[c]! - g.x[b]!;
  const vz = g.z[c]! - g.z[b]!;
  const lu = Math.hypot(ux, uz);
  const lv = Math.hypot(vx, vz);
  if (lu === 0 || lv === 0) return true;
  const cos = (ux * vx + uz * vz) / (lu * lv);
  return cos >= Math.cos(MAX_TURN);
}

/**
 * The shortest node sequence from `from` to `to` that never turns more than MAX_TURN at a node. `heading` (optional): the first
 * step must point within 90° of it (which way to leave a node in the middle of a track). Returns null when no such path exists.
 */
export function route(g: RailGraph, from: number, to: number, heading?: [number, number], prev = -1): number[] | null {
  // state = prev * N + cur; Dijkstra with a binary heap
  const N = g.x.length;
  const dist = new Map<number, number>();
  const back = new Map<number, number>();
  const heap: [number, number][] = [];
  const push = (d: number, s: number) => {
    heap.push([d, s]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p]![0] <= heap[i]![0]) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  };
  const pop = (): [number, number] | undefined => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length && last) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };
  const start = (prev + 1) * (N + 1) + from;
  dist.set(start, 0);
  push(0, start);
  while (heap.length) {
    const [d, s] = pop()!;
    if (d > (dist.get(s) ?? Infinity)) continue;
    const cur = s % (N + 1);
    const pv = Math.floor(s / (N + 1)) - 1;
    if (cur === to) {
      const seq = [cur];
      let k = s;
      while (back.has(k)) {
        k = back.get(k)!;
        seq.push(k % (N + 1));
      }
      return seq.reverse();
    }
    for (const nx of g.adj[cur]!) {
      if (nx === pv) continue;
      if (pv >= 0 && !turnOk(g, pv, cur, nx)) continue;
      if (pv < 0 && heading) {
        const hx = g.x[nx]! - g.x[cur]!;
        const hz = g.z[nx]! - g.z[cur]!;
        if (hx * heading[0] + hz * heading[1] <= 0) continue;
      }
      const ns = (cur + 1) * (N + 1) + nx;
      const nd = d + Math.hypot(g.x[nx]! - g.x[cur]!, g.z[nx]! - g.z[cur]!);
      if (nd < (dist.get(ns) ?? Infinity)) {
        dist.set(ns, nd);
        back.set(ns, s);
        push(nd, ns);
      }
    }
  }
  return null;
}

/** A route through a list of waypoints (graph nodes), the direction carried through each one. */
export function routeVia(g: RailGraph, stops: readonly number[], heading?: [number, number]): number[] | null {
  let seq: number[] = [stops[0]!];
  for (let k = 1; k < stops.length; k++) {
    const prev = seq.length >= 2 ? seq[seq.length - 2]! : -1;
    const leg = route(g, seq[seq.length - 1]!, stops[k]!, k === 1 ? heading : undefined, prev);
    if (!leg) return null;
    seq = seq.concat(leg.slice(1));
  }
  return seq;
}

export function pathOf(g: RailGraph, nodes: readonly number[]): Path {
  return new Path(
    nodes.map((i) => [g.x[i]!, g.z[i]!] as const),
    nodes,
  );
}

/** The undirected edge key of two nodes (block occupancy). */
export const edgeKey = (a: number, b: number): number => (a < b ? a * 1_000_003 + b : b * 1_000_003 + a);
