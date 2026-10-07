/**
 * Files `g0..g8` - sprite packs (`int_d`, d.java line 782).
 *
 * A file is a plain run of records with no header:
 *
 *   u16 w, u16 h, u8 pal
 *   pixels: pal != 255 -> w*h palette indices (row-major); pal == 255 -> w*h*4 bytes B,G,R,A
 *   u8 flags: low nibble = number of transformed copies (high nibble is always 0)
 *   u8 code x copies   transform codes 0 none, 1 rot90 CW, 2 rot180, 3 rot270 CW, 4 mirror X,
 *                      5 flip Y, 6 transpose, 7 anti-transpose
 *
 * Sprite ids are sequential across the files: g0 holds ids 0..150, g1 continues, and so on.
 */
import { BinaryReader } from './binary.ts';
import type { Palette } from './decodePalettes.ts';
import { at } from './util.ts';

export const RGBA_PALETTE = 255;

export interface SpriteRecord {
  id: number;
  /** Sprite file number (0..8). */
  file: number;
  w: number;
  h: number;
  /** Palette index, or null for a 32-bit (B,G,R,A) sprite. */
  paletteIndex: number | null;
  /** Transform codes of the copies generated at load time (informational). */
  transforms: number[];
  /** Raw pixel data: w*h palette indices, or w*h*4 bytes B,G,R,A. */
  pixels: Uint8Array;
}

export function decodeSpriteFile(bytes: Uint8Array, file: number, firstId: number): SpriteRecord[] {
  const r = new BinaryReader(bytes, `g${file}`);
  const sprites: SpriteRecord[] = [];
  let id = firstId;
  while (!r.atEnd) {
    const w = r.u16();
    const h = r.u16();
    const pal = r.u8();
    const pixels = r.take(pal === RGBA_PALETTE ? w * h * 4 : w * h);
    const flags = r.u8();
    if (flags >> 4 !== 0) {
      throw new Error(`g${file}: sprite ${id} has an unexpected high flag nibble ${flags >> 4}`);
    }
    const transforms: number[] = [];
    for (let c = 0; c < (flags & 0xf); c++) transforms.push(r.u8());
    sprites.push({
      id,
      file,
      w,
      h,
      paletteIndex: pal === RGBA_PALETTE ? null : pal,
      transforms,
      pixels,
    });
    id++;
  }
  r.assertAtEnd();
  return sprites;
}

/** Decodes all sprite files in order; ids are assigned sequentially starting at 0. */
export function decodeSprites(files: readonly Uint8Array[]): SpriteRecord[] {
  const sprites: SpriteRecord[] = [];
  for (let g = 0; g < files.length; g++) {
    sprites.push(...decodeSpriteFile(at(files, g, 'sprite files'), g, sprites.length));
  }
  return sprites;
}

/** Converts a sprite to straight RGBA (row-major, 4 bytes per pixel). */
export function spriteToRgba(sprite: SpriteRecord, palettes: readonly Palette[]): Uint8Array {
  const count = sprite.w * sprite.h;
  const out = new Uint8Array(count * 4);
  const px = sprite.pixels;
  if (sprite.paletteIndex === null) {
    for (let i = 0; i < count; i++) {
      out[i * 4] = px[i * 4 + 2] ?? 0; // R
      out[i * 4 + 1] = px[i * 4 + 1] ?? 0; // G
      out[i * 4 + 2] = px[i * 4] ?? 0; // B
      out[i * 4 + 3] = px[i * 4 + 3] ?? 0; // A
    }
    return out;
  }
  const palette = at(palettes, sprite.paletteIndex, 'palettes');
  for (let i = 0; i < count; i++) {
    const index = px[i] ?? 0;
    const colour = palette[index];
    if (colour === undefined) {
      throw new RangeError(
        `sprite ${sprite.id}: palette index ${index} exceeds palette ${sprite.paletteIndex} (${palette.length} entries)`,
      );
    }
    out.set(colour, i * 4);
  }
  return out;
}
