/*
 * The miniature's frame (mirrors scripts/osaka/frame.py): a transverse Mercator on GRS80 centred on JR Osaka's Toki-no-Hiroba,
 * scale factor 1, so a scene unit is a metre on the ground and grid north is true north.
 *
 * Data is (east, north); three.js is y-up with the camera's forward on -z, so scene = (x: east, y: height, z: -north).
 * A bearing `a` in data space (radians counter-clockwise from east) is the same angle as a rotation about scene +y: rotation.y = a
 * turns an object's +x onto that bearing.
 */

export const ORIGIN = { lat: 34.7024, lon: 135.4959 } as const;

/** The modelled district, scene metres: x west…east, n south…north (the diorama's base). */
export const BOUNDS = { x0: -900, x1: 700, n0: -650, n1: 850 } as const;
export const BASE_CENTER = { x: (BOUNDS.x0 + BOUNDS.x1) / 2, z: -(BOUNDS.n0 + BOUNDS.n1) / 2 } as const;

/** Rail-top heights above the street (m). JR Osaka's platforms are one floor up, over the 1F central concourse; Hankyu's are on
 * its terminal's 3F. Both are estimates from the stations' published floor guides, not surveyed levels (DATA_SOURCES.md). */
export const RAIL_TOP = { jr: 7.0, hankyu: 9.2 } as const;
/** Japanese conventional-line platforms stand 1.1 m above the rail. */
export const PLATFORM_ABOVE_RAIL = 1.1;
/** Track gauge (m): JR's narrow gauge, Hankyu's standard gauge. */
export const GAUGE = { jr: 1.067, hankyu: 1.435 } as const;

/** Decimetres → metres. */
export const m = (dm: number): number => dm / 10;

/** A flat [x, n, x, n, …] ring in decimetres → [x, z] pairs in scene metres. */
export function ringXZ(flat: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k + 1 < flat.length; k += 2) out.push([flat[k]! / 10, -flat[k + 1]! / 10]);
  return out;
}

/** WGS84 → scene (x, z) metres, with GRS80's radii of curvature at the origin (within centimetres of the TM over the scene). */
export function geoToScene(lat: number, lon: number): [number, number] {
  const a = 6378137;
  const e2 = 0.00669438002290;
  const phi = (ORIGIN.lat * Math.PI) / 180;
  const w = 1 - e2 * Math.sin(phi) ** 2;
  const meridian = (a * (1 - e2)) / w ** 1.5;
  const prime = a / Math.sqrt(w);
  const x = (((lon - ORIGIN.lon) * Math.PI) / 180) * prime * Math.cos(phi);
  const n = (((lat - ORIGIN.lat) * Math.PI) / 180) * meridian;
  return [x, -n];
}
