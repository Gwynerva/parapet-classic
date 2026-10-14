/**
 * Rectangle helpers for the screens. Screens never keep pixel positions between frames; they
 * compute their rectangles from the viewport in `onResize()` and again whenever it changes, so
 * a rotation or a window resize re-flows the screen in place.
 */
import type { SafeArea } from '../render/Viewport.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ViewportLike {
  width: number;
  height: number;
  safeArea: SafeArea;
  isCoarsePointer?: boolean;
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

/** Row height of a list: taller on touch screens so a finger lands on one row. */
export function rowHeight(base: number, coarsePointer: boolean): number {
  return coarsePointer ? base + 8 : base;
}
