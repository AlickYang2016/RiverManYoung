import type { LandmarkId } from "./data/types";

/*
 * What the page says about each landmark, and where the camera goes to show it. Facts are the owners' and operators' published
 * figures (docs/osaka/DATA_SOURCES.md); the model's own heights come from the data and are shown with their source.
 */

export type View = { target: [number, number, number]; distance: number; azimuth: number; polar: number };

export type LandmarkInfo = {
  id: LandmarkId;
  name: string;
  nameJa: string;
  kind: string;
  blurb: string;
  facts: string[];
  view: View;
};

export const LANDMARKS: LandmarkInfo[] = [
  {
    id: "jr-osaka",
    name: "JR Osaka Station",
    nameJa: "大阪駅",
    kind: "Station · JR West",
    blurb: "Six platforms, eleven tracks through the middle of Umeda. The 2011 Osaka Station City rebuild hung a glass vault, about 180 m by 100 m, between the North and South Gate buildings; Toki-no-Hiroba sits on the bridge beneath it.",
    facts: ["Opened 1874", "Great roof 2011", "Loop Line: 323 series"],
    view: { target: [5, 18, -9], distance: 470, azimuth: -1.02, polar: 0.82 },
  },
  {
    id: "hankyu-umeda",
    name: "Hankyu Osaka-Umeda Station",
    nameJa: "大阪梅田駅",
    kind: "Terminal · Hankyu Railway",
    blurb: "Nine platforms and ten tracks for the Kobe, Takarazuka and Kyoto lines, side by side — Japan's largest private-railway terminal. Every train ends here and reverses.",
    facts: ["Opened 1910", "9 platforms, 10 tracks", "Hankyu maroon since 1910"],
    view: { target: [226, 10, 349], distance: 330, azimuth: 0.3, polar: 0.92 },
  },
  {
    id: "grand-front",
    name: "Grand Front Osaka",
    nameJa: "グランフロント大阪",
    kind: "Umekita phase 1",
    blurb: "Three towers and the Knowledge Capital on the old freight yard north of the station, opened in 2013 as the first half of Umekita.",
    facts: ["Opened 2013", "Towers A, B, C"],
    view: { target: [-130, 60, 383], distance: 640, azimuth: 0.62, polar: 1.0 },
  },
  {
    id: "grand-green",
    name: "Grand Green Osaka",
    nameJa: "グラングリーン大阪",
    kind: "Umekita phase 2",
    blurb: "A park of about 4.5 ha in the middle of the city, with SANAA's undulating canopy over the south park and towers either side. Opened in stages from September 2024; the last parts are due in 2027.",
    facts: ["Pre-opened 2024", "Complete 2027", "Canopy: SANAA"],
    view: { target: [-280, 8, 140], distance: 520, azimuth: 1.75, polar: 0.62 },
  },
  {
    id: "sky-building",
    name: "Umeda Sky Building",
    nameJa: "梅田スカイビル",
    kind: "Hiroshi Hara · 1993",
    blurb: "Two 40-storey towers joined at the top by the Floating Garden Observatory, a square with a round hole cut through it, reached by escalators crossing the open air.",
    facts: ["173 m", "Opened 1993"],
    view: { target: [-528, 95, 321], distance: 470, azimuth: 0.22, polar: 1.18 },
  },
  {
    id: "hep-five",
    name: "HEP FIVE",
    nameJa: "HEP FIVE",
    kind: "Shops and the red wheel",
    blurb: "A shopping building of 1998 with its red Ferris wheel boarding on the seventh floor: 75 m across, its top 106 m above the street. Here it turns once every fifteen minutes.",
    facts: ["Opened 1998", "Wheel Ø 75 m", "Top 106 m"],
    view: { target: [384, 58, 177], distance: 330, azimuth: 2.95, polar: 1.12 },
  },
  {
    id: "yodobashi",
    name: "Yodobashi Umeda Tower",
    nameJa: "ヨドバシ梅田タワー",
    kind: "LINKS UMEDA · 2019",
    blurb: "The electronics store north of the station and the 35-storey tower of 2019 beside it, with a hotel on its upper floors.",
    facts: ["149 m", "Opened 2019"],
    view: { target: [38, 70, 215], distance: 430, azimuth: 0.7, polar: 1.0 },
  },
];

/** Landmark targets are given in (east, height, north) for readability; the camera uses scene z = −north. */
export const sceneTarget = (v: View): [number, number, number] => [v.target[0], v.target[1], -v.target[2]];

export const HOME: View = { target: [-100, 0, 100], distance: 2750, azimuth: 0.5, polar: 0.92 };
export const HOME_PHONE: View = { target: [-100, 0, 100], distance: 3700, azimuth: 0.5, polar: 0.88 };

/** The opening: an aerial reveal, JR Osaka's roof, Hankyu's terminal, then the visitor's. */
export const INTRO: { view: View; fly: number; hold: number }[] = [
  { view: { target: [-100, 0, 100], distance: 4600, azimuth: 0.95, polar: 0.5 }, fly: 0, hold: 0.3 },
  { view: HOME, fly: 4.2, hold: 0.8 },
  { view: { target: [5, 16, -9], distance: 360, azimuth: -0.95, polar: 0.86 }, fly: 4.6, hold: 1.6 },
  { view: { target: [228, 10, 330], distance: 300, azimuth: 0.36, polar: 0.98 }, fly: 4.2, hold: 1.8 },
  { view: HOME, fly: 3.6, hold: 0 },
];
