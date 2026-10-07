/**
 * Small pixel icons authored as text: each icon is a list of rows where every character is a
 * palette key (`.` is transparent). Icons are rasterised once per palette into an offscreen
 * canvas at an integer scale, so drawing one is a single `drawImage`. Used for the menu
 * icons that the original drew as anti-aliased sketches on light cards, which do not survive
 * a dark theme.
 */

export type IconRows = readonly string[];

/** Palette: character → CSS colour. Characters missing from it are transparent. */
export type IconPalette = Readonly<Record<string, string>>;

export interface IconDefinition {
  rows: IconRows;
}

/** Validates an icon: every row has the width of the first one. Returns width and height. */
export function iconSize(rows: IconRows): { width: number; height: number } {
  const width = rows[0]?.length ?? 0;
  for (const [i, row] of rows.entries()) {
    if (row.length !== width)
      throw new Error(`icon row ${i} has ${row.length} columns, expected ${width}`);
  }
  return { width, height: rows.length };
}

interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class PixelIcons<Name extends string, Variant extends string> {
  private readonly icons: Readonly<Record<Name, IconDefinition>>;
  private readonly palettes: Readonly<Record<Variant, IconPalette>>;
  readonly scale: number;
  private canvas: HTMLCanvasElement | null = null;
  private readonly frames = new Map<string, Frame>();

  constructor(
    icons: Readonly<Record<Name, IconDefinition>>,
    palettes: Readonly<Record<Variant, IconPalette>>,
    scale = 2,
  ) {
    this.icons = icons;
    this.palettes = palettes;
    this.scale = scale;
    for (const def of Object.values<IconDefinition>(icons)) iconSize(def.rows);
  }

  /** Drawn size of an icon in logical pixels. */
  size(name: Name): { width: number; height: number } {
    const { width, height } = iconSize(this.icons[name].rows);
    return { width: width * this.scale, height: height * this.scale };
  }

  /** Draws `name` in `variant` with its top-left corner at (x, y). */
  draw(ctx: CanvasRenderingContext2D, name: Name, variant: Variant, x: number, y: number): void {
    const atlas = this.atlas();
    const frame = this.frames.get(`${name}/${variant}`);
    if (!atlas || !frame) return;
    ctx.drawImage(
      atlas,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      Math.round(x),
      Math.round(y),
      frame.w,
      frame.h,
    );
  }

  /** Rasterise every icon × palette into one canvas (lazily, the first time one is drawn). */
  private atlas(): HTMLCanvasElement | null {
    if (this.canvas) return this.canvas;
    if (typeof document === 'undefined') return null;
    const names = Object.keys(this.icons) as Name[];
    const variants = Object.keys(this.palettes) as Variant[];
    let width = 0;
    let height = 0;
    for (const name of names) {
      const s = this.size(name);
      width = Math.max(width, s.width * variants.length);
      height += s.height;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    let y = 0;
    for (const name of names) {
      const rows = this.icons[name].rows;
      const s = this.size(name);
      variants.forEach((variant, vi) => {
        const x = vi * s.width;
        const palette = this.palettes[variant];
        rows.forEach((row, ry) => {
          for (let rx = 0; rx < row.length; rx++) {
            const colour = palette[row[rx] ?? '.'];
            if (!colour) continue;
            ctx.fillStyle = colour;
            ctx.fillRect(x + rx * this.scale, y + ry * this.scale, this.scale, this.scale);
          }
        });
        this.frames.set(`${name}/${variant}`, { x, y, w: s.width, h: s.height });
      });
      y += s.height;
    }
    this.canvas = canvas;
    return canvas;
  }
}
