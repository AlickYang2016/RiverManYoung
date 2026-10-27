import type { Operator, UmedaData } from "../data/types";
import { buildGraph, pathOf, routeVia, type RailGraph } from "./graph";
import type { Path } from "./path";
import { makePlan, plan, type LegSpec, type Motion, type Plan } from "./sim";
import { STOCK, trainLength, type StockId } from "./stock";

/*
 * The illustrative timetable. Not live data and not a real diagram: each service is one kind of train that really calls here,
 * on tracks it could plausibly use, once every PERIOD seconds of simulated time (the page says so).
 *
 * A service is written as intent — "Loop Line, outer loop, the south track of platform 1·2, from the east edge to the
 * south-west edge" — and resolved against the track graph when the page loads (resolve()), so it follows whatever OSM says the
 * tracks are, and survives a refresh of the data. Ends at the edge of the data are chosen by the rule Japanese railways run by:
 * keep left. A service whose route cannot be found is dropped and reported, never drawn through the air.
 */

export const PERIOD = 300;

type End = { x: number; n: number }; // a region at the edge of the data: the track ends nearest it (≤ 120 m)

type Through = {
  kind: "through";
  from: End;
  to: End;
  platform: { op: Operator; ref: string; side: "north" | "south" };
};
type Terminal = { kind: "terminal"; buffer: { x: number; n: number } };

export type ServiceDef = {
  id: string;
  label: string;
  labelJa: string;
  stock: StockId;
  cars: number;
  dwell: number;
  motion: Motion;
  offset: number;
} & (Through | Terminal);

const KMH = 1 / 3.6;
const loop: Motion = { vIn: 55 * KMH, vOut: 55 * KMH, accel: 0.72, decel: 0.95 };
const rapid: Motion = { vIn: 65 * KMH, vOut: 65 * KMH, accel: 0.7, decel: 0.95 };
const hankyu: Motion = { vIn: 45 * KMH, vOut: 50 * KMH, accel: 0.78, decel: 0.85 };

const EAST: End = { x: 843, n: 450 };
const SOUTHWEST: End = { x: -1045, n: -690 };
const WEST: End = { x: -952, n: -412 };
const NORTHEAST: End = { x: 598, n: 990 };

export const SERVICES: ServiceDef[] = [
  { id: "loop-outer", label: "Osaka Loop Line · outer loop", labelJa: "大阪環状線 外回り", stock: "jr323", cars: 8, dwell: 30, motion: loop, offset: 0, kind: "through", from: EAST, to: SOUTHWEST, platform: { op: "jr", ref: "1;2", side: "south" } },
  { id: "loop-inner", label: "Osaka Loop Line · inner loop", labelJa: "大阪環状線 内回り", stock: "jr323", cars: 8, dwell: 30, motion: loop, offset: 150, kind: "through", from: SOUTHWEST, to: EAST, platform: { op: "jr", ref: "1;2", side: "north" } },
  { id: "rapid-west", label: "JR Kyoto–Kobe Line · Special Rapid, for Kobe", labelJa: "JR京都・神戸線 新快速 姫路方面", stock: "jr225", cars: 12, dwell: 40, motion: rapid, offset: 60, kind: "through", from: NORTHEAST, to: WEST, platform: { op: "jr", ref: "7;8", side: "south" } },
  { id: "rapid-east", label: "JR Kyoto–Kobe Line · Special Rapid, for Kyoto", labelJa: "JR京都・神戸線 新快速 京都方面", stock: "jr225", cars: 12, dwell: 40, motion: rapid, offset: 210, kind: "through", from: WEST, to: NORTHEAST, platform: { op: "jr", ref: "7;8", side: "north" } },
  { id: "hankyu-kobe", label: "Hankyu Kobe Line", labelJa: "阪急神戸線", stock: "hankyu1000", cars: 8, dwell: 70, motion: hankyu, offset: 20, kind: "terminal", buffer: { x: 213, n: 248 } },
  { id: "hankyu-takarazuka", label: "Hankyu Takarazuka Line", labelJa: "阪急宝塚線", stock: "hankyu1000", cars: 8, dwell: 70, motion: hankyu, offset: 120, kind: "terminal", buffer: { x: 246, n: 254 } },
  { id: "hankyu-kyoto", label: "Hankyu Kyoto Line", labelJa: "阪急京都線", stock: "hankyu1300", cars: 8, dwell: 70, motion: hankyu, offset: 220, kind: "terminal", buffer: { x: 272, n: 258 } },
];

export type Service = { def: ServiceDef; plan: Plan; paths: Path[] };

export type Resolved = { graph: RailGraph; services: Service[]; dropped: { id: string; why: string }[] };

/** The nearest graph edge (as its two nodes) to a point, among one operator's tracks. */
function nearestEdge(g: RailGraph, px: number, pz: number, op: Operator): [number, number] | null {
  let best: [number, number] | null = null;
  let bd = Infinity;
  for (let a = 0; a < g.x.length; a++) {
    if (g.op[a] !== op) continue;
    for (const b of g.adj[a]!) {
      if (b < a) continue;
      const ax = g.x[a]!;
      const az = g.z[a]!;
      const ex = g.x[b]! - ax;
      const ez = g.z[b]! - az;
      const l2 = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2));
      const d = (ax + ex * t - px) ** 2 + (az + ez * t - pz) ** 2;
      if (d < bd) {
        bd = d;
        best = [a, b];
      }
    }
  }
  return best;
}

/** Track ends (degree-1 nodes, not buffer stops) within `r` of a region, each with the direction pointing into the network. */
function endsNear(g: RailGraph, e: End, r = 120): { node: number; dx: number; dz: number }[] {
  const out = [];
  for (let i = 0; i < g.x.length; i++) {
    if (g.adj[i]!.length !== 1 || g.bufferStops.has(i)) continue;
    if (Math.hypot(g.x[i]! - e.x, g.z[i]! + e.n) > r) continue;
    const j = g.adj[i]![0]!;
    const l = Math.hypot(g.x[j]! - g.x[i]!, g.z[j]! - g.z[i]!) || 1;
    out.push({ node: i, dx: (g.x[j]! - g.x[i]!) / l, dz: (g.z[j]! - g.z[i]!) / l });
  }
  return out;
}

/** Sorts ends so that the one on the left of a train moving `dir` comes first (keep left). */
function keepLeft<T extends { node: number }>(g: RailGraph, ends: T[], dirX: number, dirZ: number): T[] {
  // left of (dx, dz) seen from above, north up, in scene axes (z = south) is (dz, -dx)
  const lx = dirZ;
  const lz = -dirX;
  return [...ends].sort((a, b) => g.x[b.node]! * lx + g.z[b.node]! * lz - (g.x[a.node]! * lx + g.z[a.node]! * lz));
}

/** A platform's centre, its long axis and half-width, from its ring (PCA). */
export function platformFrame(flat: readonly number[]) {
  const pts: [number, number][] = [];
  for (let k = 0; k + 1 < flat.length; k += 2) pts.push([flat[k]! / 10, -flat[k + 1]! / 10]);
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (const [x, z] of pts) {
    sxx += (x - cx) ** 2;
    szz += (z - cz) ** 2;
    sxz += (x - cx) * (z - cz);
  }
  const th = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  const ax = Math.cos(th);
  const az = Math.sin(th);
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const [x, z] of pts) {
    const u = (x - cx) * ax + (z - cz) * az;
    const v = -(x - cx) * az + (z - cz) * ax;
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  const uc = (u0 + u1) / 2;
  const vc = (v0 + v1) / 2;
  return { cx: cx + ax * uc - az * vc, cz: cz + az * uc + ax * vc, ax, az, half: (u1 - u0) / 2, halfW: (v1 - v0) / 2 };
}

function resolveThrough(g: RailGraph, data: UmedaData, def: ServiceDef & Through): { paths: Path[]; legs: (len: number) => LegSpec[] } | string {
  const pf = data.platforms
    .filter((p) => p.op === def.platform.op && p.ref === def.platform.ref)
    .map((p) => ({ p, f: platformFrame(p.r[0]!) }))
    .sort((a, b) => Math.hypot(a.f.cx, a.f.cz) - Math.hypot(b.f.cx, b.f.cz))[0];
  if (!pf) return `no platform ${def.platform.ref}`;
  const f = pf.f;
  // the normal pointing south (scene +z) or north
  let nx = -f.az;
  let nz = f.ax;
  if ((def.platform.side === "south") !== nz > 0) {
    nx = -nx;
    nz = -nz;
  }
  const edge = nearestEdge(g, f.cx + nx * (f.halfW + 1.8), f.cz + nz * (f.halfW + 1.8), def.platform.op);
  if (!edge) return "no track beside the platform";
  const fromEnds = endsNear(g, def.from);
  const toEnds = endsNear(g, def.to);
  if (!fromEnds.length || !toEnds.length) return "no track ends at the edge";
  for (const a of keepLeft(g, fromEnds, fromEnds[0]!.dx, fromEnds[0]!.dz)) {
    for (const b of keepLeft(g, toEnds, -toEnds[0]!.dx, -toEnds[0]!.dz)) {
      for (const [e0, e1] of [edge, [edge[1], edge[0]] as [number, number]]) {
        const seq = routeVia(g, [a.node, e0, e1, b.node]);
        if (!seq) continue;
        const path = pathOf(g, seq);
        // stop with the head 8 m short of the platform's far end, in the direction of travel
        let sFar = -1;
        for (let s = 0; s <= path.length; s += 1) {
          const p = path.at(s);
          const u = (p.x - f.cx) * f.ax + (p.z - f.cz) * f.az;
          const v = -(p.x - f.cx) * f.az + (p.z - f.cz) * f.ax;
          if (Math.abs(u) <= f.half && Math.abs(v) <= f.halfW + 3.5) sFar = s;
        }
        if (sFar < 0) continue;
        const stop = sFar - 8;
        return {
          paths: [path],
          legs: (len) => [
            { path, s0: -len - 10, stop, dwell: def.dwell, doors: true },
            { path, s0: stop, stop: null, dwell: 0 },
          ],
        };
      }
    }
  }
  return "no route through the platform track that keeps left";
}

function resolveTerminal(g: RailGraph, def: ServiceDef & Terminal): { paths: Path[]; legs: (len: number) => LegSpec[] } | string {
  let buffer = -1;
  let bd = Infinity;
  for (const b of g.bufferStops) {
    const d = Math.hypot(g.x[b]! - def.buffer.x, g.z[b]! + def.buffer.n);
    if (d < bd) {
      bd = d;
      buffer = b;
    }
  }
  if (buffer < 0 || bd > 30) return "no buffer stop there";
  // the line's ends at the edge: every non-buffer dead end connected to this buffer stop
  const seen = new Set<number>([buffer]);
  const stack = [buffer];
  const ends: { node: number; dx: number; dz: number }[] = [];
  while (stack.length) {
    const k = stack.pop()!;
    if (g.adj[k]!.length === 1 && !g.bufferStops.has(k)) {
      const j = g.adj[k]![0]!;
      const l = Math.hypot(g.x[j]! - g.x[k]!, g.z[j]! - g.z[k]!) || 1;
      ends.push({ node: k, dx: (g.x[j]! - g.x[k]!) / l, dz: (g.z[j]! - g.z[k]!) / l });
    }
    for (const n of g.adj[k]!) if (!seen.has(n)) seen.add(n), stack.push(n);
  }
  if (ends.length < 2) return "the line has no two ends at the edge";
  const dir = ends[0]!;
  const inbound = keepLeft(g, ends, dir.dx, dir.dz); // arriving: moving into the network
  const outbound = keepLeft(g, ends, -dir.dx, -dir.dz); // leaving
  for (const a of inbound) {
    const arr = routeVia(g, [a.node, buffer]);
    if (!arr) continue;
    for (const b of outbound) {
      if (b.node === a.node) continue;
      const dep = routeVia(g, [buffer, b.node]);
      if (!dep) continue;
      const A = pathOf(g, arr);
      const B = pathOf(g, dep);
      const gap = 4; // the head stops this far short of the buffer stop
      return {
        paths: [A, B],
        legs: (len) => [
          { path: A, s0: -len - 10, stop: A.length - gap, dwell: def.dwell, doors: true },
          { path: B, s0: gap + len, stop: null, dwell: 0 },
        ],
      };
    }
  }
  return "no arrival and departure route that keep left";
}

/** Resolves every service against the data, then fits them into one period without sharing track at the same time. */
export function resolve(data: UmedaData, defs: ServiceDef[] = SERVICES): Resolved {
  const graph = buildGraph(data.rail);
  const built: { def: ServiceDef; plan: Plan; paths: Path[] }[] = [];
  const dropped: { id: string; why: string }[] = [];
  for (const def of defs) {
    const r = def.kind === "through" ? resolveThrough(graph, data, def) : resolveTerminal(graph, def);
    if (typeof r === "string") {
      dropped.push({ id: def.id, why: r });
      continue;
    }
    const len = trainLength(STOCK[def.stock], def.cars);
    built.push({ def, plan: makePlan(def.id, r.legs(len), def.motion, len), paths: r.paths });
  }
  const { placed, dropped: late } = plan(
    built.map((b) => b.plan),
    PERIOD,
    built.map((b) => b.def.offset),
  );
  for (const p of late) dropped.push({ id: p.id, why: "no slot in the period" });
  const ok = new Set(placed);
  return { graph, services: built.filter((b) => ok.has(b.plan)), dropped };
}
