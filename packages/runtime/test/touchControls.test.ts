import { describe, expect, it } from 'vitest';
import { computeLayout } from '../src/render/Viewport.ts';
import {
  BUTTON_MAX_CSS_PX,
  BUTTON_MIN_CSS_PX,
  hitTestLayout,
  layoutTouchControls,
  type TouchLayout,
  type TouchRect,
} from '../src/input/TouchControls.ts';

/** Phones and tablets: physical size, pixel ratio and safe-area insets in logical px. */
const SCREENS = [
  { pw: 2532, ph: 1170, dpr: 3, safe: { top: 0, right: 16, bottom: 7, left: 16 } },
  { pw: 2400, ph: 1080, dpr: 2.75, safe: { top: 0, right: 12, bottom: 0, left: 12 } },
  { pw: 1170, ph: 2532, dpr: 3, safe: { top: 16, right: 0, bottom: 9, left: 0 } },
  { pw: 1080, ph: 1920, dpr: 2.625, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { pw: 1536, ph: 2048, dpr: 2, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { pw: 2048, ph: 1536, dpr: 2, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { pw: 240, ph: 320, dpr: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
];

const centreOf = (b: TouchRect) => ({ x: b.x + b.size / 2, y: b.y + b.size / 2 });

/** The pixels of a round button: those whose middle lies in its circle. */
function* discPixels(b: TouchRect): Generator<[number, number]> {
  const c = centreOf(b);
  const r = b.size / 2 - 0.5;
  for (let y = b.y; y < b.y + b.size; y++) {
    for (let x = b.x; x < b.x + b.size; x++) {
      if (Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) <= r) yield [x, y];
    }
  }
}

function circlesOverlap(a: TouchRect, b: TouchRect): boolean {
  const ca = centreOf(a);
  const cb = centreOf(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y) < (a.size + b.size) / 2;
}

describe('touch controls', () => {
  for (const s of SCREENS) {
    for (const layout of ['move-left', 'move-right'] as TouchLayout[]) {
      it(`fit two thumbs on ${s.pw}×${s.ph}, ${layout}`, () => {
        const { width, height, scale } = computeLayout(s.pw, s.ph);
        const metrics = { width, height, scale, dpr: s.dpr, safeArea: s.safe };
        const placed = layoutTouchControls(metrics, layout);
        const hitAt = (x: number, y: number) => hitTestLayout(placed, x, y);
        const css = (px: number): number => (px * scale) / s.dpr;
        const all = [...placed.buttons, placed.restart, placed.pause];
        for (const b of all) {
          expect(b.x).toBeGreaterThanOrEqual(s.safe.left);
          expect(b.x + b.size).toBeLessThanOrEqual(width - s.safe.right);
          expect(b.y).toBeGreaterThanOrEqual(s.safe.top);
          expect(b.y + b.size).toBeLessThanOrEqual(height - s.safe.bottom);
          // A finger-sized target: at least 44 CSS px.
          expect(css(b.hitW)).toBeGreaterThanOrEqual(43.5);
          expect(css(b.hitH)).toBeGreaterThanOrEqual(43.5);
        }
        for (const b of placed.buttons) {
          expect(css(b.size)).toBeGreaterThanOrEqual(BUTTON_MIN_CSS_PX - 1);
          expect(css(b.size)).toBeLessThanOrEqual(BUTTON_MAX_CSS_PX + 1);
        }
        // No two buttons overlap.
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++) {
            expect(circlesOverlap(all[i]!, all[j]!)).toBe(false);
          }
        }
        // Every pixel of a button presses that button, never another.
        for (const b of all) {
          const name = 'direction' in b ? b.direction : b === placed.pause ? 'pause' : 'restart';
          for (const [x, y] of discPixels(b)) expect(hitAt(x, y)).toBe(name);
        }
        // Restart and pause side by side, centred in the safe area, restart first.
        const centre = s.safe.left + (width - s.safe.left - s.safe.right) / 2;
        const pairMiddle = (placed.restart.x + placed.pause.x + placed.pause.size) / 2;
        expect(Math.abs(pairMiddle - centre)).toBeLessThanOrEqual(2);
        expect(placed.restart.y).toBe(placed.pause.y);
        expect(placed.restart.x).toBeLessThan(placed.pause.x);
        // Left before right on one row; down on the inner side, up higher and further out.
        const [l, r, u, d] = placed.buttons;
        expect([l!.direction, r!.direction, u!.direction, d!.direction]).toEqual([
          'left',
          'right',
          'up',
          'down',
        ]);
        expect(l!.y).toBe(r!.y);
        expect(d!.y).toBe(l!.y);
        expect(u!.y).toBeLessThan(d!.y);
        expect(d!.y - u!.y).toBeLessThan(u!.size);
        const outward = layout === 'move-left' ? 1 : -1;
        expect(Math.sign(u!.x - d!.x)).toBe(outward);
        expect(l!.x < u!.x).toBe(layout === 'move-left');
        // Big areas: a thumb landing near the bottom corner of the move side still presses,
        // and under down or beside up still counts on the other side.
        const moveCorner = layout === 'move-left' ? 1 : width - 2;
        expect(hitAt(moveCorner, height - 2)).toBe(layout === 'move-left' ? 'left' : 'right');
        expect(hitAt(Math.round(centreOf(d!).x), height - 1)).toBe('down');
        const side = layout === 'move-left' ? width - 1 : 0;
        expect(hitAt(side, Math.round(centreOf(u!).y))).toBe('up');
        expect(hitAt(Math.round(centreOf(u!).x), u!.y - 4)).toBe('up');
        // The top of the screen (HUD, sky) presses nothing.
        expect(hitAt(1, 1)).toBeNull();
        expect(hitAt(width - 2, 1)).toBeNull();
      });
    }
  }

  it('put everything along the bottom, in either orientation', () => {
    for (const [pw, ph] of [
      [2532, 1170],
      [1170, 2532],
    ] as const) {
      const metrics = computeLayout(pw, ph);
      const placed = layoutTouchControls(
        { ...metrics, dpr: 3, safeArea: { top: 0, right: 0, bottom: 0, left: 0 } },
        'move-left',
      );
      const [l, r, , d] = placed.buttons;
      const line = d!.y + d!.size;
      expect(metrics.height - line).toBeLessThanOrEqual(10);
      for (const b of [l!, r!, placed.restart, placed.pause]) expect(b.y + b.size).toBe(line);
    }
  });

  it('leave restart and pause alone when the direction buttons are off', () => {
    const metrics = computeLayout(2532, 1170);
    const placed = layoutTouchControls(
      { ...metrics, dpr: 3, safeArea: { top: 0, right: 0, bottom: 0, left: 0 } },
      'move-left',
    );
    const [l] = placed.buttons;
    const c = centreOf(l!);
    expect(hitTestLayout(placed, c.x, c.y, false)).toBeNull();
    const p = centreOf(placed.pause);
    expect(hitTestLayout(placed, p.x, p.y, false)).toBe('pause');
  });
});
