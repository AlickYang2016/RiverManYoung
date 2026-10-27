"""
The miniature's one coordinate frame, shared by every preprocessing step and mirrored in src/osaka/geo/frame.ts.

- Projection: a transverse Mercator on GRS80 centred on ORIGIN, scale factor 1 (+proj=tmerc +lat_0 +lon_0 +k=1). Grid north is
  true north at the origin; over the ±900 m scene the scale error is < 1e-8 and the meridian convergence < 0.005°, so a metre
  here is a metre on the ground. (Japan Plane Rectangular CS VI, EPSG:6674, would put Umeda 0.5° off its central meridian and
  turn the grid 0.29° from true north.)
- Axes: east = +x, north = -z (three.js: y is up, the camera looks down -z), so scene (x, z) = (easting, -northing).
- Heights: metres above the ground plane (y = 0 is street level at the station; Umeda is flat, T.P. ≈ 2–3 m).
"""

from pyproj import Transformer

# JR Osaka Station's Toki-no-Hiroba (the plaza under the great roof), the middle of the station core.
ORIGIN_LAT = 34.70240
ORIGIN_LON = 135.49590

# The modelled district: 1.6 km east-west × 1.5 km north-south around the station core (metres, scene frame).
# West edge takes in the Umeda Sky Building, east edge HEP FIVE and Hankyu's concourse, north edge Hankyu's approach and
# Umekita's north end, south edge the Hanshin/Daimaru front and Sonezaki.
SCENE_X = (-900.0, 700.0)   # west … east
SCENE_N = (-650.0, 850.0)   # south … north (northing; scene z is the negative)

_to_local = Transformer.from_crs(
    "EPSG:4326",
    f"+proj=tmerc +lat_0={ORIGIN_LAT} +lon_0={ORIGIN_LON} +k=1 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
    always_xy=True,
)
_to_geo = Transformer.from_crs(
    f"+proj=tmerc +lat_0={ORIGIN_LAT} +lon_0={ORIGIN_LON} +k=1 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
    "EPSG:4326",
    always_xy=True,
)


def to_local(lon: float, lat: float) -> tuple[float, float]:
    """WGS84 (JGD2011 is the same to < 0.1 m here) → (easting, northing) metres from ORIGIN."""
    e, n = _to_local.transform(lon, lat)
    return e, n


def to_geo(e: float, n: float) -> tuple[float, float]:
    lon, lat = _to_geo.transform(e, n)
    return lon, lat


def _bbox(margin: float) -> tuple[float, float, float, float]:
    w, s = to_geo(SCENE_X[0] - margin, SCENE_N[0] - margin)
    e, n = to_geo(SCENE_X[1] + margin, SCENE_N[1] + margin)
    return (round(s, 6), round(w, 6), round(n, 6), round(e, 6))


SCENE_BBOX = _bbox(0.0)
FETCH_BBOX = _bbox(150.0)

if __name__ == "__main__":
    print("scene bbox (s, w, n, e):", SCENE_BBOX)
    print("fetch bbox (s, w, n, e):", FETCH_BBOX)
