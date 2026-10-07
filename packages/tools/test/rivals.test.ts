import { describe, expect, it } from 'vitest';
import {
  BLOB,
  decodeLevelMap,
  decodeMissionTable,
  decodeRival,
  LEVEL_COUNT,
  readBlob,
  readBlobInts,
  readBlobShorts,
  RIVAL_ENTRY_SIZE,
  RIVAL_HEADER_SIZE,
} from '../src/decodeBlobs.ts';
import { bFiles, index } from './helpers.ts';

describe('rival recordings (blobs 4..15)', () => {
  it('decodes 12 recordings: 114-byte snapshot, total time, then 5-byte entries to the end', () => {
    for (let n = 0; n < LEVEL_COUNT; n++) {
      const bytes = readBlob(index(), bFiles(), BLOB.RIVAL_FIRST + n);
      expect((bytes.length - RIVAL_HEADER_SIZE) % RIVAL_ENTRY_SIZE).toBe(0);
      const rival = decodeRival(bytes);
      expect(rival.snapshot.length).toBe(28);
      expect(rival.flags[0]).toBe(1); // facing right
      expect(rival.flags[1]).toBe(0); // hands not anchored
      expect(rival.entries.length).toBe((bytes.length - RIVAL_HEADER_SIZE) / RIVAL_ENTRY_SIZE);
      for (const entry of rival.entries) {
        expect(entry.ticks).toBeGreaterThan(0);
        expect(entry.input).toBeGreaterThanOrEqual(0);
        expect(entry.input).toBeLessThanOrEqual(63);
      }
    }
  });

  it('ends with the last entry duplicated and no -1 marker; total time = 30 x ticks', () => {
    // The writer (`w(int)`, d.java 4951) emits the final (ticks, input) pair twice; the reader
    // (`byte_a`, 4919) stops at the blob length. Nothing in the file is -1.
    for (let n = 0; n < LEVEL_COUNT; n++) {
      const rival = decodeRival(readBlob(index(), bFiles(), BLOB.RIVAL_FIRST + n));
      const last = rival.entries.at(-1);
      const beforeLast = rival.entries.at(-2);
      expect(last).toEqual(beforeLast);
      const ticks = rival.entries.reduce((sum, e) => sum + e.ticks, 0) - (last?.ticks ?? 0);
      expect(rival.totalTime).toBe(ticks * 30);
    }
  });

  it('starts at the third coordinate pair of the Sprint section of its level', () => {
    // The blob is taken from the mission table (levels 9 and 10 are swapped in b0).
    const missions = decodeMissionTable(readBlobInts(index(), bFiles(), BLOB.MISSIONS));
    expect(missions.levels.length).toBe(LEVEL_COUNT);
    for (const level of missions.levels) {
      const rival = decodeRival(readBlob(index(), bFiles(), level.rivalBlob));
      const map = decodeLevelMap(readBlobShorts(index(), bFiles(), level.mapBlob));
      const npc = map.missions[0]?.npc;
      expect(npc).toBeDefined();
      // feet position: k = x * 1024, l = (y + 1) * 1024 (d.java line 7592)
      expect(rival.snapshot[4]).toBe((npc?.x ?? -1) << 10);
      expect(rival.snapshot[5]).toBe(((npc?.y ?? -1) + 1) << 10);
    }
  });
});
