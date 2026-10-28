/*
 * Osaka-Umeda: does every control do what it says? Drives the page as a visitor would (clicks and keys, not the engine's
 * handle) and checks the result, plus the opening, reduced motion, and the no-WebGL fallback.
 *
 *   bun scripts/harness/osaka.checks.ts [baseUrl]      # against `bun run dev` or `bun run preview`
 *
 * Exits non-zero if any check fails.
 */
import { createHash } from "node:crypto";
import { chromium, type Page } from "playwright-core";

const base = process.argv[2] ?? "http://127.0.0.1:5188";
const url = `${base}/projects/osaka-umeda/`;
const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, note?: string) => {
  results.push([name, ok, note]);
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${note ? ` — ${note}` : ""}`);
};
const errors: string[] = [];

type H = { trains(): { index: number; onBase: boolean }[]; services: { op: string }[]; stats(): { fps: number } };
const handle = <T>(page: Page, fn: (h: H) => T) => page.evaluate(fn as never) as Promise<T>;
const ready = (page: Page) => page.waitForFunction(() => !!(window as unknown as { __osaka?: unknown }).__osaka, null, { timeout: 60_000 });
/** A fingerprint of what is on screen in the model's half of the page (a real screenshot: a WebGL canvas reads back blank). */
const camera = async (page: Page) => createHash("sha1").update(await page.screenshot({ type: "png", clip: { x: 520, y: 120, width: 820, height: 620 } })).digest("hex");

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const watch = (page: Page) => {
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
};

// ---------------------------------------------------------------- the controls
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page);
  await page.goto(`${url}?nointro`);
  await ready(page);
  await page.waitForTimeout(800);
  const root = page.locator(".osaka");

  await page.getByRole("button", { name: "Night", exact: true }).click();
  check("Night turns the page and the model to night", (await root.getAttribute("data-night")) !== null);
  await page.getByRole("button", { name: "Day", exact: true }).click();
  check("Day turns it back", (await root.getAttribute("data-night")) === null);
  await page.keyboard.press("n");
  check("key N toggles night", (await root.getAttribute("data-night")) !== null);
  await page.keyboard.press("n");
  await page.waitForTimeout(2000); // let the day/night fade finish

  // pausing: the picture stops changing while the camera is still
  await page.getByRole("button", { name: "Pause trains" }).click();
  await page.waitForTimeout(400);
  const a = await camera(page);
  await page.waitForTimeout(1500);
  const b = await camera(page);
  check("Pause trains freezes the trains", a === b && (await page.getByRole("button", { name: "Run trains" }).count()) === 1);
  await page.getByRole("button", { name: "Run trains" }).click();
  await page.waitForTimeout(1500);
  check("Run trains starts them again", (await camera(page)) !== b);

  for (const s of ["2", "4", "½", "1"]) {
    await page.getByRole("button", { name: `Speed ${s === "½" ? "0.5" : s} times` }).click();
    check(`speed ${s}× is selected`, (await page.getByRole("button", { name: `Speed ${s === "½" ? "0.5" : s} times` }).getAttribute("aria-pressed")) === "true");
  }

  for (const op of ["JR", "Hankyu"]) {
    const btn = page.getByRole("button", { name: op, exact: true });
    await btn.click();
    const opId = op === "JR" ? "jr" : "hankyu";
    const anyOn = await page.evaluate((o) => {
      const h = (window as unknown as { __osaka: H }).__osaka;
      return h.trains().some((t) => t.onBase && h.services[t.index]!.op === o);
    }, opId);
    check(`${op} toggle hides that railway's trains`, (await btn.getAttribute("aria-pressed")) === "false" && !anyOn);
    await btn.click();
  }

  await page.getByRole("button", { name: "Follow a train" }).click();
  await page.waitForTimeout(600); // the menu's status line fills in on its first tick
  const items = await page.getByRole("menuitem").count();
  check("Follow a train lists the services", items >= 7, `${items} entries`);
  const onBase = page.getByRole("menuitem").filter({ hasText: "on the model now" }).first();
  if ((await onBase.count()) > 0) {
    await onBase.click();
    await page.waitForTimeout(2500);
    check("following shows the train's caption", (await page.locator(".osaka-caption").textContent())?.includes("Following") ?? false);
    await page.getByRole("button", { name: "Stop following" }).first().click();
  } else check("following a train", false, "no train on the base at that moment");

  for (const [i, name] of [[1, "JR Osaka Station"], [5, "Umeda Sky Building"]] as const) {
    await page.locator(".osaka-index button").nth(i - 1).click();
    await page.waitForTimeout(2600);
    const cap = (await page.locator(".osaka-caption h2").textContent()) ?? "";
    const label = await page.locator(".osaka-label").evaluate((e) => getComputedStyle(e).opacity);
    check(`landmark ${name}: caption and label`, cap.includes(name) && label === "1");
  }
  await page.keyboard.press("3");
  await page.waitForTimeout(400);
  check("key 3 selects Grand Front Osaka", ((await page.locator(".osaka-caption h2").textContent()) ?? "").includes("Grand Front"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check("Esc returns to the whole district", (await page.locator(".osaka-caption h2").count()) === 0);

  // picking a landmark in the model itself: click the HEP FIVE wheel where it is drawn
  await page.locator(".osaka-index button").nth(5).click();
  await page.waitForTimeout(2600);
  await page.keyboard.press("Escape");
  await page.mouse.click(1440 / 2 + 173, 900 / 2 + 6); // the view target, where the words column offset puts it
  await page.waitForTimeout(500);
  const picked = (await page.locator(".osaka-caption h2").textContent()) ?? "";
  check("clicking a landmark in the model selects it", picked.length > 0, picked ? `picked “${picked.trim()}”` : "nothing under the pointer");

  const before = await camera(page);
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.waitForTimeout(2400);
  check("Reset view moves the camera home", (await camera(page)) !== before);

  await page.getByRole("button", { name: "Opening" }).click();
  await page.waitForTimeout(500);
  const skip = page.getByRole("button", { name: "Skip the opening" });
  check("Opening plays the introduction", (await skip.count()) === 1);
  await skip.click();
  check("Skip the opening ends it", (await skip.count()) === 0);

  await page.getByRole("button", { name: "About the data" }).click();
  check("About the data opens", (await page.getByRole("dialog").count()) === 1);
  await page.keyboard.press("Escape");
  check("Esc closes it", (await page.getByRole("dialog").count()) === 0);

  const fs = page.getByRole("button", { name: "Full screen" });
  check("Full screen control is offered where the browser supports it", (await fs.count()) === 1);
  await page.close();
}

// ---------------------------------------------------------------- the opening, unprompted
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  watch(page);
  await page.goto(url);
  await ready(page);
  await page.waitForTimeout(600);
  check("the opening plays on a first visit", (await page.getByRole("button", { name: "Skip the opening" }).count()) === 1);
  await page.waitForTimeout(23_000);
  check("…and hands over after about 20 s", (await page.getByRole("button", { name: "Skip the opening" }).count()) === 0);
  await page.close();
}

// ---------------------------------------------------------------- reduced motion
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(url);
  await ready(page);
  await page.waitForTimeout(600);
  check("reduced motion: no opening", (await page.getByRole("button", { name: "Skip the opening" }).count()) === 0);
  check("reduced motion: trains wait to be started", (await page.getByRole("button", { name: "Run trains" }).count()) === 1);
  await page.locator(".osaka-index button").nth(1).click();
  await page.waitForTimeout(150);
  const label = await page.locator(".osaka-label").evaluate((e) => getComputedStyle(e).opacity);
  check("reduced motion: a landmark is a cut, not a flight", label === "1");
  await ctx.close();
}

// ---------------------------------------------------------------- no WebGL
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === "webgl2" || type === "webgl") return null;
      return (get as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto(url);
  await page.waitForTimeout(1500);
  const text = (await page.locator(".osaka-fallback").textContent()) ?? "";
  check("without WebGL the page shows a still and explains itself", text.includes("could not start") && text.includes("Osaka Umeda") && (await page.locator(".osaka-fallback img").evaluate((i) => (i as HTMLImageElement).naturalWidth)) > 0);
  await page.close();
}

await browser.close();
check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
const failed = results.filter((r) => !r[1]);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
