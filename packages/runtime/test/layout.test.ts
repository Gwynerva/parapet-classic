import { describe, expect, it } from 'vitest';
import { centered, contains, fitWidth, inset, rowHeight, safeRect } from '../src/ui/layout.ts';

describe('rectangles', () => {
  it('removes the safe-area insets', () => {
    const r = safeRect({
      width: 400,
      height: 300,
      safeArea: { top: 10, right: 20, bottom: 30, left: 40 },
    });
    expect(r).toEqual({ x: 40, y: 10, w: 340, h: 260 });
    expect(inset(r, 8)).toEqual({ x: 48, y: 18, w: 324, h: 244 });
  });

  it('centres and fits', () => {
    const r = { x: 0, y: 0, w: 200, h: 100 };
    expect(centered(r, 50, 20)).toEqual({ x: 75, y: 40, w: 50, h: 20 });
    expect(centered(r, 500, 20).w).toBe(200);
    expect(fitWidth(r, 120)).toEqual({ x: 40, y: 0, w: 120, h: 100 });
    expect(contains(r, 199, 99)).toBe(true);
    expect(contains(r, 200, 0)).toBe(false);
  });

  it('makes rows taller for touch', () => {
    expect(rowHeight(20, false)).toBe(20);
    expect(rowHeight(20, true)).toBe(28);
  });
});
