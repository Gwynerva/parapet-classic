/** Small drawing helpers shared by the menu screens. */
import type { BitmapFont, DrawTextOptions } from '../text/BitmapFont.ts';
import { Theme } from './theme.ts';

/** Offsets of the eight neighbours that make up a one-pixel text outline. */
const OUTLINE_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

export interface OutlinedTextOptions extends DrawTextOptions {
  /** Outline colour (black by default). */
  outline?: string;
}

/**
 * Text with a one-pixel outline on all sides, for overlays drawn over the game view where the
 * background ranges from a near-white sky to a night wall. Nine draws of a short string per
 * frame cost nothing noticeable.
 */
export function outlined(
  ctx: CanvasRenderingContext2D,
  font: BitmapFont,
  text: string,
  x: number,
  y: number,
  opts: OutlinedTextOptions = {},
): void {
  const { outline = '#000000', ...inner } = opts;
  const edge: DrawTextOptions = { ...inner, color: outline };
  for (const [dx, dy] of OUTLINE_OFFSETS) font.draw(ctx, text, x + dx, y + dy, edge);
  font.draw(ctx, text, x, y, inner);
}

/** A one-pixel border just inside the rectangle. */
export function border(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

/** A filled rectangle with a one-pixel border (buttons, tiles, toasts, panels). */
export function framedBox(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  fill: string,
  edge: string,
): void {
  ctx.fillStyle = fill;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  border(ctx, r.x, r.y, r.w, r.h, edge);
}

export function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  framedBox(ctx, { x, y, w, h }, Theme.panel, Theme.panelBorder);
}

/** Title with a one-pixel drop shadow. */
export function heading(
  ctx: CanvasRenderingContext2D,
  font: BitmapFont,
  text: string,
  x: number,
  y: number,
  align: 'left' | 'center' | 'right' = 'center',
): void {
  font.draw(ctx, text, x + 1, y + 1, { align, color: '#000000' });
  font.draw(ctx, text, x, y, { align, color: Theme.accent });
}

export const BACK_BUTTON_SIZE = 22;
/** Touch target of the back button, larger than the drawn square. */
export const BACK_BUTTON_HIT = 40;

/** Top of a screen heading below the safe area (`heading(..., safe.y + HEADING_TOP)`). */
export const HEADING_TOP = 8;

/** Vertical centre of a heading drawn with `font` at `HEADING_TOP` below the safe area. */
export function headingCenterY(font: BitmapFont, safeTop: number): number {
  return safeTop + HEADING_TOP + font.lineHeight / 2;
}

/**
 * A small triangle telling that a list goes on above (`up`) or below: 7 px wide, 4 px tall,
 * its flat side at `y` (pointing away from the list).
 */
export function drawScrollArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  up: boolean,
  color: string = Theme.muted,
): void {
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    const w = 7 - 2 * i;
    ctx.fillRect(Math.round(cx - w / 2), up ? y - 1 - i : y + i, w, 1);
  }
}
