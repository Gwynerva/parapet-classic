/**
 * Small drawing widgets shared by the menu screens: icon rows (mission icons), a ticker
 * (scrolling mode description), a stepped slider (volume), buttons for touch menus and a
 * label with an inline sprite (record holders with their character's head).
 */
import { ANCHOR_TOP_LEFT } from '../render/SpriteSheet.ts';
import type { BitmapFont } from '../text/BitmapFont.ts';
import { contains, type Rect } from './layout.ts';
import { Theme } from './theme.ts';

/** The part of `SpriteSheet` the widgets use (so tests can pass a stub). */
export interface SpriteDrawer {
  width(id: number): number;
  height(id: number): number;
  drawSprite(
    ctx: CanvasRenderingContext2D,
    id: number,
    x: number,
    y: number,
    transform?: number,
    anchor?: number,
  ): void;
}

export interface IconRowOptions {
  /** Index drawn raised by `bob` pixels. */
  selected?: number;
  bob?: number;
}

/** Draw sprites left to right at `pitch`; the selected one bobs like the original mission icons. */
export function drawIconRow(
  ctx: CanvasRenderingContext2D,
  sheet: SpriteDrawer,
  ids: readonly number[],
  x: number,
  y: number,
  pitch: number,
  opts: IconRowOptions = {},
): void {
  ids.forEach((id, i) => {
    const lift = i === opts.selected ? (opts.bob ?? 0) : 0;
    sheet.drawSprite(ctx, id, x + i * pitch, y - lift, 0, ANCHOR_TOP_LEFT);
  });
}

/** Index of the icon under a point, or -1. */
export function hitIconRow(
  px: number,
  py: number,
  x: number,
  y: number,
  count: number,
  pitch: number,
  size: number,
): number {
  if (py < y || py >= y + size) return -1;
  for (let i = 0; i < count; i++) {
    if (px >= x + i * pitch && px < x + i * pitch + size) return i;
  }
  return -1;
}

/** Text that scrolls from right to left and wraps around (1 px per 16 ms in the original). */
export class Ticker {
  text = '';
  /** Pixels scrolled so far. */
  offset = 0;
  speedPxPerMs = 1 / 16;
  gapPx = 48;

  setText(text: string): void {
    if (text !== this.text) {
      this.text = text;
      this.offset = 0;
    }
  }

  advance(dtMs: number): void {
    this.offset += dtMs * this.speedPxPerMs;
  }

  draw(ctx: CanvasRenderingContext2D, font: BitmapFont, rect: Rect, color: string): void {
    if (!this.text) return;
    const width = font.measure(this.text);
    if (width <= rect.w) {
      font.draw(ctx, this.text, rect.x + ((rect.w - width) >> 1), rect.y, { color });
      return;
    }
    const period = width + this.gapPx;
    const shift = Math.floor(this.offset % period);
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    const first = rect.x + rect.w - shift;
    font.draw(ctx, this.text, first, rect.y, { color });
    if (first + width < rect.x + rect.w)
      font.draw(ctx, this.text, first + period, rect.y, { color });
    ctx.restore();
  }
}

/** A stepped bar: `value` of `steps` segments lit (the original's 8-segment volume bar). */
export function drawSlider(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  value: number,
  steps: number,
  litColor: string = Theme.accent,
  dimColor: string = Theme.panelBorder,
): void {
  const gap = 2;
  const segW = Math.max(1, Math.floor((rect.w - gap * (steps - 1)) / steps));
  for (let i = 0; i < steps; i++) {
    ctx.fillStyle = i < value ? litColor : dimColor;
    ctx.fillRect(rect.x + i * (segW + gap), rect.y, segW, rect.h);
  }
}

export interface ButtonOptions {
  selected?: boolean;
  color?: string;
}

/** A flat button with a centred label. Returns nothing; use `contains` for hit tests. */
export function drawButton(
  ctx: CanvasRenderingContext2D,
  font: BitmapFont,
  label: string,
  rect: Rect,
  opts: ButtonOptions = {},
): void {
  ctx.fillStyle = opts.selected ? Theme.accentDark : Theme.panel;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = opts.selected ? Theme.accent : Theme.panelBorder;
  ctx.fillRect(rect.x, rect.y, rect.w, 1);
  ctx.fillRect(rect.x, rect.y + rect.h - 1, rect.w, 1);
  ctx.fillRect(rect.x, rect.y, 1, rect.h);
  ctx.fillRect(rect.x + rect.w - 1, rect.y, 1, rect.h);
  font.draw(ctx, label, rect.x + (rect.w >> 1), rect.y + ((rect.h - font.lineHeight) >> 1), {
    align: 'center',
    color: opts.color ?? Theme.text,
  });
}

/** Index of the button under a point, or -1. */
export function hitButtons(rects: readonly Rect[], x: number, y: number): number {
  return rects.findIndex((r) => contains(r, x, y));
}

/** A sprite followed by text, both vertically centred on the text line. Returns the width. */
export function drawLabelWithIcon(
  ctx: CanvasRenderingContext2D,
  sheet: SpriteDrawer,
  iconId: number,
  font: BitmapFont,
  text: string,
  x: number,
  y: number,
  color: string,
  gap = 4,
): number {
  const iw = sheet.width(iconId);
  const ih = sheet.height(iconId);
  sheet.drawSprite(ctx, iconId, x, y + ((font.lineHeight - ih) >> 1), 0, ANCHOR_TOP_LEFT);
  font.draw(ctx, text, x + iw + gap, y, { color });
  return iw + gap + font.measure(text);
}
