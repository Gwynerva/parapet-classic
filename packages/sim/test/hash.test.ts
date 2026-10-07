import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  contentHashes,
  fnv1a,
  hashJson,
  hashLevel,
  sameContentHash,
} from '../src/content/hash.ts';
import { hasContent, loadLevel, loadMoves, loadTables } from './helpers/content.ts';

describe('content hashes', () => {
  it('computes FNV-1a with the standard offset basis', () => {
    expect(fnv1a('')).toBe(2166136261);
    expect(fnv1a('a')).toBe(0xe40c292c);
  });

  it('canonicalises object key order and drops undefined values', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: null }] })).toBe('{"a":[{"c":null,"d":2}],"b":1}');
    expect(canonicalJson({ a: undefined, b: 'x' })).toBe('{"b":"x"}');
    expect(hashJson({ b: 1, a: 2 })).toBe(hashJson({ a: 2, b: 1 }));
  });

  it('changes when a tile changes and ignores the level name', () => {
    const level = {
      id: 0,
      nameStringId: 97,
      width: 2,
      height: 1,
      tiles: [0, 1],
      missions: { 0: { start: { x: 0, y: 0 }, finish: null, npc: null, checkpoints: [] } },
    };
    const same = hashLevel({ ...level, nameStringId: 98 });
    expect(same).toBe(hashLevel(level));
    expect(hashLevel({ ...level, tiles: [0, 2] })).not.toBe(hashLevel(level));
  });

  it('compares hash triples field by field', () => {
    const a = { level: 1, moves: 2, tables: 3 };
    expect(sameContentHash(a, { ...a })).toBe(true);
    expect(sameContentHash(a, { ...a, tables: 4 })).toBe(false);
  });

  it.skipIf(!hasContent())('is stable for the extracted content', () => {
    const first = contentHashes(loadLevel(0), loadMoves(), loadTables());
    const second = contentHashes(loadLevel(0), loadMoves(), loadTables());
    expect(first).toEqual(second);
    expect(contentHashes(loadLevel(1), loadMoves(), loadTables()).level).not.toBe(first.level);
  });
});
