import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { UmedaData } from "../data/types";
import { edgeKey } from "./graph";
import { PLATFORM_ABOVE_RAIL, RAIL_TOP } from "../geo/frame";
import { PERIOD, platformFrame, platformSpan, resolve, SERVICES } from "./services";
import { headAt } from "./sim";

const data = JSON.parse(readFileSync(new URL("../data/umeda.json", import.meta.url), "utf8")) as UmedaData;
const { services, dropped, graph } = resolve(data);

/** The graph edges and nodes a train covers at time t: the stretch [head - length, head] of its current leg's path. */
function held(i: number, t: number): Set<number> {
  const svc = services[i]!;
  const h = headAt(svc.plan, t, PERIOD);
  const out = new Set<number>();
  if (!h) return out;
  const path = svc.plan.legs[h.leg]!.path;
  const lo = h.s - svc.plan.trainLength;
  for (let k = 0; k < path.nodes.length; k++) {
    const s = path.cum[k]!;
    if (s >= lo && s <= h.s) out.add(-(path.nodes[k]! + 1));
    if (k + 1 < path.nodes.length && path.cum[k + 1]! > lo && s < h.s) out.add(edgeKey(path.nodes[k]!, path.nodes[k + 1]!));
  }
  return out;
}

describe("Osaka-Umeda timetable", () => {
  test("every service resolves to a real route", () => {
    expect(dropped).toEqual([]);
    expect(services.length).toBe(SERVICES.length);
  });

  test("each train stops alongside its own platform face, at the platform's level", () => {
    for (const s of services) {
      if (s.def.kind !== "through") continue;
      const def = s.def;
      const leg = s.plan.legs[0]!;
      // the platform of that number at Osaka (Fukushima's, at the edge of the data, has numbers too)
      const pl = data.platforms
        .filter((q) => q.op === def.platform.op && q.ref === def.platform.ref)
        .sort((a, b) => Math.hypot(platformFrame(a.r[0]!).cx, platformFrame(a.r[0]!).cz) - Math.hypot(platformFrame(b.r[0]!).cx, platformFrame(b.r[0]!).cz))[0]!;
      const f = platformFrame(pl.r[0]!);
      // along the stopped train, the closest it comes to the platform's edge (platforms curve and taper): just clear of it,
      // on the named side
      let best = { out: Infinity, south: false };
      for (let k = 0; k <= 10; k++) {
        const q = leg.path.at(leg.stop! - (s.plan.trainLength * k) / 10);
        const u = (q.x - f.cx) * f.ax + (q.z - f.cz) * f.az;
        if (Math.abs(u) > f.half) continue;
        const v = -(q.x - f.cx) * f.az + (q.z - f.cz) * f.ax;
        const span = platformSpan(pl.r[0]!, u);
        const out = v > span.v1 ? v - span.v1 : span.v0 - v;
        if (out < best.out) best = { out, south: (v > span.v1) === f.ax > 0 };
      }
      expect(`${def.id} ${best.out > 0.5 && best.out < 3.5}`).toBe(`${def.id} true`);
      expect(`${def.id} ${best.south ? "south" : "north"}`).toBe(`${def.id} ${def.platform.side}`);
      const p = leg.path.at(leg.stop! - s.plan.trainLength / 2);
      const rail = pl.y !== undefined ? pl.y / 10 - PLATFORM_ABOVE_RAIL : RAIL_TOP[pl.op];
      expect(Math.abs(p.y - rail)).toBeLessThan(0.05);
    }
  });

  test("the Haruka and Kuroshio call underground at Umekita and come up near Fukushima", () => {
    for (const s of services.filter((x) => /^(haruka|kuroshio)/.test(x.def.id))) {
      const path = s.plan.legs[0]!.path;
      const ys = [...path.ys];
      expect(Math.min(...ys)).toBeLessThan(-14);
      // the south-west end is up on the viaduct toward Nishikujō
      const sw = path.xs[0]! < path.xs[path.xs.length - 1]! ? ys[0]! : ys[ys.length - 1]!;
      expect(sw).toBeGreaterThan(2);
    }
  });

  test("Hankyu trains stay on Hankyu track and JR trains on JR track", () => {
    for (const s of services) {
      const op = s.def.stock.startsWith("hankyu") ? "hankyu" : "jr";
      for (const p of s.paths) for (const n of p.nodes) expect(graph.op[n]).toBe(op);
    }
  });

  test("no two trains ever hold the same track at the same time", () => {
    const clashes: string[] = [];
    for (let t = 0; t < PERIOD; t += 0.25) {
      const sets = services.map((_, i) => held(i, t));
      for (let a = 0; a < sets.length; a++)
        for (let b = a + 1; b < sets.length; b++)
          for (const k of sets[a]!) if (sets[b]!.has(k)) clashes.push(`${services[a]!.def.id} × ${services[b]!.def.id} at ${t}s`);
    }
    expect(clashes.slice(0, 5)).toEqual([]);
  });

  test("motion is continuous and frame-rate independent", () => {
    for (const s of services) {
      const vmax = Math.max(s.def.motion.vIn, s.def.motion.vOut) + 0.01;
      let prev = headAt(s.plan, 0, PERIOD);
      for (let t = 0.05; t < PERIOD; t += 0.05) {
        const h = headAt(s.plan, t, PERIOD);
        if (h && prev && h.leg === prev.leg) expect(h.s - prev.s).toBeLessThanOrEqual(vmax * 0.05 + 1e-6);
        if (h) expect(h.v).toBeLessThanOrEqual(vmax);
        prev = h;
      }
      // the same instant reached in big or small steps is the same place
      const a = headAt(s.plan, 123.456, PERIOD);
      const b = headAt(s.plan, 123.456 + PERIOD * 7, PERIOD);
      expect(a === null).toBe(b === null);
      if (a && b) {
        expect(a.leg).toBe(b.leg);
        expect(a.s).toBeCloseTo(b.s, 6);
        expect(a.v).toBeCloseTo(b.v, 6);
      }
    }
  });

  test("trains stop at their platforms with the doors opening only while stopped", () => {
    for (const s of services) {
      let stopped = false;
      for (let t = 0; t < PERIOD; t += 0.1) {
        const h = headAt(s.plan, t, PERIOD);
        if (!h) continue;
        if (h.doors > 0) expect(h.v).toBeLessThan(1e-6);
        if (h.v === 0 && h.doors === 1) stopped = true;
      }
      expect(stopped).toBe(true);
    }
  });
});
