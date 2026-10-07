/**
 * File `p` - palettes (`void_c()`, d.java line 569):
 *
 *   u8 count, then per palette: u8 n, followed by (n - 1) x u16 RGB565 for indices 1..n-1.
 *   Index 0 is always transparent.
 */
import { BinaryReader } from './binary.ts';

export type Rgba = [number, number, number, number];
export type Palette = Rgba[];

export const TRANSPARENT: Rgba = [0, 0, 0, 0];

/** Expands RGB565 to 8-bit channels exactly like the game (line 452): `(c << 3) | (c >> 2)` etc. */
export function rgb565ToRgba(colour: number): Rgba {
  const r5 = (colour >> 11) & 0x1f;
  const g6 = (colour >> 5) & 0x3f;
  const b5 = colour & 0x1f;
  return [(r5 << 3) | (r5 >> 2), (g6 << 2) | (g6 >> 4), (b5 << 3) | (b5 >> 2), 255];
}

export function decodePalettes(bytes: Uint8Array): Palette[] {
  const r = new BinaryReader(bytes, 'p');
  const count = r.u8();
  const palettes: Palette[] = [];
  for (let p = 0; p < count; p++) {
    const n = r.u8();
    const palette: Palette = n > 0 ? [[...TRANSPARENT]] : [];
    for (let i = 1; i < n; i++) palette.push(rgb565ToRgba(r.u16()));
    palettes.push(palette);
  }
  r.assertAtEnd();
  return palettes;
}
