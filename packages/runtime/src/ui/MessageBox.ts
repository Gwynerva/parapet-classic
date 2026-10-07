/**
 * The original's message box (`a(n, str, delay, C, D)`, d.java line 4987): paged text in a
 * light panel with a black border, an optional title bar coloured by the outcome (orange for
 * success, dark red for failure) and a speech-bubble tail when a character is talking. It is
 * a screen on the stack: the screen below keeps rendering (and animating through `onFrame`),
 * input goes to the box, and the first confirm on the last page closes it.
 *
 * Briefings, tutorial pages, in-play hints, results and "level unlocked" all use it.
 */
import type { Screen, UiKey, UiPointer } from '../app/Screen.ts';
import type { BitmapFont } from '../text/BitmapFont.ts';
import { contains, safeRect, type Rect, type ViewportLike } from './layout.ts';

export type MessageTone = 'neutral' | 'success' | 'failure';

export interface MessageBoxLabels {
  /** Confirm label while more pages follow ("Next"). */
  next: string;
  /** Confirm label on the last page ("OK"). */
  ok: string;
  /** Optional second action ("Retry"). */
  retry?: string;
}

export interface MessageBoxFonts {
  text: BitmapFont;
  small: BitmapFont;
  display: BitmapFont;
}

export interface MessageBoxHost {
  viewport: ViewportLike;
  fonts: MessageBoxFonts;
}

export interface MessageBoxOptions {
  title?: string;
  tone?: MessageTone;
  pages: readonly string[];
  labels: MessageBoxLabels;
  /** The box stays invisible (and ignores input) for this long after it is pushed. */
  delayMs?: number;
  onClose: () => void;
  onRetry?: () => void;
  /** Where the speech-bubble tail points (logical px), or null for no tail. Read every frame. */
  tailTarget?: () => { x: number; y: number } | null;
  /** Called every frame with the real elapsed ms, also during the delay. */
  onFrame?: (dtMs: number) => void;
  /** Widest box, in logical px (default 400). */
  maxWidth?: number;
}

/** Colours of the original box (lines 5053-5110). */
export const BOX_BACKGROUND = '#dcd4d0';
export const BOX_BORDER = '#000000';
export const BOX_TEXT = '#4a3835';
export const BOX_MUTED = '#71615c';
export const BOX_TITLE_SUCCESS = '#ff410e';
export const BOX_TITLE_FAILURE = '#911f00';
export const BOX_TITLE_NEUTRAL = '#4a3835';

const PADDING = 8;
const TAIL_HEIGHT = 10;

export class MessageBox implements Screen {
  readonly translucent = true;
  page = 0;
  /** Real time since the box was pushed, in ms. */
  elapsed = 0;
  private readonly host: MessageBoxHost;
  private readonly opts: MessageBoxOptions;
  private lines: string[] = [];
  private box: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private retryRect: Rect | null = null;
  private closed = false;

  constructor(host: MessageBoxHost, opts: MessageBoxOptions) {
    this.host = host;
    this.opts = opts;
    this.onResize();
  }

  get visible(): boolean {
    return this.elapsed >= (this.opts.delayMs ?? 0);
  }

  get pageCount(): number {
    return Math.max(1, this.opts.pages.length);
  }

  get lastPage(): boolean {
    return this.page >= this.pageCount - 1;
  }

  /** Rectangle of the panel (valid after `onResize`). */
  get rect(): Rect {
    return this.box;
  }

  /** Confirm: turn the page, or close on the last one. */
  next(): void {
    if (this.closed) return;
    if (this.lastPage) {
      this.closed = true;
      this.opts.onClose();
      return;
    }
    this.page++;
    this.onResize();
  }

  previous(): void {
    if (this.page > 0) {
      this.page--;
      this.onResize();
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.opts.onFrame?.(dt);
  }

  onKey(key: UiKey): void {
    if (!this.visible || this.closed) return;
    switch (key.action) {
      case 'confirm':
      case 'right':
      case 'down':
        this.next();
        return;
      case 'left':
      case 'up':
        this.previous();
        return;
      case 'back':
        if (this.page > 0) this.previous();
        else if (this.opts.onRetry) {
          this.closed = true;
          this.opts.onRetry();
        }
        return;
      default:
        return;
    }
  }

  onPointer(p: UiPointer): void {
    if (!this.visible || this.closed || p.type !== 'down') return;
    if (this.retryRect && contains(this.retryRect, p.x, p.y) && this.opts.onRetry) {
      this.closed = true;
      this.opts.onRetry();
      return;
    }
    this.next();
  }

  onResize(): void {
    const { viewport, fonts } = this.host;
    const safe = safeRect(viewport);
    const maxWidth = this.opts.maxWidth ?? 400;
    const w = Math.max(120, Math.min(maxWidth, safe.w - 16));
    const text = this.opts.pages[this.page] ?? '';
    this.lines = fonts.text.wrap(text, w - 2 * PADDING);
    const titleH = this.opts.title && this.page === 0 ? fonts.display.lineHeight + 6 : 0;
    const bodyH = Math.max(1, this.lines.length) * fonts.text.lineHeight;
    const footerH = fonts.small.lineHeight + 6;
    const maxBodyH = Math.max(fonts.text.lineHeight, safe.h - 40 - titleH - footerH - 2 * PADDING);
    const h = titleH + Math.min(bodyH, maxBodyH) + footerH + 2 * PADDING;
    const x = safe.x + ((safe.w - w) >> 1);
    // Bottom-anchored, leaving room for the tail and a margin above the device edge.
    const y = Math.max(safe.y + 8, safe.y + safe.h - h - TAIL_HEIGHT - 12);
    this.box = { x, y, w, h };
    this.retryRect = null;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;
    const { fonts } = this.host;
    const { x, y, w, h } = this.box;
    ctx.fillStyle = BOX_BORDER;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = BOX_BACKGROUND;
    ctx.fillRect(x, y, w, h);

    let cursorY = y + PADDING;
    const title = this.opts.title;
    if (title && this.page === 0) {
      const tone = this.opts.tone ?? 'neutral';
      const barH = fonts.display.lineHeight + 6;
      ctx.fillStyle =
        tone === 'success'
          ? BOX_TITLE_SUCCESS
          : tone === 'failure'
            ? BOX_TITLE_FAILURE
            : BOX_TITLE_NEUTRAL;
      ctx.fillRect(x, y, w, barH);
      fonts.display.draw(ctx, title, x + (w >> 1), y + 3, { align: 'center', color: '#ffffff' });
      cursorY = y + barH + PADDING - 2;
    }

    const bodyBottom = y + h - PADDING - fonts.small.lineHeight - 6;
    const visibleLines = Math.max(1, Math.floor((bodyBottom - cursorY) / fonts.text.lineHeight));
    fonts.text.draw(ctx, this.lines.slice(0, visibleLines).join('\n'), x + PADDING, cursorY, {
      color: BOX_TEXT,
    });

    // Footer: confirm label on the left, page counter on the right, retry in the middle.
    const footerY = y + h - PADDING - fonts.small.lineHeight;
    const confirm = this.lastPage ? this.opts.labels.ok : this.opts.labels.next;
    fonts.small.draw(ctx, confirm, x + PADDING, footerY, { color: BOX_TITLE_FAILURE });
    if (this.pageCount > 1) {
      fonts.small.draw(ctx, `${this.page + 1}/${this.pageCount}`, x + w - PADDING, footerY, {
        align: 'right',
        color: BOX_MUTED,
      });
    }
    const retry = this.opts.labels.retry;
    if (retry && this.opts.onRetry) {
      const rw = fonts.small.measure(retry) + 2 * PADDING;
      const rx = x + ((w - rw) >> 1);
      this.retryRect = { x: rx, y: footerY - 3, w: rw, h: fonts.small.lineHeight + 6 };
      fonts.small.draw(ctx, retry, rx + PADDING, footerY, { color: BOX_TITLE_FAILURE });
    }

    const target = this.opts.tailTarget?.();
    if (target) this.drawTail(ctx, target.x, target.y);
  }

  /** Speech-bubble tail (sprite 183 in the original): a small triangle towards the speaker. */
  private drawTail(ctx: CanvasRenderingContext2D, tx: number, ty: number): void {
    const { x, y, w, h } = this.box;
    const baseX = Math.max(x + 12, Math.min(x + w - 12, tx));
    const below = ty >= y + h;
    const baseY = below ? y + h : y;
    const dir = below ? 1 : -1;
    const tipY = baseY + dir * TAIL_HEIGHT;
    ctx.fillStyle = BOX_BORDER;
    ctx.beginPath();
    ctx.moveTo(baseX - 7, baseY);
    ctx.lineTo(baseX + 7, baseY);
    ctx.lineTo(baseX + (tx < baseX ? -4 : 4), tipY + dir);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = BOX_BACKGROUND;
    ctx.beginPath();
    ctx.moveTo(baseX - 5, baseY - dir);
    ctx.lineTo(baseX + 5, baseY - dir);
    ctx.lineTo(baseX + (tx < baseX ? -3 : 3), tipY - dir);
    ctx.closePath();
    ctx.fill();
  }
}
