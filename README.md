# Alexis Yang — Folio

The folio edition of [alexisyang.com](https://alexisyang.com): a business card, résumé, ticket, polaroid and note in a clear pouch, a card album of the places so far, and a postcard album, in English, French and Chinese. Built on [sasshi](https://github.com/qzz0518/sasshi) by qzz0518 (AGPL-3.0); the content in `profile/` and the photos in `public/photos/` are mine (all rights reserved). Integration notes: [FOLIO.md](FOLIO.md).

---

# sasshi

English · [简体中文](README.zh-CN.md)

**A shelf of physical booklets for your personal page.** Open a ring binder of cards, leaf through a postcard album, or open a folder and pick your things out of a clear zip pouch — business card, résumé, a ticket, a polaroid, a short note — all under real-time physics, on a pale desk in the morning light.

> **sasshi** (冊子) is Japanese for a booklet. Demo: [sasshi.zezn.dev](https://sasshi.zezn.dev). Spun out of the 3D album in [CardArt](https://cardart.cc); early days, expect changes.

## Booklets

| | What it is | Inside |
|---|---|---|
| **Cards** | Ring binder with clear PVC sleeves, 2×4 per side | Card-size pieces |
| **Postcards** | Ring binder with A6 sleeves, 2×3 per side | Postcards — the picture through the front film, the message side through the back |
| **Résumé folio** | Clamshell folder with a clear zip pouch | Your business card (opens), résumé (real paper, pages turn), a ticket and a polaroid that turn over, and a 一筆箋 note |

Drag to turn pages, drag the desk to tilt the folder, shake your phone, pick things up and fling them, click to read more; on a computer, scroll to bring the résumé closer. Every booklet has an accessible text fallback built from the same data.

## Make it yours

1. **Use this template** (the green button at the top of the repository), or fork it.
2. **Write your profile** in `profile/`. `en.ts` is the demo persona: name, links, the résumé, the things in the pouch, the cards and the postcards; every field is typed and explained in [`src/profile/schema.ts`](src/profile/schema.ts). `zh.ts` is the same persona in Chinese: rewrite it, or delete it and its line in `profile/index.ts` for a page in one language. Then run `bun run seal` to cut your name seal in small seal script (小篆) for the bookplate; a name with no seal form keeps a seal set in the serif.
3. **Add your pictures** to `public/photos/` and point to them as `photos/…` (no leading slash). Delete the demo photos and their entries in `CREDITS.md` and `manifest.json`.
4. **Set `source`** to your repository's URL. The page's footer links to it, which is how a public deployment meets the AGPL (see License).
5. **Publish.** On GitHub Pages: Settings → Pages → Source: **GitHub Actions**; from then on every push to `main` builds and deploys the site (`.github/workflows/pages.yml`) to `https://<you>.github.io/<repo>/`. Anywhere else (Cloudflare, Netlify, Vercel, your own server): build command `bun run build`, output directory `dist`. Every path is relative, so the site works at a domain's root or under a sub-path.

The page's title, description and link preview are made from your profile when the site is built; nothing in `src/` needs to change.

Working with an AI? [`prompts/`](prompts/README.md) has ready-made prompts: to make the page yours (the profile and résumé, the things in the pouch, the albums, the photos, a Chinese edition, the style to write in), and to build or extend the project itself (the art direction, the 3D album, the pouch, the paper, the light, the sound, a new booklet, the quality bar).

## Develop

```bash
bun install
bun run dev      # http://127.0.0.1:5188
```

One set of files drives the 3D booklets, the accessible text version (`?view=text`) and the machine-readable view (`?view=json`); `bun run typecheck` checks your profile against the schema. Set `lang` to the language a profile is written in: `"zh-CN"` gives the page Chinese chrome and sets Chinese in Noto Serif SC / Noto Sans SC / LXGW WenKai, so no sentence mixes glyph shapes; Latin always comes from the Japanese faces.

## Languages

Write your profile once per language and list them in `profile/index.ts`; the page then shows a small 「English · 中文」 switch (at the foot of the words column on a desk, beside your name on a phone) and changes language in place — no reload, the booklet on the desk stays, the print on the booklets follows. The demo carries English and Simplified Chinese:

```ts
// profile/index.ts: one Profile per language; every language but the primary loads only when a visitor picks it
import type { Folio } from "../src/profile/folio";
import { profile } from "./en";

export const folio: Folio = {
  primary: "en",
  profiles: { en: profile, zh: () => import("./zh").then((m) => m.profileZh) },
};
```

- The languages describe the same things: the same pouch items (ids and kinds, in order), the same album cards and postcards (ids, colours, pictures); only the words differ (`shapeDiff(a, b)` lists what does not match).
- Which language a visitor sees first: `?lang=zh` in the URL (links to the page keep it; the older `?sample=zh` still works), else the language they picked last time, else `primary` (the browser's language is not consulted). One language only: list a single profile and no switch is shown.

## How it works

- `src/book` — the ring-binder engine: clear sleeve pages are chains of rigid panels with soft heat-sealed hinges, integrated at 480 Hz; the frosted cover is a screen-space blur pass. Layouts (`idCard2x4` and `postcard2x3` on the demo's tall pages; `idCard2x3`, `postcard2x2`) and content sources are pluggable.
- `src/bag` — the pouch: a 2D rigid-body world (planck.js, continuous collision, three depth layers, hand-written Coulomb friction) driven by the apparent acceleration of the folder in 3D; procedural objects rendered with three.js.
- `src/paper` — the paper viewer: résumé pages and the folding business card, bent along the same physics chains.
- `src/app` — the page: the words column (name, bio, booklets, colophon), the still desk under the canvas (the window's shadows on it and on the booklet are the engine's), the hands row and its printed-word controls, the detail views, the text and JSON views, English and Chinese chrome.
- `src/fonts` — which face sets a string: Latin from the Japanese faces, Han by language, every CJK slice loaded only when a string needs it.

No third-party models or textures. The demo photographs are Unsplash-licensed; see public/photos/CREDITS.md.

## Third-party notices

- Fonts, all under the SIL Open Font License 1.1, via Fontsource unless noted: [Shippori Mincho](https://github.com/fontdasu/ShipporiMincho), [Zen Kaku Gothic New](https://github.com/googlefonts/zen-kakugothic), [Klee One](https://github.com/fontworks-fonts/Klee), [Noto Serif SC](https://github.com/notofonts/noto-cjk) and [Noto Sans SC](https://github.com/notofonts/noto-cjk); [LXGW WenKai](https://github.com/lxgw/LxgwWenKai) via `lxgw-wenkai-webfont`.
- The bookplate's seal glyphs in `profile/seal.ts` come from [Kaiyuan Small Seal](https://github.com/frankslin/kaiyuan-small-seal-font) (開元小篆), traced from public-domain editions of the 說文解字, under the SIL Open Font License 1.1 ([`profile/seal-OFL.txt`](profile/seal-OFL.txt)), not the AGPL; `bun run seal` looks them up with [OpenCC](https://github.com/BYVoid/OpenCC)'s seal dictionaries (Apache-2.0).
- Demo photos in `public/photos/` (Japan: postcards and the polaroid) are used under the [Unsplash License](https://unsplash.com/license) and are not covered by the AGPL; photographers and sources are listed in [CREDITS.md](public/photos/CREDITS.md). Replace them with your own.
- Sound effects and the room's ambience (a breeze in the leaves, a distant bird now and then; `createSoundKit({ ambient: false })` turns it off) in `public/sounds/` were generated with the [ElevenLabs](https://elevenlabs.io) Sound Effects API and processed by `scripts/sounds/` (`ambient.ts` for the ambience); regenerate them with your own `ELEVENLABS_API_KEY`.

## License

Copyright © 2026 qzz0518. [GNU AGPL-3.0](LICENSE).

- Use it for any site — your personal page, a job-hunting résumé, a freelance portfolio, a company page. If you deploy a modified version, publish its source: a public fork plus the footer's Source link (set `source` in your profile) is enough.
- Building it into a closed-source product? A commercial license is available — get in touch via [cardart.cc](https://cardart.cc).
- Contributions are welcome under the [CLA](CLA.md) (see [CONTRIBUTING](CONTRIBUTING.md)).
