/**
 * What the player reads about the others during a run: a ghost's name over its head and the
 * label of the flag it leaves where its run ended (the hologram itself is `EchoRenderer`), and
 * the signs at the screen's edge towards whatever is off screen (`drawEdgeSign`: the ghost, the
 * rival, the boss, the finish), all of one kind.
 */
import type { EchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import type { BitmapFont } from '@parapet/runtime/text/BitmapFont.ts';
import { outlined } from '@parapet/runtime/ui/draw.ts';
import type { Rect } from '@parapet/runtime/ui/layout.ts';

/** Height of the head above the feet, in pixels (a runner is about two tiles tall). */
const HEAD_ABOVE_FEET = 70;
/** Gap between the hands point and the tag while hanging or climbing. */
const HEAD_ABOVE_HANDS = 10;
/** A sign's picture is this far inside the edge: room for its chevron on the outer side. */
const SIGN_MARGIN = 22;
/** How see-through a sign's picture is: it only shows the way. */
const SIGN_OPACITY = 0.55;
const CHEVRON_COLOR = '#9aa3ad';

/** `+1.4` / `-0.8`: a gap in ms as signed seconds (the bitmap font has no minus sign). */
export function formatGap(ms: number, decimals = 1): string {
  const sign = ms > 0 ? '+' : ms < 0 ? '-' : '±';
  return `${sign}${(Math.abs(ms) / 1000).toFixed(decimals)}`;
}

/** The runner's name over its head. `anchored` means (x, y) is the hands, not the feet. */
export function drawNameTag(
  ctx: CanvasRenderingContext2D,
  font: BitmapFont,
  text: string,
  color: EchoColor,
  x: number,
  y: number,
  anchored: boolean,
): void {
  const top = y - (anchored ? HEAD_ABOVE_HANDS : HEAD_ABOVE_FEET) - font.lineHeight;
  outlined(ctx, font, text, x, top, { align: 'center', color: color.light });
}

/** The label of a ghost's finish flag, right of the pole. */
export function drawMarkerLabel(
  ctx: CanvasRenderingContext2D,
  font: BitmapFont,
  text: string,
  color: EchoColor,
  x: number,
  y: number,
): void {
  outlined(ctx, font, text, x + 9, y - 15, { color: color.light, tabular: true });
}

/**
 * Where a sign for a point outside `area` goes: on the line from the middle of `area` towards
 * the point, `margin` inside its edge, with the unit vector of that line; null while the point
 * is inside.
 */
export function edgePoint(
  area: Rect,
  x: number,
  y: number,
  margin = SIGN_MARGIN,
): { x: number; y: number; ux: number; uy: number } | null {
  const inside = x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h;
  if (inside) return null;
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const halfW = area.w / 2 - margin;
  const halfH = area.h / 2 - margin;
  const scale = Math.min(
    dx !== 0 ? halfW / Math.abs(dx) : Infinity,
    dy !== 0 ? halfH / Math.abs(dy) : Infinity,
  );
  if (!Number.isFinite(scale)) return null;
  const len = Math.hypot(dx, dy);
  return {
    x: Math.round(cx + dx * scale),
    y: Math.round(cy + dy * scale),
    ux: dx / len,
    uy: dy / len,
  };
}

/** A picture of a sign, drawn centred on a point, and how far it reaches from it. */
export interface EdgePicture {
  radius: number;
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
}

/** A sign's words (the ghost's gap, the boss's time), under its picture. */
export interface EdgeLabel {
  font: BitmapFont;
  text: string;
  color: string;
}

/**
 * When a point lies outside `area`, a sign on the edge of `area` towards it: the picture, pale,
 * a grey chevron on its outer side pointing the way, and the label, if any, under the picture
 * (over it on the bottom edge).
 */
export function drawEdgeSign(
  ctx: CanvasRenderingContext2D,
  area: Rect,
  x: number,
  y: number,
  picture: EdgePicture,
  label: EdgeLabel | null = null,
): void {
  const at = edgePoint(area, x, y);
  if (!at) return;
  ctx.save();
  ctx.globalAlpha = SIGN_OPACITY;
  picture.draw(ctx, at.x, at.y);
  ctx.restore();
  const { ux, uy } = at;
  const tipX = at.x + ux * (picture.radius + 8);
  const tipY = at.y + uy * (picture.radius + 8);
  ctx.beginPath();
  ctx.moveTo(tipX - ux * 4 - uy * 5, tipY - uy * 4 + ux * 5);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(tipX - ux * 4 + uy * 5, tipY - uy * 4 - ux * 5);
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#000000';
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CHEVRON_COLOR;
  ctx.stroke();
  if (!label) return;
  const { font, text, color } = label;
  const half = font.lineWidth(text, true) >> 1;
  const tx = Math.max(area.x + half + 2, Math.min(area.x + area.w - half - 2, at.x));
  const ty = uy > 0.7 ? at.y - picture.radius - 2 - font.lineHeight : at.y + picture.radius + 2;
  outlined(ctx, font, text, tx, ty, { align: 'center', color, tabular: true });
}
