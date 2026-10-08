/**
 * What beating a boss gives (`app/bosses.ts`): either record opens it, the Flag hunt one gives it
 * its effect, and the player always plays the best version they have.
 */
import { describe, expect, it } from 'vitest';
import type { ContestProgress } from '@parapet/runtime/storage/profile.ts';
import {
  allBosses,
  bossCharacterFor,
  bossOfCharacter,
  contestCharacter,
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

  it('open plain with Sprint, with the effect with Flag hunt', () => {
    expect(bossCharacterFor(level, won([], []))).toBeNull();
    expect(bossCharacterFor(level, won([], [level]))).toBe(plain);
    expect(bossCharacterFor(level, won([level], []))).toBe(withFx);
    expect(bossCharacterFor(level, won([level], [level]))).toBe(withFx);
    expect(isBossUnlocked(plain, won([], [level]))).toBe(true);
    expect(isBossUnlocked(withFx, won([], [level]))).toBe(false);
    expect(isBossUnlocked(withFx, won([level], []))).toBe(true);
    expect(isBossUnlocked(plain, won([], []))).toBe(false);
  });

  it('upgrade a plain boss once its Flag hunt record falls', () => {
    expect(upgradeCharacter(plain, won([], [level]))).toBe(plain);
    expect(upgradeCharacter(plain, won([level], [level]))).toBe(withFx);
    expect(upgradeCharacter(3, won([level], []))).toBe(3);
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
