/**
 * A frame of an experiment: RGBA bytes with what the findings draw on them (lines, arrows,
 * boxes, dots, labels in the game's bitmap fonts with a dark outline, the level's tiles), in
 * logical pixels. The same frames become the GIFs, the MP4s and the Lab's canvases.
 */
import type { Rgb } from '@parapet/runtime/render/color.ts';
import { parseColor } from '@parapet/runtime/render/color.ts';
import type { TilePainter } from '@parapet/runtime/render/PlaceholderTiles.ts';
import { blendPixel, blitImage, newImage, type RgbaImage } from '@parapet/runtime/render/Raster.ts';
import { drawRasterText, type RasterFont } from '@parapet/runtime/text/RasterText.ts';
import { RGB } from './palette.ts';

export interface TextStyle {
  align?: 'left' | 'center' | 'right';
  /** A one-pixel dark outline, for text over the scene. */
  outline?: boolean;
  tabular?: boolean;
  alpha?: number;
}

export class Frame {
  readonly img: RgbaImage;

  constructor(width: number, height: number) {
    this.img = newImage(width, height);
  }

  get width(): number {
    return this.img.width;
  }

  get height(): number {
    return this.img.height;
  }

  /** Every pixel `c`, opaque. */
  clear(c: Rgb): void {
    const d = this.img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  }

  dot(x: number, y: number, c: Rgb, alpha = 1): void {
    blendPixel(this.img, Math.round(x), Math.round(y), c[0], c[1], c[2], Math.round(255 * alpha));
  }

  fill(x: number, y: number, w: number, h: number, c: Rgb, alpha = 1): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.width, Math.round(x + w));
    const y1 = Math.min(this.height, Math.round(y + h));
    const a = Math.round(255 * alpha);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) blendPixel(this.img, xx, yy, c[0], c[1], c[2], a);
    }
  }

  /** A one-pixel frame just inside the rectangle. */
  box(x: number, y: number, w: number, h: number, c: Rgb, alpha = 1): void {
    this.fill(x, y, w, 1, c, alpha);
    this.fill(x, y + h - 1, w, 1, c, alpha);
    this.fill(x, y, 1, h, c, alpha);
    this.fill(x + w - 1, y, 1, h, c, alpha);
  }

  /** A line `width` pixels wide (Bresenham, every `dash` pixels on and off when given). */
  line(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    c: Rgb,
    opts: { width?: number; alpha?: number; dash?: number } = {},
  ): void {
    const width = opts.width ?? 1;
    const r = (width - 1) / 2;
    let x = Math.round(x0);
    let y = Math.round(y0);
    const tx = Math.round(x1);
    const ty = Math.round(y1);
    const dx = Math.abs(tx - x);
    const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; ; i++) {
      if (!opts.dash || Math.floor(i / opts.dash) % 2 === 0) {
        this.fill(x - Math.floor(r), y - Math.floor(r), width, width, c, opts.alpha ?? 1);
      }
      if (x === tx && y === ty) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** A line with a head at (x1, y1). */
  arrow(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    c: Rgb,
    opts: { width?: number; head?: number } = {},
  ): void {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 0.5) return;
    this.line(x0, y0, x1, y1, c, { width: opts.width ?? 1 });
    const head = Math.min(opts.head ?? 5, len);
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    for (const side of [-1, 1]) {
      const hx = x1 - ux * head + -uy * side * head * 0.6;
      const hy = y1 - uy * head + ux * side * head * 0.6;
      this.line(x1, y1, hx, hy, c, { width: opts.width ?? 1 });
    }
  }

  /** A filled disc. */
  disc(cx: number, cy: number, r: number, c: Rgb, alpha = 1): void {
    for (let y = Math.floor(-r); y <= Math.ceil(r); y++) {
      for (let x = Math.floor(-r); x <= Math.ceil(r); x++) {
        if (x * x + y * y <= r * r + 0.5) this.dot(cx + x, cy + y, c, alpha);
      }
    }
  }

  /** A circle's outline. */
  ring(cx: number, cy: number, r: number, c: Rgb, alpha = 1): void {
    const steps = Math.max(16, Math.ceil(r * 8));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      this.dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c, alpha);
    }
  }

  /** `text` (newlines start lines) with the top of its first line at y. */
  text(font: RasterFont, text: string, x: number, y: number, c: Rgb, style: TextStyle = {}): void {
    const opts = { align: style.align, tabular: style.tabular, alpha: style.alpha };
    if (style.outline) {
      for (const [dx, dy] of OUTLINE)
        drawRasterText(this.img, font, text, x + dx, y + dy, RGB.black, opts);
    }
    drawRasterText(this.img, font, text, x, y, c, opts);
  }

  /** A crop of `src` to (dx, dy). */
  blit(src: RgbaImage, sx: number, sy: number, w: number, h: number, dx: number, dy: number): void {
    blitImage(this.img, src, sx, sy, w, h, dx, dy);
  }

  /** A painter for the collision tiles (`PlaceholderTiles.ts`), shifted by (ox, oy). */
  tiles(ox = 0, oy = 0): TilePainter {
    const cache = new Map<string, Rgb>();
    const colour = (css: string): Rgb => {
      let c = cache.get(css);
      if (!c) {
        const p = parseColor(css) ?? [255, 0, 255, 255];
        c = [p[0], p[1], p[2]];
        cache.set(css, c);
      }
      return c;
    };
    return { fill: (x, y, w, h, css) => this.fill(x + ox, y + oy, w, h, colour(css)) };
  }
}

const OUTLINE: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];
