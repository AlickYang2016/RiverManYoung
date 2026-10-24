import type { Folio } from "../src/profile/folio";
import { profile } from "./en";

/*
 * Three languages, like the main site: English ships in the entry chunk; French and Chinese are fetched the first time a visitor picks
 * them or arrives with ?lang=fr / ?lang=zh.
 */
export const folio: Folio = {
  primary: "en",
  profiles: {
    en: profile,
    fr: () => import("./fr").then((m) => m.profileFr),
    zh: () => import("./zh").then((m) => m.profileZh),
  },
};
