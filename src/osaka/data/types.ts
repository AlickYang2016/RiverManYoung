/*
 * The shape of data/umeda.json, written by scripts/osaka/build_scene.py from OpenStreetMap (heights in part from MLIT PLATEAU).
 * Coordinates are (east, north) from JR Osaka's Toki-no-Hiroba in integer decimetres; rings are flat [x, n, x, n, …], the exterior
 * counter-clockwise first, then any holes. geo/frame.ts turns them into scene metres.
 */

export type Ring = number[];

/** A building or building:part. `s` is the source of its height (meta.heightSources): 1 PLATEAU … 5 footprint estimate. */
export type BuildingRec = {
  i: string; // OSM id: w123 / r456
  h: number; // top, dm
  b?: number; // bottom (min_height), dm
  s: 1 | 2 | 3 | 4 | 5;
  u: number; // use: 0 general, 1 office, 2 retail, 3 residential, 4 hotel, 5 industrial / parking
  r: Ring[];
  lm?: LandmarkId;
  n?: string; // name, for towers ≥ 40 m
  c?: number; // facade colour from OSM building:colour (0xRRGGBB, as a facade tone)
};

/** ug: in a tunnel (the Umekita line), drawn only in the underground view */
export type RailWay = { op: Operator; n: number[]; ln?: string; svc?: string; cov?: 1; ug?: 1 };

/** ug, y: an underground platform (Osaka Station 21–24) and its top, dm; otherwise the operator's level (geo/frame.ts) */
export type Platform = { op: Operator; ref: string; r: Ring[]; t: Ring[]; cv?: Ring[][]; ug?: 1; y?: number };

/** c: 0 motorway · 1 trunk · 2 primary · 3 secondary · 4 tertiary · 5 minor · 6 service · 7 pedestrian street · 8 footbridge deck */
export type Road = { c: number; w: number; p: number[]; e?: number; o?: 1 };

export type Obb = { c: [number, number]; a: number; l: number; w: number };

export type Operator = "jr" | "hankyu";

export type LandmarkId = "jr-osaka" | "hankyu-umeda" | "grand-front" | "grand-green" | "sky-building" | "hep-five" | "yodobashi";

export type UmedaData = {
  meta: {
    frame: { origin: [number, number]; projection: string; bounds: { x: [number, number]; n: [number, number] } };
    osm: { base: string; fetched: string };
    built: string;
    heightSources: Record<string, string>;
    license: string;
  };
  buildings: BuildingRec[];
  /** el: [node, rail top dm] for every node off its operator's standard level (the Umekita line's tunnel, cutting and viaduct) */
  rail: { nodes: [number, number][]; ways: RailWay[]; bufferStops: number[]; switches: number[]; el?: [number, number][] };
  platforms: Platform[];
  roads: Road[];
  crossings: [number, number, number, number][]; // x, n (dm), road bearing (rad from east), road width (dm)
  greens: { r: Ring[]; k?: 1 }[];
  works: { r: Ring[] }[];
  trees: [number, number, number][]; // x, n (dm), kind: 0 mapped, 1 park, 2 street
  landmarks: {
    "jr-osaka": { platforms: Obb; roof: Obb; north: Obb; south: Obb };
    "hankyu-umeda": { platforms: Obb };
    "grand-front": { frame: Obb };
    "grand-green": { frame: Obb; canopy: { r: Ring[]; h: number } | null };
    "sky-building": { frame: Obb; rings: Ring[][] };
    "hep-five": { frame: Obb; wheel: Obb | null };
    yodobashi: { frame: Obb };
  };
};
