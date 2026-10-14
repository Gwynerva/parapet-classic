/**
 * The findings' charts as SVG text: an opaque dark card (it reads the same on a light and a
 * dark page, and inline on the Lab), a title and a note, then marks. Marks may carry a `tip`,
 * shown as the browser's tooltip where the SVG is inline. No scripts, no external fonts.
 */
import { INK } from './palette.ts';

export interface TextOptions {
  size?: number;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
  weight?: number;
  /** Monospace (state ids, bytes). */
  mono?: boolean;
  /** Rotated by this many degrees around (x, y). */
  rotate?: number;
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.?0+$/, '');
}

function tip(text: string | undefined): string {
  return text ? `<title>${esc(text)}</title>` : '';
}

export class Svg {
  readonly width: number;
  readonly height: number;
  private readonly title: string;
  private readonly note: string;
  private readonly parts: string[] = [];

  /** A card `width × height`; `title` and `note` sit at its top (the plot starts at y = 56). */
  constructor(width: number, height: number, title: string, note = '') {
    this.width = width;
    this.height = height;
    this.title = title;
    this.note = note;
  }

  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    opts: { rx?: number; stroke?: string; opacity?: number; tip?: string } = {},
  ): this {
    const attrs = [
      `x="${num(x)}" y="${num(y)}" width="${num(Math.max(0, w))}" height="${num(Math.max(0, h))}"`,
      `fill="${fill}"`,
      opts.rx ? `rx="${opts.rx}"` : '',
      opts.stroke ? `stroke="${opts.stroke}"` : '',
      opts.opacity !== undefined ? `opacity="${opts.opacity}"` : '',
    ];
    this.parts.push(`<rect ${attrs.filter(Boolean).join(' ')}>${tip(opts.tip)}</rect>`);
    return this;
  }

  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    stroke: string,
    opts: { width?: number; dash?: string; opacity?: number } = {},
  ): this {
    const dash = opts.dash ? ` stroke-dasharray="${opts.dash}"` : '';
    const op = opts.opacity !== undefined ? ` opacity="${opts.opacity}"` : '';
    this.parts.push(
      `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${stroke}" stroke-width="${opts.width ?? 1}"${dash}${op}/>`,
    );
    return this;
  }

  /**
   * A polyline through `points` (2 px, round joins); points in the middle of a straight
   * horizontal or vertical stretch, as written, are left out.
   */
  polyline(
    points: readonly (readonly [number, number])[],
    stroke: string,
    opts: { width?: number; dash?: string; fill?: string } = {},
  ): this {
    const at = points.map(([x, y]) => [num(x), num(y)] as const);
    const kept = at.filter((p, i) => {
      const a = at[i - 1];
      const b = at[i + 1];
      if (!a || !b) return true;
      return !((a[1] === p[1] && p[1] === b[1]) || (a[0] === p[0] && p[0] === b[0]));
    });
    const d = kept.map(([x, y]) => `${x},${y}`).join(' ');
    const dash = opts.dash ? ` stroke-dasharray="${opts.dash}"` : '';
    this.parts.push(
      `<polyline points="${d}" fill="${opts.fill ?? 'none'}" stroke="${stroke}" stroke-width="${opts.width ?? 2}" stroke-linejoin="round" stroke-linecap="round"${dash}/>`,
    );
    return this;
  }

  path(
    d: string,
    opts: { stroke?: string; fill?: string; width?: number; tip?: string } = {},
  ): this {
    this.parts.push(
      `<path d="${d}" fill="${opts.fill ?? 'none'}" stroke="${opts.stroke ?? 'none'}" stroke-width="${opts.width ?? 1}">${tip(opts.tip)}</path>`,
    );
    return this;
  }

  circle(
    cx: number,
    cy: number,
    r: number,
    fill: string,
    opts: { stroke?: string; tip?: string } = {},
  ): this {
    const stroke = opts.stroke ? ` stroke="${opts.stroke}" stroke-width="2"` : '';
    this.parts.push(
      `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="${fill}"${stroke}>${tip(opts.tip)}</circle>`,
    );
    return this;
  }

  text(x: number, y: number, text: string, opts: TextOptions = {}): this {
    const attrs = [
      `x="${num(x)}" y="${num(y)}"`,
      `font-size="${opts.size ?? 12}"`,
      `fill="${opts.fill ?? INK.text}"`,
      opts.anchor && opts.anchor !== 'start' ? `text-anchor="${opts.anchor}"` : '',
      opts.weight ? `font-weight="${opts.weight}"` : '',
      opts.mono ? `font-family="${MONO}"` : '',
      opts.rotate ? `transform="rotate(${opts.rotate} ${num(x)} ${num(y)})"` : '',
    ];
    this.parts.push(`<text ${attrs.filter(Boolean).join(' ')}>${esc(text)}</text>`);
    return this;
  }

  /** A legend entry: a swatch and its label. */
  key(x: number, y: number, color: string, label: string): this {
    this.rect(x, y - 9, 10, 10, color, { rx: 2 });
    return this.text(x + 15, y, label, { fill: INK.text, size: 12 });
  }

  /** Raw SVG markup (a picture, a pattern). */
  raw(markup: string): this {
    this.parts.push(markup);
    return this;
  }

  toString(): string {
    const w = this.width;
    const h = this.height;
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="t d" font-family="${FONT}" style="font-variant-numeric: tabular-nums">`,
      `<title id="t">${esc(this.title)}</title>`,
      `<desc id="d">${esc(this.note)}</desc>`,
      `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="10" fill="${INK.card}" stroke="${INK.line}"/>`,
      `<text x="20" y="30" font-size="16" font-weight="600" fill="${INK.text}">${esc(this.title)}</text>`,
      this.note
        ? `<text x="20" y="48" font-size="12" fill="${INK.muted}">${esc(this.note)}</text>`
        : '',
      ...this.parts,
      '</svg>',
      '',
    ]
      .filter((l) => l !== '')
      .join('\n');
  }
}

/** A linear scale from a domain to a range. */
export function scale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}
