/** Metrics of the bitmap font renderer that do not need a canvas: measurement and tabular digits. */
import { describe, expect, it } from 'vitest';
import { BitmapFont, type AtlasImage, type BitmapFontData } from '../src/text/BitmapFont.ts';

function glyph(w: number, advance: number) {
  return { x: 0, y: 0, w, h: 8, xOffset: 0, yOffset: 0, advance };
}

const DATA: BitmapFontData = {
  name: 'test',
  size: 8,
  lineHeight: 10,
  baseline: 8,
  fallback: 0x3f,
  glyphs: {
    [0x20]: glyph(0, 4),
    [0x3f]: glyph(5, 6),
    [0x30]: glyph(7, 9),
    [0x31]: glyph(3, 4),
    [0x32]: glyph(6, 7),
    [0x3a]: glyph(2, 3),
    [0x41]: glyph(7, 8),
  },
};

const image = { width: 16, height: 16 } as unknown as AtlasImage;

describe('BitmapFont metrics', () => {
  const font = new BitmapFont(DATA, image);

  it('takes the widest digit as the tabular cell', () => {
    expect(font.digitAdvance).toBe(9);
  });

  it('measures proportional text by the glyph advances', () => {
    expect(font.lineWidth('1:0')).toBe(4 + 3 + 9);
    expect(font.measure('A 1\n0:12')).toBe(Math.max(8 + 4 + 4, 9 + 3 + 4 + 7));
  });

  it('gives every digit the same width in tabular mode, other glyphs unchanged', () => {
    expect(font.lineWidth('1:0', true)).toBe(9 + 3 + 9);
    expect(font.lineWidth('12', true)).toBe(18);
    expect(font.lineWidth('A1', true)).toBe(8 + 9);
    expect(font.measure('1\n0', 2, true)).toBe(18);
  });

  it('falls back to the fallback glyph for unknown characters', () => {
    expect(font.lineWidth('☃')).toBe(6);
    expect(font.has(0x2603)).toBe(false);
  });
});
