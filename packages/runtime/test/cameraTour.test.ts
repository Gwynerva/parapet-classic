import { describe, expect, it } from 'vitest';
import { CameraTour, LEG_BASE_MS, LEG_MS_PER_PX, smoothstep } from '../src/render/CameraTour.ts';

const view = { viewW: 240 << 5, viewH: 320 << 5, levelW: 100 << 10, levelH: 40 << 10 };

describe('CameraTour', () => {
  it('eases with a smoothstep', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.25)).toBeCloseTo(0.15625);
  });

  it('centres each point in turn and loops', () => {
    const points = [
      { x: 20 << 10, y: 20 << 10 },
      { x: 60 << 10, y: 20 << 10 },
    ];
    const tour = new CameraTour(points, view);
    tour.start(0, 0);
    const first = { x: (20 << 10) - (view.viewW >> 1), y: (20 << 10) - (view.viewH >> 1) };
    const distancePx = Math.hypot(first.x, first.y) / 32;
    const legMs = Math.round(distancePx * LEG_MS_PER_PX + LEG_BASE_MS);
    const mid = tour.advance(legMs / 2);
    expect(mid.x).toBe(Math.round(first.x / 2));
    expect(mid.y).toBe(Math.round(first.y / 2));
    const end = tour.advance(legMs / 2);
    expect(end).toEqual(first);
    // A long time later the tour is still cycling between the two points.
    const later = tour.advance(60000);
    expect(later.x).toBeGreaterThanOrEqual(0);
    expect(later.x).toBeLessThanOrEqual((60 << 10) - (view.viewW >> 1));
  });

  it('clamps targets to the level like the camera', () => {
    const tour = new CameraTour([{ x: 0, y: 0 }], view);
    tour.start(5000, 5000);
    const end = tour.advance(100000);
    expect(end.x).toBe(0);
    expect(end.y).toBe(-(view.viewH >> 1));
  });
});
