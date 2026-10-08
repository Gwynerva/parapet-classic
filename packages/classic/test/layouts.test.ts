import { describe, expect, it } from 'vitest';
import { safeRect, type Rect } from '@parapet/runtime/ui/layout.ts';
import { dialogLayout, showcaseLayout, titleLayout } from '../src/app/layouts.ts';

/** Logical sizes of real screens, with and without notches. */
const SIZES: [number, number][] = [
  [240, 320],
  [270, 480],
  [292, 633],
  [307, 409],
  [480, 300],
  [640, 360],
  [683, 384],
  [844, 390],
  [960, 540],
];
const NOTCHES = [
  { top: 0, right: 0, bottom: 0, left: 0 },
  { top: 16, right: 0, bottom: 9, left: 0 },
  { top: 0, right: 16, bottom: 7, left: 16 },
];

function inside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const cases = SIZES.flatMap(([width, height]) =>
  NOTCHES.map((safeArea) => ({ width, height, safeArea })),
);

describe('title screen', () => {
  for (const vp of cases) {
    for (const coarse of [false, true]) {
      const label = `${vp.width}×${vp.height} inset ${JSON.stringify(vp.safeArea)}${coarse ? ' touch' : ''}`;
      it(`fits ${label}`, () => {
        const rows = 7;
        const row = coarse ? 32 : 24;
        const l = titleLayout(vp, { titleHeight: 43, titleWidth: 190, rowHeight: row, rows });
        const safe = safeRect(vp);
        expect(inside(l.title, safe)).toBe(true);
        expect(inside(l.menu, safe)).toBe(true);
        expect(overlap(l.title, l.menu)).toBe(false);
        // Every row is visible, or the list scrolls with at least three rows on screen.
        const visible = Math.floor(l.menu.h / l.rowHeight);
        expect(visible >= rows || visible >= 3).toBe(true);
        // Centred on the safe area.
        const centre = safe.x + safe.w / 2;
        expect(Math.abs(l.menu.x + l.menu.w / 2 - centre)).toBeLessThanOrEqual(
          l.title.x + l.title.w <= l.menu.x ? safe.w : 1,
        );
      });
    }
  }
});

describe('showcase screens', () => {
  for (const vp of cases) {
    it(`fit ${vp.width}×${vp.height} inset ${JSON.stringify(vp.safeArea)}`, () => {
      const safe = safeRect(vp);
      const body = { x: safe.x + 8, y: safe.y + 33, w: safe.w - 16, h: safe.h - 39 };
      const l = showcaseLayout(body, {
        boxMin: 150,
        boxMax: 280,
        gridRow: 34,
        gridHeight: (w) => Math.ceil(34 / Math.max(1, Math.floor((w + 4) / 34))) * 34 - 4,
      });
      expect(inside(l.box, body)).toBe(true);
      expect(overlap(l.box, l.grid)).toBe(false);
      expect(l.grid.h).toBeGreaterThanOrEqual(30);
      // No big hole between the box and the grid.
      if (!l.side) expect(l.grid.y - (l.box.y + l.box.h)).toBeLessThanOrEqual(8);
    });
  }
});

describe('dialogs', () => {
  for (const vp of cases) {
    it(`fit ${vp.width}×${vp.height} inset ${JSON.stringify(vp.safeArea)}`, () => {
      const d = dialogLayout(vp, { width: 260, header: 33, footer: 18, rows: 8, rowHeight: 32 });
      const safe = safeRect(vp);
      expect(inside(d.panel, safe)).toBe(true);
      expect(inside(d.menu, d.panel)).toBe(true);
      expect(d.menu.h).toBeGreaterThanOrEqual(32);
      expect(d.menu.h % 32).toBe(0);
    });
  }
});
