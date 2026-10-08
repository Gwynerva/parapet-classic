import { describe, expect, it } from 'vitest';
import {
  computeForcedLayout,
  computeLayout,
  MAX_LOGICAL_WIDTH,
  MIN_LOGICAL_HEIGHT,
  MIN_LOGICAL_WIDTH,
} from '../src/render/Viewport.ts';
import { physicalSize, SettleSchedule } from '../src/render/viewportSize.ts';

describe('computeLayout', () => {
  // Physical (device pixel) sizes of real screens → logical size and integer scale.
  const devices: [string, number, number, number, number, number][] = [
    ['the original phone', 240, 320, 240, 320, 1],
    ['a 1080p phone upright', 1080, 1920, 270, 480, 4],
    ['an iPhone upright', 1170, 2532, 292, 633, 4],
    ['an iPhone in landscape', 2532, 1170, 844, 390, 3],
    ['an iPad upright', 1536, 2048, 307, 409, 5],
    ['a 1366×768 laptop', 1366, 768, 683, 384, 2],
    ['a 1080p desktop', 1920, 1080, 640, 360, 3],
  ];
  for (const [name, pw, ph, w, h, scale] of devices) {
    it(`fits ${name}`, () => {
      expect(computeLayout(pw, ph)).toEqual({ width: w, height: h, scale });
    });
  }

  it('caps the width of ultra-wide screens', () => {
    expect(computeLayout(5120, 1440).width).toBe(MAX_LOGICAL_WIDTH);
  });

  it('never exceeds the physical size and keeps the original minimum when it can', () => {
    for (let pw = 240; pw <= 4000; pw += 97) {
      for (let ph = 320; ph <= 3000; ph += 89) {
        const l = computeLayout(pw, ph);
        expect(l.width * l.scale).toBeLessThanOrEqual(pw);
        expect(l.height * l.scale).toBeLessThanOrEqual(ph);
        expect(l.width).toBeGreaterThanOrEqual(Math.min(MIN_LOGICAL_WIDTH, pw));
        expect(l.height).toBeGreaterThanOrEqual(Math.min(MIN_LOGICAL_HEIGHT, ph));
      }
    }
  });

  it('honours a manual scale', () => {
    expect(computeLayout(1920, 1080, 2)).toEqual({ width: 960, height: 540, scale: 2 });
  });
});

describe('computeForcedLayout', () => {
  it('uses the largest scale that fits', () => {
    expect(computeForcedLayout(1920, 1080, 292, 633)).toEqual({
      width: 292,
      height: 633,
      scale: 1,
    });
    expect(computeForcedLayout(2560, 1440, 320, 240)).toEqual({
      width: 320,
      height: 240,
      scale: 6,
    });
  });
});

describe('physicalSize', () => {
  it('prefers the exact device pixels while they agree with the CSS size', () => {
    expect(
      physicalSize({
        devicePixels: { width: 2533, height: 1170 },
        css: { width: 844, height: 390 },
        dpr: 3,
      }),
    ).toEqual({ width: 2533, height: 1170 });
  });

  it('falls back to the CSS size when the exact size is stale or missing', () => {
    expect(
      physicalSize({
        devicePixels: { width: 1170, height: 2532 },
        css: { width: 844, height: 390 },
        dpr: 3,
      }),
    ).toEqual({ width: 2532, height: 1170 });
    expect(physicalSize({ css: { width: 683.5, height: 384 }, dpr: 2 })).toEqual({
      width: 1367,
      height: 768,
    });
  });
});

describe('SettleSchedule', () => {
  it('checks at once and a few times while things settle', () => {
    const s = new SettleSchedule([0, 100, 300]);
    expect(s.due(0)).toBe(false);
    s.trigger(1000);
    expect(s.due(1000)).toBe(true);
    expect(s.due(1050)).toBe(false);
    expect(s.due(1100)).toBe(true);
    expect(s.due(1500)).toBe(true);
    expect(s.idle).toBe(true);
  });

  it('restarts on a new signal', () => {
    const s = new SettleSchedule([0, 100]);
    s.trigger(0);
    expect(s.due(0)).toBe(true);
    s.trigger(90);
    expect(s.due(100)).toBe(true);
    expect(s.due(150)).toBe(false);
    expect(s.due(190)).toBe(true);
  });
});
