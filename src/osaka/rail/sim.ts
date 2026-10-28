import { edgeKey } from "./graph";
import type { Path } from "./path";

/*
 * The train simulation: deterministic, closed-form, and independent of the frame rate.
 *
 * A service runs one train through its legs once per period P (seconds of simulated time). Each leg is a path the train's head
 * runs along; its motion is a list of phases of constant acceleration (cruise in, brake to the stop mark, dwell, accelerate away),
 * so the head's arc length at any time t is evaluated directly — s0 + v0·τ + ½·a·τ² — never integrated frame by frame. Ten frames
 * or one frame for the same second land the train in the same place.
 *
 * At a terminal the train reverses: leg 2 starts on the same platform track, its head being the old tail.
 *
 * Collisions are ruled out when the timetable is made, not by looking ahead each frame: every service reserves the track it
 * occupies (each graph edge and node, from the moment its head enters until its tail has cleared, plus a headway margin), and a
 * service whose reservations would overlap another's is held back in whole seconds at its entry until they do not (plan()).
 * sim.test.ts checks the result: over a whole period no two trains ever hold the same edge or node at the same time.
 */

export type Motion = { vIn: number; vOut: number; accel: number; decel: number };

/** One leg: a path, where the head starts (arc length) at the leg's start, and where it stops (null: runs out past the end). */
export type LegSpec = { path: Path; s0: number; stop: number | null; dwell: number; doors?: boolean };

export type Phase = { t0: number; t1: number; s0: number; v0: number; a: number };

export type Leg = LegSpec & { phases: Phase[]; t0: number; t1: number; doorsOpenAt: number; doorsCloseAt: number };

export type Plan = {
  id: string;
  legs: Leg[];
  trainLength: number;
  /** total run time from entering to having left (s), < period */
  duration: number;
  /** cycle offset (s) found by plan() */
  offset: number;
};

export type HeadState = { leg: number; s: number; v: number; doors: number } | null;

const DOOR_LAG = 1.6; // s after stopping until the doors open, and before departing that they are closed
const DOOR_MOVE = 1.8; // s for a door leaf to slide

function phasesFor(spec: LegSpec, t0: number, motion: Motion, startV: number, trainLength: number): { phases: Phase[]; t1: number } {
  const ph: Phase[] = [];
  let t = t0;
  let s = spec.s0;
  let v = startV;
  const push = (dur: number, a: number) => {
    if (dur <= 1e-6) return;
    ph.push({ t0: t, t1: t + dur, s0: s, v0: v, a });
    s += v * dur + 0.5 * a * dur * dur;
    v += a * dur;
    t += dur;
  };
  if (v === 0) {
    // departing from rest: accelerate to the line speed
    const vt = motion.vOut;
    push(vt / motion.accel, motion.accel);
  }
  if (spec.stop !== null) {
    if (spec.stop - s < (v * v) / (2 * motion.decel)) v = Math.sqrt(2 * motion.decel * Math.max(0, spec.stop - s)); // too close to brake from line speed
    const brake = (v * v) / (2 * motion.decel);
    const cruise = Math.max(0, spec.stop - brake - s);
    push(cruise / Math.max(v, 1e-6), 0);
    push(v / motion.decel, -motion.decel);
    s = spec.stop; // remove rounding
    v = 0;
    push(spec.dwell, 0);
  } else {
    const end = spec.path.length + trainLength + 5; // the tail is past the path's end (and the base's edge)
    push(Math.max(0, end - s) / Math.max(v, 1e-6), 0);
  }
  return { phases: ph, t1: t };
}

/** Builds a service's legs with times relative to the start of its run. */
export function makePlan(id: string, specs: LegSpec[], motion: Motion, trainLength: number): Plan {
  const legs: Leg[] = [];
  let t = 0;
  let v = motion.vIn;
  for (const spec of specs) {
    const { phases, t1 } = phasesFor(spec, t, motion, v, trainLength);
    const stopAt = spec.stop !== null ? phases[phases.length - 2]?.t1 ?? t : -1;
    legs.push({
      ...spec,
      phases,
      t0: t,
      t1,
      doorsOpenAt: spec.doors && spec.stop !== null ? stopAt + DOOR_LAG : Infinity,
      doorsCloseAt: spec.doors && spec.stop !== null ? t1 - DOOR_LAG - DOOR_MOVE : -Infinity,
    });
    t = t1;
    v = spec.stop !== null ? 0 : v;
  }
  return { id, legs, trainLength, duration: t, offset: 0 };
}

function evalLeg(leg: Leg, t: number): { s: number; v: number } {
  const ph = leg.phases;
  if (!ph.length) return { s: leg.s0, v: 0 };
  let p = ph[0]!;
  if (t >= ph[ph.length - 1]!.t1) p = ph[ph.length - 1]!;
  else for (const q of ph) if (t < q.t1) {
    p = q;
    break;
  }
  const tau = Math.min(Math.max(t - p.t0, 0), p.t1 - p.t0);
  return { s: p.s0 + p.v0 * tau + 0.5 * p.a * tau * tau, v: p.v0 + p.a * tau };
}

/** Where a service's train is at simulated time t (null: off the base between runs). */
export function headAt(plan: Plan, t: number, period: number): HeadState {
  const tc = (((t - plan.offset) % period) + period) % period;
  if (tc >= plan.duration) return null;
  for (let i = 0; i < plan.legs.length; i++) {
    const leg = plan.legs[i]!;
    if (tc < leg.t1 || i === plan.legs.length - 1) {
      const { s, v } = evalLeg(leg, tc);
      let doors = 0;
      if (tc >= leg.doorsOpenAt && tc <= leg.doorsCloseAt + DOOR_MOVE) {
        const opening = Math.min(1, (tc - leg.doorsOpenAt) / DOOR_MOVE);
        const closing = Math.min(1, (leg.doorsCloseAt + DOOR_MOVE - tc) / DOOR_MOVE);
        doors = Math.max(0, Math.min(opening, closing));
      }
      return { leg: i, s, v, doors };
    }
  }
  return null;
}

/** The time (relative to the run) at which the head first reaches arc length `s` on leg `li`, or null if it never does. */
function timeAtS(leg: Leg, s: number): number | null {
  for (const p of leg.phases) {
    const sEnd = p.s0 + p.v0 * (p.t1 - p.t0) + 0.5 * p.a * (p.t1 - p.t0) ** 2;
    if (s > sEnd + 1e-6) continue;
    if (s <= p.s0) return p.t0;
    // solve s0 + v0 τ + ½ a τ² = s
    if (Math.abs(p.a) < 1e-9) return p.t0 + (s - p.s0) / Math.max(p.v0, 1e-9);
    const disc = p.v0 * p.v0 + 2 * p.a * (s - p.s0);
    const tau = (-p.v0 + Math.sqrt(Math.max(0, disc))) / p.a;
    return p.t0 + tau;
  }
  return null;
}

/** Track reservations of one run: block key → [enter, leave] (s, relative to the run's start). */
export function reservations(plan: Plan, margin = 0): Map<number, [number, number][]> {
  const out = new Map<number, [number, number][]>();
  const add = (k: number, a: number, b: number) => {
    const list = out.get(k);
    if (list) list.push([a - margin, b + margin]);
    else out.set(k, [[a - margin, b + margin]]);
  };
  const L = plan.trainLength;
  for (const leg of plan.legs) {
    const { path } = leg;
    const nodes = path.nodes;
    if (nodes.length < 2) continue;
    // the train covers [head - L, head]; it holds the stretch [a, b] while head ∈ (a, b + L)
    const span = (a: number, b: number): [number, number] | null => {
      let tIn: number | null;
      if (leg.s0 >= a) tIn = leg.s0 - L < b ? leg.t0 : null;
      else tIn = timeAtS(leg, a);
      if (tIn === null) return null;
      return [tIn, timeAtS(leg, b + L) ?? leg.t1];
    };
    for (let i = 0; i < nodes.length; i++) {
      const sNode = path.cum[i]!;
      const n = span(sNode, sNode);
      if (n) add(-(nodes[i]! + 1), n[0], n[1]);
      if (i + 1 < nodes.length) {
        const e = span(sNode, path.cum[i + 1]!);
        if (e) add(edgeKey(nodes[i]!, nodes[i + 1]!), e[0], e[1]);
      }
    }
  }
  return out;
}

function overlaps(a: [number, number][], b: [number, number][], shift: number, period: number): boolean {
  for (const [a0, a1] of a)
    for (const [b0, b1] of b)
      for (const k of [-1, 0, 1]) {
        const o0 = b0 + shift + k * period;
        const o1 = b1 + shift + k * period;
        if (a0 < o1 && o0 < a1) return true;
      }
  return false;
}

/**
 * Sets each plan's offset so that no two runs ever hold the same block at the same time (with `headway` seconds to spare).
 * Plans are placed in order, each at its preferred offset or the first whole second after it that is clear. A plan that fits
 * nowhere in the period is dropped (returned in `dropped`).
 */
export function plan(plans: Plan[], period: number, preferred: number[], headway = 6): { placed: Plan[]; dropped: Plan[] } {
  const placed: { p: Plan; res: Map<number, [number, number][]> }[] = [];
  const dropped: Plan[] = [];
  plans.forEach((p, i) => {
    if (p.duration >= period) {
      dropped.push(p);
      return;
    }
    const res = reservations(p, headway / 2);
    const start = preferred[i] ?? 0;
    for (let d = 0; d < period; d++) {
      const off = (start + d) % period;
      let clash = false;
      for (const q of placed) {
        for (const [k, iv] of res) {
          const other = q.res.get(k);
          if (other && overlaps(iv, other, q.p.offset - off, period)) {
            clash = true;
            break;
          }
        }
        if (clash) break;
      }
      if (!clash) {
        p.offset = off;
        placed.push({ p, res });
        return;
      }
    }
    dropped.push(p);
  });
  return { placed: placed.map((q) => q.p), dropped };
}
