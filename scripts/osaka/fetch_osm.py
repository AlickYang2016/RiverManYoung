"""
Fetch the OpenStreetMap layers for the Osaka-Umeda miniature from the Overpass API.

    python scripts/osaka/fetch_osm.py            # writes scripts/osaka/raw/osm.json (gitignored)

The raw extract stays out of git (it is ~10 MB and changes with every OSM edit); build_scene.py turns it into the small
public/osaka/umeda.json the page loads. Data © OpenStreetMap contributors, ODbL 1.0 (docs/osaka/DATA_SOURCES.md).
"""

import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from frame import FETCH_BBOX  # (south, west, north, east), a little wider than the scene so clipping has margin

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def query(bbox: tuple[float, float, float, float]) -> str:
    s, w, n, e = bbox
    b = f"({s},{w},{n},{e})"
    return f"""
[out:json][timeout:180];
(
  way["building"]{b};
  relation["building"]["type"="multipolygon"]{b};
  way["building:part"]{b};
  way["railway"~"^(rail|light_rail|subway|platform|buffer_stop|switch|construction)$"]{b};
  node["railway"~"^(buffer_stop|switch|railway_crossing|signal)$"]{b};
  way["public_transport"="platform"]{b};
  way["highway"]{b};
  way["area:highway"]{b};
  way["leisure"~"^(park|garden|pitch|playground)$"]{b};
  relation["leisure"~"^(park|garden)$"]{b};
  way["landuse"~"^(grass|forest|meadow|construction|railway|commercial|retail)$"]{b};
  way["natural"~"^(water|wood|scrub|tree_row)$"]{b};
  relation["natural"="water"]{b};
  way["waterway"]{b};
  node["natural"="tree"]{b};
  nwr["attraction"]{b};
  node["highway"~"^(crossing|traffic_signals)$"]{b};
  way["man_made"="bridge"]{b};
  node["railway"="station"]{b};
  way["railway"="station"]{b};
);
out body geom qt;
"""


def main() -> int:
    RAW.mkdir(exist_ok=True)
    body = urllib.parse.urlencode({"data": query(FETCH_BBOX)}).encode()
    last = None
    for url in MIRRORS:
        for attempt in range(2):
            try:
                print(f"[osm] {url} (try {attempt + 1})", flush=True)
                req = urllib.request.Request(url, data=body, headers={"User-Agent": "alexisyang-osaka-umeda/1.0 (personal portfolio miniature)"})
                with urllib.request.urlopen(req, timeout=240) as r:
                    data = json.loads(r.read().decode("utf-8"))
                data["_fetched"] = {
                    "source": url,
                    "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "bbox": FETCH_BBOX,
                    "osm3s_timestamp": data.get("osm3s", {}).get("timestamp_osm_base"),
                }
                out = RAW / "osm.json"
                out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
                print(f"[osm] {len(data['elements'])} elements, base {data['_fetched']['osm3s_timestamp']} → {out}")
                return 0
            except Exception as err:  # a busy mirror: try the next one
                last = err
                print(f"[osm]   failed: {err}", flush=True)
                time.sleep(4)
    print(f"[osm] every mirror failed: {last}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
