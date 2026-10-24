/*
 * LXGW WenKai Regular, the handwriting for Chinese text: its unicode-range slices and their URLs. Imported lazily by src/fonts the
 * first time a string needs the face.
 */
// Folio: cut to this folio's characters (scripts/subset-fonts.py)
import css from "./subset/lxgwwenkai-regular.css?raw";

const files = import.meta.glob("./subset/files/lxgwwenkai-regular-subset-0.woff2", { query: "?url", import: "default", eager: true, exhaustive: true }) as Record<string, string>;

export default { css, files };
