import type { Profile } from "../src/profile/schema";

/*
 * What en.ts, fr.ts and zh.ts share: the same objects, pictures, ids and links in every language. Kept apart from en.ts so the French
 * page (the default) does not have to load the English profile; each language file brings its own words.
 */

export const CV = "https://alexisyang.com/assets/";
export const source = "https://github.com/AlickYang2016/RiverManYoung";

/** The pouch's objects, by id: the same in every language (the page switches language in place, object by object). */
export const [card, resume, ticket, polaroid, note] = (["card", "resume", "ticket", "polaroid", "note"] as const).map((kind) => ({ kind, id: kind }));

/*
 * The card album: one chapter a page (eight pockets a page; the rails run onto a fifth), so the album reads in order instead of as a pile.
 *   page 1 · I   Study & work      a contents card, the six cities of the path so far, and the next one
 *   page 2 · II  Europe & beyond   journeys
 *   page 3 · III Japan, October 2026
 * Every card shows a landmark tied to its place: Yang's own photographs where there are any, otherwise a freely licensed photo
 * (credited on the card and in public/photos/CREDITS.md). Shared with fr.ts / zh.ts (same ids, pictures, colours, local names);
 * each language brings its own notes, chapter names and contents label.
 */
const C = (file: string, author: string, licence: string) => ({ src: `photos/${file}.webp`, credit: `Photo: ${author} / Wikimedia Commons, ${licence}` });
const own = (file: string) => ({ src: `photos/${file}.webp` });
export const places = [
  { id: "c0", chapter: 0, label: "Contents", nameLocal: "目录", color: "#e3ddcf" },
  { id: "c1", chapter: 0, label: "Shanghai", nameLocal: "上海", color: "#c9d6dd", ...C("cover-shanghai", "YouTable", "CC BY-SA 4.0") },
  { id: "c2", chapter: 0, label: "Suzhou", nameLocal: "苏州", color: "#bcd0cf", ...C("cover-suzhou", "Christian Gänshirt", "CC BY-SA 4.0") },
  { id: "c3", chapter: 0, label: "Bordeaux", nameLocal: "波尔多", color: "#c4c3cf", ...C("cover-bordeaux-cadillac", "Henry Salomé", "CC BY-SA 3.0") },
  { id: "c4", chapter: 0, label: "Cergy", nameLocal: "塞尔吉", color: "#a9c1cb", ...C("cover-cergy-essec", "Rdavout", "CC BY-SA 2.5") },
  { id: "c5", chapter: 0, label: "Paris", nameLocal: "巴黎", badge: "AEW", color: "#8fa9b8", ...own("cover-aew") },
  { id: "c6", chapter: 0, label: "Washington", nameLocal: "华盛顿", color: "#7f98a6", ...own("cover-washington") },
  { id: "c16", chapter: 0, label: "Next", nameLocal: "下一站", color: "#3f5b6b" },
  { id: "e1", chapter: 1, label: "Nice", nameLocal: "尼斯", color: "#bfd3dc", ...own("cover-nice") },
  { id: "e2", chapter: 1, label: "Seville", nameLocal: "塞维利亚", color: "#d6c8b4", ...own("cover-seville") },
  { id: "e3", chapter: 1, label: "Madrid", nameLocal: "马德里", color: "#c7cdd6", ...own("cover-madrid") },
  { id: "e4", chapter: 1, label: "Rome", nameLocal: "罗马", color: "#d8cdbd", ...own("cover-rome") },
  { id: "e5", chapter: 1, label: "Prague", nameLocal: "布拉格", color: "#d4c6a8", ...own("cover-prague") },
  { id: "e6", chapter: 1, label: "Luxor", nameLocal: "卢克索", color: "#cdb895", ...own("cover-luxor") },
  { id: "e7", chapter: 1, label: "Red Sea", nameLocal: "红海", color: "#9fc3d1", ...own("cover-red-sea") },
  { id: "e8", chapter: 1, label: "Iceland", nameLocal: "冰岛", color: "#5f7f78", ...own("cover-iceland") },
  { id: "c7", chapter: 2, label: "Osaka", nameLocal: "大阪", color: "#d5dcdf", ...C("cover-osaka", "Dick Thomas Johnson", "CC BY 2.0") },
  { id: "c8", chapter: 2, label: "Kobe", nameLocal: "神戸", color: "#c3cdd2", ...own("cover-kobe") },
  { id: "c9", chapter: 2, label: "Takamatsu · Naoshima", nameLocal: "高松・直島", color: "#b8cfd4", ...own("cover-naoshima") },
  { id: "c11", chapter: 2, label: "Okayama", nameLocal: "岡山", color: "#a7b9ad", ...C("cover-okayama", "663highland", "CC BY 2.5") },
  { id: "c12", chapter: 2, label: "Wakayama", nameLocal: "和歌山", color: "#93ab9f", ...C("cover-wakayama", "Saigen Jiro", "CC0") },
  { id: "c13", chapter: 2, label: "Shirahama", nameLocal: "白浜", color: "#c8d7d0", ...C("cover-shirahama", "Zairon", "CC BY 4.0") },
  { id: "c14", chapter: 2, label: "Kyoto", nameLocal: "京都", color: "#a5a9b6", ...C("cover-kyoto", "Martin Falbisoner", "CC BY-SA 4.0") },
  { id: "c15", chapter: 2, label: "Tokyo", nameLocal: "東京", color: "#6f8494", ...own("cover-tokyo") },
  { id: "r1", chapter: 3, label: "Narita Express", nameLocal: "成田エクスプレス", color: "#d9dcdc", ...own("rail-narita-express") },
  { id: "r2", chapter: 3, label: "Yamanote Line, Tokyo", nameLocal: "山手線", color: "#c3d7a4", ...own("rail-yamanote") },
  { id: "r3", chapter: 3, label: "Shinkansen E5, Hayabusa", nameLocal: "新幹線 はやぶさ", color: "#a8d3cf", ...own("rail-shinkansen-e5") },
  { id: "r4", chapter: 3, label: "Shinkansen N700S", nameLocal: "東海道新幹線", color: "#b9c9a6", ...own("rail-shinkansen-n700s") },
  { id: "r5", chapter: 3, label: "Haruka, Kansai Airport", nameLocal: "特急はるか", color: "#d6dbe8", ...own("rail-haruka-281") },
  { id: "r6", chapter: 3, label: "Kansai Airport Rapid", nameLocal: "関空快速", color: "#b9bcc2", ...own("rail-kanku-225") },
  { id: "r7", chapter: 3, label: "Kuroshio, Ocean Arrow", nameLocal: "特急くろしお", color: "#a9d6d4", ...own("rail-kuroshio-283") },
  { id: "r8", chapter: 3, label: "Panda Kuroshio", nameLocal: "パンダくろしお", color: "#cfe0ec", ...own("rail-panda-kuroshio") },
  { id: "r9", chapter: 3, label: "Thunderbird", nameLocal: "特急サンダーバード", color: "#c9d5e2", ...own("rail-thunderbird-683") },
  { id: "r10", chapter: 3, label: "Marine Liner", nameLocal: "快速マリンライナー", color: "#c4c8cc", ...own("rail-marine-liner") },
  { id: "r11", chapter: 3, label: "JR Shikoku 8000", nameLocal: "8000系", color: "#cfc8bd", ...own("rail-shikoku-8000") },
  { id: "r12", chapter: 3, label: "JR Shikoku 8600", nameLocal: "8600系", color: "#c7b79c", ...own("rail-shikoku-8600") },
  { id: "r13", chapter: 3, label: "Anpanman Train, Yosan Line", nameLocal: "アンパンマン列車", color: "#e5e0d2", ...own("rail-anpanman-2000") },
  { id: "r14", chapter: 3, label: "Yellow Anpanman Train", nameLocal: "きいろいアンパンマン列車", color: "#ecd77c", ...own("rail-anpanman-2700") },
  { id: "r15", chapter: 3, label: "JR Shikoku 2700", nameLocal: "2700系", color: "#c7a7a0", ...own("rail-shikoku-2700") },
  { id: "r16", chapter: 3, label: "Tsurugi, Tokushima Line", nameLocal: "特急剣山", color: "#b4cde3", ...own("rail-tsurugi-185") },
  { id: "r17", chapter: 3, label: "Kiha 47, Tokushima", nameLocal: "キハ47", color: "#b9d1e6", ...own("rail-kiha47-tokushima") },
  { id: "r18", chapter: 3, label: "JR Shikoku 1000, Kōchi", nameLocal: "1000形", color: "#c9d7e2", ...own("rail-shikoku-1000") },
  { id: "r19", chapter: 3, label: "Hobby Train, Yodo Line", nameLocal: "鉄道ホビートレイン", color: "#d7dde2", ...own("rail-hobby-train") },
  { id: "r20", chapter: 3, label: "Kotoden, Takamatsu", nameLocal: "琴電 1200形", color: "#dbd2b8", ...own("rail-kotoden-1200") },
  { id: "r21", chapter: 3, label: "Green Mover, Hiroshima", nameLocal: "広電 5000形", color: "#a9cfc6", ...own("rail-hiroden-5000") },
  { id: "r22", chapter: 3, label: "Green Mover Max, Hiroshima", nameLocal: "広電 5100形", color: "#d7a9a4", ...own("rail-hiroden-5100") },
  { id: "r23", chapter: 3, label: "Hiroden 800, Hiroshima", nameLocal: "広電 800形", color: "#b9c4a4", ...own("rail-hiroden-800") },
  { id: "r24", chapter: 3, label: "JR Kyushu 787", nameLocal: "787系", color: "#a9adb1", ...own("rail-kyushu-787") },
  { id: "r25", chapter: 3, label: "Yufuin no Mori", nameLocal: "ゆふいんの森", color: "#9fc3a6", ...own("rail-yufuin-no-mori") },
  { id: "r26", chapter: 3, label: "Aso Boy!", nameLocal: "あそぼーい！", color: "#a8a8a2", ...own("rail-aso-boy") },
  { id: "r27", chapter: 3, label: "Ibusuki no Tamatebako", nameLocal: "指宿のたまて箱", color: "#d8d2c4", ...own("rail-ibutama") },
  { id: "r28", chapter: 3, label: "RER B, Paris", color: "#d8c7c4", ...own("rail-rer-b") },
  { id: "r29", chapter: 3, label: "Métro, Abbesses", color: "#d6d0c2", ...own("rail-paris-mf67") },
  { id: "r30", chapter: 3, label: "Métro MP 14, Paris", color: "#bcd2e0", ...own("rail-paris-mp14") },
  { id: "r31", chapter: 3, label: "Silver Line, Washington DC", color: "#8f97a3", ...own("rail-washington-silver") },
  { id: "r32", chapter: 3, label: "Lisbon Tram", nameLocal: "Elétrico", color: "#e3cf8f", ...own("rail-lisbon-tram") },
] as const;

/** The rail cards' names in each language (the original-script name stays beside them unless local is null). */
export const railNames: Record<"en" | "fr" | "zh", NonNullable<AlbumWords["names"]>> = {
  en: { r1: { label: "Narita Express" }, r2: { label: "Yamanote Line, Tokyo" }, r3: { label: "Shinkansen E5, Hayabusa" }, r4: { label: "Shinkansen N700S" }, r5: { label: "Haruka, Kansai Airport" }, r6: { label: "Kansai Airport Rapid" }, r7: { label: "Kuroshio, Ocean Arrow" }, r8: { label: "Panda Kuroshio" }, r9: { label: "Thunderbird" }, r10: { label: "Marine Liner" }, r11: { label: "JR Shikoku 8000" }, r12: { label: "JR Shikoku 8600" }, r13: { label: "Anpanman Train, Yosan Line" }, r14: { label: "Yellow Anpanman Train" }, r15: { label: "JR Shikoku 2700" }, r16: { label: "Tsurugi, Tokushima Line" }, r17: { label: "Kiha 47, Tokushima" }, r18: { label: "JR Shikoku 1000, Kōchi" }, r19: { label: "Hobby Train, Yodo Line" }, r20: { label: "Kotoden, Takamatsu" }, r21: { label: "Green Mover, Hiroshima" }, r22: { label: "Green Mover Max, Hiroshima" }, r23: { label: "Hiroden 800, Hiroshima" }, r24: { label: "JR Kyushu 787" }, r25: { label: "Yufuin no Mori" }, r26: { label: "Aso Boy!" }, r27: { label: "Ibusuki no Tamatebako" }, r28: { label: "RER B, Paris", local: null }, r29: { label: "Métro, Abbesses", local: null }, r30: { label: "Métro MP 14, Paris", local: null }, r31: { label: "Silver Line, Washington DC", local: null }, r32: { label: "Lisbon Tram" } },
  fr: { r1: { label: "Narita Express" }, r2: { label: "Ligne Yamanote, Tokyo" }, r3: { label: "Shinkansen E5, Hayabusa" }, r4: { label: "Shinkansen N700S" }, r5: { label: "Haruka, aéroport du Kansai" }, r6: { label: "Rapide de l’aéroport du Kansai" }, r7: { label: "Kuroshio, Ocean Arrow" }, r8: { label: "Kuroshio panda" }, r9: { label: "Thunderbird" }, r10: { label: "Marine Liner" }, r11: { label: "JR Shikoku 8000" }, r12: { label: "JR Shikoku 8600" }, r13: { label: "Train Anpanman, ligne Yosan" }, r14: { label: "Train Anpanman jaune" }, r15: { label: "JR Shikoku 2700" }, r16: { label: "Tsurugi, ligne de Tokushima" }, r17: { label: "Kiha 47, Tokushima" }, r18: { label: "JR Shikoku 1000, Kōchi" }, r19: { label: "Hobby Train, ligne Yodo" }, r20: { label: "Kotoden, Takamatsu" }, r21: { label: "Green Mover, Hiroshima" }, r22: { label: "Green Mover Max, Hiroshima" }, r23: { label: "Hiroden 800, Hiroshima" }, r24: { label: "JR Kyushu 787" }, r25: { label: "Yufuin no Mori" }, r26: { label: "Aso Boy!" }, r27: { label: "Ibusuki no Tamatebako" }, r28: { label: "RER B, Paris", local: null }, r29: { label: "Métro, Abbesses", local: null }, r30: { label: "Métro MP 14, Paris", local: null }, r31: { label: "Ligne Silver, Washington", local: null }, r32: { label: "Tram de Lisbonne" } },
  zh: { r1: { label: "成田特快" }, r2: { label: "东京山手线" }, r3: { label: "东北新干线 E5 隼" }, r4: { label: "东海道新干线 N700S" }, r5: { label: "关西机场特急 遥" }, r6: { label: "关空・纪州路快速" }, r7: { label: "特急黑潮 海洋之箭" }, r8: { label: "熊猫黑潮" }, r9: { label: "特急雷鸟" }, r10: { label: "快速海洋线" }, r11: { label: "JR 四国 8000 系" }, r12: { label: "JR 四国 8600 系" }, r13: { label: "予赞线面包超人列车" }, r14: { label: "黄色面包超人列车" }, r15: { label: "JR 四国 2700 系" }, r16: { label: "特急剑山" }, r17: { label: "德岛 Kiha 47" }, r18: { label: "高知 1000 型" }, r19: { label: "铁道兴趣列车" }, r20: { label: "高松琴电" }, r21: { label: "广岛电铁 Green Mover" }, r22: { label: "广电 Green Mover Max" }, r23: { label: "广电 800 型" }, r24: { label: "JR 九州 787 系" }, r25: { label: "由布院之森" }, r26: { label: "阿苏男孩" }, r27: { label: "指宿之玉手箱" }, r28: { label: "巴黎 RER B", local: null }, r29: { label: "巴黎地铁 Abbesses 站", local: null }, r30: { label: "巴黎地铁 MP 14", local: null }, r31: { label: "华盛顿地铁银线", local: null }, r32: { label: "里斯本电车" } },
};

/** What a language says on the album: the three chapter names, the contents card's label, and how a photo credit begins. */
/** …and the line under a card's badge (by card id: the AEW card's role and year) */
export type AlbumWords = { chapters: [string, string, string, string]; contents: string; photo: string; badges?: Record<string, string>; names?: Record<string, { label: string; local?: string | null }> };

/*
 * Postcards: four sheets of six, one theme a sheet.
 *   I   Work & study           II  Music, science & art        III At the table, by the sea        IV  On the road
 * Shared with fr.ts / zh.ts (same ids, pictures, dates).
 */
export const postcardBase = [
  { id: "p3", file: "aew-team", date: "2026", color: "#d3dbe0" },
  { id: "p4", file: "bnpp-pro-bono", date: "2024", color: "#d9dad6" },
  { id: "p13", file: "bnpp-tokyo", date: "2024-08", color: "#d4dcd6" },
  { id: "p14", file: "udvar-hazy", date: "", color: "#d6d3cc" },
  { id: "p1", file: "renmin-xiuyuan-drawing", date: "2020-01-03", color: "#e3e3df" },
  { id: "p2", file: "renmin-kaitai-drawing", date: "2020-01-17", color: "#e1e1dc" },
  { id: "p5", file: "renmin-choir", date: "", color: "#d8c9c4" },
  { id: "p6", file: "choir-rehearsal", date: "", color: "#d6dadc" },
  { id: "p7", file: "shanghai-lab", date: "", color: "#cfd6da" },
  { id: "p8", file: "shanghai-chemistry-award", date: "2018", color: "#e2cfc5" },
  { id: "p9", file: "shanghai-debate", date: "", color: "#cdd1d8" },
  { id: "p15", file: "museum-still-life", date: "", color: "#e4e2dc" },
  { id: "p10", file: "paris-kitchen", date: "", color: "#d8d6d0" },
  { id: "p11", file: "shengjian", date: "", color: "#d6cfc4" },
  { id: "p16", file: "oysters", date: "", color: "#d9d2cc" },
  { id: "p12", file: "diving", date: "", color: "#b9d2da" },
  { id: "p17", file: "arcachon-dune", date: "", color: "#dcd6c6" },
  { id: "p18", file: "arcachon-pool-party", date: "", color: "#e9e4da" },
  { id: "p19", file: "kobe-sherlock", date: "2026", color: "#d9c4c0" },
  { id: "p20", file: "madrid-bernabeu", date: "", color: "#d3d7de" },
  { id: "p21", file: "iceland-aurora", date: "", color: "#9fb3ae" },
  { id: "p22", file: "luxor-temple", date: "", color: "#cdbb9c" },
  { id: "p23", file: "red-sea-dolphins", date: "", color: "#a9c8d4" },
  { id: "p24", file: "nice-seafront", date: "", color: "#c9d9e0" },
  { id: "p25", file: "lisbon-miradouro", date: "2024", color: "#cfdbe6" },
  { id: "p26", file: "budapest-chain-bridge", date: "2024", color: "#d3d2c6" },
  { id: "p27", file: "vatican-st-peters", date: "2023", color: "#c7cfdf" },
  { id: "p28", file: "monaco-port-hercule", date: "2024", color: "#bfd3e3" },
] as const;

export type PostcardText = { label: string; place: string; placeLocal?: string; message: string };

/** The albums for one language, from its own notes, postcard texts and album words. */
export function albumsFor(notes: string[], cards: PostcardText[], from: string, words: AlbumWords): Profile["albums"] {
  return {
    cards: places.map((c, i) => {
      const { chapter, badge, ...rest } = c as typeof c & { credit?: string; src?: string; badge?: string };
      const card = { ...rest, note: notes[i], chapter: words.chapters[chapter] } as Profile["albums"]["cards"][number];
      // the AEW team photo has its faces top left: the badge goes bottom right
      if (badge) card.badge = { title: badge, at: "bottom", ...(words.badges?.[c.id] ? { line: words.badges[c.id] } : {}) };
      if (c.id === "c0") card.label = words.contents;
      const named = words.names?.[c.id];
      if (named) {
        card.label = named.label;
        if (named.local === null) delete card.nameLocal;
        else if (named.local) card.nameLocal = named.local;
      }
      if (card.credit) card.credit = card.credit.replace(/^Photo/, words.photo);
      return card;
    }),
    postcards: postcardBase.map((b, i) => ({
      id: b.id,
      ...cards[i]!,
      src: `photos/${b.file}.webp`,
      color: b.color,
      from,
      ...(b.date ? { date: b.date } : {}),
    })),
  };
}
