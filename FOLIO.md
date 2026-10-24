# Folio → alexisyang.com/folio/

## What changed from upstream sasshi
- `profile/en.ts`, `fr.ts`, `zh.ts` — my content, taken from alexisyang.com (same facts in all three).
- `src/app/i18n.ts` — a French UI dictionary (`fr`), chosen when a profile's `lang` starts with `fr`.
- `src/paper/typeset.ts`, `src/bag/objects/ticket.ts` — French words for the printed résumé and ticket.
- `public/photos/` — my own photos from the main site; demo photos removed.
- `profile/seal.ts` — the 杨子江印 seal (`bun run seal`).
- Removed `src/profile/sample.test.ts` (it tested the demo persona). A few layout tests still name the demo persona and fail; CI only runs typecheck + build.

## Fonts (why the folio opens fast)
The CJK faces are cut to the characters the profiles print: `python3 scripts/subset-fonts.py` (needs `pip install fonttools brotli`)
writes one small woff2 per face and weight into `src/fonts/subset/`. Run it after changing any text; the Pages workflow runs it
before every build, so a pushed text change never falls back to a system font. (Before this, ~1,000 unicode-range slices were
registered and the page froze for seconds while the browser matched text against them.)

## Albums
- Cards: three pages, one chapter each (I Study & work · II Europe & beyond · III Japan 2026), eight cards a page; every city card
  has a landmark cover (`public/photos/cover-*.webp`). Licensed covers are credited on the card and in `public/photos/CREDITS.md`.
- Postcards: four sheets of six, one theme a sheet (work & study · music, science & art · at the table, by the sea · on the road).
- Photos are WebP, 960 px (covers) / 1200 px (postcards).

## Build
    bun install
    bun run build        # → dist/

## Put it on the main site (Cloudflare)
Copy everything in `dist/` into the main site's output as `folio/`, so it is served at https://alexisyang.com/folio/.
All paths are relative, so nothing needs changing. `?lang=fr` / `?lang=zh` open the other languages; `?view=text` is the plain version.

## Link it from the main site
Add one entry to the main nav, next to "Beyond work" or "CV":
- EN: `<a href="/folio/?lang=en">Folio</a>`
- FR: `<a href="/folio/?lang=fr">Folio</a>`
- 中文: `<a href="/folio/?lang=zh">作品册</a>`
- 日本語: `<a href="/folio/?lang=en">冊子</a>` (no Japanese edition yet)

## Licence (important)
sasshi is AGPL-3.0. Publishing this folio means its source must be public: push this repository to
https://github.com/AlickYang2016/RiverManYoung (public) — the page footer's "Source" link already points there.
The main site's own code is not affected as long as it only links to /folio/ and does not import this code.
