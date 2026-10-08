/**
 * Turning pixel art by any angle without mush (after the RotSprite idea): the picture is
 * magnified eight times with Scale2x, which keeps edges sharp and diagonals clean, turned there
 * with nearest-neighbour sampling, and brought back to size by taking every 8 × 8 block's
 * centre. Colours never mix, so the result stays in the picture's palette.
 *
 * The character's body parts come pre-turned in steps of 22.5° (`Rig.ts`, `rotationIndex`);
 * this makes the turned pictures of a part from its upright one.
 */

export interface PixelGrid {
  w: number;
  h: number;
  /** RGBA, `w * h * 4`. */
  px: Uint8ClampedArray;
}

const SCALE = 8;

function same(px: Uint8ClampedArray, a: number, b: number): boolean {
  const ta = px[a + 3]! < 128;
  const tb = px[b + 3]! < 128;
  if (ta || tb) return ta && tb;
  return px[a] === px[b] && px[a + 1] === px[b + 1] && px[a + 2] === px[b + 2];
}

/** Scale2x (EPX): each pixel becomes four, following the neighbours' edges. */
export function scale2x(g: PixelGrid): PixelGrid {
  const w = g.w * 2;
  const h = g.h * 2;
  const out = new Uint8ClampedArray(w * h * 4);
  const at = (x: number, y: number): number =>
    (Math.max(0, Math.min(g.h - 1, y)) * g.w + Math.max(0, Math.min(g.w - 1, x))) * 4;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const p = at(x, y);
      const a = at(x, y - 1);
      const b = at(x + 1, y);
      const c = at(x - 1, y);
      const d = at(x, y + 1);
      let e0 = p;
      let e1 = p;
      let e2 = p;
      let e3 = p;
      if (!same(g.px, c, b) && !same(g.px, a, d)) {
        if (same(g.px, c, a)) e0 = a;
        if (same(g.px, a, b)) e1 = b;
        if (same(g.px, d, c)) e2 = c;
        if (same(g.px, b, d)) e3 = d;
      }
      const o = (y * 2 * w + x * 2) * 4;
      out.set(g.px.subarray(e0, e0 + 4), o);
      out.set(g.px.subarray(e1, e1 + 4), o + 4);
      out.set(g.px.subarray(e2, e2 + 4), o + w * 4);
      out.set(g.px.subarray(e3, e3 + 4), o + w * 4 + 4);
    }
  }
  return { w, h, px: out };
}

/**
 * `g` turned by `degrees` (clockwise on screen) around its centre, in the smallest box keeping
 * the parity of the original's width and height (so it sits on the same point in both facings).
 */
export function rotsprite(g: PixelGrid, degrees: number): PixelGrid {
  if (degrees % 360 === 0) return { w: g.w, h: g.h, px: g.px.slice() };
  let big = g;
  for (let s = 1; s < SCALE; s *= 2) big = scale2x(big);
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // The turned box, grown to keep parity.
  const corners = [
    [-g.w / 2, -g.h / 2],
    [g.w / 2, -g.h / 2],
    [-g.w / 2, g.h / 2],
    [g.w / 2, g.h / 2],
  ];
  let maxX = 0;
  let maxY = 0;
  for (const [x, y] of corners) {
    maxX = Math.max(maxX, Math.abs(x! * cos - y! * sin));
    maxY = Math.max(maxY, Math.abs(x! * sin + y! * cos));
  }
  let w = Math.ceil(maxX * 2);
  let h = Math.ceil(maxY * 2);
  if ((w & 1) !== (g.w & 1)) w++;
  if ((h & 1) !== (g.h & 1)) h++;
  const out = new Uint8ClampedArray(w * h * 4);
  const cxOut = w / 2;
  const cyOut = h / 2;
  const cxIn = big.w / 2;
  const cyIn = big.h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // The centre of the output pixel, back into the magnified source.
      const dx = (x + 0.5 - cxOut) * SCALE;
      const dy = (y + 0.5 - cyOut) * SCALE;
      const sx = Math.floor(dx * cos + dy * sin + cxIn);
      const sy = Math.floor(-dx * sin + dy * cos + cyIn);
      if (sx < 0 || sy < 0 || sx >= big.w || sy >= big.h) continue;
      const o = (sy * big.w + sx) * 4;
      if (big.px[o + 3]! < 128) continue;
      out.set(big.px.subarray(o, o + 4), (y * w + x) * 4);
    }
  }
  return trimKeepingCentre({ w, h, px: out }, g.w & 1, g.h & 1);
}

/** Crops empty margins equally from opposite sides, so the centre stays where it was. */
export function trimKeepingCentre(g: PixelGrid, wParity: number, hParity: number): PixelGrid {
  let minX = g.w;
  let minY = g.h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.px[(y * g.w + x) * 4 + 3]! < 128) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return { w: 1, h: 1, px: new Uint8ClampedArray(4) };
  const cutX = Math.min(minX, g.w - 1 - maxX);
  const cutY = Math.min(minY, g.h - 1 - maxY);
  let w = g.w - cutX * 2;
  let h = g.h - cutY * 2;
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
    const s = ((oy + y) * g.w + ox) * 4;
    out.set(g.px.subarray(s, s + w * 4), y * w * 4);
  }
  return { w, h, px: out };
}
