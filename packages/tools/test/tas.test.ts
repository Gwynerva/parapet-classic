/** The TAS tool: the keyboard model, the human limits and a short search on level 1. */
import { describe, expect, it } from 'vitest';
import { checkRun, DEFAULT_CONSTRAINTS, pressProblem } from '../src/tas/constraints.ts';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GENERATED_DIR, levelContent } from '../src/tas/content.ts';
import { contestCharacter, formatPresses, keyBits, Key, parsePresses } from '../src/tas/model.ts';
import { DEFAULT_SEARCH, rng, Search } from '../src/tas/search.ts';
import { playFull } from '../src/tas/timeline.ts';

describe('TAS model', () => {
  it('presses keys like a keyboard does', () => {
    expect(keyBits(Key.UP, true)).toBe(1);
    expect(keyBits(Key.DOWN, false)).toBe(2);
    expect(keyBits(Key.RIGHT, true)).toBe(4 | 16);
    expect(keyBits(Key.RIGHT, false)).toBe(4 | 32);
    expect(keyBits(Key.LEFT, true)).toBe(8 | 32);
    expect(keyBits(Key.LEFT, false)).toBe(8 | 16);
  });

  it('writes press lists as text and back', () => {
    const presses = [
      { step: 0, key: Key.RIGHT },
      { step: 12, key: Key.UP },
      { step: 40, key: Key.DOWN },
    ] as const;
    const text = formatPresses(presses);
    expect(text).toBe('0:R 12:U 40:D');
    expect(parsePresses(text)).toEqual(presses);
    expect(() => parsePresses('3:X')).toThrow();
  });

  it('numbers the looks two per level, Flag hunt first', () => {
    expect(contestCharacter(0, 'flags')).toBe(10);
    expect(contestCharacter(0, 'sprint')).toBe(11);
    expect(contestCharacter(11, 'sprint')).toBe(33);
  });

  it('turns down presses closer than the human limit', () => {
    const ok = [
      { step: 0, key: Key.RIGHT },
      { step: 3, key: Key.UP },
    ] as const;
    expect(pressProblem(ok, DEFAULT_CONSTRAINTS)).toBeNull();
    expect(pressProblem([...ok, { step: 5, key: Key.UP }], DEFAULT_CONSTRAINTS)).toMatch(/2 steps/);
  });

  it('seeds its random numbers', () => {
    const a = rng(7);
    const b = rng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe.skipIf(!existsSync(join(GENERATED_DIR, 'moves.json')))('TAS search', () => {
  it('finds a finished, keyboard-made run of level 1 flag hunt', () => {
    const content = levelContent(0);
    const search = new Search(content, 'flags', {
      ...DEFAULT_SEARCH,
      seed: 1,
      budgetSteps: 2_000_000,
      minGap: DEFAULT_CONSTRAINTS.minGap,
    });
    const result = search.run();
    const best = result.finals[0];
    expect(best).toBeDefined();
    const play = playFull(content, 'flags', best!.presses);
    expect(play.finished).toBe(true);
    expect(play.time).toBe(best!.time);
    expect(play.splits).toHaveLength(5);
    // Faster than the original's default record of this mission (25 s).
    expect(play.time).toBeLessThan(25000);
    const checked = checkRun(content, 'flags', best!.presses, DEFAULT_CONSTRAINTS);
    expect(checked.problem).toBeNull();
    expect(checked.time).toBe(best!.time);
  }, 60000);
});
