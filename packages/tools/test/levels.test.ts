import { describe, expect, it } from 'vitest';
import {
  BLOB,
  decodeLevelMap,
  decodeMissionTable,
  LEVEL_COUNT,
  MISSION_RECORD_SIZE,
  readBlobInts,
  readBlobShorts,
  type MissionTable,
} from '../src/decodeBlobs.ts';
import { bFiles, index, jar } from './helpers.ts';

let cache: MissionTable | undefined;
function missions(): MissionTable {
  cache ??= decodeMissionTable(readBlobInts(index(), bFiles(), BLOB.MISSIONS));
  return cache;
}

const EXPECTED_SIZES: [number, number][] = [
  [80, 17],
  [100, 20],
  [100, 20],
  [99, 13],
  [88, 17],
  [150, 13],
  [75, 21],
  [100, 20],
  [118, 14],
  [150, 16],
  [150, 28],
  [99, 50],
];

describe('mission table (blob 39)', () => {
  it('is 12 x 28 ints', () => {
    expect(missions().raw.length).toBe(LEVEL_COUNT * MISSION_RECORD_SIZE);
    expect(missions().levels.length).toBe(LEVEL_COUNT);
  });

  it('references names, maps, rivals and backgrounds consistently', () => {
    const backgrounds = [3, 4, 8, 2, 10, 5, 12, 13, 6, 7, 11, 9];
    const unlock = [0, 4, 7, 9, 14, 16, 19, 22, 25, 27, 30, 41];
    // Rival recordings are blob 4 + level, except that levels 9 and 10 are swapped in b0
    // (level 9 uses blob 14, level 10 uses blob 13); the recordings match the mission table.
    const rivals = [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 13, 15];
    missions().levels.forEach((level, i) => {
      expect(level.id).toBe(i);
      expect(level.nameStringId).toBe(97 + i);
      expect(level.mapBlob).toBe(BLOB.LEVEL_FIRST + i);
      expect(level.rivalBlob).toBe(rivals[i]);
      expect(level.rivalBlob).toBeGreaterThanOrEqual(BLOB.RIVAL_FIRST);
      expect(level.rivalBlob).toBeLessThan(BLOB.MOVES);
      expect(level.sprintTimeLimit).toBe(120000);
      expect(level.unlockThreshold).toBe(unlock[i]);
      expect(level.backgroundFile).toBe(backgrounds[i]);
      expect(level.backgroundSceneId).toBe(level.backgroundFile << 11);
      expect(level.backgroundLength * 2).toBe(jar().read(`k${level.backgroundFile}`).length);
      expect(level.goals.length).toBe(level.missionCount);
      expect(level.missionTypes.length).toBe(level.missionCount);
    });
  });

  it('decodes the mission lists and goal kinds', () => {
    const types = missions().levels.map((l) => l.missionTypes);
    expect(types[0]).toEqual([4, 5, 0, 1, 2]);
    for (const i of [1, 4, 7, 9]) expect(types[i]).toEqual([0, 1, 2]);
    for (const i of [2, 3, 5, 6, 8, 10, 11]) expect(types[i]).toEqual([3, 0, 1, 2]);
    for (const level of missions().levels) {
      level.goals.forEach((goal, m) => {
        const type = level.missionTypes[m];
        if (type === 0) expect(goal.kind).toBe('sprint');
        if (goal.kind === 'sprint') expect(goal.value).toBeNull();
        if (goal.kind === 'time') expect(goal.value).toBe(goal.raw & 0x7fffffff);
        if (goal.kind === 'score') expect(goal.value).toBe(goal.raw);
      });
    }
    // Challenge limits of levels 8/10/11 are 30/20/20 s (the help text says 20 s for all three)
    expect(missions().levels[8]?.goals[0]?.value).toBe(30000);
    expect(missions().levels[10]?.goals[0]?.value).toBe(20000);
    expect(missions().levels[11]?.goals[0]?.value).toBe(20000);
  });

  it('derives the challenge rules that the original hard-codes', () => {
    const levels = missions().levels;
    for (const id of [0, 1, 4, 7, 9]) expect(levels[id]?.challenge).toBeNull();
    expect(levels[2]?.challenge).toEqual({ timeLimit: 25000, requiredMoveBits: 0, scoreTarget: 0 });
    expect(levels[3]?.challenge).toEqual({
      timeLimit: 20000,
      requiredMoveBits: 0x2,
      scoreTarget: 0,
    });
    expect(levels[5]?.challenge).toEqual({
      timeLimit: 40000,
      requiredMoveBits: 0x1c,
      scoreTarget: 0,
    });
    expect(levels[6]?.challenge).toEqual({
      timeLimit: 30000,
      requiredMoveBits: 0x60,
      scoreTarget: 0,
    });
    expect(levels[8]?.challenge).toEqual({
      timeLimit: 30000,
      requiredMoveBits: 0,
      scoreTarget: 2000,
    });
    expect(levels[10]?.challenge?.scoreTarget).toBe(3200);
    expect(levels[11]?.challenge?.scoreTarget).toBe(5000);
  });
});

describe('level tile maps (blobs 27..38)', () => {
  it('decodes all 12 levels, RLE filling exactly W*H cells and consuming the blob', () => {
    for (let n = 0; n < LEVEL_COUNT; n++) {
      const map = decodeLevelMap(readBlobShorts(index(), bFiles(), BLOB.LEVEL_FIRST + n));
      expect([map.width, map.height]).toEqual(EXPECTED_SIZES[n]);
      expect(map.tiles.length).toBe(map.width * map.height);
      for (const tile of map.tiles) {
        expect(tile).toBeGreaterThanOrEqual(0);
        expect(tile).toBeLessThanOrEqual(63);
      }
    }
  });

  it('has a section for every mission type the level offers', () => {
    missions().levels.forEach((level, n) => {
      const map = decodeLevelMap(readBlobShorts(index(), bFiles(), BLOB.LEVEL_FIRST + n));
      expect(Object.keys(map.missions).length).toBe(6);
      for (let type = 0; type < 6; type++) {
        const section = map.missions[type];
        if (level.missionTypes.includes(type)) {
          expect(section).not.toBeNull();
        } else {
          expect(section).toBeNull();
        }
      }
      const sprint = map.missions[0];
      expect(sprint?.finish).not.toBeNull();
      expect(sprint?.checkpoints.length).toBe(5);
      const flagHunt = map.missions[1];
      expect(flagHunt?.checkpoints.length).toBe(5);
      const scoreRun = map.missions[2];
      expect(scoreRun?.finish).not.toBeNull();
      expect(scoreRun?.checkpoints.length).toBe(0);
      for (const section of Object.values(map.missions)) {
        if (!section) continue;
        const points = [section.start, section.finish, section.npc, ...section.checkpoints];
        for (const p of points) {
          if (!p) continue;
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThan(map.width);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThan(map.height);
        }
      }
    });
  });
});
