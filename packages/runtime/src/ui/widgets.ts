/**
 * Small drawing widgets shared by the menu screens: the sprite drawing interface the widgets
 * take (a stub in tests) and a ticker (a scrolling mode description).
 */
import type { BitmapFont } from '../text/BitmapFont.ts';
import type { Rect } from './layout.ts';

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
