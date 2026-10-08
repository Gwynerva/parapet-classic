/**
 * A short message over everything ("Press Back again to exit"), shown for a few seconds at the
 * bottom of the screen and faded out. The client draws it after the screens.
 */
import type { BitmapFont } from '../text/BitmapFont.ts';
import type { ViewportLike } from './layout.ts';
import { Theme } from './theme.ts';

export const TOAST_MS = 2500;
const FADE_MS = 300;

export class Toast {
  private text = '';
  private shownAt = -Infinity;
  private duration = TOAST_MS;

  show(text: string, durationMs = TOAST_MS, now = performance.now()): void {
    this.text = text;
    this.shownAt = now;
    this.duration = durationMs;
  }

  hide(): void {
    this.shownAt = -Infinity;
  }

  visible(now = performance.now()): boolean {
    return this.text !== '' && now - this.shownAt < this.duration;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    font: BitmapFont,
    viewport: ViewportLike,
    now = performance.now(),
  ): void {
    if (!this.visible(now)) return;
    const age = now - this.shownAt;
    const alpha = Math.min(1, age / FADE_MS, (this.duration - age) / FADE_MS);
    const safe = viewport.safeArea;
    const maxW = viewport.width - safe.left - safe.right - 24;
    const lines = font.wrap(this.text, Math.max(40, maxW - 16)).slice(0, 3);
    const w = Math.min(maxW, Math.max(...lines.map((l) => font.measure(l))) + 16);
    const h = lines.length * font.lineHeight + 10;
    const x = safe.left + ((viewport.width - safe.left - safe.right - w) >> 1);
    const y = viewport.height - safe.bottom - h - 16;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = Theme.panel;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = Theme.accent;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
    font.draw(ctx, lines.join('\n'), x + (w >> 1), y + 5, { align: 'center', color: Theme.text });
    ctx.globalAlpha = 1;
  }
}
