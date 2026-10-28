/*
 * Osaka-Umeda: a picture of each limited express (and a few others) at its own platform, for checking the Blender rolling
 * stock and the platform assignments by eye.
 *
 *   bun run build && bun run preview              # in another terminal
 *   bun scripts/harness/osaka.stock.ts [baseUrl] [outDir]
 *
 * For each service: run the clock fast until the train is on the base, then at normal speed until it is standing at its
 * platform (doors open), and photograph it from close by. The Umekita trains are photographed in the underground view.
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";

const base = process.argv[2] ?? "http://127.0.0.1:4173";
const out = process.argv[3] ?? "docs/osaka/screenshots";
mkdirSync(out, { recursive: true });

type Handle = {
  follow(i: number | null, distance?: number): void;
  setSpeed(x: number): void;
  setUnderground(on: boolean): void;
  services: { id: string; label: string }[];
  trains(): { index: number; onBase: boolean; nextIn: number; standing: boolean }[];
  trainPose(i: number): { pos: [number, number, number]; dir: [number, number] } | null;
  view(v: { target: [number, number, number]; distance: number; azimuth: number; polar: number }, seconds?: number): void;
};

const SHOTS: [string, string, number, number][] = [
  // [service, file, camera distance, seconds after it enters the base (surface trains: caught on the open viaduct, before the
  // platform canopies hide it; Umekita trains: photographed standing at their platform in the underground view)]
  ["thunderbird-out", "16-thunderbird", 64, 26],
  ["hakuto-down", "17-super-hakuto", 56, 14],
  ["kounotori-up", "18-kounotori", 54, 22],
  ["hamakaze-down", "19-hamakaze", 50, 14],
  ["kuroshio-down", "20-kuroshio-umekita-22", 90, -1],
  ["haruka-up", "21-haruka-umekita-24", 95, -1],
  ["hankyu-kyoto", "22-hankyu-9300", 52, 2],
  ["special-rapid-west", "23-special-rapid-225", 58, 14],
  ["yamatoji-rapid", "24-yamatoji-rapid-221", 56, 10],
];

const errors: string[] = [];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${base}/projects/osaka-umeda/?nointro`, { waitUntil: "load" });
await page.waitForFunction(() => !!(window as unknown as { __osaka?: unknown }).__osaka, null, { timeout: 90_000 });

for (const [id, file, distance, after] of SHOTS) {
  const i = await page.evaluate((sid) => ((window as any).__osaka as Handle).services.findIndex((s) => s.id === sid), id);
  if (i < 0) {
    console.log(`  ${id}: not in the timetable`);
    continue;
  }
  // fast until the train comes onto the base (first letting it leave, if it is already there)
  await page.evaluate(() => ((window as any).__osaka as Handle).setSpeed(12));
  for (let k = 0; k < 400 && after >= 0; k++) {
    if (!(await page.evaluate((n) => ((window as any).__osaka as Handle).trains()[n]!.onBase, i))) break;
    await page.waitForTimeout(150);
  }
  for (let k = 0; k < 400; k++) {
    if (await page.evaluate((n) => ((window as any).__osaka as Handle).trains()[n]!.onBase, i)) break;
    await page.waitForTimeout(150);
  }
  if (after < 0) {
    // standing at the platform with its doors open (still at speed: the dwell is long enough to catch)
    for (let k = 0; k < 600; k++) {
      if (await page.evaluate((n) => ((window as any).__osaka as Handle).trains()[n]!.standing, i)) break;
      await page.waitForTimeout(150);
    }
  } else {
    await page.evaluate(() => ((window as any).__osaka as Handle).setSpeed(1));
    await page.waitForTimeout(after * 1000);
  }
  // a front three-quarter view of the leading cars
  const ok = await page.evaluate(([n, d, under]) => {
    const h = (window as any).__osaka as Handle;
    h.setSpeed(0.0001);
    const p = h.trainPose(n);
    if (!p) return false;
    const [dx, dz] = p.dir;
    // aim at the second car, from ahead of the train and off to its right
    const tx = p.pos[0] - dx * (under ? 40 : 8);
    const tz = p.pos[2] - dz * (under ? 40 : 8);
    const ox = dx * 0.8 - dz * 0.6;
    const oz = dz * 0.8 + dx * 0.6;
    // the Umekita platforms: the whole underground station from the south-east, through the see-through street
    if (under) h.view({ target: [-262, -13, 10], distance: 300, azimuth: 2.2, polar: 0.62 });
    else h.view({ target: [tx, p.pos[1] + 1.5, -tz], distance: d, azimuth: Math.atan2(ox, oz), polar: 1.2 });
    if (under) h.setUnderground(true);
    return true;
  }, [i, distance, after < 0] as const);
  if (!ok) {
    console.log(`  ${file}: the train was not on the base when photographed`);
    continue;
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${file}.jpg`, type: "jpeg", quality: 86 });
  console.log(`  ${file}`);
  await page.evaluate(() => {
    const h = (window as any).__osaka as Handle;
    h.follow(null);
    h.setUnderground(false);
    h.setSpeed(1);
  });
}
await browser.close();
console.log(errors.length ? `console errors (${errors.length}):\n  ${errors.join("\n  ")}` : "console errors: none");
