/**
 * A vertical list of selectable items drawn with bitmap fonts. Keyboard/gamepad move the
 * cursor; a pointer shows the row under it as pressed and selects it on release (a finger that
 * moves scrolls the list instead). Items can carry a value label on the right (the options
 * screen) and react to left/right to change it, or a slider dragged with the pointer.
 */
import type { BitmapFont } from '../text/BitmapFont.ts';
import type { UiGesture, UiKey, UiPointer, UiWheel } from '../app/Screen.ts';
import { drawScrollArrow } from './draw.ts';
import { PressTracker } from './press.ts';
import { Theme } from './theme.ts';

export interface MenuSlider {
  value: number;
  min: number;
  max: number;
  /** Step of a left/right press. */
  step: number;
  /** Label next to the bar (default: the value). */
  format?: (value: number) => string;
}

export interface MenuItem {
  label: string;
  /** Secondary text drawn under the label (dimmed). */
  description?: string;
  /** Value label drawn on the right. */
  value?: string;
  disabled?: boolean;
  /** Drawn dimmed but still selectable (a locked row that explains itself when chosen). */
  muted?: boolean;
  onSelect?: () => void;
  /** Called with -1 / +1 on left/right presses. */
  onAdjust?: (delta: number) => void;
  /** A bar on the right; `onChange` gets each new value, `final` once the drag ends. */
  slider?: MenuSlider;
  onChange?: (value: number, final: boolean) => void;
  /**
   * `onSelect` (and `onAdjust`) need user activation (clipboard, downloads, file dialogs,
   * full screen): keyboard and pointer reach them from `onGesture`, inside the browser's event
   * handler. A gamepad confirm still selects from the queue; the action then needs a fallback.
   */
  gesture?: boolean;
}

export interface MenuLayout {
  x: number;
  y: number;
  width: number;
  rowHeight: number;
  /** Labels on the left (lists with values) or centred (the title menu, dialogs). */
  align?: 'left' | 'center';
}

/** Width of a slider bar, without its label. */
const SLIDER_WIDTH = 96;

export class Menu {
  items: MenuItem[] = [];
  cursor = 0;
  readonly layout: MenuLayout = { x: 0, y: 0, width: 200, rowHeight: 20 };
  private readonly font: BitmapFont;
  private readonly small: BitmapFont;
  /** First visible row when the list is longer than the available height. */
  private scroll = 0;
  maxVisible = 8;
  private readonly press = new PressTracker<number>();
  /** Row whose slider follows the pointer. */
  private sliding = -1;
  /** Scroll position when a finger went down (drag scrolling). */
  private dragScroll = 0;
  /** Wheel distance not yet turned into whole rows. */
  private wheelRest = 0;
  /** Row of a gesture item pressed by touch or pen, selected on release. */
  private armed = -1;

  constructor(font: BitmapFont, small: BitmapFont) {
    this.font = font;
    this.small = small;
  }

  /** Index of the first visible item (the list scrolls when it is longer than `maxVisible`). */
  get firstVisible(): number {
    return this.scroll;
  }

  /** Rows on screen. */
  get visibleRows(): number {
    return Math.min(this.maxVisible, this.items.length);
  }

  /** Height the visible rows take. */
  get height(): number {
    return this.visibleRows * this.layout.rowHeight;
  }

  /** The row being pressed by a pointer, or -1. */
  get pressedRow(): number {
    return this.press.pressed ?? -1;
  }

  setItems(items: MenuItem[]): void {
    this.items = items;
    if (this.cursor >= items.length) this.cursor = Math.max(0, items.length - 1);
    this.skipDisabled(1);
    this.ensureVisible();
  }

  setCursor(index: number): void {
    if (this.items.length === 0) return;
    this.cursor = Math.max(0, Math.min(this.items.length - 1, index));
    this.skipDisabled(1);
    this.ensureVisible();
  }

  /** Shows as many rows as fit in `height` (at least one). */
  fit(height: number): void {
    this.maxVisible = Math.max(1, Math.floor(height / this.layout.rowHeight));
    this.ensureVisible();
  }

  private skipDisabled(dir: number): void {
    let guard = this.items.length;
    while (guard-- > 0 && this.items[this.cursor]?.disabled) {
      this.cursor = (this.cursor + dir + this.items.length) % this.items.length;
    }
  }

  private ensureVisible(): void {
    const maxScroll = Math.max(0, this.items.length - this.maxVisible);
    if (this.cursor < this.scroll) this.scroll = this.cursor;
    if (this.cursor >= this.scroll + this.maxVisible)
      this.scroll = this.cursor - this.maxVisible + 1;
    this.scroll = Math.max(0, Math.min(maxScroll, this.scroll));
  }

  private scrollTo(scroll: number): void {
    const maxScroll = Math.max(0, this.items.length - this.maxVisible);
    this.scroll = Math.max(0, Math.min(maxScroll, scroll));
    // Keep the cursor on screen so the keyboard continues from what is visible.
    if (this.cursor < this.scroll) this.cursor = this.scroll;
    if (this.cursor >= this.scroll + this.maxVisible)
      this.cursor = this.scroll + this.maxVisible - 1;
  }

  move(delta: number): void {
    if (this.items.length === 0) return;
    this.cursor = (this.cursor + delta + this.items.length) % this.items.length;
    this.skipDisabled(delta);
    this.ensureVisible();
  }

  select(): void {
    const item = this.items[this.cursor];
    if (item && !item.disabled) item.onSelect?.();
  }

  adjust(delta: number): void {
    const item = this.items[this.cursor];
    if (!item || item.disabled) return;
    if (item.slider) {
      const s = item.slider;
      const value = Math.max(s.min, Math.min(s.max, s.value + delta * s.step));
      if (value !== s.value) item.onChange?.(value, true);
      return;
    }
    item.onAdjust?.(delta);
  }

  /** Returns true when the key was handled. */
  onKey(key: UiKey): boolean {
    switch (key.action) {
      case 'up':
      case 'prev':
        this.move(-1);
        return true;
      case 'down':
      case 'next':
        this.move(1);
        return true;
      case 'left':
        this.adjust(-1);
        return true;
      case 'right':
        this.adjust(1);
        return true;
      case 'confirm':
        this.select();
        return true;
      default:
        return false;
    }
  }

  /** Whether a point is inside the visible rows. */
  contains(x: number, y: number): boolean {
    const { x: lx, y: ly, width } = this.layout;
    return x >= lx && x < lx + width && y >= ly && y < ly + this.height;
  }

  /** Row index under a logical point, or -1. */
  hitTest(x: number, y: number): number {
    const { x: lx, y: ly, width, rowHeight } = this.layout;
    if (x < lx || x >= lx + width) return -1;
    const row = Math.floor((y - ly) / rowHeight);
    if (row < 0 || row >= Math.min(this.maxVisible, this.items.length - this.scroll)) return -1;
    return row + this.scroll;
  }

  /** Returns true when the pointer event belonged to the menu. */
  onPointer(p: UiPointer): boolean {
    const row = this.hitTest(p.x, p.y);
    const finger = p.pointerType !== undefined && p.pointerType !== 'mouse';
    switch (p.type) {
      case 'move': {
        if (this.sliding >= 0) {
          this.slideTo(this.sliding, p.x, false);
          return true;
        }
        if (this.press.down) {
          if (this.press.move(p, finger ? undefined : row) && !finger) return true;
          if (this.press.dragging && finger) {
            const rows = Math.round((this.press.startY - p.y) / this.layout.rowHeight);
            this.scrollTo(this.dragScroll + rows);
          }
          return true;
        }
        // Hovering with a mouse moves the cursor (a finger only hovers while it is down).
        if (!finger && row >= 0 && !this.items[row]?.disabled) this.cursor = row;
        return false;
      }
      case 'down': {
        const item = row >= 0 ? this.items[row] : undefined;
        if (!item || item.disabled) return false;
        this.cursor = row;
        this.dragScroll = this.scroll;
        // Gesture items are pressed from `onGesture`; the queued press only shows the cursor.
        if (item.gesture) return true;
        this.press.press(row, p);
        if (item.slider && this.onSliderTrack(row, p.x)) {
          this.sliding = row;
          this.press.reset();
          this.slideTo(row, p.x, false);
        }
        return true;
      }
      case 'up': {
        if (this.sliding >= 0) {
          this.slideTo(this.sliding, p.x, true);
          this.sliding = -1;
          return true;
        }
        if (!this.press.down) return false;
        const fired = this.press.release(row);
        if (fired === null) return true;
        const item = this.items[fired];
        if (!item || item.disabled) return true;
        this.cursor = fired;
        if (item.onSelect) {
          item.onSelect();
        } else if (item.slider) {
          this.adjust(p.x < this.layout.x + (this.layout.width >> 1) ? -1 : 1);
        } else if (item.onAdjust) {
          // The `<` of the value label steps down; the `>` and the rest of the row step up.
          const bounds = this.valueBounds(item);
          const leftArrowEnd = bounds ? bounds.x + bounds.arrowW + 4 : -Infinity;
          const leftArrowStart = bounds ? bounds.x - 8 : -Infinity;
          item.onAdjust(p.x >= leftArrowStart && p.x < leftArrowEnd ? -1 : 1);
        }
        return true;
      }
      case 'cancel': {
        const was = this.press.down || this.sliding >= 0;
        if (this.sliding >= 0) {
          const item = this.items[this.sliding];
          if (item?.slider) item.onChange?.(item.slider.value, true);
        }
        this.sliding = -1;
        this.press.reset();
        return was;
      }
    }
  }

  /** Scrolls the list by whole rows; returns true when the wheel was over the menu. */
  onWheel(w: UiWheel): boolean {
    if (!this.contains(w.x, w.y)) return false;
    if (this.items.length <= this.maxVisible) return true;
    this.wheelRest += w.dy;
    const rows = Math.trunc(this.wheelRest / this.layout.rowHeight);
    if (rows !== 0) {
      this.wheelRest -= rows * this.layout.rowHeight;
      this.scrollTo(this.scroll + rows);
    }
    return true;
  }

  /**
   * Selects gesture items synchronously: keyboard confirm (and left/right on adjustable
   * gesture rows) and mouse presses at once, touch and pen on release over the same row
   * (browsers grant activation on touch release). Returns true when the gesture was consumed.
   */
  onGesture(g: UiGesture): boolean {
    if (g.kind === 'key') {
      const item = this.items[this.cursor];
      if (!item?.gesture || item.disabled) return false;
      if (g.action === 'confirm') {
        if (item.onSelect) item.onSelect();
        else item.onAdjust?.(1);
        return true;
      }
      if ((g.action === 'left' || g.action === 'right') && item.onAdjust) {
        item.onAdjust(g.action === 'left' ? -1 : 1);
        return true;
      }
      return false;
    }
    const row = this.hitTest(g.x, g.y);
    const item = row >= 0 ? this.items[row] : undefined;
    if (g.type === 'down') {
      this.armed = -1;
      if (!item?.gesture || item.disabled) return false;
      this.cursor = row;
      if (g.pointerType === 'mouse') this.fireGesture(item);
      else this.armed = row;
      return true;
    }
    const armed = this.armed;
    this.armed = -1;
    if (armed < 0) return false;
    if (row === armed && item?.gesture && !item.disabled) this.fireGesture(item);
    return true;
  }

  private fireGesture(item: MenuItem): void {
    if (item.onSelect) item.onSelect();
    else item.onAdjust?.(1);
  }

  /** Left edge, width and arrow width of a row's right-aligned value label. */
  private valueBounds(item: MenuItem): { x: number; w: number; arrowW: number } | null {
    if (item.value === undefined) return null;
    const label = item.onAdjust ? `< ${item.value} >` : item.value;
    const w = this.font.lineWidth(label);
    return {
      x: this.layout.x + this.layout.width - 8 - w,
      w,
      arrowW: this.font.lineWidth('< '),
    };
  }

  /** The bar of a slider row: x range of the track and the label's width. */
  private sliderBounds(item: MenuItem): { x: number; w: number; labelW: number } {
    const s = item.slider!;
    const format = s.format ?? String;
    const labelW = Math.max(this.font.lineWidth(format(s.max)), this.font.lineWidth(format(s.min)));
    const w = Math.min(SLIDER_WIDTH, Math.max(32, this.layout.width >> 2));
    return { x: this.layout.x + this.layout.width - 8 - labelW - 8 - w, w, labelW };
  }

  private onSliderTrack(row: number, x: number): boolean {
    const item = this.items[row];
    if (!item?.slider) return false;
    const b = this.sliderBounds(item);
    // A generous grab area: the bar plus a thumb's width on each side.
    return x >= b.x - 8 && x < b.x + b.w + 8;
  }

  private slideTo(row: number, x: number, final: boolean): void {
    const item = this.items[row];
    if (!item?.slider) return;
    const s = item.slider;
    const b = this.sliderBounds(item);
    const t = Math.max(0, Math.min(1, (x - b.x) / Math.max(1, b.w)));
    const raw = s.min + t * (s.max - s.min);
    const value = Math.max(
      s.min,
      Math.min(s.max, s.min + Math.round((raw - s.min) / s.step) * s.step),
    );
    if (value !== s.value || final) item.onChange?.(value, final);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { x, y, width, rowHeight } = this.layout;
    const centred = this.layout.align === 'center';
    const end = Math.min(this.items.length, this.scroll + this.maxVisible);
    const pressed = this.sliding >= 0 ? this.sliding : this.pressedRow;
    for (let i = this.scroll; i < end; i++) {
      const item = this.items[i]!;
      const rowY = y + (i - this.scroll) * rowHeight;
      const selected = i === this.cursor;
      const down = i === pressed && !item.slider;
      if (down) {
        ctx.fillStyle = Theme.accent;
        ctx.fillRect(x, rowY, width, rowHeight);
      } else if (selected) {
        ctx.fillStyle = Theme.accentDark;
        ctx.fillRect(x, rowY, width, rowHeight);
        ctx.fillStyle = Theme.accent;
        ctx.fillRect(x, rowY, 3, rowHeight);
        if (centred) ctx.fillRect(x + width - 3, rowY, 3, rowHeight);
      }
      const color =
        item.disabled || (item.muted && !down) ? Theme.muted : down ? Theme.background : Theme.text;
      // A pressed row sinks by a pixel, like a key.
      const textY = rowY + Math.floor((rowHeight - this.font.lineHeight) / 2) + (down ? 1 : 0);
      if (item.slider) {
        this.drawSliderRow(ctx, item, x, rowY, width, rowHeight, textY, i === pressed);
        continue;
      }
      const value =
        item.value === undefined ? null : item.onAdjust ? `< ${item.value} >` : item.value;
      const valueWidth = value === null ? 0 : this.font.lineWidth(value) + 16;
      const label = this.font.fit(item.label, width - 18 - valueWidth);
      if (centred && value === null) {
        this.font.draw(ctx, label, x + (width >> 1), textY, { align: 'center', color });
      } else {
        this.font.draw(ctx, label, x + 10, textY, { color });
      }
      if (value !== null) {
        this.font.draw(ctx, value, x + width - 8, textY, {
          align: 'right',
          color: item.disabled ? Theme.muted : down ? Theme.background : Theme.accent,
        });
      }
    }
    // Arrows just outside the list where rows are scrolled away.
    const markerX = x + (width >> 1);
    if (this.scroll > 0) drawScrollArrow(ctx, markerX, y - 1, true);
    if (end < this.items.length)
      drawScrollArrow(ctx, markerX, y + this.maxVisible * rowHeight + 1, false);
  }

  private drawSliderRow(
    ctx: CanvasRenderingContext2D,
    item: MenuItem,
    x: number,
    rowY: number,
    width: number,
    rowHeight: number,
    textY: number,
    active: boolean,
  ): void {
    const s = item.slider!;
    const b = this.sliderBounds(item);
    const color = item.disabled ? Theme.muted : Theme.text;
    this.font.draw(ctx, this.font.fit(item.label, b.x - x - 18), x + 10, textY, { color });
    const span = Math.max(1, s.max - s.min);
    const filled = Math.round(((s.value - s.min) / span) * b.w);
    const trackY = rowY + (rowHeight >> 1) - 2;
    ctx.fillStyle = Theme.panelBorder;
    ctx.fillRect(b.x, trackY, b.w, 4);
    ctx.fillStyle = item.disabled ? Theme.muted : Theme.accent;
    ctx.fillRect(b.x, trackY, filled, 4);
    // The thumb: taller while dragged.
    const thumbH = active ? 14 : 10;
    ctx.fillStyle = active ? Theme.text : Theme.accent;
    ctx.fillRect(b.x + filled - 2, rowY + ((rowHeight - thumbH) >> 1), 4, thumbH);
    const format = s.format ?? String;
    this.font.draw(ctx, format(s.value), x + width - 8, textY, {
      align: 'right',
      color: item.disabled ? Theme.muted : Theme.accent,
    });
  }
}
