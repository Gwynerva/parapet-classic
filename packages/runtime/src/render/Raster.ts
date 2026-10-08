/**
 * Drawing into RGBA bytes without a canvas, for the tools and the tests: sprites blitted with
 * the original's transforms exactly like `SpriteSheet.drawSprite`, and composed poses
 * (`Pose.ts`) drawn like `SceneRenderer.drawObject`. Alpha is composited source-over.
 */
import type { AtlasFrame } from '../content/types.ts';
import { CMD_RECT, CMD_SPRITE, type DrawCommand } from './Pose.ts';
import { isRotated, transformPixel } from './SpriteSheet.ts';

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/** An atlas as bytes: its frames, and the sheet asked for the frames it lacks. */
export interface RgbaSheet {
  image: RgbaImage;
  frames: readonly (AtlasFrame | undefined)[];
  fallback?: RgbaSheet | null;
}

export function newImage(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/** The sheet holding sprite `id` and its frame, following the fallbacks. */
export function sheetFrame(
  sheet: RgbaSheet,
  id: number,
): { sheet: RgbaSheet; frame: AtlasFrame } | null {
  for (let s: RgbaSheet | null | undefined = sheet; s; s = s.fallback) {
    const f = s.frames[id];
    if (f) return { sheet: s, frame: f };
  }
  return null;
}

/** Composites one pixel source-over (`rgba` straight alpha) at (x, y); outside is ignored. */
export function blendPixel(
  dst: RgbaImage,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  if (a <= 0 || x < 0 || y < 0 || x >= dst.width || y >= dst.height) return;
  const o = (y * dst.width + x) * 4;
  const d = dst.data;
  if (a >= 255) {
    d[o] = r;
    d[o + 1] = g;
    d[o + 2] = b;
    d[o + 3] = 255;
    return;
  }
  const sa = a / 255;
  const da = d[o + 3]! / 255;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  d[o] = Math.round((r * sa + d[o]! * da * (1 - sa)) / oa);
  d[o + 1] = Math.round((g * sa + d[o + 1]! * da * (1 - sa)) / oa);
  d[o + 2] = Math.round((b * sa + d[o + 2]! * da * (1 - sa)) / oa);
  d[o + 3] = Math.round(oa * 255);
}

/**
 * Draws sprite `id` of `sheet` with its top-left corner (after the transform) at (x, y), like
 * `SpriteSheet.drawSprite` with a top-left anchor. `alpha` scales its opacity.
 */
export function blitSprite(
  dst: RgbaImage,
  sheet: RgbaSheet,
  id: number,
  x: number,
  y: number,
  transform = 0,
  alpha = 1,
): void {
  const found = sheetFrame(sheet, id);
  if (!found) return;
  const f = found.frame;
  const src = found.sheet.image;
  const w = isRotated(transform) ? f.h : f.w;
  const h = isRotated(transform) ? f.w : f.h;
  for (let sy = 0; sy < f.h; sy++) {
    for (let sx = 0; sx < f.w; sx++) {
      const o = ((f.y + sy) * src.width + f.x + sx) * 4;
      const a = src.data[o + 3]!;
      if (a === 0) continue;
      const [dx, dy] = transformPixel(transform, sx, sy, w, h);
      blendPixel(
        dst,
        (x | 0) + dx,
        (y | 0) + dy,
        src.data[o]!,
        src.data[o + 1]!,
        src.data[o + 2]!,
        Math.round(a * alpha),
      );
    }
  }
}

/**
 * Draws composed commands whose object box has its top-left corner at (ox, oy): sprites centred
 * on their point like `drawObject`, rectangles filled. Nested objects and tiles are skipped
 * (they only occur in level art).
 */
export function rasterCommands(
  dst: RgbaImage,
  sheet: RgbaSheet,
  cmds: readonly DrawCommand[],
  count: number,
  ox: number,
  oy: number,
  alpha = 1,
): void {
  for (let i = 0; i < count; i++) {
    const c = cmds[i]!;
    if (c.kind === CMD_SPRITE) {
      const found = sheetFrame(sheet, c.id);
      if (!found) continue;
      const w = isRotated(c.transform) ? found.frame.h : found.frame.w;
      const h = isRotated(c.transform) ? found.frame.w : found.frame.h;
      const x = ((c.x + ox) | 0) - (w >> 1);
      const y = ((c.y + oy) | 0) - (h >> 1);
      blitSprite(dst, sheet, c.id, x, y, c.transform, alpha);
    } else if (c.kind === CMD_RECT) {
      const r = (c.rgb >> 16) & 0xff;
      const g = (c.rgb >> 8) & 0xff;
      const b = c.rgb & 0xff;
      for (let y = 0; y < c.h; y++) {
        for (let x = 0; x < c.w; x++) {
          blendPixel(dst, c.x + ox + x, c.y + oy + y, r, g, b, Math.round(255 * alpha));
        }
      }
    }
  }
}

/** Fills a rectangle with one colour (source-over). */
export function fillRect(
  dst: RgbaImage,
  x: number,
  y: number,
  w: number,
  h: number,
  rgba: readonly [number, number, number, number],
): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) blendPixel(dst, xx, yy, rgba[0], rgba[1], rgba[2], rgba[3]);
  }
}

/** Copies `src` into `dst` at (x, y), magnified `scale` times (nearest neighbour). */
export function drawImageScaled(
  dst: RgbaImage,
  src: RgbaImage,
  x: number,
  y: number,
  scale = 1,
): void {
  for (let sy = 0; sy < src.height; sy++) {
    for (let sx = 0; sx < src.width; sx++) {
      const o = (sy * src.width + sx) * 4;
      const a = src.data[o + 3]!;
      if (a === 0) continue;
      for (let k = 0; k < scale * scale; k++) {
        blendPixel(
          dst,
          x + sx * scale + (k % scale),
          y + sy * scale + Math.floor(k / scale),
          src.data[o]!,
          src.data[o + 1]!,
          src.data[o + 2]!,
          a,
        );
      }
    }
  }
}

/** A copy of `src` mirrored left to right. */
export function mirrorImage(src: RgbaImage): RgbaImage {
  const out = newImage(src.width, src.height);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const a = (y * src.width + x) * 4;
      const b = (y * src.width + (src.width - 1 - x)) * 4;
      for (let k = 0; k < 4; k++) out.data[b + k] = src.data[a + k]!;
    }
  }
  return out;
}
