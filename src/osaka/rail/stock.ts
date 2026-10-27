import type { Operator } from "../data/types";

/*
 * Rolling stock: the dimensions the simulation and the models share (metres). Figures are the published ones for each series,
 * rounded to the centimetre; liveries are drawn in trains.ts. Only stock that really runs through these stations is here — no
 * Shinkansen (Shin-Osaka, not Osaka, is the Shinkansen station) and no Hankyu cars on JR track or JR cars on Hankyu track (the two
 * networks do not even share a gauge).
 */

export type StockId = "hankyu1000" | "hankyu1300" | "jr323" | "jr225";

export type Stock = {
  id: StockId;
  op: Operator;
  name: string;
  nameJa: string;
  /** coupler to coupler */
  pitch: number;
  body: number;
  width: number;
  /** rail top to roof */
  height: number;
  /** distance between the two bogie centres */
  bogies: number;
  doors: number;
  /** where along the body (fraction from the front, 0…1) each door's centre is */
  doorAt: number[];
  doorWidth: number;
};

const threeDoors = [0.17, 0.5, 0.83];

export const STOCK: Record<StockId, Stock> = {
  // Hankyu 1000 series (2013–), Kobe and Takarazuka lines; 1300 series, its Kyoto line twin
  hankyu1000: { id: "hankyu1000", op: "hankyu", name: "Hankyu 1000 series", nameJa: "阪急1000系", pitch: 19.0, body: 18.7, width: 2.75, height: 3.7, bogies: 13.6, doors: 3, doorAt: threeDoors, doorWidth: 1.3 },
  hankyu1300: { id: "hankyu1300", op: "hankyu", name: "Hankyu 1300 series", nameJa: "阪急1300系", pitch: 19.0, body: 18.7, width: 2.8, height: 3.7, bogies: 13.6, doors: 3, doorAt: threeDoors, doorWidth: 1.3 },
  // JR West 323 series (2016–), the Osaka Loop Line's own train
  jr323: { id: "jr323", op: "jr", name: "JR West 323 series", nameJa: "JR西日本323系", pitch: 19.57, body: 19.5, width: 2.95, height: 3.66, bogies: 13.8, doors: 3, doorAt: threeDoors, doorWidth: 1.3 },
  // JR West 225 series (2010–), the Kyoto–Kobe Special Rapid (新快速)
  jr225: { id: "jr225", op: "jr", name: "JR West 225 series", nameJa: "JR西日本225系", pitch: 20.0, body: 19.9, width: 2.95, height: 3.69, bogies: 13.8, doors: 3, doorAt: threeDoors, doorWidth: 1.3 },
};

export const trainLength = (stock: Stock, cars: number): number => stock.pitch * cars;
