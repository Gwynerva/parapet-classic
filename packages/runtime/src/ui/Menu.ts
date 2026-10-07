/**
 * A vertical list of selectable items drawn with bitmap fonts. Keyboard/gamepad move the
 * cursor; pointer taps select the row under the pointer. Items can carry a value label on the
 * right (used by the options screen) and react to left/right to change it.
 */
import type { BitmapFont } from '../text/BitmapFont.ts';
import type { UiGesture, UiKey, UiPointer } from '../app/Screen.ts';
import { Theme } from './theme.ts';

export interface MenuItem {
  label: string;
  /** Secondary text drawn under the label (dimmed). */
  description?: string;
  /** Value label drawn on the right. */
  value?: string;
  disabled?: boolean;
  onSelect?: () => void;
  /** Called with -1 / +1 on left/right presses. */
  onAdjust?: (delta: number) => void;
  /**
   * `onSelect` needs user activation (clipboard, downloads, file dialogs): keyboard and
   * pointer select it from `onGesture`, inside the browser's event handler. A gamepad
   * confirm still selects it from the queue; the action then needs a fallback.
   */
  gesture?: boolean;
}

export interface MenuLayout {
  x: number;
  y: number;
  width: number;
  rowHeight: number;
}

export class Menu {
  items: MenuItem[] = [];
  cursor = 0;
  readonly layout: MenuLayout = { x: 0, y: 0, width: 200, rowHeight: 20 };
  private readonly font: BitmapFont;
  private readonly small: BitmapFont;
  /** First visible row when the list is longer than the available height. */
  private scroll = 0;
  maxVisible = 8;

  /** Index of the first visible item (the list scrolls when it is longer than `maxVisible`). */
  get firstVisible(): number {
    return this.scroll;
  }
  /** Row of a gesture item pressed by touch or pen, selected on release. */
  private armed = -1;

  constructor(font: BitmapFont, small: BitmapFont) {
    this.font = font;
    this.small = small;
  }

  setItems(items: MenuItem[]): void {
    this.items = items;
    if (this.cursor >= items.length) this.cursor = Math.max(0, items.length - 1);
    this.skipDisabled(1);
  }

  private skipDisabled(dir: number): void {
    let guard = this.items.length;
    while (guard-- > 0 && this.items[this.cursor]?.disabled) {
      this.cursor = (this.cursor + dir + this.items.length) % this.items.length;
    }
  }

  move(delta: number): void {
    if (this.items.length === 0) return;
    this.cursor = (this.cursor + delta + this.items.length) % this.items.length;
    this.skipDisabled(delta);
    if (this.cursor < this.scroll) this.scroll = this.cursor;
    if (this.cursor >= this.scroll + this.maxVisible)
      this.scroll = this.cursor - this.maxVisible + 1;
  }

  select(): void {
    const item = this.items[this.cursor];
    if (item && !item.disabled) item.onSelect?.();
  }

  adjust(delta: number): void {
    const item = this.items[this.cursor];
    if (item && !item.disabled) item.onAdjust?.(delta);
  }

  /** Returns true when the key was handled. */
  onKey(key: UiKey): boolean {
    switch (key.action) {
      case 'up':
        this.move(-1);
        return true;
      case 'down':
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

  /** Row index under a logical point, or -1. */
  hitTest(x: number, y: number): number {
    const { x: lx, y: ly, width, rowHeight } = this.layout;
    if (x < lx || x >= lx + width) return -1;
    const row = Math.floor((y - ly) / rowHeight);
    if (row < 0 || row >= Math.min(this.maxVisible, this.items.length - this.scroll)) return -1;
    return row + this.scroll;
  }

  /** Returns true when the pointer selected an item. */
  onPointer(p: UiPointer): boolean {
    const row = this.hitTest(p.x, p.y);
    if (row < 0) return false;
    if (p.type === 'move') {
      if (!this.items[row]?.disabled) this.cursor = row;
      return false;
    }
    if (p.type === 'down') {
      const item = this.items[row];
      if (!item || item.disabled) return false;
      this.cursor = row;
      // Gesture items are selected from `onGesture`; a queued press only moves the cursor.
      if (item.gesture) return true;
      if (item.onSelect) {
        item.onSelect();
      } else if (item.onAdjust) {
        // The `<` of the value label steps down; the `>` and the rest of the row step up.
        const bounds = this.valueBounds(item);
        const leftArrowEnd = bounds ? bounds.x + bounds.arrowW + 4 : -Infinity;
        const leftArrowStart = bounds ? bounds.x - 8 : -Infinity;
        item.onAdjust(p.x >= leftArrowStart && p.x < leftArrowEnd ? -1 : 1);
      }
      return true;
    }
    return false;
  }

  /**
   * Selects gesture items synchronously: keyboard confirm and mouse presses at once, touch
   * and pen on release over the same row (browsers grant activation on touch release).
   * Returns true when the gesture was consumed.
   */
  onGesture(g: UiGesture): boolean {
    if (g.kind === 'key') {
      const item = this.items[this.cursor];
      if (g.action !== 'confirm' || !item?.gesture || item.disabled) return false;
      item.onSelect?.();
      return true;
    }
    const row = this.hitTest(g.x, g.y);
    const item = row >= 0 ? this.items[row] : undefined;
    if (g.type === 'down') {
      this.armed = -1;
      if (!item?.gesture || item.disabled) return false;
      this.cursor = row;
      if (g.pointerType === 'mouse') item.onSelect?.();
      else this.armed = row;
      return true;
    }
    const armed = this.armed;
    this.armed = -1;
    if (armed < 0) return false;
    if (row === armed && item?.gesture && !item.disabled) item.onSelect?.();
    return true;
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

  draw(ctx: CanvasRenderingContext2D): void {
    const { x, y, width, rowHeight } = this.layout;
    const end = Math.min(this.items.length, this.scroll + this.maxVisible);
    for (let i = this.scroll; i < end; i++) {
      const item = this.items[i]!;
      const rowY = y + (i - this.scroll) * rowHeight;
      const selected = i === this.cursor;
      if (selected) {
        ctx.fillStyle = Theme.accentDark;
        ctx.fillRect(x, rowY, width, rowHeight);
        ctx.fillStyle = Theme.accent;
        ctx.fillRect(x, rowY, 3, rowHeight);
      }
      const color = item.disabled ? Theme.muted : selected ? Theme.text : Theme.text;
      const textY = rowY + Math.floor((rowHeight - this.font.lineHeight) / 2);
      this.font.draw(ctx, item.label, x + 10, textY, { color });
      if (item.value !== undefined) {
        const label = item.onAdjust ? `< ${item.value} >` : item.value;
        this.font.draw(ctx, label, x + width - 8, textY, {
          align: 'right',
          color: item.disabled ? Theme.muted : Theme.accent,
        });
      }
    }
    if (this.scroll > 0) {
      this.small.draw(ctx, '^', x + width - 8, y - this.small.lineHeight, {
        align: 'right',
        color: Theme.muted,
      });
    }
    if (end < this.items.length) {
      this.small.draw(ctx, 'v', x + width - 8, y + this.maxVisible * rowHeight, {
        align: 'right',
        color: Theme.muted,
      });
    }
  }
}
