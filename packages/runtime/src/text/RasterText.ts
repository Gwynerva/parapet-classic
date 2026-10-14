/**
 * Text in the game's bitmap fonts drawn into RGBA bytes (the findings generator in Node, the
 * Lab): the glyphs go where `BitmapFont.draw` puts them on a canvas, their alpha as the mask of
 * one colour.
 */
import type { RgbaImage } from '../render/Raster.ts';
import { blendPixel } from '../render/Raster.ts';
import type { BitmapFont, DrawTextOptions } from './BitmapFont.ts';

export interface RasterFont {
  /** The font's glyphs and metrics (its canvas atlas is not needed). */
  font: BitmapFont;
  /** The font's atlas: white glyphs on transparency. */
  atlas: RgbaImage;
}

/**
 * Draws `text` with the top of its first line box at `y` (`x` its left edge, centre or right
 * edge by `opts.align`) in `rgb`, at `alpha` of the glyphs' opacity.
 */
export function drawRasterText(
  dst: RgbaImage,
  f: RasterFont,
  text: string,
  x: number,
  y: number,
  rgb: readonly [number, number, number],
  opts: Omit<DrawTextOptions, 'color'> & { alpha?: number } = {},
): void {
  const alpha = opts.alpha ?? 1;
  const src = f.atlas;
  f.font.layout(text, x, y, opts, (g, gx, gy, scale) => {
    for (let sy = 0; sy < g.h; sy++) {
      for (let sx = 0; sx < g.w; sx++) {
        const a = src.data[((g.y + sy) * src.width + g.x + sx) * 4 + 3]!;
        if (a === 0) continue;
        for (let k = 0; k < scale * scale; k++) {
          blendPixel(
            dst,
            gx + sx * scale + (k % scale),
            gy + sy * scale + Math.floor(k / scale),
            rgb[0],
            rgb[1],
            rgb[2],
            Math.round(a * alpha),
          );
        }
      }
    }
  });
}
