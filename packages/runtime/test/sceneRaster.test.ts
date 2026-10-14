import { describe, expect, it } from 'vitest';
import type { CharacterPose } from '../src/render/CharacterRenderer.ts';
import { drawPlaceholderTiles, type TilePainter } from '../src/render/PlaceholderTiles.ts';
import { newImage, type RgbaImage, type RgbaSheet } from '../src/render/Raster.ts';
import { identitySwap } from '../src/render/Rig.ts';
import {
  paintPose,
  poseBounds,
  rasterPainter,
  rasterPose,
  sizedSheet,
} from '../src/render/SceneRaster.ts';
import { CHARACTER_OBJECT, SceneRenderer, type ScenePainter } from '../src/render/SceneRenderer.ts';
import { parseDemoLevel } from '../src/moves/demoLevel.ts';
import { drawRasterText } from '../src/text/RasterText.ts';
import { hasContent, loadScenes } from './helpers/content.ts';
import { testFont } from './helpers/font.ts';

/** A sheet whose every sprite is an opaque block of its size. */
function blockSheet(frames: ReturnType<typeof loadScenes>['frames']): RgbaSheet {
  const w = Math.max(...frames.map((f) => (f ? f.x + f.w : 0)));
  const h = Math.max(...frames.map((f) => (f ? f.y + f.h : 0)));
  const image = newImage(w, h);
  image.data.fill(255);
  return { image, frames };
}

const opaque = (img: RgbaImage): [number, number][] => {
  const out: [number, number][] = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++)
      if (img.data[(y * img.width + x) * 4 + 3]! > 0) out.push([x, y]);
  }
  return out;
};

describe.runIf(hasContent())('the runner drawn into bytes', () => {
  const { scenes, frames } = loadScenes();
  const scene = new SceneRenderer(sizedSheet(frames), scenes);
  const sheet = blockSheet(frames);
  const cam = { x: 0, y: 0 };

  it.each([0, 57, 200, 462])('stays inside its bounds (keyframe %i)', (k) => {
    for (const flipX of [false, true]) {
      const pose: CharacterPose = {
        x: 100 << 5,
        y: 120 << 5,
        a: k,
        b: k,
        t: 0,
        flipX,
        anchored: false,
      };
      const img = newImage(220, 200);
      rasterPose(img, sheet, scene, pose, cam, identitySwap);
      const box = poseBounds(sheet, scene, pose, cam, identitySwap)!;
      const pixels = opaque(img);
      expect(pixels.length).toBeGreaterThan(0);
      for (const [x, y] of pixels) {
        expect(x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1, `${x},${y}`).toBe(true);
      }
    }
  });

  it('paints the sprites the pose is composed of', () => {
    const pose: CharacterPose = {
      x: 100 << 5,
      y: 120 << 5,
      a: 10,
      b: 11,
      t: 30000,
      flipX: false,
      anchored: false,
    };
    const ids: number[] = [];
    const painter: ScenePainter = {
      sprite: (id) => void ids.push(id),
      rect: () => {},
      clip: () => {},
      unclip: () => {},
    };
    paintPose(painter, scene, pose, cam, identitySwap, 220, 200);
    const composed = scene.compose(CHARACTER_OBJECT, 10, 11, 30000)!;
    const expected = composed.cmds
      .slice(0, composed.count)
      .filter((c) => c.id >= 0)
      .map((c) => c.id);
    expect(ids).toEqual(expected);
  });

  it('is culled with the view but not by poseBounds', () => {
    const pose: CharacterPose = {
      x: -400 << 5,
      y: 120 << 5,
      a: 0,
      b: 0,
      t: 0,
      flipX: false,
      anchored: false,
    };
    const img = newImage(100, 100);
    rasterPose(img, sheet, scene, pose, cam, identitySwap);
    expect(opaque(img)).toEqual([]);
    expect(poseBounds(sheet, scene, pose, cam, identitySwap)!.x1).toBeLessThan(0);
  });
});

describe('a raster painter', () => {
  const frames = [{ x: 0, y: 0, w: 8, h: 8 }];
  const image = newImage(8, 8);
  image.data.fill(255);
  const sheet: RgbaSheet = { image, frames };

  it('keeps sprites inside a clip', () => {
    const img = newImage(16, 16);
    const p = rasterPainter(img, sheet);
    p.clip(4, 4, 3, 2);
    p.sprite(0, 8, 8, 0, 3);
    p.unclip();
    expect(opaque(img)).toEqual([
      [4, 4],
      [5, 4],
      [6, 4],
      [4, 5],
      [5, 5],
      [6, 5],
    ]);
  });

  it('fills rectangles in the original’s 24-bit colours, at its alpha', () => {
    const img = newImage(4, 4);
    rasterPainter(img, sheet, 0.5).rect(1, 1, 2, 1, 0x336699);
    expect([...img.data.subarray((1 * 4 + 1) * 4, (1 * 4 + 1) * 4 + 4)]).toEqual([
      0x33, 0x66, 0x99, 128,
    ]);
    expect(opaque(img)).toEqual([
      [1, 1],
      [2, 1],
    ]);
  });
});

describe('the demo levels’ tiles', () => {
  it('are painted where the view sees them, a 32-pixel cell each', () => {
    const level = parseDemoLevel(['.S..', '..#.', '====']);
    const fills: [number, number, number, number][] = [];
    const p: TilePainter = { fill: (x, y, w, h) => void fills.push([x, y, w, h]) };
    drawPlaceholderTiles(p, level, 16, 0, 64, 96);
    expect(fills.length).toBeGreaterThan(0);
    for (const [x, y, w, h] of fills) {
      expect(x + w > 0 && x < 64 + 32 && y >= 0 && y + h <= 96).toBe(true);
    }
    // The block at (2, 1) is drawn at (2·32 − 16, 32).
    expect(fills.some(([x, y]) => x === 48 && y === 32)).toBe(true);
  });
});

describe('text drawn into bytes', () => {
  it('puts glyphs where the font lays them out', () => {
    const font = testFont();
    const atlas = newImage(8, 8);
    // Every glyph is the atlas' top-left 5 × 8, opaque in its first column only.
    for (let y = 0; y < 8; y++) atlas.data[y * 8 * 4 + 3] = 255;
    const img = newImage(40, 12);
    drawRasterText(img, { font, atlas }, 'AB', 2, 1, [255, 0, 0]);
    const xs = new Set(opaque(img).map(([x]) => x));
    expect([...xs].sort((a, b) => a - b)).toEqual([2, 8]);
    expect([...img.data.subarray((1 * 40 + 2) * 4, (1 * 40 + 2) * 4 + 3)]).toEqual([255, 0, 0]);
  });
});
