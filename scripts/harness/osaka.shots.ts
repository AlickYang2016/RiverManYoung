/*
 * Osaka-Umeda: screenshots and a performance reading from a real browser on this machine's GPU.
 *
 *   bun run dev                                   # in another terminal (or: bun run build && bun run preview)
 *   bun scripts/harness/osaka.shots.ts [baseUrl] [outDir]
 *
 * Headless Chrome (the installed one, channel "chrome") with the GPU on. For each view: set it through the page's own handle
 * (window.__osaka), let it settle, measure the frame rate over three seconds of drawing (the trains keep it drawing), take a
 * picture. Prints the GPU it ran on, the frame rates, the draw calls, and every console error. Pictures go to
 * docs/osaka/screenshots/ by default.
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";

const base = process.argv[2] ?? "http://127.0.0.1:5188";
const out = process.argv[3] ?? "docs/osaka/screenshots";
mkdirSync(out, { recursive: true });

type Handle = {
  focus(id: string | null): void;
  follow(i: number | null): void;
  setNight(on: boolean): void;
  setSpeed(x: number): void;
  resetView(): void;
  stats(): { fps: number; ms: number; calls: number; triangles: number; pixelRatio: number; shadows: boolean; level: number };
  services: { id: string; op: string }[];
  trains(): { index: number; onBase: boolean; nextIn: number }[];
};

/** Follows the first train of `op` that is on the base (waiting for one if none is). */
async function followOn(page: Page, op: string): Promise<void> {
  for (let k = 0; k < 120; k++) {
    const i = await page.evaluate((o) => {
      const h = (window as unknown as { __osaka: Handle }).__osaka;
      const t = h.trains().find((s) => s.onBase && h.services[s.index]!.op === o);
      return t ? t.index : -1;
    }, op);
    if (i >= 0) {
      await call(page, "follow", i);
      return;
    }
    await page.waitForTimeout(1000);
  }
}

const errors: string[] = [];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader=false"] });

async function open(page: Page, query: string): Promise<void> {
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${page.viewportSize()?.width}px: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  const t0 = Date.now();
  await page.goto(`${base}/projects/osaka-umeda/${query}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!(window as unknown as { __osaka?: unknown }).__osaka, null, { timeout: 60_000 });
  console.log(`  ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

const call = (page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => {
    const h = (window as unknown as { __osaka: Record<string, (...x: unknown[]) => unknown> }).__osaka;
    return h[f as string]!(...(a as unknown[]));
  }, [fn, args] as const);

async function measure(page: Page, seconds = 3): Promise<{ fps: number; p95: number }> {
  return page.evaluate(async (s) => {
    const times: number[] = [];
    let last = performance.now();
    const end = last + s * 1000;
    await new Promise<void>((done) => {
      const f = (t: number) => {
        times.push(t - last);
        last = t;
        if (t < end) requestAnimationFrame(f);
        else done();
      };
      requestAnimationFrame(f);
    });
    times.shift();
    const sorted = [...times].sort((a, b) => a - b);
    return { fps: Math.round((1000 * times.length) / times.reduce((a, b) => a + b, 0)), p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]! * 10) / 10 };
  }, seconds);
}

async function shot(page: Page, name: string, settle = 3200): Promise<void> {
  await page.waitForTimeout(settle);
  const m = await measure(page);
  const s = (await page.evaluate(() => (window as unknown as { __osaka: Handle }).__osaka.stats())) as ReturnType<Handle["stats"]>;
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 86 });
  console.log(`  ${name.padEnd(22)} ${String(m.fps).padStart(3)} fps (p95 frame ${m.p95} ms) · ${s.calls} calls · ${Math.round(s.triangles / 1000)}k tris · dpr ${s.pixelRatio} · shadows ${s.shadows ? "on" : "off"} · step ${s.level}`);
}

// ---------------------------------------------------------------- desktop
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const gpu = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown";
  });
  console.log(`GPU: ${gpu}\ndesktop 1440×900 @1x`);
  await open(page, "?nointro&debug");
  await shot(page, "01-overview");
  await call(page, "focus", "jr-osaka");
  await shot(page, "02-jr-osaka");
  await call(page, "focus", "hankyu-umeda");
  await shot(page, "03-hankyu-umeda");
  await call(page, "focus", "sky-building");
  await shot(page, "04-sky-building");
  await call(page, "focus", "hep-five");
  await shot(page, "05-hep-five");
  await call(page, "focus", "grand-green");
  await shot(page, "06-grand-green");
  await followOn(page, "hankyu");
  await shot(page, "07-train-hankyu", 4500);
  await followOn(page, "jr");
  await shot(page, "08-train-jr", 4500);
  await call(page, "follow", null);
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.getByRole("button", { name: "Night", exact: true }).click();
  await shot(page, "09-night", 4200);
  await call(page, "focus", "jr-osaka");
  await shot(page, "10-night-jr");
  await page.close();
}

// ---------------------------------------------------------------- phone
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  console.log("phone 390×844 @3x (emulated touch; same GPU)");
  await open(page, "?nointro&debug");
  await shot(page, "11-phone-overview");
  await call(page, "focus", "hankyu-umeda");
  await shot(page, "12-phone-hankyu");
  await page.close();
}

// ---------------------------------------------------------------- the home-page preview
{
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  console.log("showcase 960×540");
  await open(page, "?mode=showcase");
  await shot(page, "13-showcase", 2500);
  await page.close();
}

// ---------------------------------------------------------------- the still for browsers without WebGL (no words over it)
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  await open(page, "?mode=showcase");
  await page.addStyleTag({ content: ".osaka-showcase-cap, .osaka::after { display: none !important; }" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/preview-still.jpg`, type: "jpeg", quality: 90 });
  await page.close();
}

await browser.close();
console.log(errors.length ? `console errors (${errors.length}):\n  ${errors.join("\n  ")}` : "console errors: none");
