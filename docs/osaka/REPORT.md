# Osaka Umeda — implementation report (28 October 2026)

Branch `feature/osaka-umeda`, not merged, not pushed, not deployed.

## Integration: what was possible

alexisyang.com is served from a Cloudflare build whose source is not in this repository or on this machine. The only website
repository available, RiverManYoung (the folio, deployed to `alexisyang.com/folio/`), is where the miniature now lives: a second
Vite page (`projects/osaka-umeda/`) in the same build and deploy, sharing the folio's fonts, palette and three.js chunk, linking
back to it, and touching none of its code beyond scoping one build plugin to the folio's own page (`vite.config.ts`). The
lines for the main site — the `/projects/osaka-umeda` route, a home-page preview, a nav entry — are in [README.md](README.md).

## Completed

- **Data pipeline** (`scripts/osaka`): OSM extract → one 553 KB scene file in a local metre frame; 3,231 buildings (1,533 with
  PLATEAU-measured heights, every height tagged with its source; 37 with an OSM facade colour), 230 track ways, 22 platforms,
  1,141 roads, 317 zebra crossings, 3,127 trees. Tracks are clipped where they cross the edge of the data, so all four Kyoto-line
  tracks now reach it (before, two stopped short and platforms 3–6 could not be reached from Kyoto).
- **City**: plinth with nameplate, roads with markings, elevated expressway and footbridges on piers, crossings, parks, building
  sites with cranes, every building under a facade shader, the landmarks in their photographed tones, rooftop plant, helipad
  marks, street lamps.
- **Landmarks**: JR Osaka's glass vault, bridge concourse and Toki-no-Hiroba; Hankyu's nine-track terminal and hall; the Umeda Sky
  Building (deep blue mirror glass, silver Floating Garden); HEP FIVE's turning red wheel; Grand Green's park and canopy; Grand
  Front and Yodobashi Umeda Tower from their OSM parts.
- **Rolling stock, modelled in Blender** (`scripts/osaka/blender/rolling_stock.py`, Blender 5.2.3 LTS): 14 series to their
  published dimensions and photographed liveries — JR 323 (Loop Line), 221 (Yamatoji Rapid), 225-0 (Special Rapid), 225-5100
  (Kansai Airport / Kishuji Rapid), 321 (locals), 683-4000 (Thunderbird), HOT7000 (Super Hakuto), 287 (Kounotori; Kuroshio in its
  ocean-green line), KiHa 189 (Hamakaze), 281 (Haruka), Hankyu 1000, 1300 and 9300. Cab, middle and pantograph cars, door leaves,
  headlamp positions; one GLB, the whole fleet drawn as one batched draw call.
- **Railway**: 25 services on an illustrative 10-minute timetable, each at the platform it uses at Osaka (JR West's assignments)
  and Osaka-umeda (Hankyu's line-by-line tracks); the Umekita line underground through platforms 21–24, its open cutting and
  portal near Fukushima and its viaduct toward Nishikujō; trains climb and pitch on its grades. No Shinkansen (it calls at
  Shin-Osaka, outside the model).
- **Experience**: everything before, plus the Underground view (U; turned on by itself when following a Haruka or Kuroshio).

## Tested — how, and the results

All on this machine: Intel Core Ultra 7 155H, Intel Arc integrated graphics, Windows 11, Chrome (headless, GPU via ANGLE/D3D11),
against the **production build** (`bun run build` + `vite preview`).

| Check | Result |
|---|---|
| `bun run typecheck` (strict) | passes |
| `bun test src` (the whole repository) | 351 pass, 0 fail — including `src/osaka/rail/sim.test.ts`: all 25 services resolve on real track; Hankyu only on Hankyu track; **no two trains on the same edge or node at any 0.25 s step of the 600 s period**; **every through train stops beside its own platform face, on the named side, at the platform's level** (the curved Umekita platforms measured across where the train stands); the Haruka and Kuroshio reach −14.5 m at Umekita and come up onto the viaduct; continuous, frame-rate-independent motion; doors only while stopped |
| `scripts/harness/osaka.checks.ts` | **31/31**, no console errors |
| `scripts/harness/osaka.stock.ts` | each limited express photographed on the model (16–24 in [screenshots/](screenshots/)), no console errors |
| `scripts/harness/osaka.shots.ts`, desktop 1440 × 900 @1× | 60 fps in every view (p95 frame 16.8 ms), 42–69 draw calls, 523–771 k triangles (the fleet adds up to ~170 k), no quality step taken |
| same, phone viewport 390 × 844 @3× (emulated) | 60 fps at the engine's 1.5 pixel-ratio cap, 44–69 calls, 366–540 k triangles |
| page weight (gzip) | page shell 16 KB + engine 47 KB + three.js 187 KB (shared with the folio) + data 186 KB + rolling stock 484 KB (loaded while the city is built) |

**The phone row is an emulated viewport on the laptop's GPU, not a phone**: no real mobile device was available.

## Known limitations

- Not on alexisyang.com itself (source unavailable) and not deployed anywhere (not authorised).
- No Shinkansen, deliberately: none runs within the modelled 1.6 × 1.5 km (Shin-Osaka is 3.5 km north).
- Eastbound Kyoto-line locals (platform 7) are left out: OSM's track there does not connect to the Kyoto line. The Thunderbird's
  empty run into platform 11 is shown arriving from the west.
- The Umekita line's depths, the cutting and the portal mouth are estimates (DATA_SOURCES.md); the timetable is illustrative.
- Rolling stock: noses are approximations of each series' shape; one cab type per series; the Haruka's 271 add-on cars are drawn
  as 281s; roof and underfloor equipment are simple solids. The GLB is 2.7 MB (0.5 MB gzipped).
- The JR roof is a symmetric vault on the right footprint, not its exact profile; about half the buildings have estimated heights;
  only 37 ordinary buildings have a mapped colour, the rest keep the model's palette by use.
- The page is in English with Japanese names; the folio's French, Chinese and Japanese editions do not reach it yet.

## Next

1. Test on real phones (iOS Safari, Android Chrome); consider Draco compression for the rolling stock.
2. Wire it into alexisyang.com (README → "Put it on alexisyang.com").
3. The JR roof's true profile and Toki-no-Hiroba's clocks; bespoke Grand Front and Yodobashi.
4. French, Chinese and Japanese editions through the folio's i18n.
