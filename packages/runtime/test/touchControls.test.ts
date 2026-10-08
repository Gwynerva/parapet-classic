import { describe, expect, it } from 'vitest';
import { computeLayout } from '../src/render/Viewport.ts';
import { layoutPauseButton, layoutTouchButtons } from '../src/input/TouchControls.ts';

/** Phones and tablets: physical size, pixel ratio and safe-area insets in logical px. */
const SCREENS = [
  { pw: 2532, ph: 1170, dpr: 3, safe: { top: 0, right: 16, bottom: 7, left: 16 } },
  { pw: 1170, ph: 2532, dpr: 3, safe: { top: 16, right: 0, bottom: 9, left: 0 } },
  { pw: 1080, ph: 1920, dpr: 2.625, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { pw: 1536, ph: 2048, dpr: 2, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { pw: 240, ph: 320, dpr: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
];

describe('pause button', () => {
  for (const s of SCREENS) {
    it(`sits in the safe area, apart from the arrows, on ${s.pw}×${s.ph}`, () => {
      const { width, height, scale } = computeLayout(s.pw, s.ph);
      const metrics = { width, height, scale, dpr: s.dpr, safeArea: s.safe };
      const pause = layoutPauseButton(metrics);
      expect(pause.y).toBeGreaterThanOrEqual(s.safe.top);
      expect(pause.x).toBeGreaterThanOrEqual(s.safe.left);
      expect(pause.x + pause.size).toBeLessThanOrEqual(width - s.safe.right);
      // Centred in the safe area.
      const centre = s.safe.left + (width - s.safe.left - s.safe.right) / 2;
      expect(Math.abs(pause.x + pause.size / 2 - centre)).toBeLessThanOrEqual(1);
      // A finger-sized target: at least 44 CSS px.
      expect((pause.hitW * scale) / s.dpr).toBeGreaterThanOrEqual(43.5);
      for (const b of layoutTouchButtons(metrics, 'move-left')) {
        expect(pause.hitY + pause.hitH).toBeLessThanOrEqual(b.hitY);
      }
    });
  }
});
