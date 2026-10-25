/*
 * The folio's main-thread stalls on arrival, measured in a real headed browser on this machine's GPU (a headless one without a GPU
 * renders in software and says nothing useful). Long animation frames and long tasks are observed from the first script on.
 *
 *   bun scripts/harness/jank.ts [url] [runs]      # default: the vite preview at http://127.0.0.1:4180/, 3 runs
 *
 * Edge or Chrome (channel msedge / chrome), throttling of hidden or covered windows switched off so a window behind another still
 * paints at full rate. Each run is a fresh browser (an empty profile): a first visit, its shader cache cold.
 */
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://127.0.0.1:4180/?lang=zh";
const runs = Number(process.argv[3] ?? 3);
const WAIT = 20000;

const observe = () => {
  const w = window as unknown as { __jank: { loaf: unknown[]; lt: unknown[] } };
  w.__jank = { loaf: [], lt: [] };
  const r = Math.round;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries() as unknown as {
      startTime: number; duration: number; blockingDuration: number; renderStart: number;
      scripts: { duration: number; invokerType: string; invoker: string; sourceFunctionName: string; sourceURL: string; sourceCharPosition: number }[];
    }[])
      w.__jank.loaf.push({
        at: r(e.startTime), dur: r(e.duration), block: r(e.blockingDuration), render: e.renderStart ? r(e.startTime + e.duration - e.renderStart) : 0,
        scripts: e.scripts.filter((s) => s.duration > 25).map((s) => `${r(s.duration)}ms ${s.invokerType}:${s.invoker} ${s.sourceFunctionName || "?"}@${(s.sourceURL || "").split("/").pop()}:${s.sourceCharPosition}`),
      });
  }).observe({ type: "long-animation-frame", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) w.__jank.lt.push([r(e.startTime), r(e.duration)]);
  }).observe({ type: "longtask", buffered: true });
};

for (let i = 0; i < runs; i++) {
  const browser = await chromium.launch({
    channel: process.env.CHANNEL ?? "msedge",
    headless: false,
    args: ["--ignore-gpu-blocklist", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--window-size=1440,900", "--window-position=-3000,0"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 820 }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
  const page = await ctx.newPage();
  await page.addInitScript(observe);
  await page.goto(url);
  await page.waitForTimeout(WAIT);
  const out = await page.evaluate(() => {
    const j = (window as unknown as { __jank: { loaf: { dur: number }[]; lt: [number, number][] } }).__jank;
    const gl = document.createElement("canvas").getContext("webgl2");
    const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      gpu: dbg ? gl!.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "?",
      longest: Math.max(0, ...j.lt.map((t) => t[1])),
      blocking: j.lt.reduce((a, t) => a + Math.max(0, t[1] - 50), 0),
      lt: j.lt,
      loaf: j.loaf.filter((f) => f.dur > 100),
    };
  });
  console.log(`--- run ${i + 1}: ${out.gpu}`);
  console.log(`longest task ${out.longest} ms, total blocking ${out.blocking} ms`);
  console.log("long tasks [start, ms]:", JSON.stringify(out.lt));
  if (process.env.VERBOSE) for (const f of out.loaf) console.log(JSON.stringify(f));
  await browser.close();
}
