import type { Operator, UmedaData } from "../data/types";
import { PLATFORM_ABOVE_RAIL, RAIL_TOP } from "../geo/frame";
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

export const PERIOD = 600;

type End = { x: number; n: number }; // a region at the edge of the data: the track ends nearest it (≤ 120 m)

/** A platform face: the platform (OSM ref) and which of its two tracks — the lower number is the south (or east) face. */
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
const express: Motion = { vIn: 60 * KMH, vOut: 60 * KMH, accel: 0.6, decel: 0.85 };
const diesel: Motion = { vIn: 55 * KMH, vOut: 55 * KMH, accel: 0.5, decel: 0.8 };
const hankyu: Motion = { vIn: 45 * KMH, vOut: 50 * KMH, accel: 0.78, decel: 0.85 };

// the track ends at the edges of the data (the kept box reaches 160 m past the base on every side)
const EAST: End = { x: 860, n: 455 }; // Loop Line, toward Temma and Kyōbashi
const SOUTHWEST: End = { x: -1060, n: -700 }; // Loop Line toward Fukushima and Nishikujō; the Umekita line's viaduct beside it
const WEST: End = { x: -1060, n: -360 }; // JR Kobe and Takarazuka lines
const NORTHEAST: End = { x: 605, n: 1010 }; // JR Kyoto line, toward Shin-Osaka
const UMEKITA_NORTH: End = { x: -75, n: 1010 }; // the Umekita line's tunnel, toward Shin-Osaka

const jr = (ref: string, side: "north" | "south") => ({ op: "jr" as const, ref, side });

/*
 * Who stops where, from Osaka Station's platform assignments (JR West, as tabled in the Japanese Wikipedia article 大阪駅,
 * October 2026): 1 Loop Line for Nishikujō and the Yamatoji / Kansai Airport / Kishuji rapids; 2 Loop Line for Kyōbashi;
 * 3·4 westbound limited expresses (Super Hakuto, Kounotori, Hamakaze) and terminating Thunderbirds; 5 Special Rapid and 6 locals
 * west; 7 locals and 8 Special Rapid east; 9·10 eastbound limited expresses and terminating Hamakaze; 11 Thunderbird for Tsuruga;
 * 21·22 (Umekita, underground) the Haruka and Kuroshio for Nishikujō, 23·24 for Shin-Osaka. Hankyu Osaka-umeda: 1–3 Kyoto line,
 * 4–6 Takarazuka line, 7–9 Kobe line, numbered from the east.
 */
export const SERVICES: ServiceDef[] = [
  // Osaka Loop Line and the rapids that run onto it
  { id: "loop-inner", label: "Osaka Loop Line · inner loop, for Nishikujō and Tennōji", labelJa: "大阪環状線 内回り 西九条・天王寺方面", stock: "jr323", cars: 8, dwell: 30, motion: loop, offset: 0, kind: "through", from: EAST, to: SOUTHWEST, platform: jr("1;2", "south") },
  { id: "loop-outer", label: "Osaka Loop Line · outer loop, for Kyōbashi and Tsuruhashi", labelJa: "大阪環状線 外回り 京橋・鶴橋方面", stock: "jr323", cars: 8, dwell: 30, motion: loop, offset: 150, kind: "through", from: SOUTHWEST, to: EAST, platform: jr("1;2", "north") },
  { id: "loop-outer-2", label: "Osaka Loop Line · outer loop, for Kyōbashi and Tsuruhashi", labelJa: "大阪環状線 外回り 京橋・鶴橋方面", stock: "jr323", cars: 8, dwell: 30, motion: loop, offset: 450, kind: "through", from: SOUTHWEST, to: EAST, platform: jr("1;2", "north") },
  { id: "yamatoji-rapid", label: "Yamatoji Rapid, for Tennōji and Nara", labelJa: "大和路快速 天王寺・奈良方面", stock: "jr221", cars: 8, dwell: 40, motion: rapid, offset: 200, kind: "through", from: EAST, to: SOUTHWEST, platform: jr("1;2", "south") },
  { id: "kanku-rapid", label: "Kansai Airport / Kishuji Rapid, for Kansai Airport and Wakayama", labelJa: "関空快速・紀州路快速 関西空港・和歌山方面", stock: "jr225h", cars: 8, dwell: 40, motion: rapid, offset: 400, kind: "through", from: EAST, to: SOUTHWEST, platform: jr("1;2", "south") },
  // JR Kyoto and Kobe lines
  { id: "special-rapid-west", label: "JR Kobe Line · Special Rapid, for Sannomiya and Himeji", labelJa: "JR神戸線 新快速 三ノ宮・姫路方面", stock: "jr225", cars: 12, dwell: 40, motion: rapid, offset: 60, kind: "through", from: NORTHEAST, to: WEST, platform: jr("5;6", "south") },
  { id: "special-rapid-east", label: "JR Kyoto Line · Special Rapid, for Kyoto", labelJa: "JR京都線 新快速 京都方面", stock: "jr225", cars: 12, dwell: 40, motion: rapid, offset: 360, kind: "through", from: WEST, to: NORTHEAST, platform: jr("7;8", "north") },
  { id: "local-west", label: "JR Kobe Line · Local, for Nishi-Akashi", labelJa: "JR神戸線 普通 西明石方面", stock: "jr321", cars: 7, dwell: 30, motion: loop, offset: 250, kind: "through", from: NORTHEAST, to: WEST, platform: jr("5;6", "north") },
  // (eastbound locals use platform 7, whose track OSM does not connect to the Kyoto line: left out rather than drawn elsewhere)
  // limited expresses
  { id: "thunderbird-out", label: "Limited Express Thunderbird, for Tsuruga", labelJa: "特急サンダーバード 敦賀行き", stock: "jr683", cars: 9, dwell: 60, motion: express, offset: 100, kind: "through", from: WEST, to: NORTHEAST, platform: jr("11", "south") },
  { id: "thunderbird-in", label: "Limited Express Thunderbird, from Tsuruga (terminates here)", labelJa: "特急サンダーバード 大阪止まり", stock: "jr683", cars: 9, dwell: 60, motion: express, offset: 420, kind: "through", from: NORTHEAST, to: WEST, platform: jr("3;4", "north") },
  { id: "hakuto-down", label: "Limited Express Super Hakuto, for Tottori and Kurayoshi", labelJa: "特急スーパーはくと 鳥取・倉吉行き", stock: "hot7000", cars: 5, dwell: 45, motion: diesel, offset: 20, kind: "through", from: NORTHEAST, to: WEST, platform: jr("3;4", "south") },
  { id: "hakuto-up", label: "Limited Express Super Hakuto, for Kyoto", labelJa: "特急スーパーはくと 京都行き", stock: "hot7000", cars: 5, dwell: 45, motion: diesel, offset: 330, kind: "through", from: WEST, to: NORTHEAST, platform: jr("9;10", "south") },
  { id: "kounotori-down", label: "Limited Express Kounotori, for Fukuchiyama and Kinosaki-onsen", labelJa: "特急こうのとり 福知山・城崎温泉行き", stock: "jr287", cars: 4, dwell: 45, motion: express, offset: 230, kind: "through", from: NORTHEAST, to: WEST, platform: jr("3;4", "north") },
  { id: "kounotori-up", label: "Limited Express Kounotori, for Shin-Osaka", labelJa: "特急こうのとり 新大阪行き", stock: "jr287", cars: 4, dwell: 45, motion: express, offset: 500, kind: "through", from: WEST, to: NORTHEAST, platform: jr("9;10", "north") },
  { id: "hamakaze-down", label: "Limited Express Hamakaze, for Kasumi and Tottori", labelJa: "特急はまかぜ 香住・鳥取行き", stock: "kiha189", cars: 3, dwell: 45, motion: diesel, offset: 480, kind: "through", from: NORTHEAST, to: WEST, platform: jr("3;4", "south") },
  { id: "hamakaze-up", label: "Limited Express Hamakaze, from Tottori (terminates here)", labelJa: "特急はまかぜ 大阪止まり", stock: "kiha189", cars: 3, dwell: 45, motion: diesel, offset: 170, kind: "through", from: WEST, to: NORTHEAST, platform: jr("9;10", "north") },
  // the Umekita platforms, underground
  { id: "haruka-down", label: "Limited Express Haruka, for Kansai Airport", labelJa: "特急はるか 関西空港行き", stock: "jr281", cars: 9, dwell: 40, motion: express, offset: 50, kind: "through", from: UMEKITA_NORTH, to: SOUTHWEST, platform: jr("21;22", "south") },
  { id: "haruka-up", label: "Limited Express Haruka, for Kyoto", labelJa: "特急はるか 京都行き", stock: "jr281", cars: 9, dwell: 40, motion: express, offset: 200, kind: "through", from: SOUTHWEST, to: UMEKITA_NORTH, platform: jr("23;24", "north") },
  { id: "kuroshio-down", label: "Limited Express Kuroshio, for Shirahama and Shingū", labelJa: "特急くろしお 白浜・新宮行き", stock: "jr287k", cars: 6, dwell: 40, motion: express, offset: 350, kind: "through", from: UMEKITA_NORTH, to: SOUTHWEST, platform: jr("21;22", "north") },
  { id: "kuroshio-up", label: "Limited Express Kuroshio, for Shin-Osaka and Kyoto", labelJa: "特急くろしお 新大阪・京都行き", stock: "jr287k", cars: 6, dwell: 40, motion: express, offset: 500, kind: "through", from: SOUTHWEST, to: UMEKITA_NORTH, platform: jr("23;24", "north") },
  // Hankyu Osaka-umeda
  { id: "hankyu-kobe", label: "Hankyu Kobe Line · Limited Express, for Kobe-sannomiya", labelJa: "阪急神戸線 特急 神戸三宮行き", stock: "hankyu1000", cars: 8, dwell: 70, motion: hankyu, offset: 20, kind: "terminal", buffer: { x: 213, n: 248 } },
  { id: "hankyu-kobe-local", label: "Hankyu Kobe Line · Local, for Kobe-sannomiya", labelJa: "阪急神戸線 普通 神戸三宮行き", stock: "hankyu1000", cars: 8, dwell: 70, motion: hankyu, offset: 320, kind: "terminal", buffer: { x: 204, n: 246 } },
  { id: "hankyu-takarazuka", label: "Hankyu Takarazuka Line · Express, for Takarazuka", labelJa: "阪急宝塚線 急行 宝塚行き", stock: "hankyu1000", cars: 8, dwell: 70, motion: hankyu, offset: 120, kind: "terminal", buffer: { x: 246, n: 254 } },
  { id: "hankyu-kyoto", label: "Hankyu Kyoto Line · Limited Express, for Kyoto-kawaramachi", labelJa: "阪急京都線 特急 京都河原町行き", stock: "hankyu9300", cars: 8, dwell: 70, motion: hankyu, offset: 220, kind: "terminal", buffer: { x: 272, n: 258 } },
  { id: "hankyu-kyoto-local", label: "Hankyu Kyoto Line · Local, for Takatsuki-shi", labelJa: "阪急京都線 普通 高槻市行き", stock: "hankyu1300", cars: 8, dwell: 70, motion: hankyu, offset: 470, kind: "terminal", buffer: { x: 281, n: 260 } },
];

export type Service = { def: ServiceDef; plan: Plan; paths: Path[] };

export type Resolved = { graph: RailGraph; services: Service[]; dropped: { id: string; why: string }[] };

/** The nearest graph edge (as its two nodes) to a point, among one operator's tracks at a rail level (m). */
function nearestEdge(g: RailGraph, px: number, pz: number, op: Operator, level: number): [number, number] | null {
  let best: [number, number] | null = null;
  let bd = Infinity;
  for (let a = 0; a < g.x.length; a++) {
    if (g.op[a] !== op || Math.abs(g.y[a]! - level) > 3) continue;
    for (const b of g.adj[a]!) {
      if (b < a || Math.abs(g.y[b]! - level) > 3) continue;
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

/** Where a platform's edges are across it (v0…v1, in its frame's v) at a distance u along its frame. */
export function platformSpan(flat: readonly number[], u: number): { v0: number; v1: number } {
  const f = platformFrame(flat);
  const pts: [number, number][] = [];
  for (let k = 0; k + 1 < flat.length; k += 2) {
    const x = flat[k]! / 10 - f.cx;
    const z = -flat[k + 1]! / 10 - f.cz;
    pts.push([x * f.ax + z * f.az, -x * f.az + z * f.ax]);
  }
  let v0 = Infinity;
  let v1 = -Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ua, va] = pts[i]!;
    const [ub, vb] = pts[j]!;
    if ((ua - u) * (ub - u) > 0 || ua === ub) continue;
    const v = va + ((vb - va) * (u - ua)) / (ub - ua);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  return v0 <= v1 ? { v0, v1 } : { v0: -f.halfW, v1: f.halfW };
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
  const level = pf.p.y !== undefined ? pf.p.y / 10 - PLATFORM_ABOVE_RAIL : RAIL_TOP[def.platform.op];
  // the face is measured across the platform at its middle, not from the frame: Umekita's platforms are on a curve
  const span = platformSpan(pf.p.r[0]!, 0);
  const vFace = (nx * -f.az + nz * f.ax > 0 ? span.v1 : span.v0) + (nx * -f.az + nz * f.ax > 0 ? 1.8 : -1.8);
  const edge = nearestEdge(g, f.cx - f.az * vFace, f.cz + f.ax * vFace, def.platform.op, level);
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
