/**
 * A grid of square tiles (characters, moves), centred in its area. Groups start on a row of
 * their own; an `even` group keeps an even number of tiles per row so pairs stay side by side.
 * Arrows move the selection, a tap selects a tile and a tap on the selected one activates it;
 * a finger dragged over the grid scrolls it, and so does the mouse wheel.
 */
import type { UiKey, UiPointer, UiWheel } from '../app/Screen.ts';
import type { BitmapFont } from '../text/BitmapFont.ts';
import { drawScrollArrow } from './draw.ts';
import { contains, type Rect } from './layout.ts';
import { PressTracker } from './press.ts';
import { Theme } from './theme.ts';

export interface TileGroup {
  count: number;
  /** An even number of tiles per row (pairs stay together). */
  even?: boolean;
}

export interface TileState {
  selected: boolean;
  pressed: boolean;
}

export class TileGrid {
  tile: number;
  gap: number;
  /** Area the grid may use; the tiles are centred in it horizontally. */
  rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  cols = 1;
  /** Rows in total and on screen. */
  rows = 1;
  visibleRows = 1;
  scrollRow = 0;
  index = 0;
  /** Called when the selection changes (by keys or a tap). */
  onSelect: ((index: number) => void) | null = null;
  /** Called on Enter or a tap on the selected tile. */
  onActivate: ((index: number) => void) | null = null;
  private groups: TileGroup[] = [{ count: 0 }];
  private cells: { col: number; row: number }[] = [];
  private originX = 0;
  private readonly press = new PressTracker<number>();
  private dragScroll = 0;
  private wheelRest = 0;

  constructor(tile: number, gap: number) {
    this.tile = tile;
    this.gap = gap;
  }

  get count(): number {
    return this.cells.length;
  }

  private get pitch(): number {
    return this.tile + this.gap;
  }

  /** Width the tiles take (at most `rect.w`). */
  get usedWidth(): number {
    return this.cols * this.pitch - this.gap;
  }

  /** Height of all rows, or of the visible ones when the grid scrolls. */
  get usedHeight(): number {
    return Math.min(this.rows, this.visibleRows) * this.pitch - this.gap;
  }

  setGroups(groups: readonly TileGroup[]): void {
    this.groups = groups.map((g) => ({ ...g }));
    this.relayout();
  }

  /** Columns that fit a width (for screens that size the area around the grid). */
  columnsFor(width: number): number {
    return Math.max(1, Math.floor((width + this.gap) / this.pitch));
  }

  /** Places the grid in `rect`; `maxCols` caps the row length (a tidier block on wide screens). */
  layout(rect: Rect, maxCols = Infinity): void {
    this.rect = rect;
    this.cols = Math.max(1, Math.min(maxCols, this.columnsFor(rect.w)));
    this.visibleRows = Math.max(1, Math.floor((rect.h + this.gap) / this.pitch));
    this.relayout();
  }

  private relayout(): void {
    this.cells = [];
    let row = 0;
    for (const group of this.groups) {
      const width = group.even && this.cols > 1 ? this.cols - (this.cols % 2) : this.cols;
      let col = 0;
      for (let i = 0; i < group.count; i++) {
        if (col >= width) {
          col = 0;
          row++;
        }
        this.cells.push({ col, row });
        col++;
      }
      if (group.count > 0) row++;
    }
    this.rows = Math.max(1, row);
    this.originX = this.rect.x + ((this.rect.w - this.usedWidth) >> 1);
    if (this.index >= this.cells.length) this.index = Math.max(0, this.cells.length - 1);
    this.keepVisible();
  }

  /** Screen rectangle of a tile, or null while it is scrolled away. */
  cellRect(index: number): Rect | null {
    const cell = this.cells[index];
    if (!cell) return null;
    const r = cell.row - this.scrollRow;
    if (r < 0 || r >= this.visibleRows) return null;
    return {
      x: this.originX + cell.col * this.pitch,
      y: this.rect.y + r * this.pitch,
      w: this.tile,
      h: this.tile,
    };
  }

  /** The tile under a point (gaps count to the nearest tile), or -1. */
  hitTest(x: number, y: number): number {
    const half = this.gap >> 1;
    for (let i = 0; i < this.cells.length; i++) {
      const r = this.cellRect(i);
      if (r && x >= r.x - half && x < r.x + r.w + half && y >= r.y - half && y < r.y + r.h + half)
        return i;
    }
    return -1;
  }

  private entryAt(col: number, row: number): number {
    return this.cells.findIndex((c) => c.col === col && c.row === row);
  }

  private keepVisible(): void {
    const row = this.cells[this.index]?.row ?? 0;
    if (row < this.scrollRow) this.scrollRow = row;
    if (row >= this.scrollRow + this.visibleRows) this.scrollRow = row - this.visibleRows + 1;
    this.scrollRow = Math.max(
      0,
      Math.min(Math.max(0, this.rows - this.visibleRows), this.scrollRow),
    );
  }

  select(index: number): void {
    const n = this.cells.length;
    if (n === 0) return;
    const next = ((index % n) + n) % n;
    const changed = next !== this.index;
    this.index = next;
    this.keepVisible();
    if (changed) this.onSelect?.(next);
  }

  /** Up or down a row: the tile in the nearest column of that row (wrapping around). */
  private verticalMove(delta: number): void {
    const here = this.cells[this.index];
    if (!here) return;
    let row = here.row + delta;
    if (row < 0) row = this.rows - 1;
    if (row >= this.rows) row = 0;
    for (let col = here.col; col >= 0; col--) {
      const i = this.entryAt(col, row);
      if (i >= 0) {
        this.select(i);
        return;
      }
    }
  }

  /** Returns true when the key was handled. */
  onKey(key: UiKey): boolean {
    switch (key.action) {
      case 'left':
      case 'prev':
        this.select(this.index - 1);
        return true;
      case 'right':
      case 'next':
        this.select(this.index + 1);
        return true;
      case 'up':
        this.verticalMove(-1);
        return true;
      case 'down':
        this.verticalMove(1);
        return true;
      case 'confirm':
        this.onActivate?.(this.index);
        return true;
      default:
        return false;
    }
  }

  /** Returns true when the event belonged to the grid. */
  onPointer(p: UiPointer): boolean {
    switch (p.type) {
      case 'down': {
        if (!contains(this.rect, p.x, p.y)) return false;
        this.press.press(this.hitTest(p.x, p.y), p);
        if (this.press.pressed === -1) this.press.pressed = null;
        this.dragScroll = this.scrollRow;
        return true;
      }
      case 'move': {
        if (!this.press.down) return false;
        const finger = p.pointerType !== undefined && p.pointerType !== 'mouse';
        this.press.move(p, finger ? undefined : this.hitTest(p.x, p.y));
        if (this.press.dragging && finger) {
          const rows = Math.round((this.press.startY - p.y) / this.pitch);
          this.scrollTo(this.dragScroll + rows);
        }
        return true;
      }
      case 'up': {
        if (!this.press.down) return false;
        const fired = this.press.release(this.hitTest(p.x, p.y));
        if (fired !== null && fired >= 0) {
          if (fired === this.index) this.onActivate?.(fired);
          else this.select(fired);
        }
        return true;
      }
      case 'cancel': {
        const was = this.press.down;
        this.press.reset();
        return was;
      }
    }
  }

  onWheel(w: UiWheel): boolean {
    if (!contains(this.rect, w.x, w.y)) return false;
    this.wheelRest += w.dy;
    const rows = Math.trunc(this.wheelRest / this.pitch);
    if (rows !== 0) {
      this.wheelRest -= rows * this.pitch;
      this.scrollTo(this.scrollRow + rows);
    }
    return true;
  }

  private scrollTo(row: number): void {
    this.scrollRow = Math.max(0, Math.min(Math.max(0, this.rows - this.visibleRows), row));
  }

  /** Calls `draw` for every visible tile with its rectangle and state. */
  forEachVisible(draw: (index: number, rect: Rect, state: TileState) => void): void {
    const pressed = this.press.pressed;
    for (let i = 0; i < this.cells.length; i++) {
      const r = this.cellRect(i);
      if (r) draw(i, r, { selected: i === this.index, pressed: i === pressed });
    }
  }

  /** Tile backgrounds and borders (selected: accent; pressed: sunk by a pixel). */
  drawFrames(ctx: CanvasRenderingContext2D): void {
    this.forEachVisible((_, r, s) => drawTileFrame(ctx, r, s));
  }

  /** Small arrows above and below when rows are scrolled away. */
  drawScrollMarkers(ctx: CanvasRenderingContext2D, _font?: BitmapFont): void {
    const cx = this.originX + (this.usedWidth >> 1);
    if (this.scrollRow > 0) drawScrollArrow(ctx, cx, this.rect.y - 1, true);
    if (this.scrollRow + this.visibleRows < this.rows) {
      drawScrollArrow(ctx, cx, this.rect.y + this.visibleRows * this.pitch - this.gap + 1, false);
    }
  }
}

/** A tile's square: panel colours, accent when selected, accent fill when pressed. */
export function drawTileFrame(ctx: CanvasRenderingContext2D, r: Rect, s: TileState): void {
  ctx.fillStyle = s.pressed ? Theme.accent : s.selected ? Theme.accentDark : Theme.panel;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = s.selected || s.pressed ? Theme.accent : Theme.panelBorder;
  ctx.fillRect(r.x, r.y, r.w, 1);
  ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
  ctx.fillRect(r.x, r.y, 1, r.h);
  ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
}
