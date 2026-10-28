import type { Operator } from "../data/types";

/*
 * Rolling stock: the dimensions the simulation and the models share (metres). Figures are the published ones for each series,
 * rounded to the centimetre; the models themselves are built in Blender to the same figures (scripts/osaka/blender/
 * rolling_stock.py, which must be kept in step with this table) and loaded by scene/trains.ts.
 *
 * Only stock that really calls at Osaka or Osaka-umeda is here — no Shinkansen (they call at Shin-Osaka, 3.5 km north of the
 * model) and no Hankyu cars on JR track or JR cars on Hankyu track (the two networks do not even share a gauge).
 */

export type StockId =
  | "jr323"
  | "jr225"
  | "jr225h"
  | "jr221"
  | "jr321"
  | "jr683"
  | "jr287"
  | "jr287k"
  | "jr281"
  | "hot7000"
  | "kiha189"
  | "hankyu1000"
  | "hankyu1300"
  | "hankyu9300";

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
  /** electric (a pantograph on the motor cars) or diesel */
  electric: boolean;
};

const threeDoors = [0.17, 0.5, 0.83];
const oneDoor = [0.93];

function stock(id: StockId, op: Operator, name: string, nameJa: string, pitch: number, body: number, width: number, height: number, doorAt: number[], doorWidth: number, electric = true): Stock {
  // bogie centres at 70 % of the body, as the Blender models place them
  return { id, op, name, nameJa, pitch, body, width, height, bogies: Math.round(body * 70) / 100, doors: doorAt.length, doorAt, doorWidth, electric };
}

export const STOCK: Record<StockId, Stock> = {
  jr323: stock("jr323", "jr", "JR West 323 series", "323系", 19.57, 19.5, 2.95, 3.66, threeDoors, 1.3),
  jr225: stock("jr225", "jr", "JR West 225 series", "225系", 20.0, 19.5, 2.95, 3.69, threeDoors, 1.3),
  jr225h: stock("jr225h", "jr", "JR West 225 series 5100", "225系5100番台", 20.0, 19.5, 2.95, 3.69, threeDoors, 1.3),
  jr221: stock("jr221", "jr", "JR West 221 series", "221系", 20.1, 19.67, 2.95, 3.65, threeDoors, 1.3),
  jr321: stock("jr321", "jr", "JR West 321 series", "321系", 20.0, 19.5, 2.95, 3.66, threeDoors, 1.3),
  jr683: stock("jr683", "jr", "JR West 683 series 4000", "683系4000番台", 21.3, 20.9, 2.915, 3.5, oneDoor, 1.0),
  jr287: stock("jr287", "jr", "JR West 287 series", "287系", 21.1, 20.6, 2.915, 3.5, oneDoor, 1.0),
  jr287k: stock("jr287k", "jr", "JR West 287 series (Kuroshio)", "287系（くろしお）", 21.1, 20.6, 2.915, 3.5, oneDoor, 1.0),
  jr281: stock("jr281", "jr", "JR West 281 series", "281系", 21.1, 20.6, 2.9, 3.5, oneDoor, 1.0),
  hot7000: stock("hot7000", "jr", "Chizu Express HOT7000 series", "智頭急行HOT7000系", 21.3, 20.8, 2.82, 3.55, oneDoor, 0.9, false),
  kiha189: stock("kiha189", "jr", "JR West KiHa 189 series", "キハ189系", 21.3, 20.8, 2.9, 3.6, oneDoor, 1.0, false),
  hankyu1000: stock("hankyu1000", "hankyu", "Hankyu 1000 series", "阪急1000系", 19.0, 18.7, 2.75, 3.7, threeDoors, 1.3),
  hankyu1300: stock("hankyu1300", "hankyu", "Hankyu 1300 series", "阪急1300系", 19.0, 18.7, 2.8, 3.7, threeDoors, 1.3),
  hankyu9300: stock("hankyu9300", "hankyu", "Hankyu 9300 series", "阪急9300系", 19.0, 18.7, 2.8, 3.7, threeDoors, 1.3),
};

export const trainLength = (stock: Stock, cars: number): number => stock.pitch * cars;
