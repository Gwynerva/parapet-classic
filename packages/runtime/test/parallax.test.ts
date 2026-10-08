import { describe, expect, it } from 'vitest';
import { LevelRenderer } from '../src/render/LevelRenderer.ts';
import type { SceneRenderer } from '../src/render/SceneRenderer.ts';
import type { SpriteSheet } from '../src/render/SpriteSheet.ts';
import { objectGrid, splitPixel, toScreen, worldGrid } from '../src/render/View.ts';

const FAR = 212;

/** A context scaled `per` times (the viewport's scale) that only keeps track of its moves. */
function fakeContext(per: number): {
  ctx: CanvasRenderingContext2D;
  offset: () => { x: number; y: number };
} {
  let x = 0;
  let y = 0;
  const stack: [number, number][] = [];
  const ctx = {
    fillStyle: '',
    getTransform: () => ({ a: per }),
    save: () => stack.push([x, y]),
    restore: () => ([x, y] = stack.pop() ?? [0, 0]),
    translate: (dx: number, dy: number) => {
      x += dx;
      y += dy;
    },
    fillRect: () => undefined,
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    offset: () => ({ x, y }),
  };
}

/** Where the far layer's first strip lands, in logical pixels, for a camera at `camX` units. */
function farLayerAt(per: number, camX: number): number {
  const { ctx, offset } = fakeContext(per);
  const placed: number[] = [];
  const sheet = {
    drawSprite: (_c: unknown, id: number, x: number) => {
      if (id === FAR && placed.length === 0) placed.push(x + offset().x);
    },
    drawStrip: () => undefined,
  } as unknown as SpriteSheet;
  // Theme 0: ground, sky bottom, sky top, the far strip (the near one is the next sprite), no clouds.
  const content = {
    missions: { levels: [] },
    tables: { M: [0x404040, 0x8080ff, 0x4040c0, FAR, -1] },
  };
  const level = new LevelRenderer(content, sheet, {} as SceneRenderer, new Int16Array(512));
  level.drawBackground(ctx, { x: camX, y: 0 }, { width: 400, height: 384 }, 0, 0);
  return placed[0]!;
}

describe('parallax', () => {
  it('splits a position into a whole pixel and a rest on screen pixels', () => {
    expect(splitPixel(-12.3, 5)).toEqual({ whole: -13, rest: 0.6 });
    expect(splitPixel(7.01, 4)).toEqual({ whole: 7, rest: 0 });
    expect(splitPixel(3.5, 1)).toEqual({ whole: 3, rest: 1 });
  });

  it('moves the far layer a screen pixel at a time on a big screen', () => {
    // The camera runs 8 logical pixels (256 units) a unit at a time: the layer, at 0.117×,
    // goes about one logical pixel, through the screen pixels between.
    const per = 5;
    const seen = new Set<number>();
    let last = farLayerAt(per, 1000 * 32);
    for (let u = 1; u <= 256; u++) {
      const x = farLayerAt(per, 1000 * 32 + u);
      expect(Math.abs(x - last)).toBeLessThanOrEqual(1 / per + 1e-9);
      expect(Math.abs(x * per - Math.round(x * per))).toBeLessThan(1e-9);
      seen.add(Math.round(x * per));
      last = x;
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('puts the world on whole pixels and moves it by the rest, a screen pixel at a time', () => {
    const per = 4;
    let last = Number.NaN;
    for (let u = 0; u < 96; u++) {
      const exact = { x: 50_000 + u, y: -7_000 - u };
      const grid = worldGrid(exact, per);
      expect(Math.abs(grid.cam.x % 32)).toBe(0);
      expect(Math.abs(grid.cam.y % 32)).toBe(0);
      // A tile corner on the level's grid lands within half a screen pixel of the exact place.
      const corner = 51_200;
      const drawn = toScreen(corner, grid.cam.x) + grid.dx;
      expect(Math.abs(drawn - (corner - exact.x) / 32)).toBeLessThanOrEqual(0.5 / per + 1e-9);
      expect(Math.abs(drawn * per - Math.round(drawn * per))).toBeLessThan(1e-9);
      if (!Number.isNaN(last)) expect(Math.abs(drawn - last)).toBeLessThanOrEqual(1 / per + 1e-9);
      last = drawn;
    }
  });

  it('keeps a runner the camera follows still, its root on a whole pixel of its camera', () => {
    const per = 5;
    for (let u = 0; u < 64; u++) {
      const runner = { x: 70_000 + u * 3, y: 9_000 };
      const cam = { x: runner.x - 150 * 32 - 11, y: runner.y - 200 * 32 };
      const grid = objectGrid(runner, cam, per);
      const root = toScreen(runner.x, grid.cam.x);
      expect(Number.isInteger(root)).toBe(true);
      expect(Math.abs(root + grid.dx - (150 + 11 / 32))).toBeLessThanOrEqual(0.5 / per);
      expect(grid.dx).toBeGreaterThanOrEqual(0);
      expect(grid.dx).toBeLessThan(1);
    }
  });

  it('keeps whole pixels on a canvas without a scale', () => {
    for (let u = 0; u < 512; u += 7) {
      const x = farLayerAt(1, 40000 + u);
      expect(Number.isInteger(x)).toBe(true);
    }
  });
});
