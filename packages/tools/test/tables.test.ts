import { describe, expect, it } from 'vitest';
import { decodeTables } from '../src/decodeBlobs.ts';
import { bFiles, index } from './helpers.ts';

describe('physics tables (blobs 18..26)', () => {
  const tables = decodeTables(index(), bFiles());

  it('match the values documented in 03-physics.md', () => {
    expect(tables.F).toEqual([1024, 1024, 1024, 1024, 900, 715, 512, 256, 64, 32, 8, 0]);
    expect(tables.G.slice(0, 8)).toEqual([0, 0, -512, -512, 512, 512, -1024, 1024]);
    expect(tables.G.slice(8)).toEqual(new Array<number>(10).fill(0));
    expect(tables.C.slice(0, 8)).toEqual([0, 2, 4, 4, 4, 4, 6, 6]);
    expect(tables.D).toEqual([0, 0, 256, 512]);
    expect(tables.E).toEqual([1250, 1250, 1250, 1250, 1424, 1168, 1524, 1168]);
    expect(tables.H).toEqual([
      1, 131842, 256, 2, 512, 2306, 4610, 64, 128, 4, 8, 32, 16, 31490, 31490, 130, 66, 256, 512,
      131074, 2, 131842, 98304, 2, 1024, 31490, 31490,
    ]);
  });

  it('maps tiles to B columns as documented', () => {
    expect(tables.A.length).toBe(64);
    const expected = new Array<number>(64).fill(0);
    for (const t of [1, 3, 5, 6, 15, 16, 19, 20, 21, 23]) expected[t] = 2;
    expected[9] = 4;
    expected[10] = 6;
    expected[11] = 8;
    expected[12] = 10;
    expected[7] = 12;
    expected[8] = 14;
    for (const t of [2, 17, 25]) expected[t] = 16;
    for (const t of [4, 18, 26]) expected[t] = 18;
    expected[24] = 20;
    expect(tables.A).toEqual(expected);
  });

  it('has 11 x 11 contact-following pairs with the documented row k=1', () => {
    expect(tables.B.length).toBe(11 * 11 * 2);
    expect(tables.B.slice(22, 44)).toEqual([
      0, 0, 10, 1, 1, 2, 8, 3, 2, 4, 4, 5, 9, 6, 6, 7, 1, 8, 4, 9, 0, 0,
    ]);
  });

  it('has 4 background themes of 5 ints', () => {
    expect(tables.M.length).toBe(20);
    for (let theme = 0; theme < 4; theme++) {
      const far = tables.M[theme * 5 + 3] ?? -1;
      const cloud = tables.M[theme * 5 + 4] ?? -1;
      expect(far).toBeGreaterThanOrEqual(212);
      expect(far).toBeLessThanOrEqual(222);
      expect(cloud === -1 || (cloud >= 212 && cloud <= 222)).toBe(true);
    }
  });
});
