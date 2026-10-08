/**
 * Packs rectangles in reading order: left to right, top to bottom, in the order given (no
 * sorting), a new row when the next one does not fit or when an item asks for it. Rows are as
 * tall as their tallest item; `gap` pixels separate items, rows and the border. Deterministic,
 * so a layout can be computed again from the same list.
 */

export interface PackItem {
  key: string;
  w: number;
  h: number;
  /** Start a new row with this item (a new family of parts). */
  breakBefore?: boolean;
}

export interface PackedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Packing {
  width: number;
  height: number;
  cells: Map<string, PackedRect>;
}

export function packRows(items: readonly PackItem[], maxWidth: number, gap: number): Packing {
  const cells = new Map<string, PackedRect>();
  let x = gap;
  let y = gap;
  let rowHeight = 0;
  let width = 0;
  for (const item of items) {
    const rowStarted = x > gap;
    if (rowStarted && (item.breakBefore || x + item.w + gap > maxWidth)) {
      x = gap;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    cells.set(item.key, { x, y, w: item.w, h: item.h });
    x += item.w + gap;
    rowHeight = Math.max(rowHeight, item.h);
    width = Math.max(width, x);
  }
  const height = items.length > 0 ? y + rowHeight + gap : gap * 2;
  return { width: Math.max(width, gap * 2), height, cells };
}
