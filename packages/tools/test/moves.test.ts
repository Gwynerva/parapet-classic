import { describe, expect, it } from 'vitest';
import {
  BLOB,
  decodeAnims,
  decodeKeyframeBounds,
  decodeMoveDemos,
  decodeMoves,
  MOVE_RECORD_SIZE,
  readBlobInts,
  readBlobShorts,
  unpackConditionWord,
  type MoveTable,
} from '../src/decodeBlobs.ts';
import { bFiles, index } from './helpers.ts';

let cache: MoveTable | undefined;
function moves(): MoveTable {
  cache ??= decodeMoves(readBlobInts(index(), bFiles(), BLOB.MOVES));
  return cache;
}

describe('move state table (blob 16)', () => {
  it('has 135 states of 14 ints and transition lists from int 1890', () => {
    expect(moves().states.length).toBe(135);
    expect(moves().transitionListStart).toBe(135 * MOVE_RECORD_SIZE);
    expect(moves().transitionListStart).toBe(1890);
    expect(moves().rawTransitionLists.length).toBe(2366 - 1890);
  });

  it('decodes the documented records', () => {
    const s0 = moves().states[0];
    expect(s0).toMatchObject({ duration: 900, next: 2, impulseType: 19, paramB: 2800, parent: 1 });
    expect(s0?.transitionList).toBe(1890);
    expect(s0?.transitions).toEqual([
      { conditions: [69], target: 42 },
      { conditions: [68], target: 38 },
    ]);
    expect(moves().states[2]).toMatchObject({ impulseType: 19, paramB: 1000, scoreType: 4 });
    // ground parent: 3 AND 5 -> bonk 71, ledge 25 -> 99, ladder 29 -> 118, ...
    const parent = moves().states[1]?.transitions ?? [];
    expect(parent.slice(0, 4)).toEqual([
      { conditions: [3, 5], target: 71 },
      { conditions: [25], target: 99 },
      { conditions: [29], target: 118 },
      { conditions: [14], target: 15 },
    ]);
    // air parent 10: FWD AND pole-ahead -> 122
    expect(moves().states[10]?.transitions[0]).toEqual({ conditions: [7, 62], target: 122 });
  });

  it('keeps every reference in range', () => {
    const count = moves().states.length;
    for (const state of moves().states) {
      expect(state.next === -1 || (state.next >= 0 && state.next < count)).toBe(true);
      expect(state.parent === -1 || (state.parent >= 0 && state.parent < count)).toBe(true);
      for (const t of state.transitions) {
        expect(t.target).toBeGreaterThanOrEqual(0);
        expect(t.target).toBeLessThan(count);
        for (const c of t.conditions) {
          expect(c).toBeGreaterThanOrEqual(1);
          expect(c).toBeLessThanOrEqual(80);
        }
      }
    }
  });

  it('has contiguous transition lists that are all referenced', () => {
    const ints = readBlobInts(index(), bFiles(), BLOB.MOVES);
    const referenced = new Set(moves().states.map((s) => s.transitionList));
    let p = moves().transitionListStart;
    let lists = 0;
    while (p < ints.length) {
      expect(referenced.has(p)).toBe(true);
      p += 1 + 2 * (ints[p] ?? 0);
      lists++;
    }
    expect(p).toBe(ints.length);
    expect(lists).toBe(52);
  });

  it('unpacks condition words low byte first', () => {
    expect(unpackConditionWord(0)).toEqual([]);
    expect(unpackConditionWord(0x0503)).toEqual([3, 5]);
    expect(unpackConditionWord(0x27262305)).toEqual([5, 35, 38, 39]);
    expect(unpackConditionWord(0x0a00)).toEqual([10]);
  });
});

describe('animation clips (blob 17)', () => {
  it('is a chain of 68 clips covering all 605 shorts', () => {
    const shorts = readBlobShorts(index(), bFiles(), BLOB.ANIMS);
    expect(shorts.length).toBe(605);
    const anims = decodeAnims(shorts);
    expect(Object.keys(anims.clips).length).toBe(68);
    let total = 0;
    for (const frames of Object.values(anims.clips)) {
      total += 1 + frames.length;
      for (const f of frames) {
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(463);
      }
    }
    expect(total).toBe(605);
  });

  it('contains every clip referenced by the move table and the menu demos', () => {
    const anims = decodeAnims(readBlobShorts(index(), bFiles(), BLOB.ANIMS));
    for (const state of moves().states) {
      if (state.clipOffset !== -1) expect(anims.clips[String(state.clipOffset)]).toBeDefined();
    }
    const demos = decodeMoveDemos(readBlobShorts(index(), bFiles(), BLOB.MOVE_DEMOS));
    expect(demos.length).toBe(20);
    demos.forEach((demo, i) => {
      expect(demo.stringId).toBe(56 + i);
      const clip = anims.clips[String(demo.clipOffset)];
      expect(clip).toBeDefined();
      expect(demo.frameCount).toBeLessThanOrEqual(clip?.length ?? 0);
    });
  });

  it('has one bounding box per character keyframe', () => {
    const bounds = decodeKeyframeBounds(readBlobShorts(index(), bFiles(), BLOB.KEYFRAME_BOUNDS));
    expect(bounds.length).toBe(463);
    for (const [minX, minY, maxX, maxY] of bounds) {
      expect(maxX).toBeGreaterThanOrEqual(minX);
      expect(maxY).toBeGreaterThanOrEqual(minY);
    }
  });
});
