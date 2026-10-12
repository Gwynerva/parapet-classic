/**
 * What beating a boss gives (`app/bosses.ts`): either record opens it plain, both give it its
 * effect (in any order), and the player always plays the version they have.
 */
import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT, STEP } from '@parapet/sim';
import type { ContestProgress } from '@parapet/runtime/storage/profile.ts';
import contestsJson from '@content/bosses/contests.json';
import {
  allBosses,
  bossCharacterFor,
  bossOfCharacter,
  CONTEST_ALLOWANCE,
  contestCharacter,
  contestRecord,
  effectOf,
  isBossUnlocked,
  upgradeCharacter,
} from '../src/app/bosses.ts';

const won = (flags: number[], sprint: number[]): ContestProgress => ({
  beaten: {
    flags: flags.reduce((m, l) => m | (1 << l), 0),
    sprint: sprint.reduce((m, l) => m | (1 << l), 0),
  },
});

describe('bosses', () => {
  const level = 0;
  const withFx = contestCharacter(level, 'flags');
  const plain = contestCharacter(level, 'sprint');

  it('keep two character numbers per level: with the effect, then plain', () => {
    expect([withFx, plain]).toEqual([10, 11]);
    expect(bossOfCharacter(withFx)?.effects).toBe(true);
    expect(bossOfCharacter(plain)?.effects).toBe(false);
    expect(bossOfCharacter(plain)?.levelId).toBe(level);
    expect(bossOfCharacter(9)).toBeNull();
  });

  it('open plain with one win (either), with the effect with both', () => {
    expect(bossCharacterFor(level, won([], []))).toBeNull();
    expect(bossCharacterFor(level, won([], [level]))).toBe(plain);
    expect(bossCharacterFor(level, won([level], []))).toBe(plain);
    expect(bossCharacterFor(level, won([level], [level]))).toBe(withFx);
    expect(bossCharacterFor(level, won([level + 1], [level + 1]))).toBeNull();
    for (const one of [won([], [level]), won([level], [])]) {
      expect(isBossUnlocked(plain, one)).toBe(true);
      expect(isBossUnlocked(withFx, one)).toBe(false);
    }
    expect(isBossUnlocked(withFx, won([level], [level]))).toBe(true);
    expect(isBossUnlocked(plain, won([level], [level]))).toBe(true);
    expect(isBossUnlocked(plain, won([], []))).toBe(false);
  });

  it('upgrade a plain boss once both records fall, and take back an effect not earned', () => {
    expect(upgradeCharacter(plain, won([], [level]))).toBe(plain);
    expect(upgradeCharacter(plain, won([level], []))).toBe(plain);
    expect(upgradeCharacter(plain, won([level], [level]))).toBe(withFx);
    expect(upgradeCharacter(withFx, won([level], []))).toBe(plain);
    expect(upgradeCharacter(3, won([level], []))).toBe(3);
  });

  it('race their found runs slower, by the same share on every level', () => {
    expect(CONTEST_ALLOWANCE).toBeCloseTo(0.065);
    const contests = contestsJson as { levels: { sprint: { timeMs: number } }[] };
    for (const levelId of [0, LEVEL_COUNT - 1]) {
      const found = contests.levels[levelId]!.sprint;
      const raced = contestRecord(levelId, 'sprint')!;
      expect(raced.timeMs / found.timeMs).toBeCloseTo(1.065, 2);
    }
    for (let levelId = 0; levelId < LEVEL_COUNT; levelId++) {
      for (const kind of ['flags', 'sprint'] as const) {
        const { timeMs, splitsMs } = contestRecord(levelId, kind)!;
        for (const ms of [...splitsMs, timeMs]) expect(ms % STEP).toBe(0);
        for (let k = 1; k < splitsMs.length; k++) {
          expect(splitsMs[k]!).toBeGreaterThan(splitsMs[k - 1]!);
        }
        expect(splitsMs.at(-1)!).toBeLessThanOrEqual(timeMs);
      }
    }
  });

  it('wear their effect, or an outfit its own', () => {
    for (const boss of allBosses()) {
      expect(boss.data.effect.length, boss.id).toBeGreaterThan(0);
      for (const look of boss.looks) {
        for (const v of effectOf(boss, look))
          expect(boss.fx?.variants[v], `${boss.id} ${v}`).toBeTruthy();
      }
    }
  });
});
