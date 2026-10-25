import type { Folio } from "../src/profile/folio";
import { profileFr } from "./fr";

/*
 * Three languages, like the main site. French is the default (owner 2026-10-25: the folio is for recruiters in Paris) and ships in
 * the entry chunk; English and Chinese are fetched the first time a visitor picks them or arrives with ?lang=en / ?lang=zh.
 */
export const folio: Folio = {
  primary: "fr",
  profiles: {
    fr: profileFr,
    en: () => import("./en").then((m) => m.profile),
    zh: () => import("./zh").then((m) => m.profileZh),
  },
};
