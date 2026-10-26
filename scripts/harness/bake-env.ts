/*
 * The studio's prefiltered environment, baked once into public/env/studio.bin.gz (owner 2026-10-26: Folio loads faster without
 * compiling PMREM's blur and GGX programs on every first visit; see src/book/studio-env.ts). Run with the dev server up:
 *   bun scripts/harness/bake-env.ts [http://localhost:5174/]
 * Writes the RGBA half floats (768 × 1024 CubeUV, rows bottom to top as WebGL reads them), their mantissas cut to 6 bits (≤ 0.8 %
 * off, invisible in the reflections; 288 KB instead of 1.4 MB gzipped), gzipped.
 */
import { chromium } from "playwright-core";
import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:5174/";
const b = await chromium.launch({ channel: process.env.CHANNEL ?? "msedge", headless: false, args: ["--ignore-gpu-blocklist", "--window-position=-3000,0"] });
const p = await b.newPage();
await p.goto(base);
const out = await p.evaluate(async (page) => (await import(/* @vite-ignore */ page)).bake() as Promise<string>, "/scripts/harness/bake-env.page.ts");
await b.close();
const [size, data] = out.split(":") as [string, string];
const halfs = new Uint16Array(Buffer.from(data, "base64").buffer.slice(0));
for (let i = 0; i < halfs.length; i++) halfs[i]! &= 0xfff0;
const raw = Buffer.from(halfs.buffer);
mkdirSync("public/env", { recursive: true });
const gz = gzipSync(raw, { level: 9 });
writeFileSync("public/env/studio.bin.gz", gz);
console.log(`studio ${size}: ${raw.length} bytes raw, ${gz.length} gzipped`);
