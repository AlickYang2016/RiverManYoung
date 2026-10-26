import type { Profile } from "../src/profile/schema";
import { seal } from "./seal";

/*
 * Zijiang (Alexis) Yang — the folio edition of alexisyang.com. Every line below is taken from the main site and its CV; the photos in
 * public/photos are the site's own. fr.ts and zh.ts carry the same things in French and Chinese, in the same order, with the same ids.
 * To change a fact, change it in all three files.
 */

export const CV = "https://alexisyang.com/assets/";

/*
 * The card album: three pages, one chapter each (eight pockets a page), so the album reads in order instead of as a pile.
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
] as const;

/** What a language says on the album: the three chapter names, the contents card's label, and how a photo credit begins. */
/** …and the line under a card's badge (by card id: the AEW card's role and year) */
export type AlbumWords = { chapters: [string, string, string]; contents: string; photo: string; badges?: Record<string, string> };
const wordsEn: AlbumWords = { chapters: ["I · Study & work", "II · Europe & beyond", "III · Japan 2026"], contents: "Contents", photo: "Photo", badges: { c5: "Research & Strategy · 2026" } };

const placeNotes = [
  "Three pages, three chapters. I · Study & work: the cities that shaped the path so far, and the next one. II · Europe & beyond: journeys. III · Japan, October 2026. Each card shows a landmark tied to its place.",
  "Where I grew up, and where the science competitions started. On the card: Lujiazui, seen from the Bund.",
  "Renmin University of China, 2019–2023: Bachelor of Economics in Finance, graduated with distinction. On the card: the Gate of the Orient over Jinji Lake.",
  "KEDGE Business School: dual-degree bachelor’s in supply chain management. On the card: the Château des ducs d’Épernon in Cadillac, a Bordeaux wine appellation whose wines I once helped promote.",
  "ESSEC Business School: Master in Management, Real Estate and Sustainable Development Chair. On the card: the ESSEC campus.",
  "AEW (Natixis Investment Managers), Research & Strategy, February to August 2026: automated scoring of European cities, from 45 to 72, and the data and every chart of the July 2026 European Office Outlook. Paris also brought BNP Paribas Group Legal in 2024 and the Adagio project in 2025. On the card: the AEW team, Paris, 2026.",
  "GWU School of Business: graduate exchange, August 2025 to January 2026. On the card: the World War II Memorial and the Washington Monument.",
  "From January 2027: the final-year internship. The city is still open.",
  "Nice: the seafront.",
  "Seville: rowing under the bridges of the Plaza de España.",
  "Madrid: the Santiago Bernabéu, home of Real Madrid.",
  "Rome: marble and sculpture.",
  "Prague: the National Museum’s great hall, where Mission: Impossible was filmed.",
  "Luxor: the temple by night.",
  "Egypt: diving in the Red Sea.",
  "Iceland: under the northern lights.",
  "Japan, October 2026: the first stop. On the card: Osaka Castle.",
  "Japan, October 2026: the port of Kobe.",
  "Japan, October 2026: across the Seto Inland Sea to Takamatsu, then the island of Naoshima. On the card: Yayoi Kusama’s Red Pumpkin.",
  "Japan, October 2026: Okayama Castle above the Kōraku-en garden.",
  "Japan, October 2026: Wakayama Castle.",
  "Japan, October 2026: the coast. On the card: Engetsu Island.",
  "Japan, October 2026: Kiyomizu-dera.",
  "Japan, October 2026: the last stop before Paris, on 17 October. The photo is from an earlier visit: Tokyo Tower, August 2024.",
];

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
] as const;

export type PostcardText = { label: string; place: string; placeLocal?: string; message: string };

const postcardsEn: PostcardText[] = [
  { label: "AEW", place: "AEW, Paris", message: "Six months with the European Research & Strategy team: city scoring, quarterly reports, and the charts in the July 2026 Office Outlook." },
  { label: "Pro Bono", place: "BNP Paribas, Paris", message: "Group LEGAL Pro Bono: helping relaunch the EMEA programme, with the tracker, the sponsor summaries and the SharePoint site." },
  { label: "Same green birds", place: "GranTokyo, Tokyo", message: "BNP Paribas in Tokyo: the same logo I worked under in Paris, on the other side of the world." },
  { label: "Discovery", place: "Udvar-Hazy Center, Virginia", message: "Space Shuttle Discovery, a short drive from Washington, D.C., the city of my exchange semester." },
  { label: "Xiuyuan Building", place: "Renmin University of China", placeLocal: "修远楼", message: "Pen on paper. Not an architect’s drawing; I simply enjoyed looking closely enough at a place to put it on paper." },
  { label: "Kaitai Building", place: "Renmin University of China", placeLocal: "开太楼", message: "Two weeks later. Growing up with an architect father, I learned to notice proportions, small details and the way people use a building." },
  { label: "Choir", place: "Renmin University of China", placeLocal: "一二·九合唱音乐节", message: "The 33rd December 9th choral festival. At the piano and among the inner voices." },
  { label: "Rehearsal", place: "Before the concert", message: "Listening across the choir while keeping my own line." },
  { label: "Laboratory", place: "Shanghai", message: "Afternoons in a laboratory: break the problem down, test the assumptions, learn from what did not work." },
  { label: "First Prize", place: "Shanghai", placeLocal: "白猫杯", message: "First Prize, 2018 Shanghai Applied Chemistry & Skills Competition, high-school division." },
  { label: "Debate", place: "Shanghai", message: "First speaker in an English debate exchange: open the case, build the argument, then listen to the reply." },
  { label: "Still life", place: "In a museum", message: "Flowers in a gilt frame. Looking closely, again: the same habit as the pen drawings." },
  { label: "Kitchen", place: "Paris", message: "Cooking is one of the simplest ways I stay connected to home. Living abroad turned it into a way of sharing where I come from." },
  { label: "Shengjian", place: "Shanghai, wherever I am", placeLocal: "生煎", message: "Pan-fried dumplings, occasionally one batch at a time. Shanghai, wherever I am." },
  { label: "Oysters", place: "By the sea", message: "A plate of oysters, a squeeze of lemon, the sky turning pink." },
  { label: "Diving", place: "Under water", message: "Underwater, panic makes a difficult situation harder. Breathe steadily, understand what is happening, then act deliberately." },
  { label: "Dune du Pilat", place: "Arcachon", message: "Four friends, four water guns, one beach near Bordeaux. The next card is its pair." },
  { label: "Pool Party", place: "Arcachon", message: "The same afternoon, paired with League of Legends’ Pool Party art." },
  { label: "Detective", place: "Kobe", message: "221b Baker Street, Japan edition: playing Sherlock Holmes." },
  { label: "Trophy room", place: "Santiago Bernabéu, Madrid", message: "Real Madrid’s trophy room, scarf on." },
  { label: "Aurora", place: "Iceland", message: "Waiting in the dark and the cold, until the sky turned green." },
  { label: "Luxor Temple", place: "Luxor, Egypt", message: "The colonnade by night." },
  { label: "Dolphins", place: "The Red Sea, Egypt", message: "Dolphins beside the boat." },
  { label: "Riviera", place: "Nice", message: "Palm trees and the Mediterranean." },
];

/** The albums for one language, from its own notes, postcard texts and album words. */
export function albumsFor(notes: string[], cards: PostcardText[], from: string, words: AlbumWords = wordsEn): Profile["albums"] {
  return {
    cards: places.map((c, i) => {
      const { chapter, badge, ...rest } = c as typeof c & { credit?: string; src?: string; badge?: string };
      const card = { ...rest, note: notes[i], chapter: words.chapters[chapter] } as Profile["albums"]["cards"][number];
      // the AEW team photo has its faces top left: the badge goes bottom right
      if (badge) card.badge = { title: badge, at: "bottom", ...(words.badges?.[c.id] ? { line: words.badges[c.id] } : {}) };
      if (c.id === "c0") card.label = words.contents;
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

export const profile: Profile = {
  lang: "en",
  name: "Zijiang (Alexis) Yang",
  nameLocal: "杨子江",
  role: "Real estate research & strategy",
  location: "Paris",
  timezone: "Europe/Paris",
  bio: "Research and strategy at AEW, Master in Management at ESSEC. Looking for a final-year internship from January 2027.",
  coverTitle: "Alexis Yang — Folio",
  seal,
  source: "https://github.com/AlickYang2016/RiverManYoung",
  links: [
    { label: "Email", href: "mailto:zijiang.yang1@essec.edu" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/yangzijiang" },
    { label: "Website", href: "https://alexisyang.com" },
  ],
  items: [
    {
      kind: "card",
      id: "card",
      label: "Business card",
      anecdote: "Real estate research, strategy and international business, between France, China and the United States.",
      story: "The short version of everything else in this pouch. The inside is for the people who write back.",
      specs: [
        { k: "Based", v: "Paris" },
        { k: "Languages", v: "Mandarin · English · French" },
      ],
      front: { name: "Zijiang (Alexis) Yang", role: "Real estate research & strategy", tagline: "Research into insight, insight into strategy" },
      inside: [
        { k: "Email", v: "zijiang.yang1@essec.edu" },
        { k: "Web", v: "alexisyang.com" },
        { k: "LinkedIn", v: "in/yangzijiang" },
      ],
      insideNote: "Available for a final-year internship from January 2027.",
    },
    {
      kind: "resume",
      id: "resume",
      label: "Résumé",
      anecdote: "Research at AEW, a strategy project presented to Adagio’s CEO, programme work at BNP Paribas.",
      story: "From raw data to a clear recommendation: the same habit at AEW, on the Adagio project and in the Pro Bono programme.",
      specs: [
        { k: "Updated", v: "October 2026" },
        { k: "Also in", v: "Français · 中文" },
      ],
      summary: "ESSEC Master in Management student with research and strategy experience at AEW, BNP Paribas and on a consulting project for Adagio. I turn raw data into clear recommendations, in three working languages. Available for a final-year internship from January 2027.",
      experience: [
        {
          org: "AEW (Natixis Investment Managers)",
          role: "Research & Strategy Analyst Intern",
          from: "Feb 2026",
          to: "Aug 2026",
          bullets: [
            "Automated the multi-criteria scoring of European office and logistics markets: coverage widened from 45 to 72 cities, publication cycle cut from six months to three.",
            "Built the data, regression analysis and every chart of the July 2026 European Office Outlook.",
            "Asset positioning studies for acquisitions, disposals and debt financing; a country study on Poland.",
          ],
        },
        {
          org: "Adagio × ESSEC",
          role: "Expansion strategy consulting project, co-lead",
          from: "Jan 2025",
          to: "Jul 2025",
          bullets: ["Assessed 35+ European cities for three brands and compared lease, franchise and management-contract models.", "Presented the prioritised markets to Adagio’s CEO; project graded 19/20."],
        },
        {
          org: "BNP Paribas, Group Legal Pro Bono",
          role: "Legal Assistant Intern",
          from: "Feb 2024",
          to: "Aug 2024",
          bullets: ["Helped relaunch the EMEA Pro Bono programme: project tracking in Excel, sponsor presentations and the programme’s SharePoint site."],
        },
      ],
      education: [
        { school: "ESSEC Business School", degree: "Master in Management, Real Estate Chair", from: "2023", to: "2027" },
        { school: "George Washington University", degree: "Graduate exchange", from: "2025", to: "2026" },
        { school: "Renmin University of China", degree: "B.Econ. Finance, with distinction", from: "2019", to: "2023" },
        { school: "KEDGE Business School", degree: "Bachelor, Supply Chain Management", from: "2019", to: "2023" },
      ],
      skills: ["Market research", "Quantitative & regression analysis", "Multi-criteria scoring", "Data visualisation", "Excel · PowerPoint · Power BI", "VBA & R (coursework)"],
      languages: ["Mandarin (native)", "English (IELTS 7.5)", "French (TCF B2)"],
      pdf: `${CV}Zijiang_Yang_CV_EN.4fe0a263ecb921bd.pdf`,
      page: "cv/cv-en.webp",
    },
    {
      kind: "ticket",
      id: "ticket",
      label: "Presentation pass",
      anecdote: "35+ European cities, three brands, one set of recommendations to the CEO. Graded 19/20.",
      story: "An ESSEC corporate strategy project for Adagio: extended-stay market research, demand indicators, multi-criteria scoring and competitive benchmarking, ending in prioritised cities and operating models for Access, Original and Premium.",
      event: "Adagio × ESSEC",
      date: "2025",
      city: "Paris",
      seat: "Co-lead",
      talk: "Where should Adagio grow next?",
      serial: "19/20",
      specs: [
        { k: "Cities", v: "35+" },
        { k: "Brands", v: "Access · Original · Premium" },
      ],
      links: [{ label: "The project on alexisyang.com", href: "https://alexisyang.com/?lang=en#adagio-strategy" }],
    },
    {
      kind: "polaroid",
      id: "polaroid",
      label: "Polaroid",
      anecdote: "A semester across the Atlantic: graduate exchange at the GWU School of Business.",
      story: "MBA-level courses in US business law (contract, property and tort), quantitative analysis for real estate investment and development, and data analysis with Power BI.",
      caption: "washington, d.c.",
      image: "photos/washington.webp",
      tint: "#c9d3da",
      place: "Washington, D.C.",
      date: "Fall 2025",
      back: "GWU exchange, August 2025 to January 2026, through ESSEC.",
    },
    {
      kind: "note",
      id: "note",
      label: "A note",
      anecdote: "A 便笺 is a narrow sheet for a few lines: too short for a letter, a little warmer than a text.",
      text: "Thanks for stopping by. From January 2027 I am looking for a final-year internship, somewhere analysis meets strategy. If anything here spoke to you, I would be glad to hear from you.",
      from: "Alexis",
      date: "2026-10-24",
    },
  ],
  albums: albumsFor(placeNotes, postcardsEn, "Alexis"),
};
