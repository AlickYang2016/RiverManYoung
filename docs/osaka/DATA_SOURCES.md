# Osaka Umeda — data sources, licences, and what is measured versus drawn

The miniature covers 1.6 km (west–east) × 1.5 km (south–north) round JR Osaka Station. Every position in it comes from the data
below through one projection; nothing about Osaka's layout is made up. Where a number is not in any source, the model says so: it
is an estimate, labelled as one in the data file and listed here.

## Sources

| Source | What it gives | Version | Licence |
|---|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/) via the Overpass API (`scripts/osaka/fetch_osm.py`) | building footprints and parts, heights and storey counts, every track centreline, platforms, roads, crossings, parks, building sites, mapped trees, HEP FIVE's wheel | database state 2026-10-27 16:39 UTC (fetched 2026-10-27) | © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) |
| [MLIT Project PLATEAU](https://www.mlit.go.jp/plateau/) — Osaka City 3D city model | measured building heights, **as imported into OSM** (`source:height=MLIT_PLATEAU`) on 1,533 of the 3,231 buildings on the base | as present in OSM on 2026-10-27 | PLATEAU site policy (CC BY 4.0-compatible), credited on the page |
| GSI 基盤地図情報 (Fundamental Geospatial Data), via OSM | most building footprints in the district (`source=GSI/KIBAN 2500`) | as present in OSM | GSI terms, imported into OSM under ODbL |
| Owners' and operators' published figures | South Gate Building 122 m; Umeda Hankyu Building 186.95 m; the great roof's ~180 m × ~100 m; HEP FIVE's wheel Ø 75 m, top 106 m, boarding on 7F; opening years; rolling-stock dimensions | — | facts, cited in the page's text |

Not used: Google Maps, Google Earth or any other proprietary 3D data or imagery; no third-party 3D models or textures (everything
is built in code, as the rest of this repository is).

### PLATEAU directly, and Claude Code PLATEAU tools

The PLATEAU CityGML for Osaka City is distributed per city as multi-gigabyte archives; for this district its heights are already
in OpenStreetMap, building by building, with their provenance tagged, so the pipeline reads them from there rather than shipping
a CityGML parser. No official PLATEAU skill or MCP tool for Claude Code was available in this session. The newest buildings
(Grand Green Osaka, 2024–) postdate the PLATEAU survey; their heights come from OSM contributors' tags (source 2 below).

## The frame

`scripts/osaka/frame.py` ⇄ `src/osaka/geo/frame.ts`: a transverse Mercator on GRS80 centred on Toki-no-Hiroba at JR Osaka
(34.7024° N, 135.4959° E), scale factor 1. Over the ±900 m base the scale error is below 10⁻⁸ and grid north is true north to within
0.005°; one scene unit is one metre on the ground. Data is stored as (east, north) in integer decimetres; the scene uses x = east,
z = −north.

## Height sources (the `s` field of every building in `src/osaka/data/umeda.json`)

| Code | Source | Buildings |
|---|---|---|
| 1 | PLATEAU measured height (via OSM) | 1,533 |
| 2 | OSM `height` tag (contributor, usually the owner's figure) | 54 |
| 3 | documented public figure (table above) | 1 |
| 4 | estimate: `building:levels` × storey height by use (homes 3.1 m, offices 4.0 m, shops 4.4 m, hotels 3.4 m) | 771 |
| 5 | estimate from footprint area (no height or storey count anywhere) | 872 |

Buildings whose OSM outline is fully described by its `building:part`s are drawn from the parts (40 outlines), as 3D renderers of
OSM do. Station sheds, canopies and the shops under the viaducts that OSM maps over the tracks (23) are left out: the miniature
builds its own station roofs, and the trains have to stay visible.

## Railway

- 209 track ways, 879 nodes above ground (JR and Hankyu); underground lines (Hanshin, the Osaka Metro, the JR Tōzai line, the
  Umeda freight line and Osaka Station's Umekita platforms 21–24) are not drawn.
- The graph is OSM's: trains run only where OSM has track, and only along routes that never turn more than 32° at a node (no
  reversing in a switch). JR (1,067 mm) and Hankyu (1,435 mm) form separate networks in the data, as on the ground.
- In OSM, Osaka Station's platforms 3–6 do not connect to both the Kyoto and Kobe ends; the Special Rapid therefore uses
  platform 7·8, which does. Platform assignments in the model are plausible, not timetabled.
- The timetable (`src/osaka/rail/services.ts`) is illustrative: seven services, each once every 300 s of simulated time. It is
  not live running information, and the page says so.

## Approximated geometry

Built in code on the data's footprints and frames, with these estimates:

| Element | Measured / documented | Estimated |
|---|---|---|
| JR Osaka great roof | position across the tracks (the gap between the North and South Gate buildings' facing walls: 98.5 m in OSM, ~100 m published); 180 m length | along-track position (centred on where the two buildings face each other); a symmetric segmental vault, springing 32 m, crown 50 m |
| JR Osaka bridge concourse and Toki-no-Hiroba | that it spans the tracks under the roof at 3F/5F | width 34 m, 13.6–22.8 m above the street |
| Rail and platform levels | platforms 1.1 m above the rail (Japanese conventional standard) | JR rail top 7.0 m above the street (platforms over the 1F concourse), Hankyu 9.2 m (3F terminal) |
| Hankyu Osaka-Umeda | platform and track layout (OSM), buffer stops | hall roof laid over each platform (open over the tracks so the trains stay visible), concourse depth 14 m |
| Umeda Sky Building | two towers 31 × 56 m, 50 m apart; crowns stepping 38F/39F/40F; the Floating Garden's 56 m square and 36 m opening (OSM parts); 173 m | storey heights of the steps (160/164/168 m), the escalator tube's line |
| HEP FIVE wheel | plane and centre (OSM `attraction=big_wheel`), Ø 75 m, top 106 m | spoke count, A-frame legs, 52 gondolas |
| Grand Green Osaka canopy | outline and 13 m roof height (OSM) | the undulation |
| Tower cranes | Umekita's building sites (OSM `landuse=construction`) | positions, heights |
| Trees | 313 mapped trees (OSM) | park planting (1,002, 7.5 m jittered grid in park polygons) and street trees (1,812, every 10 m along major streets) |
| Viaduct piers, catenary masts | — | every 12 m / 48 m, kept clear of roads and of other tracks |

## Rebuilding the data

```
python -m pip install shapely pyproj
python scripts/osaka/fetch_osm.py      # → scripts/osaka/raw/osm.json (not versioned)
python scripts/osaka/build_scene.py    # → src/osaka/data/umeda.json, with a summary of what was kept, dropped and estimated
bun test src/osaka                     # the timetable still resolves and stays collision-free
```
