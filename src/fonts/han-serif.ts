/*
 * Noto Serif SC, the three weights Chinese serif text is set in (src/fonts SC_FILES.serif: 400 / 500 / 600, Shippori's own): the
 * unicode-range slices (the 400 CSS; the other files have the same slices) and the URLs of all three weights' files. Imported
 * lazily by src/fonts the first time a string needs the face, so an English page never loads this chunk; a 500 or 600 slice
 * downloads only when text at that weight needs it.
 */
// Folio: the characters this folio prints, cut from Noto Serif SC (scripts/subset-fonts.py); one file per weight
import css from "./subset/noto-serif-sc.css?raw";

const files = import.meta.glob("./subset/files/noto-serif-sc-0-{400,500,600}-normal.woff2", { query: "?url", import: "default", eager: true, exhaustive: true }) as Record<string, string>;

export default { css, files };
