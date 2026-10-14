/**
 * Turning pixel art by any angle without mush (after the RotSprite idea): the picture is
 * magnified eight times with Scale2x, which keeps edges sharp and diagonals clean, turned there
 * with nearest-neighbour sampling, and brought back to size by taking every 8 × 8 block's
 * centre. Colours never mix, so the result stays in the picture's palette.
 *
 * The character's body parts come pre-turned in steps of 22.5° (`Rig.ts`, `rotationIndex`);
 * this makes the turned pictures of a part from its upright one.
 */
import type { RgbaImage } from './Raster.ts';

const SCALE = 8;

function same(px: RgbaImage['data'], a: number, b: number): boolean {
  const ta = px[a + 3]! < 128;
  const tb = px[b + 3]! < 128;
  if (ta || tb) return ta && tb;
  return px[a] === px[b] && px[a + 1] === px[b + 1] && px[a + 2] === px[b + 2];
}

/** Scale2x (EPX): each pixel becomes four, following the neighbours' edges. */
export function scale2x(g: RgbaImage): RgbaImage {
  const w = g.width * 2;
  const h = g.height * 2;
  const out = new Uint8ClampedArray(w * h * 4);
  const at = (x: number, y: number): number =>
    (Math.max(0, Math.min(g.height - 1, y)) * g.width + Math.max(0, Math.min(g.width - 1, x))) * 4;
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const p = at(x, y);
      const a = at(x, y - 1);
      const b = at(x + 1, y);
      const c = at(x - 1, y);
      const d = at(x, y + 1);
      let e0 = p;
      let e1 = p;
      let e2 = p;
      let e3 = p;
      if (!same(g.data, c, b) && !same(g.data, a, d)) {
        if (same(g.data, c, a)) e0 = a;
        if (same(g.data, a, b)) e1 = b;
        if (same(g.data, d, c)) e2 = c;
        if (same(g.data, b, d)) e3 = d;
      }
      const o = (y * 2 * w + x * 2) * 4;
      out.set(g.data.subarray(e0, e0 + 4), o);
      out.set(g.data.subarray(e1, e1 + 4), o + 4);
      out.set(g.data.subarray(e2, e2 + 4), o + w * 4);
      out.set(g.data.subarray(e3, e3 + 4), o + w * 4 + 4);
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * `g` turned by `degrees` (clockwise on screen) around its centre, in the smallest box keeping
 * the parity of the original's width and height (so it sits on the same point in both facings).
 */
export function rotsprite(g: RgbaImage, degrees: number): RgbaImage {
  if (degrees % 360 === 0) return { width: g.width, height: g.height, data: g.data.slice() };
  let big = g;
  for (let s = 1; s < SCALE; s *= 2) big = scale2x(big);
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // The turned box, grown to keep parity.
  const corners = [
    [-g.width / 2, -g.height / 2],
    [g.width / 2, -g.height / 2],
    [-g.width / 2, g.height / 2],
    [g.width / 2, g.height / 2],
  ];
  let maxX = 0;
  let maxY = 0;
  for (const [x, y] of corners) {
    maxX = Math.max(maxX, Math.abs(x! * cos - y! * sin));
    maxY = Math.max(maxY, Math.abs(x! * sin + y! * cos));
  }
  let w = Math.ceil(maxX * 2);
  let h = Math.ceil(maxY * 2);
  if ((w & 1) !== (g.width & 1)) w++;
  if ((h & 1) !== (g.height & 1)) h++;
  const out = new Uint8ClampedArray(w * h * 4);
  const cxOut = w / 2;
  const cyOut = h / 2;
  const cxIn = big.width / 2;
  const cyIn = big.height / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // The centre of the output pixel, back into the magnified source.
      const dx = (x + 0.5 - cxOut) * SCALE;
      const dy = (y + 0.5 - cyOut) * SCALE;
      const sx = Math.floor(dx * cos + dy * sin + cxIn);
      const sy = Math.floor(-dx * sin + dy * cos + cyIn);
      if (sx < 0 || sy < 0 || sx >= big.width || sy >= big.height) continue;
      const o = (sy * big.width + sx) * 4;
      if (big.data[o + 3]! < 128) continue;
      out.set(big.data.subarray(o, o + 4), (y * w + x) * 4);
    }
  }
  return trimKeepingCentre({ width: w, height: h, data: out }, g.width & 1, g.height & 1);
}

/** Crops empty margins equally from opposite sides, so the centre stays where it was. */
export function trimKeepingCentre(g: RgbaImage, wParity: number, hParity: number): RgbaImage {
  let minX = g.width;
  let minY = g.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      if (g.data[(y * g.width + x) * 4 + 3]! < 128) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return { width: 1, height: 1, data: new Uint8ClampedArray(4) };
  const cutX = Math.min(minX, g.width - 1 - maxX);
  const cutY = Math.min(minY, g.height - 1 - maxY);
  let w = g.width - cutX * 2;
  let h = g.height - cutY * 2;
  let ox = cutX;
  let oy = cutY;
  // Cutting equal amounts keeps the parity; the original's parity is kept by construction.
  if ((w & 1) !== wParity && ox > 0) {
    ox--;
    w += 2;
  }
  if ((h & 1) !== hParity && oy > 0) {
    oy--;
    h += 2;
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const s = ((oy + y) * g.width + ox) * 4;
    out.set(g.data.subarray(s, s + w * 4), y * w * 4);
  }
  return { width: w, height: h, data: out };
}
