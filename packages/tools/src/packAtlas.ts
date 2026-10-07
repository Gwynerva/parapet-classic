/**
 * Shelf packer: items are sorted by height, laid out left to right in rows ("shelves"), with
 * `padding` pixels between frames and around the border.
 */
export interface AtlasItem {
  id: number;
  w: number;
  h: number;
}

export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AtlasLayout {
  width: number;
  height: number;
  frames: Record<number, AtlasFrame>;
}

export function packAtlas(items: readonly AtlasItem[], padding = 1, maxWidth = 4096): AtlasLayout {
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w || a.id - b.id);
  let area = 0;
  let widest = 0;
  for (const item of sorted) {
    area += (item.w + padding) * (item.h + padding);
    widest = Math.max(widest, item.w + 2 * padding);
  }
  let width = 64;
  while (width < widest || width * width < area) width *= 2;
  for (;;) {
    const layout = shelf(sorted, width, padding);
    if (layout.height <= width || width >= maxWidth) return layout;
    width *= 2;
  }
}

function shelf(sorted: readonly AtlasItem[], width: number, padding: number): AtlasLayout {
  const frames: Record<number, AtlasFrame> = {};
  let x = padding;
  let y = padding;
  let shelfHeight = 0;
  for (const item of sorted) {
    if (x + item.w + padding > width) {
      x = padding;
      y += shelfHeight + padding;
      shelfHeight = 0;
    }
    frames[item.id] = { x, y, w: item.w, h: item.h };
    x += item.w + padding;
    shelfHeight = Math.max(shelfHeight, item.h);
  }
  return { width, height: y + shelfHeight + padding, frames };
}
