/**
 * Text that may be longer than its box: descriptions, the About pages, long dialog text. When
 * it fits it simply sits there. When it does not, it scrolls by itself like end credits: a
 * pause at the top, a slow crawl down, a pause at the bottom, a quick return. A finger dragged
 * over it, the mouse wheel or the arrow keys take over for a few seconds; a thin bar on the
 * right tells how much there is. Players who ask their system for reduced motion get no
 * crawl, only the manual scroll.
 */
import type { UiKey, UiPointer, UiWheel } from '../app/Screen.ts';
import type { BitmapFont } from '../text/BitmapFont.ts';
import { contains, type Rect } from './layout.ts';
import { prefersReducedMotion } from './motion.ts';
import { Theme } from './theme.ts';

export interface TextBlock {
  text: string;
  font: BitmapFont;
  color: string;
  /** Space above the block (px). */
  gapBefore?: number;
  align?: 'left' | 'center';
}

interface Line {
  text: string;
  font: BitmapFont;
  color: string;
  y: number;
  align: 'left' | 'center';
}

/** Auto-scroll timing. */
export const SCROLL_HOLD_MS = 2500;
export const SCROLL_SPEED = 18 / 1000;
export const RETURN_SPEED = 160 / 1000;
/** How long manual scrolling keeps the crawl away. */
export const MANUAL_MS = 5000;
/** Room on the right for the scroll bar when the text overflows. */
const BAR_SPACE = 6;

type Phase = 'top' | 'down' | 'bottom' | 'up' | 'manual';

export class TextScroller {
  rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** Pixels scrolled from the top. */
  offset = 0;
  /** Colour of the fade at the edges where more text follows (the box's background). */
  fade: string | null = null;
  private lines: Line[] = [];
  private blocks: TextBlock[] = [];
  private contentHeight = 0;
  private key = '';
  private phase: Phase = 'top';
  private timer = 0;
  private auto: boolean;
  private dragStart = -1;
  private dragOffset = 0;
  /** The pointer that is down has scrolled the text (its release is not a tap). */
  private dragged = false;

  constructor(opts: { auto?: boolean } = {}) {
    this.auto = opts.auto ?? !prefersReducedMotion();
  }

  /** Whether the text is taller than the box. */
  get overflows(): boolean {
    return this.contentHeight > this.rect.h;
  }

  get maxOffset(): number {
    return Math.max(0, this.contentHeight - this.rect.h);
  }

  /** Height of all lines (to size a box around short text). */
  get height(): number {
    return this.contentHeight;
  }

  /** Sets the box; the text re-wraps when its width changes. */
  setRect(rect: Rect): void {
    const widthChanged = rect.w !== this.rect.w || rect.h !== this.rect.h;
    this.rect = rect;
    if (widthChanged && this.key) this.relayout(this.blocks);
  }

  /** Sets the text (a plain string needs a font and colour); starts from the top on a change. */
  setText(blocks: readonly TextBlock[]): void {
    const key = blocks
      .map((b) => `${b.text}\u0000${b.color}\u0000${b.gapBefore ?? 0}\u0000${b.align ?? ''}`)
      .join('\u0001');
    if (key === this.key) return;
    this.key = key;
    this.blocks = blocks.slice();
    this.relayout(this.blocks);
    this.restart();
  }

  /** Back to the top, with the opening pause. */
  restart(): void {
    this.offset = 0;
    this.phase = 'top';
    this.timer = 0;
  }

  private relayout(blocks: readonly TextBlock[]): void {
    const layout = (width: number): number => {
      this.lines = [];
      let y = 0;
      blocks.forEach((b, i) => {
        if (i > 0) y += b.gapBefore ?? 0;
        for (const text of b.font.wrap(b.text, Math.max(8, width))) {
          this.lines.push({ text, font: b.font, color: b.color, y, align: b.align ?? 'left' });
          y += b.font.lineHeight;
        }
      });
      return y;
    };
    this.contentHeight = layout(this.rect.w);
    // Overflowing text makes room for the bar on the right.
    if (this.contentHeight > this.rect.h) this.contentHeight = layout(this.rect.w - BAR_SPACE);
    this.offset = Math.min(this.offset, this.maxOffset);
  }

  update(dt: number): void {
    if (!this.overflows) {
      this.offset = 0;
      return;
    }
    this.timer += dt;
    switch (this.phase) {
      case 'manual':
        if (this.timer >= MANUAL_MS && this.dragStart < 0)
          this.enter(this.offset >= this.maxOffset ? 'bottom' : 'down');
        return;
      case 'top':
        if (this.auto && this.timer >= SCROLL_HOLD_MS) this.enter('down');
        return;
      case 'down':
        if (!this.auto) return;
        this.offset = Math.min(this.maxOffset, this.offset + dt * SCROLL_SPEED);
        if (this.offset >= this.maxOffset) this.enter('bottom');
        return;
      case 'bottom':
        if (this.auto && this.timer >= SCROLL_HOLD_MS) this.enter('up');
        return;
      case 'up':
        this.offset = Math.max(0, this.offset - dt * RETURN_SPEED);
        if (this.offset <= 0) this.enter('top');
        return;
    }
  }

  private enter(phase: Phase): void {
    this.phase = phase;
    this.timer = 0;
  }

  /** Scrolls by hand (and pauses the crawl); returns false when already at that end. */
  scrollBy(dy: number): boolean {
    const before = this.offset;
    this.offset = Math.max(0, Math.min(this.maxOffset, this.offset + dy));
    this.enter('manual');
    return this.offset !== before;
  }

  /** Up/down scroll by a line; returns false at the ends (so focus may move on). */
  onKey(key: UiKey): boolean {
    if (!this.overflows) return false;
    const line = this.lines[0]?.font.lineHeight ?? 12;
    if (key.action === 'up') return this.scrollBy(-line * 2);
    if (key.action === 'down') return this.scrollBy(line * 2);
    return false;
  }

  onWheel(w: UiWheel): boolean {
    if (!this.overflows || !contains(this.rect, w.x, w.y)) return false;
    this.scrollBy(w.dy);
    return true;
  }

  /** A pointer dragged over the text scrolls it; returns true while it does. */
  onPointer(p: UiPointer): boolean {
    switch (p.type) {
      case 'down':
        this.dragged = false;
        if (!this.overflows || !contains(this.rect, p.x, p.y)) return false;
        this.dragStart = p.y;
        this.dragOffset = this.offset;
        return false;
      case 'move':
        if (this.dragStart < 0) return false;
        if (!this.dragged && Math.abs(p.y - this.dragStart) < 4) return false;
        this.dragged = true;
        this.offset = Math.max(
          0,
          Math.min(this.maxOffset, this.dragOffset - (p.y - this.dragStart)),
        );
        this.enter('manual');
        return true;
      case 'up':
      case 'cancel': {
        const dragged = this.dragged;
        this.dragStart = -1;
        this.dragged = false;
        return dragged;
      }
    }
  }

  /** Whether a pointer is scrolling the text right now (its release is not a tap). */
  get dragging(): boolean {
    return this.dragged;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const r = this.rect;
    if (r.w <= 0 || r.h <= 0) return;
    const offset = Math.round(this.offset);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    const textW = this.overflows ? r.w - BAR_SPACE : r.w;
    for (const line of this.lines) {
      const y = r.y + line.y - offset;
      if (y + line.font.lineHeight < r.y || y > r.y + r.h) continue;
      if (line.align === 'center') {
        line.font.draw(ctx, line.text, r.x + (textW >> 1), y, {
          align: 'center',
          color: line.color,
        });
      } else {
        line.font.draw(ctx, line.text, r.x, y, { color: line.color });
      }
    }
    if (this.fade && this.overflows) {
      // Soft edges where more text is hidden.
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        ctx.globalAlpha = (steps - i) / (steps + 1);
        ctx.fillStyle = this.fade;
        if (offset > 0) ctx.fillRect(r.x, r.y + i, textW, 1);
        if (offset < this.maxOffset) ctx.fillRect(r.x, r.y + r.h - 1 - i, textW, 1);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (this.overflows) {
      const barX = r.x + r.w - 2;
      ctx.fillStyle = Theme.panelBorder;
      ctx.fillRect(barX, r.y, 2, r.h);
      const thumbH = Math.max(8, Math.round((r.h * r.h) / this.contentHeight));
      const thumbY = r.y + Math.round(((r.h - thumbH) * offset) / Math.max(1, this.maxOffset));
      ctx.fillStyle = Theme.muted;
      ctx.fillRect(barX, thumbY, 2, thumbH);
    }
  }
}
