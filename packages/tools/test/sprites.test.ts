import { describe, expect, it } from 'vitest';
import { fileFirstSlot, SPRITE_FILE_COUNT, spriteSlot } from '../src/decodeIndex.ts';
import { decodePalettes } from '../src/decodePalettes.ts';
import { decodeSprites, spriteToRgba, type SpriteRecord } from '../src/decodeSprites.ts';
import { index, jar } from './helpers.ts';

let cache: SpriteRecord[] | undefined;
function sprites(): SpriteRecord[] {
  if (!cache) {
    const files: Uint8Array[] = [];
    for (let g = 0; g < SPRITE_FILE_COUNT; g++) files.push(jar().read(`g${g}`));
    cache = decodeSprites(files);
  }
  return cache;
}

describe('sprites (files g0..g8)', () => {
  it('decodes 314 sprites with sequential ids, consuming every file exactly', () => {
    const all = sprites();
    expect(all.length).toBe(314);
    all.forEach((sprite, i) => expect(sprite.id).toBe(i));
  });

  it('assigns the id ranges documented in the notes', () => {
    const ranges: Record<number, [number, number]> = {
      0: [0, 150],
      1: [151, 152],
      2: [153, 175],
      3: [176, 211],
      4: [212, 213],
      5: [214, 216],
      6: [217, 219],
      7: [220, 222],
      8: [223, 313],
    };
    for (const sprite of sprites()) {
      const range = ranges[sprite.file];
      expect(range).toBeDefined();
      if (!range) continue;
      expect(sprite.id).toBeGreaterThanOrEqual(range[0]);
      expect(sprite.id).toBeLessThanOrEqual(range[1]);
    }
  });

  it('matches the slot table of the index, including the transformed copies', () => {
    let slot = fileFirstSlot(index(), 0);
    let file = 0;
    for (const sprite of sprites()) {
      if (sprite.file !== file) {
        expect(slot).toBe(fileFirstSlot(index(), sprite.file));
        file = sprite.file;
      }
      expect(spriteSlot(index(), sprite.id)).toBe(slot);
      slot += 1 + sprite.transforms.length;
    }
    expect(slot).toBe(fileFirstSlot(index(), SPRITE_FILE_COUNT));
  });

  it('keeps palette indices and transform codes in range', () => {
    const palettes = decodePalettes(jar().read('p'));
    for (const sprite of sprites()) {
      expect(sprite.w).toBeGreaterThan(0);
      expect(sprite.h).toBeGreaterThan(0);
      for (const code of sprite.transforms) {
        expect(code).toBeGreaterThanOrEqual(1);
        expect(code).toBeLessThanOrEqual(7);
      }
      if (sprite.paletteIndex === null) {
        expect(sprite.pixels.length).toBe(sprite.w * sprite.h * 4);
      } else {
        expect(sprite.paletteIndex).toBeLessThan(palettes.length);
        const palette = palettes[sprite.paletteIndex] ?? [];
        let max = 0;
        for (const p of sprite.pixels) max = Math.max(max, p);
        expect(max).toBeLessThan(palette.length);
      }
      expect(spriteToRgba(sprite, palettes).length).toBe(sprite.w * sprite.h * 4);
    }
  });

  it('stores the HUD digit font as 32-bit sprites', () => {
    for (let id = 194; id <= 211; id++) expect(sprites()[id]?.paletteIndex).toBeNull();
  });
});
