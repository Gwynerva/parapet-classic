import { describe, expect, it } from 'vitest';
import {
  centered,
  classify,
  columns,
  contains,
  fitWidth,
  inset,
  rowHeight,
  safeRect,
  stack,
} from '../src/ui/layout.ts';

describe('layout classes', () => {
  it('classifies phones upright as compact portrait and wide screens as regular', () => {
    expect(classify(375, 812)).toBe('compact-portrait');
    expect(classify(270, 585)).toBe('compact-portrait');
    expect(classify(640, 360)).toBe('regular');
    expect(classify(860, 360)).toBe('regular');
    expect(classify(512, 384)).toBe('regular');
    expect(classify(384, 512)).toBe('compact-portrait');
    expect(classify(420, 600)).toBe('regular');
  });

  it('classifies short landscape viewports as compact landscape', () => {
    expect(classify(480, 270)).toBe('compact-landscape');
    expect(classify(300, 240)).toBe('compact-landscape');
  });
});

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

  it('stacks fixed and flexible rows', () => {
    const rows = stack({ x: 0, y: 0, w: 100, h: 100 }, [20, -1, -1, 10], 5);
    expect(rows.map((r) => [r.y, r.h])).toEqual([
      [0, 20],
      [25, 27],
      [57, 27],
      [89, 10],
    ]);
    expect(rows.every((r) => r.x === 0 && r.w === 100)).toBe(true);
  });

  it('clips rows that do not fit', () => {
    const rows = stack({ x: 0, y: 0, w: 10, h: 30 }, [20, 20]);
    expect(rows.map((r) => r.h)).toEqual([20, 10]);
  });

  it('splits columns by width', () => {
    const cols = columns({ x: 10, y: 0, w: 110, h: 50 }, [-1, 30], 10);
    expect(cols).toEqual([
      { x: 10, y: 0, w: 70, h: 50 },
      { x: 90, y: 0, w: 30, h: 50 },
    ]);
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
