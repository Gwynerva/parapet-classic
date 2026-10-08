/**
 * Text on RGBA pictures with the game's bitmap fonts (`packages/content/fonts`), for the labels
 * of the tools' preview sheets.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blendPixel, type RgbaImage } from '@parapet/runtime/render/Raster.ts';
import { decodePng } from './png.ts';

interface Glyph {
  x: number;
  y: number;
  w: number;
  h: number;
  xOffset: number;
  yOffset: number;
  advance: number;
}

export interface BitmapText {
  lineHeight: number;
  glyphs: Record<string, Glyph>;
  image: { width: number; height: number; rgba: Uint8Array };
}

export function loadFont(fontsDir: string, name = 'text-12'): BitmapText {
  const json = JSON.parse(readFileSync(join(fontsDir, `${name}.json`), 'utf8')) as {
    lineHeight: number;
    glyphs: Record<string, Glyph>;
  };
  const image = decodePng(new Uint8Array(readFileSync(join(fontsDir, `${name}.png`))));
  return { lineHeight: json.lineHeight, glyphs: json.glyphs, image };
}

function glyphOf(font: BitmapText, ch: string): Glyph | undefined {
  return font.glyphs[String(ch.codePointAt(0))] ?? font.glyphs['63'];
}

export function textWidth(font: BitmapText, text: string): number {
  let w = 0;
  for (const ch of text) w += glyphOf(font, ch)?.advance ?? 0;
  return w;
}

/** Draws `text` with its top-left corner at (x, y) in `rgb` (the glyphs' alpha is the mask). */
export function drawText(
  dst: RgbaImage,
  font: BitmapText,
  text: string,
  x: number,
  y: number,
  rgb: readonly [number, number, number],
): void {
  let pen = x;
  const src = font.image;
  for (const ch of text) {
    const g = glyphOf(font, ch);
    if (!g) continue;
    for (let gy = 0; gy < g.h; gy++) {
      for (let gx = 0; gx < g.w; gx++) {
        const a = src.rgba[((g.y + gy) * src.width + g.x + gx) * 4 + 3]!;
        if (a === 0) continue;
        blendPixel(dst, pen + g.xOffset + gx, y + g.yOffset + gy, rgb[0], rgb[1], rgb[2], a);
      }
    }
    pen += g.advance;
  }
}
