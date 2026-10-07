/**
 * Bitmap font renderer for the atlases produced by `packages/tools` (`npm run build-font`):
 * a PNG with white glyphs on transparency and a JSON glyph table. Text is drawn glyph by glyph
 * with `drawImage` at integer positions; colours come from a tinted copy of the atlas cached per
 * colour, so there is no per-glyph compositing cost.
 */

export interface BitmapGlyph {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Added to the pen x. */
  xOffset: number;
  /** Added to the top of the line box. */
  yOffset: number;
  advance: number;
}

export interface BitmapFontData {
  name: string;
  size: number;
  lineHeight: number;
  /** Baseline distance from the top of the line box. */
  baseline: number;
  glyphs: Record<string, BitmapGlyph>;
  /** Code point drawn for characters the font lacks. */
  fallback: number;
}

export type TextAlign = 'left' | 'center' | 'right';
export type TextScale = 1 | 2;

export interface DrawTextOptions {
  align?: TextAlign;
  /** Any CSS colour; omitted or white draws the atlas as is. */
  color?: string;
  scale?: TextScale;
  /** Digits share one advance (the widest digit's), so counters and timers do not jitter. */
  tabular?: boolean;
}

export type AtlasImage = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;

const WHITE = new Set(['white', '#fff', '#ffffff', 'rgb(255,255,255)', 'rgb(255, 255, 255)']);

export class BitmapFont {
  readonly name: string;
  readonly size: number;
  readonly lineHeight: number;
  readonly baseline: number;
  readonly image: AtlasImage;
  /** Advance of the widest digit: the cell width of tabular digits. */
  readonly digitAdvance: number;
  private readonly glyphs = new Map<number, BitmapGlyph>();
  private readonly fallback: BitmapGlyph | undefined;
  private readonly tinted = new Map<string, HTMLCanvasElement>();

  constructor(data: BitmapFontData, image: AtlasImage) {
    this.name = data.name;
    this.size = data.size;
    this.lineHeight = data.lineHeight;
    this.baseline = data.baseline;
    this.image = image;
    for (const [key, glyph] of Object.entries(data.glyphs)) {
      const codePoint = Number(key);
      if (Number.isInteger(codePoint)) this.glyphs.set(codePoint, glyph);
    }
    this.fallback = this.glyphs.get(data.fallback);
    let widest = 0;
    for (let c = 0x30; c <= 0x39; c++) {
      widest = Math.max(widest, this.glyphs.get(c)?.advance ?? 0);
    }
    this.digitAdvance = widest;
  }

  /** Fetches the JSON table and the PNG atlas (both must be bundled with the client). */
  static async load(jsonUrl: string, imageUrl: string): Promise<BitmapFont> {
    const [data, image] = await Promise.all([fetchFontData(jsonUrl), loadImage(imageUrl)]);
    return new BitmapFont(data, image);
  }

  /** Builds a font from an already imported JSON table and an atlas URL. */
  static async fromData(data: BitmapFontData, imageUrl: string): Promise<BitmapFont> {
    return new BitmapFont(data, await loadImage(imageUrl));
  }

  has(codePoint: number): boolean {
    return this.glyphs.has(codePoint);
  }

  /** The glyph for a code point, or the fallback glyph when the font lacks it. */
  glyph(codePoint: number): BitmapGlyph | undefined {
    return this.glyphs.get(codePoint) ?? this.fallback;
  }

  /** Width in logical pixels of the widest line of `text`. */
  measure(text: string, scale: TextScale = 1, tabular = false): number {
    let widest = 0;
    for (const line of text.split('\n')) widest = Math.max(widest, this.lineWidth(line, tabular));
    return widest * scale;
  }

  /** Height in logical pixels of all the lines of `text`. */
  measureHeight(text: string, scale: TextScale = 1): number {
    return text.split('\n').length * this.lineHeight * scale;
  }

  /** Width of a single line (no newlines expected). */
  lineWidth(line: string, tabular = false): number {
    let width = 0;
    for (const ch of line) {
      const codePoint = ch.codePointAt(0) ?? 0;
      const glyph = this.glyph(codePoint);
      if (glyph) width += tabular && isDigit(codePoint) ? this.digitAdvance : glyph.advance;
    }
    return width;
  }

  /**
   * Greedy word wrap: breaks at spaces, keeps explicit newlines and splits words that are wider
   * than `maxWidth` by character. Returns the lines.
   */
  wrap(text: string, maxWidth: number, scale: TextScale = 1): string[] {
    const limit = Math.max(1, Math.floor(maxWidth / scale));
    const lines: string[] = [];
    const spaceWidth = this.glyph(0x20)?.advance ?? 0;
    for (const paragraph of text.split('\n')) {
      let line = '';
      let lineWidth = 0;
      for (const word of paragraph.split(' ')) {
        const wordWidth = this.lineWidth(word);
        if (line !== '' && lineWidth + spaceWidth + wordWidth <= limit) {
          line += ' ' + word;
          lineWidth += spaceWidth + wordWidth;
          continue;
        }
        if (line !== '') {
          lines.push(line);
          line = '';
          lineWidth = 0;
        }
        if (wordWidth <= limit) {
          line = word;
          lineWidth = wordWidth;
          continue;
        }
        // A single word wider than the line: break it by character.
        for (const ch of word) {
          const advance = this.glyph(ch.codePointAt(0) ?? 0)?.advance ?? 0;
          if (line !== '' && lineWidth + advance > limit) {
            lines.push(line);
            line = '';
            lineWidth = 0;
          }
          line += ch;
          lineWidth += advance;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  /**
   * Draws `text` (newlines start new lines) with the top of the first line box at `y`. `x` is
   * the left edge, centre or right edge of each line depending on `align`.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    opts: DrawTextOptions = {},
  ): void {
    const scale = opts.scale ?? 1;
    const align = opts.align ?? 'left';
    const tabular = opts.tabular ?? false;
    const atlas = this.atlas(opts.color);
    const baseX = Math.round(x);
    let lineY = Math.round(y);
    for (const line of text.split('\n')) {
      let penX = baseX;
      if (align !== 'left') {
        const width = this.lineWidth(line, tabular) * scale;
        penX = align === 'center' ? baseX - Math.floor(width / 2) : baseX - width;
      }
      for (const ch of line) {
        const codePoint = ch.codePointAt(0) ?? 0;
        const glyph = this.glyph(codePoint);
        if (!glyph) continue;
        // A tabular digit sits centred in the cell of the widest digit.
        const cell = tabular && isDigit(codePoint) ? this.digitAdvance : glyph.advance;
        const shift = (cell - glyph.advance) >> 1;
        if (glyph.w > 0 && glyph.h > 0) {
          ctx.drawImage(
            atlas,
            glyph.x,
            glyph.y,
            glyph.w,
            glyph.h,
            penX + (glyph.xOffset + shift) * scale,
            lineY + glyph.yOffset * scale,
            glyph.w * scale,
            glyph.h * scale,
          );
        }
        penX += cell * scale;
      }
      lineY += this.lineHeight * scale;
    }
  }

  /** Draws pre-wrapped lines (from `wrap`) with the given line spacing. */
  drawLines(
    ctx: CanvasRenderingContext2D,
    lines: readonly string[],
    x: number,
    y: number,
    opts: DrawTextOptions = {},
  ): void {
    this.draw(ctx, lines.join('\n'), x, y, opts);
  }

  /** Drops the cached tinted atlases (for example after a theme change). */
  clearTintCache(): void {
    this.tinted.clear();
  }

  private atlas(color: string | undefined): CanvasImageSource {
    if (!color) return this.image;
    const key = color.trim().toLowerCase();
    if (WHITE.has(key)) return this.image;
    const cached = this.tinted.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = this.image.width;
    canvas.height = this.image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return this.image;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.tinted.set(key, canvas);
    return canvas;
  }
}

function isDigit(codePoint: number): boolean {
  return codePoint >= 0x30 && codePoint <= 0x39;
}

async function fetchFontData(url: string): Promise<BitmapFontData> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`BitmapFont: failed to load ${url} (${response.status})`);
  return (await response.json()) as BitmapFontData;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`BitmapFont: failed to load ${url}`));
    image.src = url;
  });
}
