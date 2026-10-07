import { describe, expect, it } from 'vitest';
import { BLOB_COUNT, INDEX_INT_COUNT, INDEX_SHORT_COUNT } from '../src/decodeIndex.ts';
import { bFiles, index } from './helpers.ts';

describe('index (file i)', () => {
  it('has 16 sound types, 593 shorts and 166 ints', () => {
    expect(index().soundTypes.length).toBe(16);
    expect(index().shorts.length).toBe(INDEX_SHORT_COUNT);
    expect(index().ints.length).toBe(INDEX_INT_COUNT);
    expect(index().soundTypes.slice(2)).toEqual(new Array<number>(14).fill(1));
  });

  it('holds the first image slot of each sprite file', () => {
    expect(index().shorts.slice(35, 45)).toEqual([0, 900, 902, 928, 967, 969, 972, 975, 978, 1080]);
  });

  it('holds the string group starts', () => {
    expect(index().shorts.slice(30, 35)).toEqual([0, 138, 140, 161, 205]);
  });

  it('has a blob directory that tiles b0, b1 and b2 exactly', () => {
    const blobs = index().blobs;
    expect(blobs.length).toBe(BLOB_COUNT);
    for (let file = 0; file < 3; file++) {
      const inFile = blobs.filter((b) => b.file === file).sort((a, b) => a.offset - b.offset);
      let end = 0;
      for (const blob of inFile) {
        expect(blob.offset).toBe(end);
        end += blob.length;
      }
      expect(end).toBe(bFiles()[file]?.length);
    }
    // ids are assigned in file order: 0..15 in b0, 16..26 in b1, 27..39 in b2
    expect(blobs.map((b) => b.file)).toEqual([
      ...new Array<number>(16).fill(0),
      ...new Array<number>(11).fill(1),
      ...new Array<number>(13).fill(2),
    ]);
  });
});
