/*
 * Where the arrival's main-thread time goes: a CPU profile of a cold first visit (headed Edge on this machine's GPU, see jank.ts),
 * its samples summed by the app's entry point on their stack (ROOTS: tick, a compile poll, React's scheduler, …), self time by function.
 *
 *   bun scripts/harness/jank-profile.ts [url]     # best against an unminified build: vite build --minify false --outDir dist-dbg
 */
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://127.0.0.1:4181/?lang=zh";
const browser = await chromium.launch({
  channel: process.env.CHANNEL ?? "msedge",
  headless: false,
  args: ["--ignore-gpu-blocklist", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--window-size=1440,900"],
});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 820 } })).newPage();
const cdp = await page.context().newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
await cdp.send("Profiler.start");
await page.goto(url);
await page.waitForTimeout(20000);
const { profile } = (await cdp.send("Profiler.stop")) as { profile: { nodes: Node[]; startTime: number; samples: number[]; timeDeltas: number[] } };
await browser.close();

type Node = { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; children?: number[] };
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map<number, number>();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const name = (n: Node) => `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber + 1}`;

// Sum the samples by the app's entry point on their stack (tick, a timer's callback, …): self time of the functions under each.
const ROOTS = (process.env.ROOTS ?? "tick,checkMaterialsReady,next,performWorkUntilDeadline,createBook,prepareSwap,paintSide,prepaintSoon").split(",");
const groups = new Map<string, Map<string, number>>();
for (let i = 0; i < profile.samples.length; i++) {
  const id = profile.samples[i]!;
  const n = byId.get(id)!;
  if (["(idle)", "(program)", "(root)"].includes(n.callFrame.functionName)) continue;
  const d = (profile.timeDeltas[i + 1] ?? 500) / 1000;
  let root = "(other)";
  for (let p: number | undefined = id; p !== undefined; p = parent.get(p)) {
    const f = byId.get(p)!.callFrame.functionName;
    if (ROOTS.includes(f)) root = f; // the outermost wins
  }
  const g = groups.get(root) ?? new Map<string, number>();
  groups.set(root, g);
  g.set(name(n), (g.get(name(n)) ?? 0) + d);
}
for (const [root, g] of [...groups].sort((a, b) => sum(b[1]) - sum(a[1]))) {
  console.log(`
=== under ${root}: ${sum(g).toFixed(0)} ms`);
  for (const [k, v] of [...g].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`   ${v.toFixed(0).padStart(5)} ms  ${k}`);
}
function sum(m: Map<string, number>) {
  let t = 0;
  for (const v of m.values()) t += v;
  return t;
}
