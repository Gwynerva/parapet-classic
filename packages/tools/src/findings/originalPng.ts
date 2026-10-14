/**
 * The PNG the original builds in memory for each sprite (`int_a`, d.java line 430), so that the
 * phone's own decoder can turn the jar's raw pixels into an image: signature; IHDR (8 bits,
 * colour type 3 with a palette, 6 for 32-bit sprites); for a palette, PLTE of n + 1 entries
 * (the first and the last are filler) and a tRNS of one zero byte (index 0 transparent); then
 * a zlib stream that compresses nothing: its two-byte header in an IDAT of its own, each stored
 * block (at most 4087 bytes, or 1015 pixels of a 32-bit sprite) in an IDAT of its own, the
 * Adler-32 in one more, and IEND. The fillers hold whatever the game's buffer held; zero here.
 */
import type { Palette } from '../decodePalettes.ts';
import type { SpriteRecord } from '../decodeSprites.ts';
import { chunk, concat, SIGNATURE } from '../png.ts';

const MAX_BLOCK = 4087;
const MAX_BLOCK_RGBA = 1015;

export interface OriginalPng {
  bytes: Uint8Array;
  /** The chunks in order, with their sizes (12 bytes of frame included). */
  chunks: { type: string; bytes: number }[];
}

export function originalPng(sprite: SpriteRecord, palettes: readonly Palette[]): OriginalPng {
  const { w, h } = sprite;
  const rgba = sprite.paletteIndex === null;
  const parts: Uint8Array[] = [SIGNATURE];
  const chunks: { type: string; bytes: number }[] = [{ type: 'signature', bytes: 8 }];
  const put = (type: string, data: Uint8Array): void => {
    parts.push(chunk(type, data));
    chunks.push({ type, bytes: 12 + data.length });
  };
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, w);
  view.setUint32(4, h);
  ihdr[8] = 8;
  ihdr[9] = rgba ? 6 : 3;
  put('IHDR', ihdr);
  if (!rgba) {
    const palette = palettes[sprite.paletteIndex!]!;
    // Entries 1..n-1 from the palette; entry 0 and entry n are filler.
    const plte = new Uint8Array(palette.length * 3 + 3);
    for (let i = 1; i < palette.length; i++) plte.set(palette[i]!.slice(0, 3), i * 3);
    put('PLTE', plte);
    put('tRNS', Uint8Array.of(0));
  }
  put('IDAT', Uint8Array.of(0x78, 0xda));
  // Rows of a filter byte (0) and the pixels, cut into stored blocks.
  const positions = (w + 1) * h;
  let a = 1;
  let b = 0;
  let left = positions;
  let pos = 0;
  let src = 0;
  do {
    const take = Math.min(left, rgba ? MAX_BLOCK_RGBA : MAX_BLOCK);
    left -= take;
    const data: number[] = [];
    for (let i = 0; i < take; i++, pos++) {
      const pixel = pos % (w + 1) !== 0;
      if (!pixel) data.push(0);
      else if (rgba) {
        // B, G, R, A in the jar; R, G, B, A in the PNG.
        const p = sprite.pixels;
        data.push(p[src + 2]!, p[src + 1]!, p[src]!, p[src + 3]!);
        src += 4;
      } else data.push(sprite.pixels[src++]!);
    }
    for (const v of data) {
      a = (a + v) % 65521;
      b = (b + a) % 65521;
    }
    const n = data.length;
    put(
      'IDAT',
      Uint8Array.of(left === 0 ? 1 : 0, n & 0xff, n >> 8, ~n & 0xff, (~n >> 8) & 0xff, ...data),
    );
  } while (left > 0);
  const adler = new Uint8Array(4);
  new DataView(adler.buffer).setUint32(0, ((b << 16) | a) >>> 0);
  put('IDAT', adler);
  put('IEND', new Uint8Array(0));
  return { bytes: concat(parts), chunks };
}
