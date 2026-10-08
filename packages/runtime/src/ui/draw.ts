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

export function clear(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color = Theme.background,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}

export function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = Theme.panel;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = Theme.panelBorder;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
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

/** Footer hint line, e.g. "Enter: select   Esc: back"; wraps to at most two lines. */
export function footer(
  ctx: CanvasRenderingContext2D,
  font: BitmapFont,
  text: string,
  width: number,
  height: number,
  safeBottom: number,
): void {
  const lines = font.wrap(text, width - 16).slice(0, 2);
  font.draw(
    ctx,
    lines.join('\n'),
    width >> 1,
    height - safeBottom - lines.length * font.lineHeight - 4,
    {
      align: 'center',
      color: Theme.muted,
    },
  );
}

/** Height the footer occupies, for screens that must not draw under it. */
export function footerHeight(font: BitmapFont, lines = 1): number {
  return lines * font.lineHeight + 8;
}

export const BACK_BUTTON_SIZE = 22;
/** Touch target of the back button, larger than the drawn square. */
export const BACK_BUTTON_HIT = 40;

interface ViewportInsets {
  safeArea: { top: number; left: number };
}

/** Top of a screen heading below the safe area (`heading(..., safe.y + HEADING_TOP)`). */
export const HEADING_TOP = 8;

/** Vertical centre of a heading drawn with `font` at `HEADING_TOP` below the safe area. */
export function headingCenterY(font: BitmapFont, safeTop: number): number {
  return safeTop + HEADING_TOP + font.lineHeight / 2;
}

/**
 * Small `<` button at the top-left of a sub-screen, the touch way back to the previous one.
 * `centerY` aligns it vertically with the heading (default: the top safe inset plus 6).
 */
export function drawBackButton(
  ctx: CanvasRenderingContext2D,
  font: BitmapFont,
  viewport: ViewportInsets,
  centerY?: number,
): void {
  const x = viewport.safeArea.left + 6;
  const y =
    centerY === undefined ? viewport.safeArea.top + 6 : Math.round(centerY - BACK_BUTTON_SIZE / 2);
  panel(ctx, x, y, BACK_BUTTON_SIZE, BACK_BUTTON_SIZE);
  font.draw(
    ctx,
    '<',
    x + (BACK_BUTTON_SIZE >> 1),
    y + ((BACK_BUTTON_SIZE - font.lineHeight) >> 1),
    {
      align: 'center',
      color: Theme.accent,
    },
  );
}

export function hitBackButton(viewport: ViewportInsets, x: number, y: number): boolean {
  return (
    x < viewport.safeArea.left + BACK_BUTTON_HIT && y < viewport.safeArea.top + BACK_BUTTON_HIT
  );
}

/** A fixed-height column centred horizontally with a max width. */
export function column(width: number, maxWidth: number): { x: number; w: number } {
  const w = Math.min(maxWidth, width - 16);
  return { x: (width - w) >> 1, w };
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
