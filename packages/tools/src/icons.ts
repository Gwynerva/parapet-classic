/**
 * The app icon of Parapet Classic: a runner leaping off a rooftop parapet, our own pixel art
 * (nothing from the original game). Drawn once at 32×32 and scaled by whole pixels to every
 * size the browsers and phones ask for.
 */
import { encodePng } from './png.ts';

const PALETTE: Readonly<Record<string, readonly [number, number, number]>> = {
  '.': [16, 20, 24],
  d: [58, 70, 84],
  g: [91, 98, 112],
  G: [139, 152, 168],
  A: [184, 116, 0],
  a: [255, 176, 0],
  // The racing echo: the game's neon cyan ghost.
  C: [20, 92, 112],
  c: [38, 178, 204],
};

export const ICON_ART: readonly string[] = [
  '................................',
  '................................',
  '................................',
  '....................aa..........',
  '...................aaaa.........',
  '...................aaaa.........',
  '...................aaa..........',
  '..dddddddd......................',
  '.................Aaaaa....aa....',
  '................Aaaaaaa.aaaa....',
  '..............AAAaaaaaaaaaa.....',
  'ddddddd......AAAaaaa..aaa.......',
  '.............AA.aaaa............',
  '............AAAaaaa.............',
  '.......AA...AAAaaaaa............',
  '.......AAAA.AAAaaaaaaa..........',
  '........AAAAAA.....aaa..........',
  '...ddd....AAA.......aa..........',
  '....................aaa.........',
  '.....................aa.........',
  '.....................aaa........',
  'GGGGGGGGGGGGGGGGGGG.............',
  'ddddddddddddddddddd.............',
  'gggggdgggggggdggggd.............',
  'gggggdgggggggdggggd.............',
  'gggggdgggggggdggggd.............',
  'ddddddddddddddddddd.............',
  'gggggggggdgggggggdd.............',
  'gggggggggdgggggggdd.............',
  'gggggggggdgggggggdd.............',
  'ddddddddddddddddddd.............',
  'ggggggggggggggggggd.............',
];

/** How far behind the runner its echo runs in the race icon, in art pixels. */
const ECHO_BEHIND = 10;
/** The parapet starts on this row; the runner and its speed lines are above it. */
const PARAPET_ROW = 21;

/**
 * The icon of a race (the challenge links' preview): the runner leaping off the parapet with
 * its echo, the game's neon ghost, a stride behind on the roof; no speed lines.
 */
export const RACE_ICON_ART: readonly string[] = ((): string[] => {
  // Two runners show the speed: no lines.
  const rows = ICON_ART.map((row, y) =>
    y < PARAPET_ROW ? row.replace(/d/g, '.').split('') : row.split(''),
  );
  const runner = (ch: string): boolean => ch === 'a' || ch === 'A';
  for (let y = 0; y < PARAPET_ROW; y++) {
    for (let x = 0; x < rows[y]!.length; x++) {
      const ch = ICON_ART[y]![x]!;
      const ex = x - ECHO_BEHIND;
      if (runner(ch) && ex >= 0) rows[y]![ex] = ch === 'a' ? 'c' : 'C';
    }
  }
  // The runner over its echo.
  for (let y = 0; y < PARAPET_ROW; y++) {
    for (let x = 0; x < rows[y]!.length; x++) {
      if (runner(ICON_ART[y]![x]!)) rows[y]![x] = ICON_ART[y]![x]!;
    }
  }
  return rows.map((r) => r.join(''));
})();

/** Files under `packages/classic/public/icons/`: name → art scale and padding. */
export const ICON_FILES: readonly { name: string; scale: number; size: number }[] = [
  { name: 'favicon-32.png', scale: 1, size: 32 },
  // Search engines show a site's icon from 48 px up, in multiples of 48.
  { name: 'favicon-96.png', scale: 3, size: 96 },
  { name: 'icon-192.png', scale: 6, size: 192 },
  { name: 'icon-512.png', scale: 16, size: 512 },
  // Launchers crop maskable icons to a circle or a squircle: the art keeps to the middle 80 %.
  { name: 'icon-maskable-512.png', scale: 10, size: 512 },
  { name: 'apple-touch-icon.png', scale: 5, size: 180 },
];

/** The art scaled by `scale`, centred on a `size`² square of the background colour. */
export function renderIcon(
  scale: number,
  size: number,
  art: readonly string[] = ICON_ART,
): Uint8Array {
  const artSize = art.length * scale;
  const offset = (size - artSize) >> 1;
  const background = PALETTE['.']!;
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ax = Math.floor((x - offset) / scale);
      const ay = Math.floor((y - offset) / scale);
      const inside = x >= offset && y >= offset && ax < art.length && ay < art.length;
      const color = inside ? (PALETTE[art[ay]![ax]!] ?? background) : background;
      const i = (y * size + x) * 4;
      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

/**
 * The art as an SVG of whole-pixel rectangles (a row's run of one colour each): crisp at any
 * size, for the browsers that take an SVG favicon.
 */
export function renderIconSvg(art: readonly string[] = ICON_ART): string {
  const hex = (c: readonly number[]): string =>
    '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const rects: string[] = [];
  art.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x]!;
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') {
        rects.push(
          `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${hex(PALETTE[ch]!)}"/>`,
        );
      }
      x = end;
    }
  });
  const size = art.length;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="${hex(PALETTE['.']!)}"/>` +
    rects.join('') +
    '</svg>\n'
  );
}

/** A `.ico` holding PNG pictures (every browser since IE 11 reads them). */
export function renderIco(pngs: readonly { size: number; png: Uint8Array }[]): Uint8Array {
  const header = 6 + 16 * pngs.length;
  const total = header + pngs.reduce((n, p) => n + p.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, pngs.length, true);
  let offset = header;
  pngs.forEach((p, i) => {
    const e = 6 + i * 16;
    out[e] = p.size >= 256 ? 0 : p.size;
    out[e + 1] = p.size >= 256 ? 0 : p.size;
    view.setUint16(e + 4, 1, true);
    view.setUint16(e + 6, 32, true);
    view.setUint32(e + 8, p.png.length, true);
    view.setUint32(e + 12, offset, true);
    out.set(p.png, offset);
    offset += p.png.length;
  });
  return out;
}
