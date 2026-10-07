/**
 * Layout model for the screens: a few rectangle helpers and the breakpoint that tells a screen
 * which arrangement to use. Screens never keep pixel positions between frames; they compute
 * their rectangles from the viewport in `onResize()` and again whenever it changes, so a
 * rotation or a window resize re-flows the screen in place.
 *
 * - `regular`: desktops, tablets and phones in landscape with room for two columns.
 * - `compact-landscape`: short viewports (phones in landscape at a large scale).
 * - `compact-portrait`: narrow viewports (phones held upright); one column, big rows.
 */

export type LayoutClass = 'compact-portrait' | 'compact-landscape' | 'regular';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportLike {
  width: number;
  height: number;
  safeArea: Insets;
  isCoarsePointer?: boolean;
}

/**
 * Below this logical width a viewport is compact (one column): phones upright land between
 * 270 and 400 logical px, tablets upright around 384, and two panels need about 480.
 */
export const COMPACT_WIDTH = 420;
/** Below this logical height a landscape viewport is compact (no stacked panels). */
export const COMPACT_HEIGHT = 300;

export function classify(width: number, height: number): LayoutClass {
  if (width < COMPACT_WIDTH && height >= width) return 'compact-portrait';
  if (width < COMPACT_WIDTH || height < COMPACT_HEIGHT) return 'compact-landscape';
  return 'regular';
}

export function isCompact(layout: LayoutClass): boolean {
  return layout !== 'regular';
}

/** The viewport minus the device's unsafe insets (notches, home indicators). */
export function safeRect(viewport: ViewportLike): Rect {
  const s = viewport.safeArea;
  return {
    x: s.left,
    y: s.top,
    w: Math.max(0, viewport.width - s.left - s.right),
    h: Math.max(0, viewport.height - s.top - s.bottom),
  };
}

export function inset(r: Rect, dx: number, dy = dx): Rect {
  return { x: r.x + dx, y: r.y + dy, w: Math.max(0, r.w - 2 * dx), h: Math.max(0, r.h - 2 * dy) };
}

export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** A rectangle of `w × h` centred in `r` (clamped to `r`'s size). */
export function centered(r: Rect, w: number, h: number): Rect {
  const cw = Math.min(w, r.w);
  const ch = Math.min(h, r.h);
  return { x: r.x + ((r.w - cw) >> 1), y: r.y + ((r.h - ch) >> 1), w: cw, h: ch };
}

/** A column of at most `maxWidth` centred horizontally in `r`, full height. */
export function fitWidth(r: Rect, maxWidth: number): Rect {
  const w = Math.min(maxWidth, r.w);
  return { x: r.x + ((r.w - w) >> 1), y: r.y, w, h: r.h };
}

/**
 * Split `r` into rows from the top. A height of -1 means "share what is left" (several such
 * rows share it equally); fixed rows that do not fit are clipped to the bottom.
 */
export function stack(r: Rect, heights: readonly number[], gap = 0): Rect[] {
  return split(r, heights, gap, true);
}

/** Split `r` into columns from the left; weights follow the rules of `stack`. */
export function columns(r: Rect, widths: readonly number[], gap = 0): Rect[] {
  return split(r, widths, gap, false);
}

function split(r: Rect, sizes: readonly number[], gap: number, vertical: boolean): Rect[] {
  const total = vertical ? r.h : r.w;
  const gaps = Math.max(0, sizes.length - 1) * gap;
  let fixed = 0;
  let flexible = 0;
  for (const s of sizes) {
    if (s < 0) flexible++;
    else fixed += s;
  }
  const remaining = Math.max(0, total - gaps - fixed);
  const share = flexible > 0 ? Math.floor(remaining / flexible) : 0;
  const out: Rect[] = [];
  let pos = vertical ? r.y : r.x;
  const end = (vertical ? r.y : r.x) + total;
  for (const s of sizes) {
    const size = Math.max(0, Math.min(s < 0 ? share : s, end - pos));
    out.push(vertical ? { x: r.x, y: pos, w: r.w, h: size } : { x: pos, y: r.y, w: size, h: r.h });
    pos += size + gap;
  }
  return out;
}

/** Row height of a list: taller on touch screens so a finger lands on one row. */
export function rowHeight(base: number, coarsePointer: boolean): number {
  return coarsePointer ? base + 8 : base;
}
