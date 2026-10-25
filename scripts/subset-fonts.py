#!/usr/bin/env python3
"""
Folio: cut the CJK faces down to the characters this folio actually prints.

Why: fontsource / LXGW ship each CJK face as ~100 unicode-range slices per weight. With the Chinese and Japanese faces registered
the page held 1,000+ FontFace objects, and every `document.fonts.load()` / text layout had to match against all of them: on a
desktop this froze the page for seconds at a time while the folio opened, and a Chinese page downloaded 100+ slice files (~2 MB).

What: every non-ASCII character in profile/, src/ and index.html is collected; for each face and weight the slices holding those
characters are subset to exactly them and merged into ONE small woff2, with one @font-face whose unicode-range lists only those
characters. The output keeps the shapes the loaders expect:
  - src/fonts/subset/<face>.css + files/  (Chinese faces: read raw by han-*.ts, file names "<prefix>-0-<weight>-normal.woff2")
  - src/fonts/subset/<face>-<weight>.css  (Japanese faces: imported as CSS by src/fonts/index.ts)
A character outside the set (new text added later without re-running this) falls back to the system's CJK face, never to tofu.
Run after changing any text:  python3 scripts/subset-fonts.py   (needs: pip install fonttools brotli). CI runs it before the build.
"""
import re, sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.merge import Merger, Options as MergeOptions

ROOT = Path(__file__).resolve().parent.parent
NM = ROOT / "node_modules"
OUT = ROOT / "src" / "fonts" / "subset"
FILES = OUT / "files"

# ---- the characters ---------------------------------------------------------------------------------------------------------
def collect(ja: bool = False) -> set[int]:
    """All non-ASCII characters. ja=True: only what can be set in the Japanese faces, i.e. without the Chinese profile and the
    Chinese UI dictionary (on a Chinese page their text takes the Chinese faces), so a Japanese file stays small."""
    cps: set[int] = set()
    paths = list((ROOT / "profile").glob("*.ts")) + [ROOT / "index.html"]
    for ext in ("ts", "tsx"):
        paths += [p for p in (ROOT / "src").rglob(f"*.{ext}") if ".test." not in p.name and "/subset/" not in str(p)]
    for p in paths:
        text = p.read_text(encoding="utf-8")
        if ja and p.name == "zh.ts" and p.parent.name == "profile":
            continue
        if ja and p.name == "i18n.ts":
            text = re.sub(r"export const zh: Dict = \{.*?\n\};", "", text, flags=re.S)
            text = re.sub(r"const ZH_NUM.*?\n\}", "", text, flags=re.S)
        for ch in text:
            c = ord(ch)
            if c > 0x7F:
                cps.add(c)
    # always-safe extras: CJK punctuation, full-width forms and digits a date or a label may print
    cps |= set(range(0x3000, 0x3040)) | set(range(0xFF01, 0xFF5F))
    cps |= {ord(c) for c in "〇一二三四五六七八九十百千年月日时時分秒星期周週"}
    return cps

# ---- parsing a slice CSS -----------------------------------------------------------------------------------------------------
def ranges(spec: str) -> list[tuple[int, int]]:
    out = []
    for part in spec.split(","):
        part = part.strip().upper().replace("U+", "")
        if not part:
            continue
        if "?" in part:
            out.append((int(part.replace("?", "0"), 16), int(part.replace("?", "F"), 16)))
        elif "-" in part:
            a, b = part.split("-")
            out.append((int(a, 16), int(b, 16)))
        else:
            out.append((int(part, 16), int(part, 16)))
    return out

def slices(css: Path) -> list[tuple[str, list[tuple[int, int]]]]:
    out = []
    for body in re.findall(r"@font-face\s*{([^}]*)}", css.read_text(encoding="utf-8")):
        f = re.search(r"url\(\s*['\"]?\./files/([^'\")]+\.woff2)", body)
        r = re.search(r"unicode-range:\s*([^;}]+)", body)
        if f and r:
            out.append((f.group(1), ranges(r.group(1))))
    return out

def to_range_css(cps: list[int]) -> str:
    cps = sorted(cps)
    parts, i = [], 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1:
            j += 1
        parts.append(f"U+{cps[i]:X}" if i == j else f"U+{cps[i]:X}-{cps[j]:X}")
        i = j + 1
    return ", ".join(parts)

# ---- subsetting --------------------------------------------------------------------------------------------------------------
def subset_one(path: Path, keep: set[int]) -> TTFont | None:
    font = TTFont(path)
    have = set(font.getBestCmap() or {})
    want = keep & have
    if not want:
        return None
    opts = subset.Options()
    opts.layout_features = ["*"]  # vertical forms (vert / vrt2) and proportional punctuation stay
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.hinting = False
    opts.desubroutinize = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=sorted(want))
    s.subset(font)
    font.flavor = None
    return font

def build(src_dir: Path, slice_css: Path, file_for_weight, weight: str, out_name: str, keep: set[int]) -> tuple[str, list[int]] | None:
    """Merge the subset of every slice holding a needed character into FILES/out_name. Returns (file name, code points)."""
    used: list[TTFont] = []
    cps: set[int] = set()
    tmp = []
    for fname, rs in slices(slice_css):
        need = {c for c in keep if any(a <= c <= b for a, b in rs)}
        if not need:
            continue
        p = src_dir / file_for_weight(fname, weight)
        if not p.exists():
            continue
        f = subset_one(p, need)
        if f is None:
            continue
        cps |= set(f.getBestCmap())
        t = OUT / f".tmp-{len(tmp)}.ttf"
        f.save(t)
        tmp.append(t)
    if not tmp:
        return None
    if len(tmp) == 1:
        merged = TTFont(tmp[0])
    else:
        merged = Merger(options=MergeOptions()).merge([str(t) for t in tmp])
    merged.flavor = "woff2"
    merged.save(FILES / out_name)
    for t in tmp:
        t.unlink()
    return out_name, sorted(cps)

def main() -> None:
    keep = collect()
    keep_ja = collect(ja=True)
    OUT.mkdir(parents=True, exist_ok=True)
    FILES.mkdir(parents=True, exist_ok=True)
    for old in FILES.glob("*.woff2"):
        old.unlink()
    total = 0
    report = []

    # Chinese faces: one raw CSS per face (all its weights' files exist under the same slice number "0")
    zh = [
        ("noto-serif-sc", NM / "@fontsource/noto-serif-sc", "400.css", ["400", "500", "600"], "Noto Serif SC"),
        ("noto-sans-sc", NM / "@fontsource/noto-sans-sc", "300.css", ["300", "500"], "Noto Sans SC"),
    ]
    for name, pkg, css, weights, fam in zh:
        rows = []
        for w in weights:
            r = build(pkg / "files", pkg / css, lambda f, w=w: re.sub(r"-\d+-normal\.woff2$", f"-{w}-normal.woff2", f), w, f"{name}-0-{w}-normal.woff2", keep)
            if r:
                rows.append(r)
        if rows:
            # the loader reads the first weight's slice list and swaps the weight in the file name for the others
            cps = sorted(set().union(*[set(c) for _, c in rows]))
            (OUT / f"{name}.css").write_text(
                f"/* generated by scripts/subset-fonts.py — do not edit */\n@font-face {{\n  font-family: '{fam}';\n  font-style: normal;\n  font-display: swap;\n  font-weight: {weights[0]};\n  src: url(./files/{rows[0][0]}) format('woff2');\n  unicode-range: {to_range_css(cps)};\n}}\n",
                encoding="utf-8",
            )
            report += [(f, len(c)) for f, c in rows]

    lx = NM / "lxgw-wenkai-webfont"
    r = build(lx / "files", lx / "lxgwwenkai-regular.css", lambda f, w: f, "400", "lxgwwenkai-regular-subset-0.woff2", keep)
    if r:
        (OUT / "lxgwwenkai-regular.css").write_text(
            f"/* generated by scripts/subset-fonts.py — do not edit */\n@font-face {{\n  font-family: 'LXGW WenKai';\n  font-style: normal;\n  font-display: swap;\n  font-weight: 400;\n  src: url(./files/{r[0]}) format('woff2');\n  unicode-range: {to_range_css(r[1])};\n}}\n",
            encoding="utf-8",
        )
        report.append((r[0], len(r[1])))

    # Japanese faces: one importable CSS per weight (only the CJK part: their Latin slices are the alias faces, registered apart)
    ja = [
        ("shippori-mincho", "Shippori Mincho", ["400", "500", "600"]),
        ("zen-kaku-gothic-new", "Zen Kaku Gothic New", ["400", "500"]),
        ("klee-one", "Klee One", ["600"]),
    ]
    for name, fam, weights in ja:
        pkg = NM / "@fontsource" / name
        for w in weights:
            r = build(pkg / "files", pkg / f"{w}.css", lambda f, w=w: f, w, f"{name}-0-{w}-normal.woff2", keep_ja)
            body = f"/* generated by scripts/subset-fonts.py — do not edit */\n"
            if r:
                body += f"@font-face {{\n  font-family: '{fam}';\n  font-style: normal;\n  font-display: swap;\n  font-weight: {w};\n  src: url(./files/{r[0]}) format('woff2');\n  unicode-range: {to_range_css(r[1])};\n}}\n"
                report.append((r[0], len(r[1])))
            (OUT / f"{name}-{w}.css").write_text(body, encoding="utf-8")

    for f, n in report:
        size = (FILES / f).stat().st_size
        total += size
        print(f"{f:44s} {n:5d} chars {size/1024:7.1f} KB")
    print(f"{len(keep)} characters kept ({len(keep_ja)} for the Japanese faces); {len(report)} files, {total/1024:.0f} KB in all")

if __name__ == "__main__":
    sys.exit(main())
