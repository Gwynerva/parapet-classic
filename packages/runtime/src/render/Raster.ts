/**
 * Drawing into RGBA bytes without a canvas, for the tools, the tests and the Lab: sprites
 * blitted with the original's transforms exactly like `SpriteSheet.drawSprite`, composed poses
 * (`Pose.ts`) drawn like `SceneRenderer.drawObject` (whole scenes: `SceneRaster.ts`), crops,
 * layers and tinted sheets. Alpha is composited source-over.
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

/**
 * Paints pixel art written as text into `dst` with its top-left at (x, y): each character is a
 * pixel of `colourOf(character)`, written as it is (no blending); null leaves the pixel alone.
 */
export function paintRows(
  dst: RgbaImage,
  rows: readonly (readonly string[])[],
  colourOf: (ch: string) => readonly number[] | null | undefined,
  x = 0,
  y = 0,
): void {
  for (let ry = 0; ry < rows.length; ry++) {
    const row = rows[ry]!;
    for (let rx = 0; rx < row.length; rx++) {
      const c = colourOf(row[rx]!);
      if (c) dst.data.set(c, ((y + ry) * dst.width + x + rx) * 4);
    }
  }
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

/** The part of the target pixels may land on: `x0 <= x < x1`, `y0 <= y < y1`. */
export interface ClipRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Draws sprite `id` of `sheet` with its top-left corner (after the transform) at (x, y), like
 * `SpriteSheet.drawSprite` with a top-left anchor. `alpha` scales its opacity; nothing lands
 * outside `clip`.
 */
export function blitSprite(
  dst: RgbaImage,
  sheet: RgbaSheet,
  id: number,
  x: number,
  y: number,
  transform = 0,
  alpha = 1,
  clip?: ClipRect,
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
      const px = (x | 0) + dx;
      const py = (y | 0) + dy;
      if (clip && (px < clip.x0 || py < clip.y0 || px >= clip.x1 || py >= clip.y1)) continue;
      blendPixel(
        dst,
        px,
        py,
        src.data[o]!,
        src.data[o + 1]!,
        src.data[o + 2]!,
        Math.round(a * alpha),
      );
    }
  }
}

/**
 * Copies the `w × h` window of `src` at (sx, sy) to (dx, dy) of `dst`, source-over (opaque
 * pixels are written as they are): a crop of a big picture, such as a level's art.
 */
export function blitImage(
  dst: RgbaImage,
  src: RgbaImage,
  sx: number,
  sy: number,
  w: number,
  h: number,
  dx: number,
  dy: number,
): void {
  for (let y = 0; y < h; y++) {
    const ty = dy + y;
    const fy = sy + y;
    if (ty < 0 || ty >= dst.height || fy < 0 || fy >= src.height) continue;
    for (let x = 0; x < w; x++) {
      const tx = dx + x;
      const fx = sx + x;
      if (tx < 0 || tx >= dst.width || fx < 0 || fx >= src.width) continue;
      const o = (fy * src.width + fx) * 4;
      const a = src.data[o + 3]!;
      if (a === 0) continue;
      blendPixel(dst, tx, ty, src.data[o]!, src.data[o + 1]!, src.data[o + 2]!, a);
    }
  }
}

/**
 * Lays `layer` (the size of `dst`) over `dst` at `alpha`: a see-through runner drawn whole
 * first, so its limbs do not show through one another.
 */
export function compositeLayer(dst: RgbaImage, layer: RgbaImage, alpha: number): void {
  const n = Math.min(dst.width * dst.height, layer.width * layer.height);
  const w = dst.width;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = layer.data[o + 3]!;
    if (a === 0) continue;
    blendPixel(
      dst,
      i % w,
      Math.floor(i / w),
      layer.data[o]!,
      layer.data[o + 1]!,
      layer.data[o + 2]!,
      Math.round(a * alpha),
    );
  }
}

/** A copy of `sheet` whose sprites `recolor(id)` returns a colour for are painted flat in it. */
export function tintSheet(
  sheet: RgbaSheet,
  recolor: (id: number) => readonly [number, number, number] | null,
): RgbaSheet {
  const data = new Uint8ClampedArray(sheet.image.data);
  const width = sheet.image.width;
  sheet.frames.forEach((f, id) => {
    const rgb = f ? recolor(id) : null;
    if (!f || !rgb) return;
    for (let y = f.y; y < f.y + f.h; y++) {
      for (let x = f.x; x < f.x + f.w; x++) {
        const o = (y * width + x) * 4;
        if (data[o + 3]! < 128) continue;
        data[o] = rgb[0];
        data[o + 1] = rgb[1];
        data[o + 2] = rgb[2];
      }
    }
  });
  return {
    image: { width, height: sheet.image.height, data },
    frames: sheet.frames,
    fallback: sheet.fallback ?? null,
  };
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
