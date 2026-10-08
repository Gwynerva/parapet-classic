import { BitmapFont, type AtlasImage, type BitmapFontData } from '../../src/text/BitmapFont.ts';

/** A fixed-width font without an image: every printable ASCII glyph advances 6 px. */
export function testFont(lineHeight = 10): BitmapFont {
  const glyphs: BitmapFontData['glyphs'] = {};
  for (let c = 0x20; c < 0x7f; c++)
    glyphs[c] = { x: 0, y: 0, w: 5, h: 8, xOffset: 0, yOffset: 0, advance: 6 };
  const data: BitmapFontData = {
    name: 't',
    size: 8,
    lineHeight,
    baseline: 8,
    glyphs,
    fallback: 0x3f,
  };
  return new BitmapFont(data, { width: 8, height: 8 } as unknown as AtlasImage);
}
