/**
 * The pale finish flag that shows the way to the finish, on the real levels: all through a score run, from the last
 * flag on where a finish follows the flags, never in flag hunts and free runs.
 */
import { describe, expect, it } from 'vitest';
import { Level, LEVEL_COUNT, missionTypeForMode, type LevelData, type RunMode } from '@parapet/sim';
import { showsFinishPointer } from '../src/app/ui/finishPointer.ts';

const levelFiles = import.meta.glob('@content/playman/extracted/levels/*.json', {
  eager: true,
  import: 'default',
});

/** Level `levelId` laid out for `mode`, or null when the level has no such mission. */
function levelFor(levelId: number, mode: RunMode): Level | null {
  const found = Object.entries(levelFiles).find(([path]) => path.endsWith(`/${levelId}.json`));
  if (!found) throw new Error(`level ${levelId} is missing`);
  try {
    return new Level(found[1] as LevelData, missionTypeForMode(mode));
  } catch {
    return null;
  }
}

/** The flags mask with the first `taken` flags taken. */
const taken = (n: number): number => -1 ^ ((1 << n) - 1);

describe('the sign towards the finish', () => {
  it('shows all through a score run', () => {
    for (let levelId = 0; levelId < LEVEL_COUNT; levelId++) {
      const level = levelFor(levelId, 'score')!;
      expect(showsFinishPointer('score', level, -1), `level ${levelId}`).toBe(true);
    }
  });

  it('shows in a sprint once the fifth checkpoint is taken', () => {
    for (let levelId = 0; levelId < LEVEL_COUNT; levelId++) {
      const level = levelFor(levelId, 'sprint')!;
      expect(level.checkpoints.length).toBe(5);
      expect(showsFinishPointer('sprint', level, -1)).toBe(false);
      expect(showsFinishPointer('sprint', level, taken(4))).toBe(false);
      expect(showsFinishPointer('sprint', level, taken(5)), `level ${levelId}`).toBe(true);
    }
  });

  it('shows in a challenge once its flag is taken, and never in one without a flag', () => {
    const withFlag: number[] = [];
    for (let levelId = 0; levelId < LEVEL_COUNT; levelId++) {
      const level = levelFor(levelId, 'challenge');
      if (!level) continue;
      if (level.checkpoints.length === 0) {
        expect(showsFinishPointer('challenge', level, 0), `level ${levelId}`).toBe(false);
        continue;
      }
      withFlag.push(levelId);
      expect(showsFinishPointer('challenge', level, -1)).toBe(false);
      expect(showsFinishPointer('challenge', level, taken(level.checkpoints.length))).toBe(true);
    }
    expect(withFlag).toEqual([2, 3, 5, 6]);
  });

  it('shows in the warm-ups once their flag is taken', () => {
    for (const mode of ['warmup1', 'warmup2'] as const) {
      const level = levelFor(0, mode)!;
      expect(showsFinishPointer(mode, level, -1)).toBe(false);
      expect(showsFinishPointer(mode, level, taken(level.checkpoints.length)), mode).toBe(true);
    }
  });

  it('never shows in flag hunts and free runs', () => {
    for (let levelId = 0; levelId < LEVEL_COUNT; levelId++) {
      expect(showsFinishPointer('flags', levelFor(levelId, 'flags')!, 0)).toBe(false);
      expect(showsFinishPointer('free', levelFor(levelId, 'free')!, 0)).toBe(false);
    }
  });
});
