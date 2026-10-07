import { describe, expect, it } from 'vitest';
import { decodePalettes, rgb565ToRgba } from '../src/decodePalettes.ts';
import { jar } from './helpers.ts';

describe('palettes (file p)', () => {
  it('decodes 113 palettes and consumes the file exactly', () => {
    const palettes = decodePalettes(jar().read('p'));
    expect(palettes.length).toBe(113);
    for (const palette of palettes) {
      expect(palette.length).toBeGreaterThan(1);
      expect(palette[0]).toEqual([0, 0, 0, 0]);
      for (const colour of palette.slice(1)) expect(colour[3]).toBe(255);
    }
  });

  it('expands RGB565 like the game', () => {
    expect(rgb565ToRgba(0xffff)).toEqual([255, 255, 255, 255]);
    expect(rgb565ToRgba(0x0000)).toEqual([0, 0, 0, 255]);
    expect(rgb565ToRgba(0xf800)).toEqual([255, 0, 0, 255]);
    expect(rgb565ToRgba(0x07e0)).toEqual([0, 255, 0, 255]);
    expect(rgb565ToRgba(0x001f)).toEqual([0, 0, 255, 255]);
    expect(rgb565ToRgba(0x8410)).toEqual([132, 130, 132, 255]);
  });

  it('rejects truncated data', () => {
    expect(() => decodePalettes(Uint8Array.of(1, 3, 0))).toThrow(/overruns/);
  });
});
