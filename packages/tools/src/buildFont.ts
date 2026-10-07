/**
 * Bitmap font rasteriser: renders TrueType glyphs at a fixed pixel size without anti-aliasing
 * (every pixel is sampled 4×4 times and lit when at least half of the samples fall inside the
 * outline, nonzero winding), then packs them into a PNG atlas with a JSON description:
 *
 *   { name, size, lineHeight, baseline, glyphs: { [codePoint]: { x, y, w, h, xOffset, yOffset,
 *     advance } }, fallback }
 *
 * Positions are in atlas pixels; `xOffset` is added to the pen x, `yOffset` to the top of the
 * line box; `baseline` is the baseline's distance from the top of the line box.
 */
import { packAtlas, type AtlasItem } from './packAtlas.ts';
import { encodePng } from './png.ts';
import type { TrueTypeFont, TtfPoint } from './ttf.ts';

export interface FontGlyphMetrics {
  x: number;
  y: number;
  w: number;
  h: number;
  xOffset: number;
  yOffset: number;
  advance: number;
}

export interface BitmapFontData {
  name: string;
  size: number;
  lineHeight: number;
  baseline: number;
  glyphs: Record<string, FontGlyphMetrics>;
  /** Code point drawn for characters the font lacks ('?'). */
  fallback: number;
}

export interface RasterGlyph {
  codePoint: number;
  w: number;
  h: number;
  /** Bitmap left edge relative to the pen position. */
  left: number;
  /** Bitmap top edge relative to the baseline (negative above it). */
  top: number;
  advance: number;
  /** `w × h` bytes, 1 = lit. */
  bitmap: Uint8Array;
  /** Pixels whose 4×4 sample coverage was neither 0 nor 16 (0 for a pixel-aligned outline). */
  partialPixels: number;
  /** Untrimmed bitmap area, the denominator of the crispness statistic. */
  sampled: number;
}

/**
 * 'auto' copies the font's embedded bitmap strike when it has one at the requested size (the
 * authoritative pixel design of fonts like Terminus) and rasterises outlines otherwise;
 * 'outline' always rasterises the outlines.
 */
export type GlyphSource = 'auto' | 'outline';

export interface BuildFontOptions {
  name: string;
  size: number;
  /** Code points to include; defaults to `DEFAULT_CHARSET`. */
  charset?: readonly number[];
  fallback?: number;
  source?: GlyphSource;
}

export interface BuiltFont {
  data: BitmapFontData;
  png: Uint8Array;
  width: number;
  height: number;
  /** Where the pixels came from (see `GlyphSource`). */
  source: 'bitmap' | 'outline';
  /** Requested code points the font has no glyph for. */
  missing: number[];
  /** Total partially covered pixels over all glyphs (0 means the outlines sit on the grid). */
  partialPixels: number;
  glyphPixels: number;
}

const SUBSAMPLES = 4;
const LIT_THRESHOLD = (SUBSAMPLES * SUBSAMPLES) / 2;

export const FALLBACK_CODE_POINT = 0x3f; // '?'

/** Latin Basic, Latin-1 Supplement, Cyrillic U+0400–045F plus common punctuation and symbols. */
export const DEFAULT_CHARSET: readonly number[] = (() => {
  const out: number[] = [];
  const range = (from: number, to: number): void => {
    for (let c = from; c <= to; c++) out.push(c);
  };
  range(0x20, 0x7e);
  range(0xa0, 0xff);
  range(0x400, 0x45f);
  out.push(
    0x2013, // en dash
    0x2014, // em dash
    0x2018, // left single quote
    0x2019, // right single quote / apostrophe
    0x201c, // left double quote
    0x201d, // right double quote
    0x201e, // low double quote (ru)
    0x2026, // ellipsis
    0x2116, // numero sign (ru)
    0x20ac, // euro
    0x2190, // arrows
    0x2191,
    0x2192,
    0x2193,
  );
  return out;
})();

/**
 * Required coverage: Latin Basic, Latin-1 Supplement and Cyrillic U+0400–045F except the four
 * letters with a grave accent (Ѐ Ѝ ѐ ѝ, Bulgarian/Macedonian only). Everything else is optional.
 */
export const REQUIRED_CHARSET: readonly number[] = DEFAULT_CHARSET.filter(
  (c) =>
    c <= 0xff ||
    (c >= 0x400 && c <= 0x45f && c !== 0x400 && c !== 0x40d && c !== 0x450 && c !== 0x45d),
);

/**
 * Converts a TrueType contour (on/off-curve points) into a closed polyline in pixel space.
 * Quadratic segments are flattened into a few straight pieces depending on their size.
 */
export function flattenContour(contour: readonly TtfPoint[], scale: number): [number, number][] {
  const src = contour.map((p) => ({ x: p.x * scale, y: -p.y * scale, onCurve: p.onCurve }));
  const n = src.length;
  if (n === 0) return [];
  // Rotate the contour so it starts on-curve; an all-off-curve contour gets a synthetic
  // on-curve start at the midpoint of its last and first points.
  const startIndex = src.findIndex((p) => p.onCurve);
  let pts: { x: number; y: number; onCurve: boolean }[];
  if (startIndex < 0) {
    const a = src[n - 1];
    const b = src[0];
    if (!a || !b) return [];
    pts = [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, onCurve: true }, ...src];
  } else {
    pts = [...src.slice(startIndex), ...src.slice(0, startIndex)];
  }
  const start = pts[0];
  if (!start) return [];
  const out: [number, number][] = [[start.x, start.y]];
  let prev: { x: number; y: number } = start;
  let control: { x: number; y: number } | null = null;
  const emitQuad = (c: { x: number; y: number }, to: { x: number; y: number }): void => {
    const len = Math.hypot(c.x - prev.x, c.y - prev.y) + Math.hypot(to.x - c.x, to.y - c.y);
    const steps = Math.min(24, Math.max(3, Math.ceil(len * 1.5)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      out.push([
        mt * mt * prev.x + 2 * mt * t * c.x + t * t * to.x,
        mt * mt * prev.y + 2 * mt * t * c.y + t * t * to.y,
      ]);
    }
    prev = to;
  };
  // Walk every point and finally back to the (on-curve) start, which closes the contour.
  for (let k = 1; k <= pts.length; k++) {
    const p = pts[k % pts.length] ?? start;
    if (p.onCurve) {
      if (control) emitQuad(control, p);
      else {
        out.push([p.x, p.y]);
        prev = p;
      }
      control = null;
    } else if (control) {
      emitQuad(control, { x: (control.x + p.x) / 2, y: (control.y + p.y) / 2 });
      control = p;
    } else {
      control = p;
    }
  }
  // The walk ends back on the start point; the polyline is implicitly closed, so drop it.
  const last = out[out.length - 1];
  if (out.length > 1 && last && last[0] === start.x && last[1] === start.y) out.pop();
  return out;
}

/** Rasterises one glyph at `size` pixels per em (or copies its embedded bitmap, see `GlyphSource`). */
export function rasterizeGlyph(
  font: TrueTypeFont,
  codePoint: number,
  size: number,
  source: GlyphSource = 'auto',
): RasterGlyph {
  const scale = size / font.unitsPerEm;
  const glyphIndex = font.glyphIndex(codePoint);
  if (source === 'auto') {
    const embedded = font.embeddedBitmap(size, glyphIndex);
    if (embedded) {
      return trimGlyph({
        codePoint,
        ...embedded,
        partialPixels: 0,
        sampled: embedded.w * embedded.h,
      });
    }
  }
  const glyph = font.glyph(glyphIndex);
  const advance = Math.round(glyph.advance * scale);
  const polylines = glyph.contours.map((c) => flattenContour(c, scale)).filter((c) => c.length > 1);
  if (polylines.length === 0) {
    return {
      codePoint,
      w: 0,
      h: 0,
      left: 0,
      top: 0,
      advance,
      bitmap: new Uint8Array(0),
      partialPixels: 0,
      sampled: 0,
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const line of polylines) {
    for (const [x, y] of line) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const EPS = 1e-6;
  const left = Math.floor(minX + EPS);
  const top = Math.floor(minY + EPS);
  const right = Math.ceil(maxX - EPS);
  const bottom = Math.ceil(maxY - EPS);
  const w = Math.max(0, right - left);
  const h = Math.max(0, bottom - top);
  const coverage = new Uint8Array(w * h);

  // Edge list (x0, y0, x1, y1) with y0 !== y1.
  const edges: number[] = [];
  for (const line of polylines) {
    for (let i = 0; i < line.length; i++) {
      const a = line[i];
      const b = line[(i + 1) % line.length];
      if (!a || !b || a[1] === b[1]) continue;
      edges.push(a[0], a[1], b[0], b[1]);
    }
  }

  const crossings: { x: number; dir: number }[] = [];
  const subWidth = w * SUBSAMPLES;
  for (let j = 0; j < h; j++) {
    for (let sy = 0; sy < SUBSAMPLES; sy++) {
      const y = top + j + (sy + 0.5) / SUBSAMPLES;
      crossings.length = 0;
      for (let e = 0; e < edges.length; e += 4) {
        const x0 = edges[e] ?? 0;
        const y0 = edges[e + 1] ?? 0;
        const x1 = edges[e + 2] ?? 0;
        const y1 = edges[e + 3] ?? 0;
        const yLo = Math.min(y0, y1);
        const yHi = Math.max(y0, y1);
        if (y < yLo || y >= yHi) continue;
        crossings.push({ x: x0 + ((y - y0) * (x1 - x0)) / (y1 - y0), dir: y1 > y0 ? 1 : -1 });
      }
      if (crossings.length < 2) continue;
      crossings.sort((p, q) => p.x - q.x);
      let winding = 0;
      for (let k = 0; k < crossings.length - 1; k++) {
        const c = crossings[k];
        const next = crossings[k + 1];
        if (!c || !next) break;
        winding += c.dir;
        if (winding === 0) continue;
        // Sub-sample columns whose centre lies in [c.x, next.x).
        const first = Math.max(0, Math.ceil((c.x - left) * SUBSAMPLES - 0.5));
        const last = Math.min(subWidth, Math.ceil((next.x - left) * SUBSAMPLES - 0.5));
        for (let s = first; s < last; s++) {
          const i = (s / SUBSAMPLES) | 0;
          coverage[j * w + i] = (coverage[j * w + i] ?? 0) + 1;
        }
      }
    }
  }

  const bitmap = new Uint8Array(w * h);
  let partialPixels = 0;
  for (let i = 0; i < bitmap.length; i++) {
    const c = coverage[i] ?? 0;
    if (c > 0 && c < SUBSAMPLES * SUBSAMPLES) partialPixels++;
    bitmap[i] = c >= LIT_THRESHOLD ? 1 : 0;
  }
  return withSideBearing(
    trimGlyph({ codePoint, w, h, left, top, advance, bitmap, partialPixels, sampled: w * h }),
  );
}

/**
 * Keeps at least one blank pixel column after the ink of an outline glyph. Vector faces may
 * set the advance inside the ink (the anti-aliased edge keeps neighbours apart on screen); on
 * a pixel grid the rounded advance then fuses adjacent glyphs, for example "1:" in Russo One.
 */
function withSideBearing(g: RasterGlyph): RasterGlyph {
  if (g.w === 0) return g;
  const left = Math.max(0, g.left);
  return { ...g, left, advance: Math.max(g.advance, left + g.w + 1) };
}

/** Drops empty rows and columns around the lit pixels. */
function trimGlyph(g: RasterGlyph): RasterGlyph {
  let minX = g.w;
  let minY = g.h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.bitmap[y * g.w + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    return { ...g, w: 0, h: 0, left: 0, top: 0, bitmap: new Uint8Array(0) };
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  if (w === g.w && h === g.h) return g;
  const bitmap = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    bitmap.set(g.bitmap.subarray((minY + y) * g.w + minX, (minY + y) * g.w + minX + w), y * w);
  }
  return { ...g, w, h, left: g.left + minX, top: g.top + minY, bitmap };
}

/** Rasterises a charset and packs the glyphs into an atlas. */
export function buildFont(font: TrueTypeFont, opts: BuildFontOptions): BuiltFont {
  const scale = opts.size / font.unitsPerEm;
  const source = opts.source ?? 'auto';
  const strike = source === 'auto' ? font.strikeMetrics(opts.size) : null;
  const charset = [...new Set(opts.charset ?? DEFAULT_CHARSET)].sort((a, b) => a - b);
  const fallback = opts.fallback ?? FALLBACK_CODE_POINT;
  if (!charset.includes(fallback)) charset.push(fallback);
  const rasters: RasterGlyph[] = [];
  const missing: number[] = [];
  for (const codePoint of charset) {
    if (!font.hasGlyph(codePoint)) {
      missing.push(codePoint);
      continue;
    }
    rasters.push(rasterizeGlyph(font, codePoint, opts.size, source));
  }
  if (!font.hasGlyph(fallback)) {
    throw new Error(`font ${opts.name}: fallback code point U+${fallback.toString(16)} is missing`);
  }

  const items: AtlasItem[] = rasters
    .filter((g) => g.w > 0 && g.h > 0)
    .map((g) => ({ id: g.codePoint, w: g.w, h: g.h }));
  const layout = packAtlas(items, 1);
  const rgba = new Uint8Array(layout.width * layout.height * 4);
  const glyphs: Record<string, FontGlyphMetrics> = {};
  const baseline = strike ? strike.ascender : Math.round(font.ascender * scale);
  const lineHeight = strike
    ? strike.ascender - strike.descender
    : Math.round((font.ascender - font.descender + font.lineGap) * scale);
  let partialPixels = 0;
  let glyphPixels = 0;
  for (const g of rasters) {
    partialPixels += g.partialPixels;
    glyphPixels += g.sampled;
    const frame = layout.frames[g.codePoint];
    if (frame) {
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          if (!g.bitmap[y * g.w + x]) continue;
          const o = ((frame.y + y) * layout.width + frame.x + x) * 4;
          rgba[o] = 255;
          rgba[o + 1] = 255;
          rgba[o + 2] = 255;
          rgba[o + 3] = 255;
        }
      }
    }
    glyphs[String(g.codePoint)] = {
      x: frame?.x ?? 0,
      y: frame?.y ?? 0,
      w: g.w,
      h: g.h,
      xOffset: g.left,
      yOffset: baseline + g.top,
      advance: g.advance,
    };
  }
  return {
    data: { name: opts.name, size: opts.size, lineHeight, baseline, glyphs, fallback },
    png: encodePng(layout.width, layout.height, rgba),
    width: layout.width,
    height: layout.height,
    source: strike ? 'bitmap' : 'outline',
    missing,
    partialPixels,
    glyphPixels,
  };
}
