/**
 * Minimal TrueType parser: enough of `head`, `hhea`, `maxp`, `hmtx`, `loca`, `cmap` (formats 4
 * and 12) and `glyf` (simple and composite glyphs, quadratic contours) to rasterise a font.
 * Nothing else (hinting, kerning, OpenType layout, CFF outlines) is read.
 */
import { BinaryReader } from './binary.ts';

export interface TtfPoint {
  x: number;
  y: number;
  onCurve: boolean;
}

export interface TtfGlyph {
  /** Closed contours in font units; `onCurve === false` marks quadratic control points. */
  contours: TtfPoint[][];
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  advance: number;
  leftSideBearing: number;
}

/** A glyph image from an embedded bitmap strike (`EBLC`/`EBDT`). */
export interface EmbeddedBitmap {
  w: number;
  h: number;
  /** Left edge relative to the pen position. */
  left: number;
  /** Top edge relative to the baseline, negative above it. */
  top: number;
  advance: number;
  /** `w × h` bytes, 1 = lit. */
  bitmap: Uint8Array;
}

/** Line metrics of an embedded bitmap strike, in pixels. */
export interface StrikeMetrics {
  ppem: number;
  ascender: number;
  descender: number;
}

interface TableRecord {
  offset: number;
  length: number;
}

interface BigMetrics {
  height: number;
  width: number;
  bearingX: number;
  bearingY: number;
  advance: number;
}

interface StrikeSubtable {
  first: number;
  last: number;
  indexFormat: number;
  imageFormat: number;
  imageDataOffset: number;
  /** Offset of the index subtable header inside the EBLC table. */
  header: number;
}

interface Strike extends StrikeMetrics {
  subtables: StrikeSubtable[];
}

const EMPTY_BOX = { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };

export class TrueTypeFont {
  readonly unitsPerEm: number;
  readonly ascender: number;
  readonly descender: number;
  readonly lineGap: number;
  readonly numGlyphs: number;
  readonly xMin: number;
  readonly yMin: number;
  readonly xMax: number;
  readonly yMax: number;
  private readonly bytes: Uint8Array;
  private readonly tables: Map<string, TableRecord>;
  private readonly loca: Uint32Array;
  private readonly advances: Uint16Array;
  private readonly bearings: Int16Array;
  private readonly cmap: Map<number, number>;
  private readonly strikes: Strike[];
  private readonly glyphCache = new Map<number, TtfGlyph>();

  constructor(bytes: Uint8Array, label = 'font') {
    this.bytes = bytes;
    this.tables = readTableDirectory(bytes, label);
    const head = this.reader('head');
    head.skip(18);
    this.unitsPerEm = head.u16();
    head.skip(16);
    this.xMin = head.i16();
    this.yMin = head.i16();
    this.xMax = head.i16();
    this.yMax = head.i16();
    head.skip(6);
    const indexToLocFormat = head.i16();

    const hhea = this.reader('hhea');
    hhea.skip(4);
    this.ascender = hhea.i16();
    this.descender = hhea.i16();
    this.lineGap = hhea.i16();
    hhea.skip(24);
    const numberOfHMetrics = hhea.u16();

    const maxp = this.reader('maxp');
    maxp.skip(4);
    this.numGlyphs = maxp.u16();

    const hmtx = this.reader('hmtx');
    this.advances = new Uint16Array(this.numGlyphs);
    this.bearings = new Int16Array(this.numGlyphs);
    let lastAdvance = 0;
    for (let i = 0; i < this.numGlyphs; i++) {
      if (i < numberOfHMetrics) {
        lastAdvance = hmtx.u16();
        this.advances[i] = lastAdvance;
        this.bearings[i] = hmtx.i16();
      } else {
        this.advances[i] = lastAdvance;
        this.bearings[i] = hmtx.remaining >= 2 ? hmtx.i16() : 0;
      }
    }

    const loca = this.reader('loca');
    this.loca = new Uint32Array(this.numGlyphs + 1);
    for (let i = 0; i <= this.numGlyphs; i++) {
      if (loca.remaining < (indexToLocFormat === 0 ? 2 : 4)) break;
      this.loca[i] = indexToLocFormat === 0 ? loca.u16() * 2 : loca.u32();
    }

    this.cmap = readCmap(this.reader('cmap'));
    this.strikes =
      this.tables.has('EBLC') && this.tables.has('EBDT') ? readStrikes(this.reader('EBLC')) : [];
  }

  /** Pixel sizes that have an embedded 1-bit bitmap strike (`EBLC`/`EBDT`), ascending. */
  embeddedSizes(): number[] {
    return this.strikes.map((s) => s.ppem).sort((a, b) => a - b);
  }

  /** Line metrics of the embedded strike at `ppem`, or null when there is none. */
  strikeMetrics(ppem: number): StrikeMetrics | null {
    const strike = this.strikes.find((s) => s.ppem === ppem);
    return strike
      ? { ppem: strike.ppem, ascender: strike.ascender, descender: strike.descender }
      : null;
  }

  /**
   * The embedded bitmap of a glyph at `ppem`, or null when the font has no strike at that size,
   * the glyph has no image in it (e.g. a space) or the image format is unsupported.
   */
  embeddedBitmap(ppem: number, glyphIndex: number): EmbeddedBitmap | null {
    const strike = this.strikes.find((s) => s.ppem === ppem);
    const ebdt = this.tables.get('EBDT');
    if (!strike || !ebdt) return null;
    const sub = strike.subtables.find((s) => glyphIndex >= s.first && glyphIndex <= s.last);
    if (!sub) return null;
    const eblc = this.reader('EBLC').bytes;
    const view = new DataView(eblc.buffer, eblc.byteOffset, eblc.byteLength);
    const h = sub.header;
    const i = glyphIndex - sub.first;
    let offset: number;
    let size: number;
    let metrics: BigMetrics | null = null;
    switch (sub.indexFormat) {
      case 1:
        offset = view.getUint32(h + 8 + i * 4);
        size = view.getUint32(h + 12 + i * 4) - offset;
        break;
      case 2: {
        const imageSize = view.getUint32(h + 8);
        metrics = readBigMetrics(view, h + 12);
        offset = i * imageSize;
        size = imageSize;
        break;
      }
      case 3:
        offset = view.getUint16(h + 8 + i * 2);
        size = view.getUint16(h + 10 + i * 2) - offset;
        break;
      case 4: {
        const count = view.getUint32(h + 8);
        let found = -1;
        for (let k = 0; k < count; k++) {
          if (view.getUint16(h + 12 + k * 4) === glyphIndex) {
            found = k;
            break;
          }
        }
        if (found < 0) return null;
        offset = view.getUint16(h + 14 + found * 4);
        size = view.getUint16(h + 14 + (found + 1) * 4) - offset;
        break;
      }
      case 5: {
        const imageSize = view.getUint32(h + 8);
        metrics = readBigMetrics(view, h + 12);
        const count = view.getUint32(h + 20);
        let found = -1;
        for (let k = 0; k < count; k++) {
          if (view.getUint16(h + 24 + k * 2) === glyphIndex) {
            found = k;
            break;
          }
        }
        if (found < 0) return null;
        offset = found * imageSize;
        size = imageSize;
        break;
      }
      default:
        return null;
    }
    if (size <= 0) return null;
    const start = ebdt.offset + sub.imageDataOffset + offset;
    if (start + size > ebdt.offset + ebdt.length) return null;
    return readBitmapGlyph(this.bytes.subarray(start, start + size), sub.imageFormat, metrics);
  }

  /** Glyph index for a Unicode code point, or 0 (`.notdef`) when the font lacks it. */
  glyphIndex(codePoint: number): number {
    return this.cmap.get(codePoint) ?? 0;
  }

  hasGlyph(codePoint: number): boolean {
    return this.cmap.has(codePoint);
  }

  /** Every code point the font maps, ascending. */
  codePoints(): number[] {
    return [...this.cmap.keys()].sort((a, b) => a - b);
  }

  advanceOf(glyphIndex: number): number {
    return this.advances[glyphIndex] ?? 0;
  }

  glyph(glyphIndex: number): TtfGlyph {
    const cached = this.glyphCache.get(glyphIndex);
    if (cached) return cached;
    const glyph = this.readGlyph(glyphIndex, 0);
    this.glyphCache.set(glyphIndex, glyph);
    return glyph;
  }

  private reader(tag: string): BinaryReader {
    const table = this.tables.get(tag);
    if (!table) throw new Error(`ttf: missing table ${tag}`);
    return new BinaryReader(this.bytes.subarray(table.offset, table.offset + table.length), tag);
  }

  private readGlyph(glyphIndex: number, depth: number): TtfGlyph {
    const advance = this.advances[glyphIndex] ?? 0;
    const leftSideBearing = this.bearings[glyphIndex] ?? 0;
    const start = this.loca[glyphIndex];
    const end = this.loca[glyphIndex + 1];
    const glyf = this.tables.get('glyf');
    if (!glyf || start === undefined || end === undefined || end <= start) {
      return { contours: [], ...EMPTY_BOX, advance, leftSideBearing };
    }
    const r = new BinaryReader(
      this.bytes.subarray(glyf.offset + start, glyf.offset + end),
      `glyf[${glyphIndex}]`,
    );
    const numberOfContours = r.i16();
    const box = { xMin: r.i16(), yMin: r.i16(), xMax: r.i16(), yMax: r.i16() };
    const contours =
      numberOfContours >= 0
        ? readSimpleGlyph(r, numberOfContours)
        : this.readCompositeGlyph(r, depth);
    return { contours, ...box, advance, leftSideBearing };
  }

  private readCompositeGlyph(r: BinaryReader, depth: number): TtfPoint[][] {
    if (depth > 8) throw new Error('ttf: composite glyph nesting too deep');
    const ARG_1_AND_2_ARE_WORDS = 0x0001;
    const ARGS_ARE_XY_VALUES = 0x0002;
    const WE_HAVE_A_SCALE = 0x0008;
    const MORE_COMPONENTS = 0x0020;
    const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
    const WE_HAVE_A_TWO_BY_TWO = 0x0080;
    const contours: TtfPoint[][] = [];
    for (;;) {
      const flags = r.u16();
      const componentIndex = r.u16();
      let dx: number;
      let dy: number;
      if (flags & ARG_1_AND_2_ARE_WORDS) {
        dx = r.i16();
        dy = r.i16();
      } else {
        dx = r.i8();
        dy = r.i8();
      }
      if (!(flags & ARGS_ARE_XY_VALUES)) {
        // Point-matching placement is not used by the fonts we bundle; treat as no offset.
        dx = 0;
        dy = 0;
      }
      let a = 1;
      let b = 0;
      let c = 0;
      let d = 1;
      if (flags & WE_HAVE_A_SCALE) {
        a = d = f2dot14(r.i16());
      } else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) {
        a = f2dot14(r.i16());
        d = f2dot14(r.i16());
      } else if (flags & WE_HAVE_A_TWO_BY_TWO) {
        a = f2dot14(r.i16());
        b = f2dot14(r.i16());
        c = f2dot14(r.i16());
        d = f2dot14(r.i16());
      }
      const component = this.readGlyph(componentIndex, depth + 1);
      for (const contour of component.contours) {
        contours.push(
          contour.map((p) => ({
            x: a * p.x + c * p.y + dx,
            y: b * p.x + d * p.y + dy,
            onCurve: p.onCurve,
          })),
        );
      }
      if (!(flags & MORE_COMPONENTS)) break;
    }
    return contours;
  }
}

function f2dot14(value: number): number {
  return value / 16384;
}

function readTableDirectory(bytes: Uint8Array, label: string): Map<string, TableRecord> {
  const r = new BinaryReader(bytes, label);
  const version = r.u32();
  if (version !== 0x00010000 && version !== 0x74727565 /* 'true' */) {
    throw new Error(
      `ttf: ${label} is not a TrueType font (sfnt version 0x${version.toString(16)})`,
    );
  }
  const numTables = r.u16();
  r.skip(6);
  const tables = new Map<string, TableRecord>();
  for (let i = 0; i < numTables; i++) {
    const tag = String.fromCharCode(...r.take(4));
    r.skip(4);
    const offset = r.u32();
    const length = r.u32();
    if (offset + length > bytes.length) throw new Error(`ttf: table ${tag} overruns the file`);
    tables.set(tag, { offset, length });
  }
  return tables;
}

function readSimpleGlyph(r: BinaryReader, numberOfContours: number): TtfPoint[][] {
  const endPts: number[] = [];
  for (let i = 0; i < numberOfContours; i++) endPts.push(r.u16());
  const pointCount = numberOfContours === 0 ? 0 : (endPts[numberOfContours - 1] ?? -1) + 1;
  const instructionLength = r.u16();
  r.skip(instructionLength);

  const ON_CURVE = 0x01;
  const X_SHORT = 0x02;
  const Y_SHORT = 0x04;
  const REPEAT = 0x08;
  const X_SAME_OR_POSITIVE = 0x10;
  const Y_SAME_OR_POSITIVE = 0x20;

  const flags = new Uint8Array(pointCount);
  for (let i = 0; i < pointCount;) {
    const flag = r.u8();
    flags[i++] = flag;
    if (flag & REPEAT) {
      let repeats = r.u8();
      while (repeats-- > 0 && i < pointCount) flags[i++] = flag;
    }
  }
  const xs = new Int32Array(pointCount);
  const ys = new Int32Array(pointCount);
  let value = 0;
  for (let i = 0; i < pointCount; i++) {
    const flag = flags[i] ?? 0;
    if (flag & X_SHORT) {
      const delta = r.u8();
      value += flag & X_SAME_OR_POSITIVE ? delta : -delta;
    } else if (!(flag & X_SAME_OR_POSITIVE)) {
      value += r.i16();
    }
    xs[i] = value;
  }
  value = 0;
  for (let i = 0; i < pointCount; i++) {
    const flag = flags[i] ?? 0;
    if (flag & Y_SHORT) {
      const delta = r.u8();
      value += flag & Y_SAME_OR_POSITIVE ? delta : -delta;
    } else if (!(flag & Y_SAME_OR_POSITIVE)) {
      value += r.i16();
    }
    ys[i] = value;
  }

  const contours: TtfPoint[][] = [];
  let first = 0;
  for (const last of endPts) {
    const contour: TtfPoint[] = [];
    for (let i = first; i <= last && i < pointCount; i++) {
      contour.push({ x: xs[i] ?? 0, y: ys[i] ?? 0, onCurve: ((flags[i] ?? 0) & ON_CURVE) !== 0 });
    }
    if (contour.length > 0) contours.push(contour);
    first = last + 1;
  }
  return contours;
}

function readCmap(r: BinaryReader): Map<number, number> {
  const base = r.bytes;
  r.skip(2);
  const numTables = r.u16();
  let best: { offset: number; score: number } | undefined;
  for (let i = 0; i < numTables; i++) {
    const platformId = r.u16();
    const encodingId = r.u16();
    const offset = r.u32();
    if (offset + 4 > base.length) continue;
    const format = new DataView(base.buffer, base.byteOffset + offset, 2).getUint16(0);
    let score = -1;
    if (platformId === 3 && encodingId === 10 && format === 12) score = 4;
    else if (platformId === 0 && format === 12) score = 3;
    else if (platformId === 3 && encodingId === 1 && format === 4) score = 2;
    else if (platformId === 0 && format === 4) score = 1;
    if (score > (best?.score ?? -1)) best = { offset, score };
  }
  if (!best) throw new Error('ttf: no usable Unicode cmap subtable (format 4 or 12)');
  const sub = new BinaryReader(base.subarray(best.offset), 'cmap subtable');
  const format = sub.u16();
  const map = new Map<number, number>();
  if (format === 4) readCmapFormat4(sub, map);
  else readCmapFormat12(sub, map);
  map.delete(0xffff);
  return map;
}

function readCmapFormat4(r: BinaryReader, map: Map<number, number>): void {
  r.skip(4); // length, language
  const segCount = r.u16() / 2;
  r.skip(6);
  const endCodes: number[] = [];
  for (let i = 0; i < segCount; i++) endCodes.push(r.u16());
  r.skip(2);
  const startCodes: number[] = [];
  for (let i = 0; i < segCount; i++) startCodes.push(r.u16());
  const idDeltas: number[] = [];
  for (let i = 0; i < segCount; i++) idDeltas.push(r.u16());
  const idRangeOffsetPos = r.pos;
  const idRangeOffsets: number[] = [];
  for (let i = 0; i < segCount; i++) idRangeOffsets.push(r.u16());
  const view = new DataView(r.bytes.buffer, r.bytes.byteOffset, r.bytes.byteLength);
  for (let s = 0; s < segCount; s++) {
    const start = startCodes[s] ?? 0;
    const end = endCodes[s] ?? 0;
    const delta = idDeltas[s] ?? 0;
    const rangeOffset = idRangeOffsets[s] ?? 0;
    if (start > end) continue;
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let glyph: number;
      if (rangeOffset === 0) {
        glyph = (c + delta) & 0xffff;
      } else {
        const addr = idRangeOffsetPos + s * 2 + rangeOffset + (c - start) * 2;
        if (addr + 2 > r.bytes.length) continue;
        glyph = view.getUint16(addr);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) map.set(c, glyph);
    }
  }
}

function readCmapFormat12(r: BinaryReader, map: Map<number, number>): void {
  r.skip(2 + 4 + 4); // reserved, length, language
  const numGroups = r.u32();
  for (let g = 0; g < numGroups; g++) {
    const start = r.u32();
    const end = r.u32();
    const startGlyph = r.u32();
    for (let c = start; c <= end && c - start < 0x10000; c++) {
      const glyph = startGlyph + (c - start);
      if (glyph !== 0) map.set(c, glyph);
    }
  }
}

/** Reads the `EBLC` strike directory: one entry per 1-bit square strike with its subtables. */
function readStrikes(r: BinaryReader): Strike[] {
  const bytes = r.bytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  r.skip(4); // version
  const numSizes = r.u32();
  const strikes: Strike[] = [];
  for (let s = 0; s < numSizes; s++) {
    const rec = 8 + s * 48;
    if (rec + 48 > bytes.length) break;
    const arrayOffset = view.getUint32(rec);
    const subtableCount = view.getUint32(rec + 8);
    const ascender = view.getInt8(rec + 16);
    const descender = view.getInt8(rec + 17);
    const ppemX = view.getUint8(rec + 44);
    const ppemY = view.getUint8(rec + 45);
    const bitDepth = view.getUint8(rec + 46);
    if (bitDepth !== 1 || ppemX !== ppemY) continue;
    const subtables: StrikeSubtable[] = [];
    for (let i = 0; i < subtableCount; i++) {
      const a = arrayOffset + i * 8;
      if (a + 8 > bytes.length) break;
      const header = arrayOffset + view.getUint32(a + 4);
      if (header + 8 > bytes.length) continue;
      subtables.push({
        first: view.getUint16(a),
        last: view.getUint16(a + 2),
        header,
        indexFormat: view.getUint16(header),
        imageFormat: view.getUint16(header + 2),
        imageDataOffset: view.getUint32(header + 4),
      });
    }
    strikes.push({ ppem: ppemX, ascender, descender, subtables });
  }
  return strikes;
}

function readBigMetrics(view: DataView, offset: number): BigMetrics {
  return {
    height: view.getUint8(offset),
    width: view.getUint8(offset + 1),
    bearingX: view.getInt8(offset + 2),
    bearingY: view.getInt8(offset + 3),
    advance: view.getUint8(offset + 4),
  };
}

/** Decodes an `EBDT` glyph image (formats 1, 2, 5, 6 and 7; composites are not supported). */
function readBitmapGlyph(
  data: Uint8Array,
  imageFormat: number,
  metrics: BigMetrics | null,
): EmbeddedBitmap | null {
  const r = new BinaryReader(data, 'EBDT glyph');
  let m: BigMetrics;
  switch (imageFormat) {
    case 1:
    case 2:
      m = { height: r.u8(), width: r.u8(), bearingX: r.i8(), bearingY: r.i8(), advance: r.u8() };
      break;
    case 6:
    case 7:
      m = { height: r.u8(), width: r.u8(), bearingX: r.i8(), bearingY: r.i8(), advance: r.u8() };
      r.skip(3); // vertical metrics
      break;
    case 5:
      if (!metrics) return null;
      m = metrics;
      break;
    default:
      return null;
  }
  const byteAligned = imageFormat === 1 || imageFormat === 6;
  const bitmap = new Uint8Array(m.width * m.height);
  let bit = r.pos * 8;
  for (let y = 0; y < m.height; y++) {
    if (byteAligned) bit = (bit + 7) & ~7;
    for (let x = 0; x < m.width; x++) {
      const byte = data[bit >> 3] ?? 0;
      bitmap[y * m.width + x] = (byte >> (7 - (bit & 7))) & 1;
      bit++;
    }
  }
  return {
    w: m.width,
    h: m.height,
    left: m.bearingX,
    top: -m.bearingY,
    advance: m.advance,
    bitmap,
  };
}
