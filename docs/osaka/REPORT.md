# Osaka Umeda — implementation report (27 October 2026)

Branch `feature/osaka-umeda`, not merged, not pushed, not deployed.

## Integration: what was possible

alexisyang.com is served from a Cloudflare build whose source is not in this repository or on this machine. The only website
repository available, RiverManYoung (the folio, deployed to `alexisyang.com/folio/`), is where the miniature now lives: a second
Vite page (`projects/osaka-umeda/`) in the same build and deploy, sharing the folio's fonts, palette and three.js chunk, linking
back to it, and touching none of its code beyond scoping one build plugin to the folio's own page (`vite.config.ts`). The
lines for the main site — the `/projects/osaka-umeda` route, a home-page preview, a nav entry — are in [README.md](README.md).

## Completed

- **Data pipeline** (`scripts/osaka`): OSM extract → one 548 KB scene file in a local metre frame; 3,231 buildings (1,533 with
  PLATEAU-measured heights, every height tagged with its source), 209 track ways, 20 platforms, 1,141 roads, 317 zebra
  crossings, 3,127 trees. Verified against the published facts it can be checked with (the 98.5 m gap the JR roof spans).
- **City**: plinth with nameplate, roads with markings, elevated expressway and footbridges on piers, crossings, parks, building
  sites with cranes, every building under a facade shader (curtain walls, punched windows, balconies, shopfronts, night windows),
  rooftop plant, the helipad marks Japanese towers over 100 m carry, street lamps.
- **Landmarks**: JR Osaka's glass vault, bridge concourse and Toki-no-Hiroba; Hankyu's ten-track terminal and hall; the Umeda Sky
  Building with its Floating Garden; HEP FIVE's turning red wheel; Grand Green's park and SANAA canopy; Grand Front and Yodobashi
  Umeda from their OSM parts, pickable and highlighted.
- **Railway**: viaducts, ballast with sleepers, rails at 1,067 / 1,435 mm, platforms with tactile lines, canopies, buffer stops,
  catenary; JR 323 (Loop Line), JR 225 (Special Rapid, 12 cars), Hankyu 1000 and 1300 (8 cars) built in code; a deterministic,
  frame-rate-independent simulation with braking, stops, doors on the platform side, terminal reversal and block reservations.
- **Experience**: orbit / pan / zoom with bounds; seven landmarks with flights, labels and captions; follow a train (with
  occlusion avoidance); day / night; play / pause; four speeds; JR / Hankyu filters; reset; full screen; a 20 s skippable
  opening; showcase mode for a home page; reduced-motion handling; a still image and text when WebGL 2 is missing; keyboard
  shortcuts.

## Tested — how, and the results

All on this machine: Intel Core Ultra 7 155H, Intel Arc integrated graphics, Windows 11, Chrome (headless, GPU via ANGLE/D3D11),
against the **production build** (`bun run build` + `vite preview`).

| Check | Result |
|---|---|
| `bun run typecheck` (strict) | passes |
| `bun test src` (the whole repository) | 349 pass, 0 fail — including `src/osaka/rail/sim.test.ts`: all 7 services resolve on real track, Hankyu only on Hankyu track, **no two trains on the same edge or node at any 0.25 s step of a period**, continuous motion, doors only while stopped (73,556 assertions) |
| `scripts/harness/osaka.checks.ts` | **31/31**: day/night (buttons and key), pause stops the picture and run restarts it, each speed, each operator filter hides its trains, follow lists 7 services and follows one, landmark captions and labels, keys 1–7 and Esc, picking HEP FIVE by clicking the 3D model, reset, the opening plays, hands over and can be skipped, About the data, full screen offered, reduced motion (no opening, trains wait, cuts not flights), no-WebGL fallback with its still, **no console errors** |
| `scripts/harness/osaka.shots.ts`, desktop 1440 × 900 @1× | 57–60 fps in every view (p95 frame 16.7–17.1 ms; one view 33 ms at p95 while a flight settled), 47–74 draw calls, 576–604 k triangles, no quality step taken |
| same, phone viewport 390 × 844 @3× (emulated) | 60 fps at the engine's 1.5 pixel-ratio cap, 50–74 calls, 420–448 k triangles |
| page weight (gzip) | page shell 15 KB + engine 31 KB + three.js 187 KB (shared with the folio) + data 185 KB |

The 60 fps figures are capped by the display rate; the GPU had headroom (1.2–2.4 ms of render submission per frame). **The phone
row is an emulated viewport on the laptop's GPU, not a phone**: no real mobile device was available, so mobile performance is
untested. Screenshots of every view are in [screenshots/](screenshots/).

## Known limitations

- Not on alexisyang.com itself (source unavailable) and not deployed anywhere (not authorised).
- The JR roof is a symmetric segmental vault on the right footprint, not the real roof's exact profile; its height and
  along-track position are estimates. Station floor levels and rail heights are estimates, and rails are level (no grades).
- About half the buildings have estimated heights (storey counts or footprint), and ordinary buildings share one procedural
  facade; Grand Front and Yodobashi Umeda are their OSM masses with that facade, not bespoke models.
- Rolling stock is simplified (no detailed cab masks); the 1300 series uses the 1000 series' model.
- Trains cast contact shadows only, not sun shadows; the glass roof is not in the camera's collision field.
- The timetable is illustrative (7 services every 5 minutes); underground lines and Osaka Station's Umekita platforms are not shown.
- The page is in English with Japanese names; the folio's French, Chinese and Japanese editions do not reach it yet.

## Next

1. Test on real phones (iOS Safari, Android Chrome) and tune the phone defaults from measurements.
2. Wire it into alexisyang.com (README → "Put it on alexisyang.com") and add the home-page preview.
3. The JR roof's true profile and Toki-no-Hiroba's clocks; Hankyu's concourse and 3F gate hall; bespoke Grand Front and Yodobashi.
4. More services: Kyoto/Kobe line locals (207/321), the Haruka and Thunderbird at platform 11, Hankyu limited expresses.
5. French, Chinese and Japanese editions through the folio's i18n.
