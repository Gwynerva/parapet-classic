import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildFont, flattenContour, rasterizeGlyph, REQUIRED_CHARSET } from '../src/buildFont.ts';
import { readPngSize } from '../src/png.ts';
import { TrueTypeFont } from '../src/ttf.ts';

const FONTS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'content',
  'fonts',
  'src',
);
const TERMINUS = 'terminus/TerminusTTF-4.49.3.ttf';
const RUSSO = 'russo-one/RussoOne-Regular.ttf';

/** Cyrillic letters Russian needs (the rest of U+0400–045F is other Slavic languages). */
const RUSSIAN = [0x401, 0x451];
for (let c = 0x410; c <= 0x44f; c++) RUSSIAN.push(c);

function load(file: string): TrueTypeFont {
  return new TrueTypeFont(readFileSync(resolve(FONTS, file)), file);
}

function render(font: TrueTypeFont, ch: string, size: number): string[] {
  const g = rasterizeGlyph(font, ch.codePointAt(0) ?? 0, size);
  const rows: string[] = [];
  for (let y = 0; y < g.h; y++) {
    let row = '';
    for (let x = 0; x < g.w; x++) row += g.bitmap[y * g.w + x] ? '#' : '.';
    rows.push(row);
  }
  return rows;
}

describe('TrueType parser', () => {
  it('reads metrics and the Unicode cmap of Russo One', () => {
    const font = load(RUSSO);
    expect(font.unitsPerEm).toBeGreaterThan(0);
    expect(font.numGlyphs).toBeGreaterThan(200);
    expect(font.glyphIndex(0x41)).toBeGreaterThan(0); // A
    expect(font.glyphIndex(0x42f)).toBeGreaterThan(0); // Я
    expect(font.glyphIndex(0x451)).toBeGreaterThan(0); // ё
    expect(font.hasGlyph(0x1f600)).toBe(false);
    expect(font.glyphIndex(0x1f600)).toBe(0);
    expect(font.embeddedSizes()).toEqual([]);
  });

  it('covers Latin Basic, Latin-1 Supplement and Cyrillic in the text font', () => {
    const font = load(TERMINUS);
    expect(REQUIRED_CHARSET.filter((c) => !font.hasGlyph(c))).toEqual([]);
  });

  it('covers every letter Russian needs in the display font', () => {
    const font = load(RUSSO);
    expect(RUSSIAN.filter((c) => !font.hasGlyph(c))).toEqual([]);
  });

  it('decodes simple and composite glyph outlines', () => {
    const font = load(RUSSO);
    const o = font.glyph(font.glyphIndex(0x4f)); // O: two contours
    expect(o.contours.length).toBe(2);
    expect(o.advance).toBeGreaterThan(0);
    const eWithDiaeresis = font.glyph(font.glyphIndex(0x451)); // ё (usually a composite)
    expect(eWithDiaeresis.contours.length).toBeGreaterThanOrEqual(3);
  });

  it('lists the embedded bitmap strikes of Terminus and reads their glyphs', () => {
    const font = load(TERMINUS);
    expect(font.embeddedSizes()).toContain(12);
    expect(font.embeddedSizes()).toContain(16);
    expect(font.strikeMetrics(16)).toEqual({ ppem: 16, ascender: 12, descender: -4 });
    expect(font.strikeMetrics(13)).toBeNull();
    const h = font.embeddedBitmap(16, font.glyphIndex(0x48));
    expect(h).not.toBeNull();
    expect(h?.advance).toBe(8);
    expect(h?.h).toBeGreaterThan(0);
    expect(h?.bitmap.length).toBe((h?.w ?? 0) * (h?.h ?? 0));
    // A space has no lit pixels (constant-size strikes still store a blank image for it).
    const space = font.embeddedBitmap(16, font.glyphIndex(0x20));
    expect(space === null || !space.bitmap.some((bit) => bit === 1)).toBe(true);
    expect(rasterizeGlyph(font, 0x20, 16)).toMatchObject({ w: 0, h: 0, advance: 8 });
  });
});

describe('rasteriser', () => {
  it('flattens a square contour into its four corners', () => {
    const square = [
      { x: 0, y: 0, onCurve: true },
      { x: 100, y: 0, onCurve: true },
      { x: 100, y: 100, onCurve: true },
      { x: 0, y: 100, onCurve: true },
    ];
    expect(flattenContour(square, 0.1)).toEqual([
      [0, -0],
      [10, -0],
      [10, -10],
      [0, -10],
    ]);
  });

  it('subdivides quadratic segments and closes all-off-curve contours', () => {
    const circleish = [
      { x: 0, y: 100, onCurve: false },
      { x: 100, y: 100, onCurve: false },
      { x: 100, y: 0, onCurve: false },
      { x: 0, y: 0, onCurve: false },
    ];
    const pts = flattenContour(circleish, 0.1);
    expect(pts.length).toBeGreaterThan(8);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(10);
      expect(-y).toBeGreaterThanOrEqual(0);
      expect(-y).toBeLessThanOrEqual(10);
    }
  });

  it('copies the Terminus bitmap at a strike size, so there are no partial pixels', () => {
    const font = load(TERMINUS);
    const g = rasterizeGlyph(font, 0x48, 16); // H
    expect(g.partialPixels).toBe(0);
    expect(g.advance).toBe(8);
    const rows = render(font, 'H', 16);
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) {
      expect(row.startsWith('#')).toBe(true);
      expect(row.endsWith('#')).toBe(true);
    }
    expect(rows.some((row) => !row.includes('.'))).toBe(true); // the crossbar
  });

  it('rasterises outlines when asked to, with the nonzero winding rule', () => {
    const font = load(TERMINUS);
    const outline = rasterizeGlyph(font, 0x4f, 16, 'outline'); // O
    expect(outline.w).toBeGreaterThan(0);
    const bitmap = rasterizeGlyph(font, 0x4f, 16);
    expect(bitmap.w).toBeGreaterThan(0);
    const rows = render(font, 'O', 16);
    const middle = rows[Math.floor(rows.length / 2)] ?? '';
    expect(middle.includes('.')).toBe(true);
    expect(middle.startsWith('#') && middle.endsWith('#')).toBe(true);
  });

  it('renders Russo One outlines at 16 px', () => {
    const rows = render(load(RUSSO), 'I', 16);
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.every((row) => row.includes('#'))).toBe(true);
  });

  it('builds an atlas and a glyph table with line metrics', () => {
    const font = load(RUSSO);
    const built = buildFont(font, {
      name: 'test',
      size: 16,
      charset: [0x20, 0x41, 0x42, 0x3f, 0x416],
    });
    expect(built.source).toBe('outline');
    expect(readPngSize(built.png)).toEqual({ width: built.width, height: built.height });
    expect(built.missing).toEqual([]);
    expect(built.data.fallback).toBe(0x3f);
    expect(built.data.lineHeight).toBeGreaterThan(16 * 0.9);
    expect(built.data.baseline).toBeGreaterThan(0);
    const space = built.data.glyphs['32'];
    expect(space).toMatchObject({ w: 0, h: 0 });
    expect(space?.advance).toBeGreaterThan(0);
    const a = built.data.glyphs['65'];
    expect(a).toBeDefined();
    expect(a?.w).toBeGreaterThan(0);
    expect(a?.x).toBeGreaterThanOrEqual(1);
    expect((a?.x ?? 0) + (a?.w ?? 0)).toBeLessThan(built.width);
    expect(a?.yOffset).toBeGreaterThanOrEqual(0);
    expect((a?.yOffset ?? 0) + (a?.h ?? 0)).toBeLessThanOrEqual(built.data.baseline + 1);
    expect(built.data.glyphs['1046']).toBeDefined(); // Ж
  });

  it('uses the strike line metrics for a bitmap font', () => {
    const built = buildFont(load(TERMINUS), { name: 'test', size: 12, charset: [0x41, 0x67] });
    expect(built.source).toBe('bitmap');
    expect(built.partialPixels).toBe(0);
    expect(built.data.lineHeight).toBe(12);
    expect(built.data.baseline).toBe(10);
    const g = built.data.glyphs['103']; // g has a descender
    expect((g?.yOffset ?? 0) + (g?.h ?? 0)).toBeGreaterThan(10);
  });

  it('keeps a blank column after the ink of every outline glyph', () => {
    // Russo One sets the advance of "1" inside its ink at 16 px; without the rule "1:" fuses.
    const built = buildFont(load(RUSSO), { name: 'test', size: 16 });
    for (const [code, g] of Object.entries(built.data.glyphs)) {
      if (g.w === 0) continue;
      expect(g.xOffset, `U+${Number(code).toString(16)}`).toBeGreaterThanOrEqual(0);
      expect(g.xOffset + g.w, `U+${Number(code).toString(16)}`).toBeLessThan(g.advance);
    }
    const one = rasterizeGlyph(load(RUSSO), 0x31, 16);
    expect(one.advance).toBe(one.left + one.w + 1);
  });
});
