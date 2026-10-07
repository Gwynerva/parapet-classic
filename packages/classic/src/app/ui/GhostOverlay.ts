/**
 * What the player reads about a ghost during a race: its name over its head, an arrow at the
 * screen edge pointing at it while it is off screen (with the current gap), and the label of
 * the flag it leaves where its run ended. The hologram itself is `EchoRenderer`.
 */
import type { EchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import type { BitmapFont } from '@parapet/runtime/text/BitmapFont.ts';
import { outlined } from '@parapet/runtime/ui/draw.ts';
import type { Rect } from '@parapet/runtime/ui/layout.ts';

/** Height of the head above the feet, in pixels (a runner is about two tiles tall). */
const HEAD_ABOVE_FEET = 70;
/** Gap between the hands point and the tag while hanging or climbing. */
const HEAD_ABOVE_HANDS = 10;
/** Distance of the arrow from the screen edge. */
const ARROW_MARGIN = 14;

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
 * When a point (the runner's body centre) lies outside `area`, draws an arrow on the edge of
 * `area` pointing at it, with `text` (the gap) next to the arrow.
 */
export function drawEdgeArrow(
  ctx: CanvasRenderingContext2D,
  font: BitmapFont,
  area: Rect,
  x: number,
  y: number,
  color: EchoColor,
  text: string | null,
): void {
  const inside = x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h;
  if (inside) return;
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const halfW = area.w / 2 - ARROW_MARGIN;
  const halfH = area.h / 2 - ARROW_MARGIN;
  const scale = Math.min(
    dx !== 0 ? halfW / Math.abs(dx) : Infinity,
    dy !== 0 ? halfH / Math.abs(dy) : Infinity,
  );
  if (!Number.isFinite(scale)) return;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const px = Math.round(cx + dx * scale);
  const py = Math.round(cy + dy * scale);
  ctx.beginPath();
  ctx.moveTo(px + ux * 7, py + uy * 7);
  ctx.lineTo(px - ux * 4 - uy * 6, py - uy * 4 + ux * 6);
  ctx.lineTo(px - ux * 4 + uy * 6, py - uy * 4 - ux * 6);
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000000';
  ctx.stroke();
  ctx.fillStyle = color.css;
  ctx.fill();
  if (text) {
    // The gap sits on the inner side of the arrow, away from the edge.
    const tx = Math.round(px - ux * 16);
    const ty = Math.round(py - uy * 14 - font.lineHeight / 2);
    outlined(ctx, font, text, tx, ty, { align: 'center', color: color.light, tabular: true });
  }
}
