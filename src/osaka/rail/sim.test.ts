import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { UmedaData } from "../data/types";
import { edgeKey } from "./graph";
import { PERIOD, resolve } from "./services";
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
    expect(services.length).toBe(7);
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
