import { hanLangOf, pageLang, type FontRun } from "../../fonts";
import type { AlbumCard } from "../../profile/schema";
import type { LayoutPreset, LayoutSpec } from "../layout";
import { createPocketGrid, type ContentSource, type PaintEnv, type SlotCell } from "./grid";
import { BLACK, WHITE, css, grainPattern, luma, mix, printFont, rgbOf, roundRectPath, track } from "./paint";

/*
 * The card album's faces. A card with a picture (src) shows the picture; one without is a colour card (色見本): a soft field of its
 * colour with a sheen, its name printed at the bottom left — the romaji and the kanji (nameLocal) in Shippori Mincho, 1.2 mm apart,
 * in sumi (or a cool white on a dark colour) — and a tiny index top right in Zen Kaku. No logos, no invented marks, no bold.
 * 和色 names are Japanese: their kanji are set in the Japanese faces whatever the profile's language.
 */

const LABEL_MM = 4;
const INDEX_MM = 1.6;
/** Folio: the chapter line on a picture card */
const CHAPTER_MM = 2.2;
/** Folio: a card's badge (AlbumCard.badge): its title and the line under it */
const BADGE_MM = 5.2;
const BADGE_LINE_MM = 2.1;

/** The strings the faces print. */
function cardRuns(cards: readonly AlbumCard[]): FontRun[] {
  const latin = cards.map((c) => c.label || c.id).join(" ");
  const local = cards.map((c) => c.nameLocal ?? "").join("");
  const chapters = cards.map((c) => c.chapter ?? "").join(" ");
  const runs: FontRun[] = [{ role: "serif", weight: 400, text: latin, han: hanLangOf(latin, pageLang()) }, { role: "sans", weight: 500, text: "0123456789", han: "ja" }];
  if (chapters.trim()) runs.push({ role: "sans", weight: 500, text: chapters, han: hanLangOf(chapters, pageLang()) });
  if (local) runs.push({ role: "serif", weight: 400, text: local, han: "ja" });
  const badges = cards.map((c) => c.badge?.title ?? "").join(" ");
  const lines = cards.map((c) => c.badge?.line ?? "").join(" ");
  if (badges.trim()) runs.push({ role: "serif", weight: 600, text: badges, han: hanLangOf(badges, pageLang()) });
  if (lines.trim()) runs.push({ role: "sans", weight: 500, text: lines, han: hanLangOf(lines, pageLang()) });
  return runs;
}

/** `layout`: any pocket grid of CR80 cards (the faces are painted per pocket, whatever the rows); default the tall album's 2 × 4. */
export function createCardContent(cards: readonly AlbumCard[], layout: LayoutPreset | LayoutSpec = "idCard2x4"): ContentSource {
  return createPocketGrid({ items: cards, paint: paintAlbumCard, layout, fonts: cardRuns(cards) });
}

export function paintAlbumCard(ctx: CanvasRenderingContext2D, card: AlbumCard, cell: SlotCell, env: PaintEnv) {
  const { place: r } = cell;
  const k = env.pxPerMm;
  const img = card.src ? env.image(card.src) : null;
  const base = rgbOf(card.color);
  const w = r.w;
  const h = r.h;
  ctx.save();
  ctx.translate(r.x + w / 2, r.y + h / 2);
  ctx.rotate(r.tilt);
  ctx.translate(-w / 2, -h / 2);
  // the card's own soft shadow in the pocket (it has a thickness)
  ctx.save();
  ctx.shadowColor = "rgba(21,35,58,0.28)";
  ctx.shadowBlur = 1.2 * k;
  ctx.shadowOffsetY = 0.25 * k;
  roundRectPath(ctx, 0, 0, w, h, r.r);
  ctx.fillStyle = css(base);
  ctx.fill();
  ctx.restore();
  roundRectPath(ctx, 0, 0, w, h, r.r);
  ctx.save();
  ctx.clip();
  if (img) {
    paintPictureCard(ctx, card, img, w, h, cell.index);
  } else {
    // soft gradient from the colour: lighter up-left, a touch deeper down-right
    const g = ctx.createLinearGradient(0, 0, w * 0.7, h * 1.2);
    g.addColorStop(0, css(mix(base, WHITE, 0.34)));
    g.addColorStop(0.55, css(base));
    g.addColorStop(1, css(mix(base, BLACK, 0.1)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // a broad sheen across the upper half
    const s = ctx.createRadialGradient(w * 0.22, -h * 0.25, 0, w * 0.22, -h * 0.25, w * 0.9);
    s.addColorStop(0, "rgba(255,255,255,0.32)");
    s.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    const dark = luma(base) < 0.3;
    const ink = dark ? "rgba(244,246,247,0.9)" : "rgba(28,35,43,0.6)";
    // the index, top right: Zen Kaku, small, tracked
    ctx.font = printFont("sans", 500, INDEX_MM, "ja");
    track(ctx, INDEX_MM * 0.14);
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = ink;
    ctx.fillText(String(cell.index + 1).padStart(2, "0"), w - 4.6, 6.6);
    ctx.textAlign = "left";
    track(ctx, 0);
    // the name, bottom left: the romaji, then the kanji 1.2 mm after it (both Mincho 400, 4 mm)
    const label = card.label || card.id;
    const x = 5;
    const y = h - 5.4;
    ctx.font = printFont("serif", 400, LABEL_MM, hanLangOf(label, pageLang()));
    track(ctx, LABEL_MM * 0.01);
    ctx.fillText(label, x, y);
    const lw = ctx.measureText(label).width;
    if (card.nameLocal && card.nameLocal !== label) {
      ctx.font = printFont("serif", 400, LABEL_MM, "ja");
      track(ctx, LABEL_MM * 0.06);
      ctx.fillText(card.nameLocal, x + lw + 1.2, y);
    }
    track(ctx, 0);
  }
  ctx.restore();
  // the cut edge: a hairline of light
  ctx.lineWidth = 0.18;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  roundRectPath(ctx, 0.09, 0.09, w - 0.18, h - 0.18, r.r - 0.09);
  ctx.stroke();
  ctx.restore();
}

/**
 * Folio: a picture card. The photo fills the card cropped (never stretched), a soft shade at the foot carries the place's name in
 * white (romaji, then its own script), the chapter sits small at the top left and the card's number at the top right, so a page of
 * cards reads as one chapter of the journey.
 */
function paintPictureCard(ctx: CanvasRenderingContext2D, card: AlbumCard, img: CanvasImageSource, w: number, h: number, index: number) {
  const iw = (img as HTMLImageElement).naturalWidth || (img as { width: number }).width || w;
  const ih = (img as HTMLImageElement).naturalHeight || (img as { height: number }).height || h;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  // the foot shade (the name sits on it) and a lighter one at the head (chapter, number)
  const foot = ctx.createLinearGradient(0, h * 0.5, 0, h);
  foot.addColorStop(0, "rgba(12,20,30,0)");
  foot.addColorStop(1, "rgba(12,20,30,0.62)");
  ctx.fillStyle = foot;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);
  const head = ctx.createLinearGradient(0, 0, 0, h * 0.28);
  head.addColorStop(0, "rgba(12,20,30,0.38)");
  head.addColorStop(1, "rgba(12,20,30,0)");
  ctx.fillStyle = head;
  ctx.fillRect(0, 0, w, h * 0.28);
  const ink = "rgba(250,250,247,0.96)";
  ctx.fillStyle = ink;
  ctx.textBaseline = "alphabetic";
  ctx.font = printFont("sans", 500, INDEX_MM, "ja");
  track(ctx, INDEX_MM * 0.14);
  ctx.textAlign = "right";
  ctx.fillText(String(index + 1).padStart(2, "0"), w - 4.6, 6.6);
  ctx.textAlign = "left";
  if (card.chapter) {
    ctx.font = printFont("sans", 500, CHAPTER_MM, hanLangOf(card.chapter, pageLang()));
    track(ctx, CHAPTER_MM * 0.1);
    ctx.fillStyle = "rgba(250,250,247,0.86)";
    ctx.fillText(card.chapter, 5, 7);
  }
  track(ctx, 0);
  if (card.badge) paintBadge(ctx, card.badge, w, h);
  ctx.fillStyle = ink;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 0.8;
  const label = card.label || card.id;
  const x = 5;
  const y = h - 5.4;
  ctx.font = printFont("serif", 400, LABEL_MM, hanLangOf(label, pageLang()));
  track(ctx, LABEL_MM * 0.01);
  ctx.fillText(label, x, y);
  const lw = ctx.measureText(label).width;
  if (card.nameLocal && card.nameLocal !== label) {
    ctx.font = printFont("serif", 400, LABEL_MM * 0.8, "ja");
    track(ctx, LABEL_MM * 0.06);
    ctx.fillText(card.nameLocal, x + lw + 1.6, y);
  }
  track(ctx, 0);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

/**
 * Folio: a card's badge — a white label laid on the picture under the chapter line, like a tag slipped into the pocket with the card:
 * the title in Mincho 600 (sumi), the line under it in Zen Kaku (藍鼠), and a hairline of the album's indigo down its left edge.
 */
function paintBadge(ctx: CanvasRenderingContext2D, badge: NonNullable<AlbumCard["badge"]>, w: number, h: number) {
  const padX = 2.2;
  ctx.font = printFont("serif", 600, BADGE_MM, hanLangOf(badge.title, pageLang()));
  track(ctx, BADGE_MM * 0.04);
  const tw = ctx.measureText(badge.title).width;
  let lw = 0;
  if (badge.line) {
    ctx.font = printFont("sans", 500, BADGE_LINE_MM, hanLangOf(badge.line, pageLang()));
    track(ctx, BADGE_LINE_MM * 0.08);
    lw = ctx.measureText(badge.line).width;
  }
  const bw = Math.max(tw, lw) + padX * 2 + 0.8;
  const bh = badge.line ? 11.4 : 7.8;
  // top: under the chapter line; bottom: bottom right, clear of the name at the bottom left
  const x = badge.at === "bottom" ? w - 4.6 - bw : 5;
  const y = badge.at === "bottom" ? h - 4.6 - bh : 9.6;
  ctx.save();
  ctx.shadowColor = "rgba(12,20,30,0.3)";
  ctx.shadowBlur = 1.4;
  ctx.shadowOffsetY = 0.3;
  roundRectPath(ctx, x, y, bw, bh, 0.9);
  ctx.fillStyle = "rgba(250,250,247,0.95)";
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#2f4f73";
  ctx.fillRect(x, y + 1.2, 0.45, bh - 2.4);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#1c232b";
  ctx.font = printFont("serif", 600, BADGE_MM, hanLangOf(badge.title, pageLang()));
  track(ctx, BADGE_MM * 0.04);
  ctx.fillText(badge.title, x + padX + 0.8, y + 5.8);
  if (badge.line) {
    ctx.fillStyle = "#4f5d69";
    ctx.font = printFont("sans", 500, BADGE_LINE_MM, hanLangOf(badge.line, pageLang()));
    track(ctx, BADGE_LINE_MM * 0.08);
    ctx.fillText(badge.line, x + padX + 0.8, y + 9.4);
  }
  track(ctx, 0);
}
