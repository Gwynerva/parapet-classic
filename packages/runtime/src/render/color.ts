/**
 * Colours as the renderers and the content files write them: `#rgb`, `#rrggbb` and
 * `#rrggbbaa` text, RGB(A) bytes, the original's 24-bit integers, and CSS for the canvas. Pure.
 */

export type Rgb = readonly [number, number, number];
export type Rgba = readonly [number, number, number, number];

/** The accent of a look or a boss that names none (a hot pink). */
export const DEFAULT_ACCENT = '#ff3ea5';

/** `#rgb`, `#rrggbb` or `#rrggbbaa` → RGBA bytes, or null. */
export function parseColor(text: string): Rgba | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
  if (!m) return null;
  let hex = m[1]!;
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  const v = (i: number): number => parseInt(hex.slice(i, i + 2), 16);
  return [v(0), v(2), v(4), hex.length === 8 ? v(6) : 255];
}

/** The RGB bytes of a colour's text (black for text that is not a colour). */
export function rgbOf(text: string): Rgb {
  const c = parseColor(text);
  return c ? [c[0], c[1], c[2]] : [0, 0, 0];
}

/** `a` moved towards `b` by `t` (0..1), rounded. */
export function mixRgb(a: Rgb | Rgba, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Two hex digits of a byte. */
export function hexByte(v: number): string {
  return v.toString(16).padStart(2, '0');
}

/** CSS of a colour: `#rrggbb`, or `rgba(...)` with an alpha (0..1). */
export function cssColor(c: Rgb | Rgba, alpha?: number): string {
  if (alpha !== undefined) return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
  return `#${hexByte(c[0])}${hexByte(c[1])}${hexByte(c[2])}`;
}

/** CSS of the original's 24-bit `0xRRGGBB` colours. */
export function cssOf24(rgb: number): string {
  return '#' + (rgb & 0xffffff).toString(16).padStart(6, '0');
}
