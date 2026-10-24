import type { Profile } from "../src/profile/schema";
import { seal } from "./seal";

/*
 * Zijiang (Alexis) Yang — the folio edition of alexisyang.com. Every line below is taken from the main site and its CV; the photos in
 * public/photos are the site's own. fr.ts and zh.ts carry the same things in French and Chinese, in the same order, with the same ids.
 * To change a fact, change it in all three files.
 */

export const CV = "https://alexisyang.com/assets/";

/** Sixteen places, two full sides of the card album. Shared with fr.ts / zh.ts (same ids, colours, local names). */
export const places = [
  { id: "c1", label: "Shanghai", nameLocal: "上海", color: "#c9d6dd" },
  { id: "c2", label: "Suzhou", nameLocal: "苏州", color: "#bcd0cf" },
  { id: "c3", label: "Bordeaux", nameLocal: "波尔多", color: "#c4c3cf" },
  { id: "c4", label: "Cergy", nameLocal: "塞尔吉", color: "#a9c1cb" },
  { id: "c5", label: "Paris", nameLocal: "巴黎", color: "#8fa9b8" },
  { id: "c6", label: "Washington", nameLocal: "华盛顿", color: "#7f98a6" },
  { id: "c7", label: "Osaka", nameLocal: "大阪", color: "#d5dcdf" },
  { id: "c8", label: "Kobe", nameLocal: "神戸", color: "#c3cdd2" },
  { id: "c9", label: "Takamatsu", nameLocal: "高松", color: "#b8cfd4" },
  { id: "c10", label: "Naoshima", nameLocal: "直島", color: "#9fc0c4" },
  { id: "c11", label: "Okayama", nameLocal: "岡山", color: "#a7b9ad" },
  { id: "c12", label: "Wakayama", nameLocal: "和歌山", color: "#93ab9f" },
  { id: "c13", label: "Shirahama", nameLocal: "白浜", color: "#c8d7d0" },
  { id: "c14", label: "Kyoto", nameLocal: "京都", color: "#a5a9b6" },
  { id: "c15", label: "Tokyo", nameLocal: "東京", color: "#6f8494" },
  { id: "c16", label: "Next", nameLocal: "下一站", color: "#3f5b6b" },
] as const;

const placeNotes = [
  "Where I grew up, and where the science competitions started.",
  "Renmin University of China, 2019–2023: Bachelor of Economics in Finance, graduated with distinction.",
  "KEDGE Business School: dual-degree bachelor’s in supply chain management.",
  "ESSEC Business School: Master in Management, Real Estate and Sustainable Development Chair.",
  "AEW Research & Strategy in 2026, BNP Paribas Group Legal in 2024, the Adagio project in 2025.",
  "GWU School of Business: graduate exchange, August 2025 to January 2026.",
  "Japan, October 2026: the first stop.",
  "Japan, October 2026.",
  "Japan, October 2026: across the Seto Inland Sea.",
  "Japan, October 2026: an island in the Inland Sea.",
  "Japan, October 2026.",
  "Japan, October 2026.",
  "Japan, October 2026: the coast.",
  "Japan, October 2026.",
  "Japan, October 2026: the last stop before Paris, on 17 October.",
  "From January 2027: the final-year internship. The city is still open.",
];

/** Twelve postcards, two sheets of six. Shared with fr.ts / zh.ts (same ids, pictures, dates). */
export const postcardBase = [
  { id: "p1", file: "renmin-xiuyuan-drawing", date: "2020-01-03", color: "#e3e3df" },
  { id: "p2", file: "renmin-kaitai-drawing", date: "2020-01-17", color: "#e1e1dc" },
  { id: "p3", file: "aew-team", date: "2026", color: "#d3dbe0" },
  { id: "p4", file: "bnpp-pro-bono", date: "2024", color: "#d9dad6" },
  { id: "p5", file: "renmin-choir", date: "", color: "#d8c9c4" },
  { id: "p6", file: "choir-rehearsal", date: "", color: "#d6dadc" },
  { id: "p7", file: "shanghai-lab", date: "", color: "#cfd6da" },
  { id: "p8", file: "shanghai-chemistry-award", date: "2018", color: "#e2cfc5" },
  { id: "p9", file: "shanghai-debate", date: "", color: "#cdd1d8" },
  { id: "p10", file: "paris-kitchen", date: "", color: "#d8d6d0" },
  { id: "p11", file: "shengjian", date: "", color: "#d6cfc4" },
  { id: "p12", file: "diving", date: "", color: "#b9d2da" },
] as const;

export type PostcardText = { label: string; place: string; placeLocal?: string; message: string };

const postcardsEn: PostcardText[] = [
  { label: "Xiuyuan Building", place: "Renmin University of China", placeLocal: "修远楼", message: "Pen on paper. Not an architect’s drawing; I simply enjoyed looking closely enough at a place to put it on paper." },
  { label: "Kaitai Building", place: "Renmin University of China", placeLocal: "开太楼", message: "Two weeks later. Growing up with an architect father, I learned to notice proportions, small details and the way people use a building." },
  { label: "AEW", place: "AEW, Paris", message: "Six months with the European Research & Strategy team: city scoring, quarterly reports, and the charts in the July 2026 Office Outlook." },
  { label: "Pro Bono", place: "BNP Paribas, Paris", message: "Group LEGAL Pro Bono: helping relaunch the EMEA programme, with the tracker, the sponsor summaries and the SharePoint site." },
  { label: "Choir", place: "Renmin University of China", placeLocal: "一二·九合唱音乐节", message: "The 33rd December 9th choral festival. At the piano and among the inner voices." },
  { label: "Rehearsal", place: "Before the concert", message: "Listening across the choir while keeping my own line." },
  { label: "Laboratory", place: "Shanghai", message: "Afternoons in a laboratory: break the problem down, test the assumptions, learn from what did not work." },
  { label: "First Prize", place: "Shanghai", placeLocal: "白猫杯", message: "First Prize, 2018 Shanghai Applied Chemistry & Skills Competition, high-school division." },
  { label: "Debate", place: "Shanghai", message: "First speaker in an English debate exchange: open the case, build the argument, then listen to the reply." },
  { label: "Kitchen", place: "Paris", message: "Cooking is one of the simplest ways I stay connected to home. Living abroad turned it into a way of sharing where I come from." },
  { label: "Shengjian", place: "Shanghai, wherever I am", placeLocal: "生煎", message: "Pan-fried dumplings, occasionally one batch at a time. Shanghai, wherever I am." },
  { label: "Diving", place: "Under water", message: "Underwater, panic makes a difficult situation harder. Breathe steadily, understand what is happening, then act deliberately." },
];

/** The albums for one language, from its own notes and postcard texts. */
export function albumsFor(notes: string[], cards: PostcardText[], from: string): Profile["albums"] {
  return {
    cards: places.map((c, i) => ({ ...c, label: c.label, note: notes[i] })),
    postcards: postcardBase.map((b, i) => ({
      id: b.id,
      ...cards[i]!,
      src: `photos/${b.file}.jpg`,
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
  bio: "Real estate research at AEW, Master in Management at ESSEC. Seeking a final-year internship from January 2027.",
  coverTitle: "Alexis Yang — Folio",
  seal,
  source: "https://github.com/AlickYang2016/folio",
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
      anecdote: "Real estate research at AEW, a strategy project for Adagio’s CEO, programme delivery at BNP Paribas.",
      story: "From source data to a clear recommendation: the same habit at AEW, on the Adagio project and in the Pro Bono programme.",
      specs: [
        { k: "Updated", v: "October 2026" },
        { k: "Also in", v: "Français · 中文" },
      ],
      summary: "ESSEC Master in Management candidate combining quantitative analysis, strategy and cross-cultural experience. Seeking a final-year internship from January 2027.",
      experience: [
        {
          org: "AEW (Natixis Investment Managers)",
          role: "Research & Strategy Analyst Intern",
          from: "Feb 2026",
          to: "Aug 2026",
          bullets: [
            "Automated multi-criteria scoring of European office and logistics markets: 45 to 72 cities, publication cycle from six months to three.",
            "Data, regression analysis and all charts for the July 2026 European Office Outlook.",
            "Asset positioning studies for acquisitions, disposals and debt financing.",
          ],
        },
        {
          org: "Adagio × ESSEC",
          role: "Real estate development strategy, co-lead",
          from: "Jan 2025",
          to: "Jul 2025",
          bullets: ["Scored 35+ European cities for three brands; recommendations presented to the CEO. Grade 19/20."],
        },
        {
          org: "BNP Paribas, Group Legal Pro Bono",
          role: "Legal Assistant Intern",
          from: "Feb 2024",
          to: "Aug 2024",
          bullets: ["Relaunch of the EMEA Pro Bono programme: tracking, sponsor decks, SharePoint."],
        },
      ],
      education: [
        { school: "ESSEC Business School", degree: "Master in Management, Real Estate Chair", from: "2023", to: "2027" },
        { school: "George Washington University", degree: "Graduate exchange", from: "2025", to: "2026" },
        { school: "Renmin University of China", degree: "B.Econ. Finance, with distinction", from: "2019", to: "2023" },
        { school: "KEDGE Business School", degree: "Bachelor, Supply Chain Management", from: "2019", to: "2023" },
      ],
      skills: ["Market research", "Regression analysis", "Multi-criteria scoring", "Data visualisation", "Excel · Power BI"],
      languages: ["Mandarin (native)", "English (IELTS 7.5)", "French (TCF B2)"],
      pdf: `${CV}Zijiang_Yang_CV_EN.4fe0a263ecb921bd.pdf`,
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
      image: "photos/washington.jpg",
      tint: "#c9d3da",
      place: "Washington, D.C.",
      date: "Fall 2025",
      back: "GWU exchange, August 2025 to January 2026, through ESSEC.",
    },
    {
      kind: "note",
      id: "note",
      label: "A note",
      anecdote: "A 一筆箋 is a narrow sheet for a few lines: too short for a letter, too kind for a text.",
      text: "Thank you for opening this. I am looking for a final-year internship from January 2027 in real estate investment, asset management, research or strategy. If something here caught your eye, write to me.",
      from: "Alexis",
      date: "2026-10-24",
    },
  ],
  albums: albumsFor(placeNotes, postcardsEn, "Alexis"),
};
