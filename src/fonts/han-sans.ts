/*
 * Noto Sans SC, the two weights Chinese sans text is set in (src/fonts SC_FILES.sans: 300 for the body, 500 for the words set at 500):
 * the unicode-range slices (the 300 CSS; the 500 file has the same slices) and the URLs of both weights' files. Imported lazily by
 * src/fonts the first time a string needs the face; a 500 slice downloads only when text at 500 needs it.
 */
// Folio: cut to this folio's characters (scripts/subset-fonts.py)
import css from "./subset/noto-sans-sc.css?raw";

const files = import.meta.glob("./subset/files/noto-sans-sc-0-{300,500}-normal.woff2", { query: "?url", import: "default", eager: true, exhaustive: true }) as Record<string, string>;

export default { css, files };
