"""
Turn the raw OpenStreetMap extract into src/osaka/data/umeda.json, the one data file the miniature loads.

    python scripts/osaka/fetch_osm.py     # once, or to refresh: raw/osm.json
    python scripts/osaka/build_scene.py   # → src/osaka/data/umeda.json (+ a summary of what was kept, dropped, estimated)

Everything is in the frame of frame.py: (east, north) metres from JR Osaka's Toki-no-Hiroba, stored as integer decimetres.
Every building height carries its source (HEIGHT_SOURCES), so the page and the docs can tell measured from estimated; nothing
missing is invented silently: an unknown height is a labelled estimate from the footprint, an unknown track is left out.
"""

import json
import math
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from shapely import prepared
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
from shapely.ops import polygonize, unary_union

from frame import ORIGIN_LAT, ORIGIN_LON, SCENE_N, SCENE_X, to_local

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / "src" / "osaka" / "data" / "umeda.json"

CLIP = box(SCENE_X[0], SCENE_N[0], SCENE_X[1], SCENE_N[1])
RAIL_BOX = CLIP.buffer(160, join_style=2)  # tracks run on past the base so trains can slide in from the cut edge

# The Umeda freight line (梅田貨物線), underground since February 2023 through Osaka Station's Umekita platforms 21–24. Its
# south portal is inside the base (OSM: the tunnel begins where the line, having crossed Naniwa-suji at grade and passed under
# the JR Kobe line viaduct by Fukushima, turns north); its north portal is 250 m past the base's north edge (OSM, at about
# (3, 1097) m — not in the extract, so given here). No open source gives the depths: the line is laid as a 3.5 % grade from each
# portal down to the station's level, rail top 14.5 m below the street (the platforms are published as about 15 m down, B2).
UMEKITA_X_MAX = -150.0  # the corridor is the JR tunnel track west of this (east of it: the JR Tōzai line, left out)
UMEKITA_RAIL = -14.5
UMEKITA_GRADE = 0.035
NORTH_PORTAL = (3.0, 1097.0)
PORTAL_DEPTH = -6.8  # rail top at the south portal's mouth (a train and its wires under the street), after an open cutting
VIADUCT_GRADE = 0.025  # from the Fukushima level crossing the line climbs to its viaduct toward Nishikujō
VIADUCT_TOP = 7.0


# OSM building:colour → the facade tone the miniature paints. Named colours are the facade's own materials as they read from the
# street (OSM "white" on a Japanese office block is off-white tile or panel, not paper white), so each maps to a weathered tone.
FACADE_TONES = {
    "white": 0xE6E3DC, "beige": 0xD9CBB0, "brown": 0x8A6A52, "grey": 0xA7AAAB, "gray": 0xA7AAAB, "black": 0x3A3D40,
    "red": 0xA4473C, "green": 0x7E9479, "blue": 0x6F8396, "yellow": 0xD8C27A, "orange": 0xC98552, "silver": 0xBFC3C6,
    "pink": 0xD6A9A4, "cream": 0xE8DFC8, "ivory": 0xEAE4D2, "tan": 0xC8AE8A, "maroon": 0x6E2B2A,
}


# The landmarks' facade tones where OSM has none, from photographs (Wikimedia Commons, docs/osaka/DATA_SOURCES.md): what each
# reads as from a few hundred metres in daylight.
LANDMARK_TONES = {
    "jr-osaka": 0xB6C0C7,  # North Gate Building (LUCUA): silver-grey glass
    "hankyu-umeda": 0xA2AAB1,  # Umeda Hankyu Building: grey glass over a stone base
    "grand-front": 0xA9B7C3,  # blue-grey glass between pale fins
    "grand-green": 0x8DA6BC,  # the towers' bluish curtain walls
    "hep-five": 0xDAD9D4,  # light grey panels (the red is the wheel and the band at street level)
    "yodobashi": 0x59616A,  # Yodobashi Umeda Tower: dark glass
}
TONE_BY_ID = {
    "w161450829": 0xD8CFBF,  # South Gate Building (Daimaru, Hotel Granvia): pale stone
}


def colour_of(v) -> int | None:
    if not v:
        return None
    v = v.strip().lower().split(";")[0]
    if v in FACADE_TONES:
        return FACADE_TONES[v]
    m = re.fullmatch(r"#?([0-9a-f]{6})", v)
    return int(m.group(1), 16) if m else None


def underground_way(e) -> bool:
    t = e.get("tags", {})
    return (num(t.get("layer")) or 0) < 0 or t.get("tunnel") == "yes" or t.get("location") == "underground"

# The source of a building's height, stored per building (key "s").
HEIGHT_SOURCES = {
    1: "PLATEAU measured height (MLIT Project PLATEAU, imported into OSM with source:height=MLIT_PLATEAU)",
    2: "OSM height tag (contributor-entered, usually from the owner's published figure)",
    3: "documented public figure (DOCUMENTED below)",
    4: "estimate from building:levels × storey height by use",
    5: "estimate from footprint area (no height or levels in any source)",
}

# Heights from the owners' published figures where OSM has only a storey count; each is cited in docs/osaka/DATA_SOURCES.md.
DOCUMENTED = {
    "w161450829": 122.0,  # South Gate Building, Osaka Station City (27F)
    "w494976864": 186.95,  # Umeda Hankyu Building office tower (41F)
}

# Storey heights for the levels estimate (m per floor + parapet), by use.
STOREY = {"res": 3.1, "off": 4.0, "ret": 4.4, "hot": 3.4, "ind": 5.0, "gen": 3.5}

USE_CODES = {"gen": 0, "off": 1, "ret": 2, "res": 3, "hot": 4, "ind": 5}

# Landmarks: OSM ids and name patterns. The page picks, labels and dresses these; the Sky Building is rebuilt from its footprint.
LANDMARK_IDS = {
    "jr-osaka": {"w162183788", "w161450829", "w494976863"},
    "hankyu-umeda": {"w655980091"},
    "grand-front": {"w469076711", "w469076709", "w469076710", "w220195614"},
    "grand-green": {"w1147393980", "w1147394015", "w1147394026", "w1147394027", "w1347368433", "w1314389103", "w1314389105"},
    "sky-building": {"r3389505"},
    "hep-five": {"w161451126"},
    "yodobashi": {"w788888925"},
}
LANDMARK_NAMES = [
    ("grand-front", re.compile(r"グランフロント|GRAND FRONT|ナレッジキャピタル|インターコンチネンタル", re.I)),
    ("grand-green", re.compile(r"グラングリーン|GRAND GREEN|うめきた(グリーン|公園)", re.I)),
    ("yodobashi", re.compile(r"ヨドバシ|LINKS UMEDA", re.I)),
    ("sky-building", re.compile(r"梅田スカイビル|Umeda Sky", re.I)),
]
# Rebuilt by hand (src/osaka/landmarks): the OSM mass is dropped so the two never overlap.
REBUILT = {"sky-building"}
# Grand Green's SANAA canopy (大屋根広場, building:part=roof): drawn as its own undulating roof, not as a block.
CANOPY_ID = "w1314389106"

ROAD_W = {
    "motorway": 15.0, "motorway_link": 7.5, "trunk": 20.0, "trunk_link": 7.5, "primary": 16.0, "primary_link": 7.0,
    "secondary": 12.0, "secondary_link": 6.5, "tertiary": 9.5, "tertiary_link": 6.0, "unclassified": 6.5,
    "residential": 5.5, "living_street": 5.0, "service": 4.0, "pedestrian": 6.0,
}
ROAD_CLASS = {k: i for i, k in enumerate(["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service", "pedestrian", "deck"])}


def dm(v: float) -> int:
    return int(round(v * 10))


def num(s) -> float | None:
    if s is None:
        return None
    m = re.match(r"\s*(-?\d+(?:\.\d+)?)", str(s))
    return float(m.group(1)) if m else None


def pts(geom) -> list[tuple[float, float]]:
    return [to_local(p["lon"], p["lat"]) for p in geom]


def ring_out(poly: Polygon) -> list[list[int]]:
    """Exterior first (counter-clockwise), then holes (clockwise), each as a flat [x, n, x, n, …] in decimetres, unclosed."""
    from shapely.geometry.polygon import orient

    p = orient(poly.simplify(0.15, preserve_topology=True), 1.0)
    rings = [p.exterior] + list(p.interiors)
    out = []
    for r in rings:
        cs = list(r.coords)[:-1]
        flat = []
        for x, n in cs:
            flat += [dm(x), dm(n)]
        if len(cs) >= 3:
            out.append(flat)
    return out


def polys_of(g) -> list[Polygon]:
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, MultiPolygon):
        return list(g.geoms)
    return [p for p in getattr(g, "geoms", []) if isinstance(p, Polygon)]


def way_polygon(el) -> Polygon | None:
    g = el.get("geometry")
    if not g or len(g) < 4:
        return None
    p = Polygon(pts(g))
    if not p.is_valid:
        p = p.buffer(0)
    return p if not p.is_empty and p.area > 1.0 else None


def relation_polygon(el):
    outer, inner = [], []
    for m in el.get("members", []):
        if m.get("type") != "way" or not m.get("geometry"):
            continue
        line = LineString(pts(m["geometry"]))
        (inner if m.get("role") == "inner" else outer).append(line)
    if not outer:
        return None
    o = unary_union(list(polygonize(unary_union(outer))))
    if inner:
        o = o.difference(unary_union(list(polygonize(unary_union(inner)))))
    return o if not o.is_empty else None


def obb(geom) -> dict:
    """Oriented bounding box: centre, angle of the long side (radians from east, counter-clockwise), length, width."""
    r = geom.minimum_rotated_rectangle
    cs = list(r.exterior.coords)[:4]
    e0 = (cs[1][0] - cs[0][0], cs[1][1] - cs[0][1])
    e1 = (cs[2][0] - cs[1][0], cs[2][1] - cs[1][1])
    l0, l1 = math.hypot(*e0), math.hypot(*e1)
    a, length, width = (math.atan2(e0[1], e0[0]), l0, l1) if l0 >= l1 else (math.atan2(e1[1], e1[0]), l1, l0)
    c = r.centroid
    return {"c": [round(c.x, 2), round(c.y, 2)], "a": round(a, 5), "l": round(length, 2), "w": round(width, 2)}


def use_of(t: dict) -> str:
    b = (t.get("building") or t.get("building:part") or "").lower()
    if b in ("apartments", "residential", "house", "detached", "dormitory", "terrace"):
        return "res"
    if b in ("hotel",) or t.get("tourism") == "hotel":
        return "hot"
    if b in ("retail", "supermarket", "kiosk") or "shop" in t:
        return "ret"
    if b in ("office", "commercial", "government", "civic", "public", "bank"):
        return "off"
    if b in ("industrial", "warehouse", "parking", "garage", "garages", "service", "train_station", "transportation"):
        return "ind"
    return "gen"


def main() -> None:
    raw = json.loads((HERE / "raw" / "osm.json").read_text(encoding="utf-8"))
    els = raw["elements"]
    by_id = {f"{e['type'][0]}{e['id']}": e for e in els}
    log: dict[str, list] = defaultdict(list)

    # ---------------------------------------------------------------- railway corridor (also used to clear buildings off tracks)
    rail_ways = []
    for e in els:
        t = e.get("tags", {})
        if e["type"] != "way" or t.get("railway") != "rail" or "geometry" not in e:
            continue
        layer = num(t.get("layer")) or 0
        op = t.get("operator", "") + t.get("name", "")
        line = LineString(pts(e["geometry"]))
        underground = layer < 0 or t.get("tunnel") == "yes" or t.get("location") == "underground"
        # the one underground line kept: the Umeda freight line through Osaka Station's Umekita platforms (21–24), which the
        # Haruka and Kuroshio use; it comes up inside the base near Fukushima. The Hanshin, Metro and JR Tōzai lines stay out.
        if underground and not (t.get("operator") == "西日本旅客鉄道" and ("梅田貨物線" in op or ("東西線" not in op and line.centroid.x < UMEKITA_X_MAX))):
            continue
        if "阪神" in op or "Metro" in op:
            continue
        if not line.intersects(RAIL_BOX):
            continue
        rail_ways.append((e, line, "hankyu" if "阪急" in op else "jr"))

    platforms = []
    for e in els:
        t = e.get("tags", {})
        if e["type"] != "way" or not (t.get("railway") == "platform" or t.get("public_transport") == "platform"):
            continue
        layer = num(t.get("layer"))
        ref = t.get("ref", "")
        umekita = any(r in ref.split(";") for r in ("21", "22", "23", "24"))  # Osaka Station's Umekita platforms, B2
        if layer is not None and layer < 0 and not umekita:
            continue
        g = e.get("geometry")
        if not g:
            continue
        p = pts(g)
        poly = Polygon(p) if len(p) >= 4 and p[0] == p[-1] else LineString(p).buffer(4.0, cap_style=2)
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.is_empty or not poly.intersects(CLIP) or poly.area < 30:
            continue
        op = "hankyu" if any(poly.distance(l) < 3.0 for (w, l, o) in rail_ways if o == "hankyu") and poly.centroid.y > 150 else "jr"
        platforms.append({"poly": poly, "op": op, "ref": ref, "id": f"w{e['id']}", **({"ug": True} if umekita else {})})

    # what is under the street clears no building off it
    corridor = unary_union([pl["poly"] for pl in platforms if not pl.get("ug")] + [l.buffer(2.4) for (w, l, o) in rail_ways if not underground_way(w)])
    corridor_p = prepared.prep(corridor)

    # ---------------------------------------------------------------- buildings
    raw_b = []
    for e in els:
        t = e.get("tags", {})
        if not ("building" in t or "building:part" in t) or e["type"] not in ("way", "relation"):
            continue
        if t.get("building") in ("roof",) and "building:part" not in t and t.get("layer") not in (None, "0"):
            pass  # elevated canopies: kept, drawn thin (min_height below)
        if t.get("location") == "underground" or (num(t.get("layer")) or 0) < 0:
            continue
        geom = way_polygon(e) if e["type"] == "way" else relation_polygon(e)
        if geom is None or not geom.intersects(CLIP):
            continue
        raw_b.append((f"{e['type'][0]}{e['id']}", t, geom))

    parts = [(i, t, g) for (i, t, g) in raw_b if "building:part" in t]
    part_index = [(g.representative_point(), g.area, i) for (i, t, g) in parts]

    def landmark_of(oid: str, t: dict, g) -> str | None:
        for lm, ids in LANDMARK_IDS.items():
            if oid in ids:
                return lm
        nm = (t.get("name", "") + " " + t.get("name:en", ""))
        for lm, pat in LANDMARK_NAMES:
            if pat.search(nm):
                return lm
        return None

    sky = relation_polygon(by_id["r3389505"])
    sky_zone = sky.buffer(3.0) if sky is not None else None

    outline_lm = [(g, landmark_of(oid, t, g)) for (oid, t, g) in raw_b if "building:part" not in t]
    outline_lm = [(prepared.prep(g), lm) for (g, lm) in outline_lm if lm]

    buildings = []
    landmark_geoms: dict[str, list] = defaultdict(list)
    for oid, t, g in raw_b:
        if oid == CANOPY_ID:
            log["building:rebuilt-canopy"].append(oid)
            continue
        is_part = "building:part" in t
        lm = landmark_of(oid, t, g)
        if lm is None and is_part:
            rp = g.representative_point()
            lm = next((l for (pg, l) in outline_lm if pg.contains(rp)), None)
        if sky_zone is not None and g.representative_point().within(sky_zone):
            lm = "sky-building"
        if lm in REBUILT:
            landmark_geoms[lm].append(g)
            log["building:rebuilt-landmark"].append(oid)
            continue
        if not is_part:
            covered = sum(a for (pt, a, pid) in part_index if pt.within(g))
            if covered >= 0.5 * g.area:
                log["building:outline-with-parts"].append(f"{oid} {t.get('name', '')}")
                continue
        # station sheds and canopies over the tracks: the miniature builds its own roofs, so the trains stay visible
        over = g.intersection(corridor).area / g.area if corridor_p.intersects(g) else 0.0
        h_tag = num(t.get("height"))
        if over > 0.3 and (h_tag is None or h_tag < 60):
            log["building:over-tracks"].append(f"{oid} {t.get('name', '')} {over:.2f}")
            continue
        use = use_of(t)
        h, s = None, 5
        if oid in DOCUMENTED:
            h, s = DOCUMENTED[oid], 3
        elif h_tag is not None and h_tag > 0:
            h, s = h_tag, 1 if t.get("source:height") == "MLIT_PLATEAU" else 2
        else:
            lv = num(t.get("building:levels"))
            if lv is not None and lv > 0:
                h, s = lv * STOREY[use] + (1.0 if lv > 2 else 0.5), 4
        if h is None:
            a = g.area
            h = 6.5 if a < 50 else 9.0 if a < 150 else 12.0 if a < 500 else 16.0 if a < 2000 else 20.0
            if "roof" in (t.get("building"), t.get("building:part")):
                h = 4.0
        min_h = num(t.get("min_height"))
        if min_h is None:
            ml = num(t.get("building:min_level"))
            min_h = ml * STOREY[use] if ml else 0.0
        if "roof" in (t.get("building"), t.get("building:part")) and min_h == 0.0:
            min_h = max(0.0, h - 1.2)  # a canopy: a thin slab at the top, not a solid block
        if min_h >= h:
            min_h = 0.0
        clipped = g.intersection(CLIP)
        for poly in polys_of(clipped):
            if poly.area < 4.0:
                continue
            rings = ring_out(poly)
            if not rings:
                continue
            b = {"i": oid, "h": dm(h), "s": s, "u": USE_CODES[use], "r": rings}
            col = colour_of(t.get("building:colour"))
            if col is not None:
                b["c"] = col
            if min_h > 0:
                b["b"] = dm(min_h)
            if lm:
                b["lm"] = lm
                if "c" not in b and lm in LANDMARK_TONES:
                    b["c"] = TONE_BY_ID.get(oid, LANDMARK_TONES[lm])
                landmark_geoms[lm].append(poly)
            if t.get("name") and h >= 40:
                b["n"] = t.get("name")
            buildings.append(b)

    # ---------------------------------------------------------------- rail graph
    node_xy: dict[int, tuple[float, float]] = {}
    for e, line, op in rail_ways:
        for nid, p in zip(e["nodes"], e["geometry"]):
            node_xy[nid] = to_local(p["lon"], p["lat"])
    special = {}
    for e in els:
        if e["type"] == "node" and e.get("tags", {}).get("railway") in ("buffer_stop", "switch"):
            special[e["id"]] = e["tags"]["railway"]
    keep_box = prepared.prep(RAIL_BOX)
    node_index: dict[int, int] = {}
    nodes_out: list[list[int]] = []
    ways_out = []

    def nidx(nid) -> int:
        if nid not in node_index:
            node_index[nid] = len(nodes_out)
            x, n = node_xy[nid]
            nodes_out.append([dm(x), dm(n)])
        return node_index[nid]

    edge = RAIL_BOX.exterior

    def cut(a, b):
        """Where the segment a→b crosses the box's edge (one inside, one outside)."""
        hit = LineString([a, b]).intersection(edge)
        p = hit if hit.geom_type == "Point" else min(getattr(hit, "geoms", [Point(a)]), key=lambda q: q.distance(Point(a)))
        return (p.x, p.y)

    for e, line, op in rail_ways:
        t = e["tags"]
        run: list = []
        runs = []
        prev = None
        for k, nid in enumerate(e["nodes"]):
            inside = keep_box.contains(Point(node_xy[nid]))
            if prev is not None and inside != prev[1]:
                # a track leaving (or entering) the kept box ends at the box's edge, not at its last node inside: OSM's long
                # straight segments would otherwise stop a track short of the edge, or drop it
                c = ("cut", e["id"], k)
                node_xy[c] = cut(node_xy[prev[0]], node_xy[nid])
                run.append(c)
                if not inside:
                    if len(run) >= 2:
                        runs.append(run)
                    run = []
            if inside:
                run.append(nid)
            prev = (nid, inside)
        if len(run) >= 2:
            runs.append(run)
        for r in runs:
            w = {"op": op, "n": [nidx(n) for n in r]}
            if underground_way(e):
                w["ug"] = 1
            nm = t.get("name", "")
            if nm:
                w["ln"] = nm
            if t.get("service"):
                w["svc"] = t["service"]
            if t.get("tunnel") == "building_passage" or t.get("covered") == "yes":
                w["cov"] = 1
            ways_out.append(w)
    buffer_stops = [node_index[nid] for nid, kind in special.items() if kind == "buffer_stop" and nid in node_index]
    switches = [node_index[nid] for nid, kind in special.items() if kind == "switch" and nid in node_index]

    # ---------------------------------------------------------------- the Umekita line's levels (estimates; see UMEKITA_*)
    def xy(i):
        return nodes_out[i][0] / 10, nodes_out[i][1] / 10

    corridor_w = [w for w in ways_out if w.get("ug") or "梅田貨物線" in w.get("ln", "")]
    adj_c: dict[int, set] = defaultdict(set)
    for w in corridor_w:
        for a, b in zip(w["n"], w["n"][1:]):
            adj_c[a].add((b, bool(w.get("ug"))))
            adj_c[b].add((a, bool(w.get("ug"))))

    def along(start: int, ug: bool) -> dict[int, float]:
        """Track distance from `start` over the corridor's tunnel (ug) or surface track."""
        dist = {start: 0.0}
        todo = [start]
        while todo:
            todo.sort(key=lambda i: -dist[i])
            i = todo.pop()
            for j, wug in adj_c[i]:
                if wug != ug:
                    continue
                d = dist[i] + math.dist(xy(i), xy(j))
                if d < dist.get(j, math.inf):
                    dist[j] = d
                    todo.append(j)
        return dist

    ug_nodes = {i for w in corridor_w if w.get("ug") for i in w["n"]}
    surface = {i for w in corridor_w if not w.get("ug") for i in w["n"]}
    portal = min(ug_nodes & surface, key=lambda i: math.dist(xy(i), (-587, -374)))
    elev: dict[int, float] = {}
    s_ug = along(portal, True)
    for i in ug_nodes:
        north = -UMEKITA_GRADE * math.dist(xy(i), NORTH_PORTAL)
        elev[i] = max(UMEKITA_RAIL, PORTAL_DEPTH - UMEKITA_GRADE * s_ug.get(i, 1e9), north)
    # outside the portal: an open cutting climbing to the street at the same grade, then street level to the viaduct
    s_sf = along(portal, False)
    cutting = -PORTAL_DEPTH / UMEKITA_GRADE
    bridge_nodes = set()
    for e, line, op in rail_ways:
        if "梅田貨物線" in e["tags"].get("name", "") and e["tags"].get("bridge") and not underground_way(e):
            bridge_nodes |= {node_index[n] for n in e["nodes"] if n in node_index}
    foot = min(bridge_nodes, key=lambda i: s_sf.get(i, 1e9)) if bridge_nodes else None
    s_foot = s_sf.get(foot, 1e9) if foot is not None else 1e9
    for i in surface - ug_nodes:
        s = s_sf.get(i, 1e9)
        if s < cutting:
            elev[i] = PORTAL_DEPTH * (1 - s / cutting)
        elif i in bridge_nodes or s > s_foot:
            elev[i] = min(VIADUCT_TOP, VIADUCT_GRADE * (s - s_foot))
        else:
            elev[i] = 0.0
    print(f"Umekita line: portal node at {xy(portal)}, cutting {cutting:.0f} m, viaduct foot {s_foot:.0f} m from the portal; "
          f"rail {min(elev.values()):.1f}…{max(elev.values()):.1f} m")
    el_out = [[i, dm(v)] for i, v in sorted(elev.items())]

    # ---------------------------------------------------------------- roads, pedestrian decks
    roads = []
    road_lines = []
    way_nodes_xy: dict[int, list] = {}
    for e in els:
        t = e.get("tags", {})
        hw = t.get("highway")
        if e["type"] != "way" or not hw or "geometry" not in e:
            continue
        layer = num(t.get("layer")) or 0
        if layer < 0 or t.get("tunnel") in ("yes", "building_passage") or t.get("indoor") == "yes":
            continue
        line = LineString(pts(e["geometry"]))
        if not line.intersects(CLIP.buffer(40)):
            continue
        bridge = t.get("bridge") not in (None, "no")
        if hw in ("footway", "path", "steps", "corridor", "cycleway"):
            if not (bridge and layer >= 1 and line.length >= 12):
                continue
            cls, width = "deck", 4.0
        elif hw in ROAD_W:
            if hw.startswith(("motorway", "trunk", "primary", "secondary", "tertiary")):
                cls = hw.split("_")[0]
            elif hw == "service":
                cls = "service"
            elif hw == "pedestrian":
                cls = "pedestrian"
            else:
                cls = "minor"
            width = num(t.get("width")) or None
            lanes = num(t.get("lanes"))
            if width is None and lanes and cls in ("motorway", "trunk", "primary", "secondary", "tertiary"):
                width = lanes * 3.25 + (1.0 if t.get("oneway") == "yes" else 1.5)
            width = min(width or ROAD_W[hw], 40.0)
            if t.get("area") == "yes":
                continue
        else:
            continue
        elev = min(layer, 4) * 5.0 if bridge and layer >= 1 else 0.0
        if cls == "motorway" and bridge and elev < 12:
            elev = 12.0
        cs = list(line.coords)
        flat = []
        for x, n in cs:
            flat += [dm(x), dm(n)]
        r = {"c": ROAD_CLASS[cls], "w": dm(width), "p": flat}
        if elev > 0:
            r["e"] = dm(elev)
        if t.get("oneway") == "yes":
            r["o"] = 1
        roads.append(r)
        if elev == 0 and cls not in ("deck",):
            road_lines.append((line, width, cls))
        way_nodes_xy[e["id"]] = (e["nodes"], cs, width, elev)

    # ---------------------------------------------------------------- crossings (zebra stripes across the carriageway)
    node_ways = defaultdict(list)
    for wid, (nids, cs, width, elev) in way_nodes_xy.items():
        if elev > 0:
            continue
        for k, nid in enumerate(nids):
            node_ways[nid].append((wid, k))
    crossings = []
    for e in els:
        t = e.get("tags", {})
        if e["type"] != "node" or t.get("highway") != "crossing":
            continue
        if t.get("crossing") in ("unmarked", "no") or t.get("crossing:markings") == "no":
            continue
        x, n = to_local(e["lon"], e["lat"])
        if not CLIP.contains(Point(x, n)):
            continue
        best = None
        for wid, k in node_ways.get(e["id"], []):
            nids, cs, width, elev = way_nodes_xy[wid]
            if width < 5:
                continue
            a = cs[max(0, k - 1)]
            b = cs[min(len(cs) - 1, k + 1)]
            ang = math.atan2(b[1] - a[1], b[0] - a[0])
            if best is None or width > best[1]:
                best = (ang, width)
        if best:
            crossings.append([dm(x), dm(n), round(best[0], 3), dm(best[1])])

    # ---------------------------------------------------------------- green, construction
    greens, works = [], []
    for e in els:
        t = e.get("tags", {})
        kind = None
        if t.get("leisure") in ("park", "garden", "playground", "pitch") or t.get("landuse") in ("grass", "forest", "meadow") or t.get("natural") in ("wood", "scrub"):
            kind = "green"
        elif t.get("landuse") == "construction":
            kind = "works"
        if not kind or e["type"] not in ("way", "relation"):
            continue
        g = way_polygon(e) if e["type"] == "way" else relation_polygon(e)
        if g is None:
            continue
        for poly in polys_of(g.intersection(CLIP)):
            if poly.area < 20:
                continue
            item = {"r": ring_out(poly)}
            if t.get("leisure") == "pitch":
                item["k"] = 1
            (greens if kind == "green" else works).append(item)

    # ---------------------------------------------------------------- trees: mapped trees, park planting, street trees
    canopy_geom = way_polygon(by_id[CANOPY_ID]) if CANOPY_ID in by_id else None
    bmask = prepared.prep(unary_union([Polygon([(r[k] / 10, r[k + 1] / 10) for k in range(0, len(r), 2)]) for b in buildings for r in b["r"][:1]] + list(landmark_geoms.get("sky-building", [])) + ([canopy_geom.buffer(2)] if canopy_geom is not None else [])))
    road_mask = prepared.prep(unary_union([l.buffer(w / 2 + 0.6) for (l, w, c) in road_lines]))
    rail_mask = prepared.prep(corridor.buffer(4))
    trees = []
    seen = set()

    def add_tree(x: float, n: float, kind: int) -> None:
        key = (round(x / 3), round(n / 3))
        if key in seen:
            return
        p = Point(x, n)
        if not CLIP.buffer(-2).contains(p) or bmask.contains(p) or road_mask.contains(p) or rail_mask.contains(p):
            return
        seen.add(key)
        trees.append([dm(x), dm(n), kind])

    for e in els:
        if e["type"] == "node" and e.get("tags", {}).get("natural") == "tree":
            add_tree(*to_local(e["lon"], e["lat"]), 0)
    mapped_trees = len(trees)
    # park planting: a jittered grid (deterministic), 7.5 m apart, kept off paths and buildings
    import random

    rnd = random.Random(1874)  # Osaka Station opened in 1874
    for gi in greens:
        if gi.get("k"):
            continue
        ring = gi["r"][0]
        poly = Polygon([(ring[k] / 10, ring[k + 1] / 10) for k in range(0, len(ring), 2)])
        x0, n0, x1, n1 = poly.bounds
        pp = prepared.prep(poly.buffer(-1.5))
        step = 7.5
        x = x0
        while x < x1:
            n = n0
            while n < n1:
                jx, jn = x + rnd.uniform(-2.6, 2.6), n + rnd.uniform(-2.6, 2.6)
                if pp.contains(Point(jx, jn)) and rnd.random() < 0.72:
                    add_tree(jx, jn, 1)
                n += step
            x += step
    park_trees = len(trees) - mapped_trees
    # street trees: both kerbs of the wider streets, every 10 m (Umeda's avenues are lined with ginkgo and zelkova)
    for (line, width, cls) in road_lines:
        if cls not in ("trunk", "primary", "secondary"):
            continue
        for side in (-1, 1):
            off = line.offset_curve(side * (width / 2 + 2.2))
            if off.is_empty:
                continue
            d = 5.0
            while d < off.length - 5.0:
                p = off.interpolate(d)
                add_tree(p.x, p.y, 2)
                d += 10.0
    street_trees = len(trees) - mapped_trees - park_trees

    # ---------------------------------------------------------------- landmark frames
    def frame_of(polys) -> dict | None:
        if not polys:
            return None
        u = unary_union(polys)
        return obb(u)

    jr_refs = {"1;2", "3;4", "5;6", "7;8", "9;10", "11"}
    jr_pl = [p["poly"] for p in platforms if p["op"] == "jr" and p["ref"] in jr_refs and p["poly"].centroid.distance(Point(0, 0)) < 220]
    hk_pl = [p["poly"] for p in platforms if p["op"] == "hankyu" and p["poly"].centroid.distance(Point(230, 350)) < 150]  # the terminal, not Nakatsu
    wheel = by_id.get("w332292139")
    wheel_line = None
    if wheel:
        wp = Polygon(pts(wheel["geometry"])) if len(wheel["geometry"]) >= 4 else None
        wheel_line = obb(wp) if wp is not None else None
    canopy = by_id.get("w1314389106")
    canopy_out = None
    if canopy:
        cp = way_polygon(canopy)
        canopy_out = {"r": ring_out(cp), "h": num(canopy["tags"].get("roof:height")) or 13.0}

    # ---------------------------------------------------------------- JR Osaka: the great roof and the platform canopies
    # Published: the roof is ~180 m along the tracks × ~100 m across, hung between the North and South Gate buildings. Across, it
    # is placed to fill the gap between those two buildings' facing facades (OSM footprints: 103 m, which agrees with the published
    # span); along, it is centred on the stretch where the two buildings face each other. The along-track position is therefore
    # an estimate (docs/osaka/DATA_SOURCES.md, "approximated geometry").
    jf = frame_of(jr_pl)
    ca, sa = math.cos(jf["a"]), math.sin(jf["a"])
    cx, cn = jf["c"]

    def uv(p):
        dx, dn = p[0] - cx, p[1] - cn
        return dx * ca + dn * sa, -dx * sa + dn * ca

    north_uv = [uv(p) for p in way_polygon(by_id["w162183788"]).exterior.coords]
    south_uv = [uv(p) for p in way_polygon(by_id["w161450829"]).exterior.coords]
    v_north = min(v for (u, v) in north_uv)
    v_south = max(v for (u, v) in south_uv)
    u_lo = max(min(u for (u, v) in north_uv), min(u for (u, v) in south_uv))
    u_hi = min(max(u for (u, v) in north_uv), max(u for (u, v) in south_uv))
    u_mid, v_mid = (u_lo + u_hi) / 2, (v_north + v_south) / 2
    roof_span = v_north - v_south
    roof = {"c": [round(cx + u_mid * ca - v_mid * sa, 2), round(cn + u_mid * sa + v_mid * ca, 2)], "a": jf["a"], "l": 180.0, "w": round(roof_span, 2)}
    roof_poly = Polygon([(roof["c"][0] + du * ca - dv * sa, roof["c"][1] + du * sa + dv * ca) for du, dv in ((-90, -roof_span / 2), (90, -roof_span / 2), (90, roof_span / 2), (-90, roof_span / 2))])
    print(f"JR great roof: span {roof_span:.1f} m between the gate buildings, along-track overlap {u_lo:.0f}…{u_hi:.0f} m")

    for p in platforms:
        poly = p["poly"]
        inner = poly.buffer(-0.8, join_style=2)
        p["tactile"] = [ring_out(q)[0] for q in polys_of(inner)] if not inner.is_empty else []
        if p["op"] == "jr" and not p.get("ug"):
            canopy = poly.buffer(-0.5, join_style=2).difference(roof_poly.buffer(1.0, join_style=2))
            p["canopy"] = [ring_out(q) for q in polys_of(canopy) if q.area > 25]

    landmarks = {
        "jr-osaka": {"platforms": frame_of(jr_pl), "roof": roof,"north": frame_of([way_polygon(by_id["w162183788"])]), "south": frame_of([way_polygon(by_id["w161450829"])])},
        "hankyu-umeda": {"platforms": frame_of(hk_pl)},
        "grand-front": {"frame": frame_of(landmark_geoms.get("grand-front", []))},
        "grand-green": {"frame": frame_of(landmark_geoms.get("grand-green", [])), "canopy": canopy_out},
        "sky-building": {"frame": frame_of(landmark_geoms.get("sky-building", [])), "rings": [ring_out(p) for p in polys_of(unary_union(landmark_geoms.get("sky-building", [])))]},
        "hep-five": {"frame": frame_of(landmark_geoms.get("hep-five", [])), "wheel": wheel_line},
        "yodobashi": {"frame": frame_of(landmark_geoms.get("yodobashi", []))},
    }

    data = {
        "meta": {
            "name": "Osaka-Umeda miniature",
            "frame": {
                "origin": [ORIGIN_LAT, ORIGIN_LON],
                "projection": f"+proj=tmerc +lat_0={ORIGIN_LAT} +lon_0={ORIGIN_LON} +k=1 +ellps=GRS80 +units=m",
                "axes": "x = east, n = north, metres; stored as integer decimetres",
                "bounds": {"x": list(SCENE_X), "n": list(SCENE_N)},
            },
            "osm": {"base": raw["_fetched"]["osm3s_timestamp"], "fetched": raw["_fetched"]["at"], "bbox": raw["_fetched"]["bbox"]},
            "built": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "heightSources": HEIGHT_SOURCES,
            "license": "Map data © OpenStreetMap contributors, ODbL 1.0; building heights in part from MLIT Project PLATEAU (CC BY 4.0 compatible terms) via OSM",
        },
        "buildings": buildings,
        "rail": {"nodes": nodes_out, "ways": ways_out, "bufferStops": buffer_stops, "switches": switches, "el": el_out},
        "platforms": [
            {"op": p["op"], "ref": p["ref"], "r": ring_out(p["poly"]), "t": p.get("tactile", []), **({"cv": p["canopy"]} if p.get("canopy") else {}),
             **({"ug": 1, "y": dm(UMEKITA_RAIL + 1.1)} if p.get("ug") else {})}
            for p in platforms
            if p["poly"].intersects(RAIL_BOX)
        ],
        "roads": roads,
        "crossings": crossings,
        "greens": greens,
        "works": works,
        "trees": trees,
        "landmarks": landmarks,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    src_count = defaultdict(int)
    for b in buildings:
        src_count[b["s"]] += 1
    print(f"buildings {len(buildings)}  by height source {dict(sorted(src_count.items()))}")
    print(f"rail nodes {len(nodes_out)} ways {len(ways_out)} buffer stops {len(buffer_stops)} switches {len(switches)}")
    print(f"platforms {len(data['platforms'])} roads {len(roads)} crossings {len(crossings)} greens {len(greens)} works {len(works)}")
    print(f"trees {len(trees)} (mapped {mapped_trees}, park {park_trees}, street {street_trees})")
    for k, v in log.items():
        print(f"{k}: {len(v)}" + ("" if len(v) > 45 else f"  {v}"))
    for k, v in landmarks.items():
        print(k, {kk: (vv if not isinstance(vv, dict) or "r" not in vv else "…") for kk, vv in v.items() if kk != "rings"})
    print(f"→ {OUT.relative_to(ROOT)} {OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
