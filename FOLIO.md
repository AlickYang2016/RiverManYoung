# Folio → alexisyang.com/folio/

## What changed from upstream sasshi
- `profile/en.ts`, `fr.ts`, `zh.ts` — my content, taken from alexisyang.com (same facts in all three).
- `src/app/i18n.ts` — a French UI dictionary (`fr`), chosen when a profile's `lang` starts with `fr`.
- `src/paper/typeset.ts`, `src/bag/objects/ticket.ts` — French words for the printed résumé and ticket.
- `public/photos/` — my own photos from the main site; demo photos removed.
- `profile/seal.ts` — the 杨子江印 seal (`bun run seal`).
- Removed `src/profile/sample.test.ts` (it tested the demo persona). A few layout tests still name the demo persona and fail; CI only runs typecheck + build.

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
https://github.com/AlickYang2016/folio (public) — the page footer's "Source" link already points there.
The main site's own code is not affected as long as it only links to /folio/ and does not import this code.
