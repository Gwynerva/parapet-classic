/**
 * The colours of the findings, one set for the animations and the charts: a dark card (it reads
 * the same on a light and a dark page), text inks, and categorical series that keep apart for
 * colour-blind readers too (checked against the card: lightness band, chroma, CVD separation,
 * contrast). A series' colour follows what it stands for, in this order.
 */
import type { Rgb } from '@parapet/runtime/render/color.ts';

export const INK = {
  /** The card everything is drawn on. */
  card: '#161b22',
  /** Its frame and the chart grid. */
  line: '#30363d',
  text: '#e6edf3',
  muted: '#8b949e',
} as const;

/** Categorical series, in order: blue, orange, aqua, yellow, magenta, violet, red. */
export const SERIES = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#9085e9',
  '#e66767',
] as const;

export function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** The same colours as bytes, for the frames. */
export const RGB = {
  card: rgb(INK.card),
  line: rgb(INK.line),
  text: rgb(INK.text),
  muted: rgb(INK.muted),
  black: [0, 0, 0] as Rgb,
  white: [255, 255, 255] as Rgb,
  series: SERIES.map(rgb),
};
