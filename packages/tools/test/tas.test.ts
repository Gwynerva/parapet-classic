/**
 * The TAS tool: the keyboard model, the human limits, the rule that keeps a run without a
 * frame-perfect press over any with one, style, and short searches on level 1 (for speed and
 * for style).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  checkRun,
  countFragile,
  DEFAULT_CONSTRAINTS,
  pressProblem,
  robustness,
} from '../src/tas/constraints.ts';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GENERATED_DIR, levelContent } from '../src/tas/content.ts';
import { jobKey } from '../src/tas/files.ts';
import {
  betterRun,
  betterStyleRun,
  needsSearch,
  needsStyleSearch,
  runFile,
  styleCap,
} from '../src/tas/job.ts';
import {
  contestCharacter,
  formatPresses,
  keyBits,
  Key,
  parsePresses,
  type Press,
} from '../src/tas/model.ts';
import { DEFAULT_POLISH, polish } from '../src/tas/polish.ts';
import { DEFAULT_SEARCH, rng, Search, type FinalRun } from '../src/tas/search.ts';
import {
  addTrick,
  failStates,
  styleOf,
  styleScore,
  styleStep,
  trickCount,
  trickCounts,
  TRICKS,
} from '../src/tas/style.ts';
import { playFull, Timeline } from '../src/tas/timeline.ts';

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

describe('TAS keep rule', () => {
  it('prefers a run without frame-perfect presses, whatever the times', () => {
    const clean = { timeMs: 30000, fragile: [] };
    const fragile = { timeMs: 20000, fragile: [4] };
    expect(betterRun(clean, fragile)).toBe(true);
    expect(betterRun(fragile, clean)).toBe(false);
    expect(betterRun({ timeMs: 29000, fragile: [] }, clean)).toBe(true);
    expect(betterRun(clean, clean)).toBe(false);
    expect(betterRun({ timeMs: 40000, fragile: [1] }, { timeMs: 20000, fragile: [1, 2] })).toBe(
      true,
    );
  });
});

describe('style', () => {
  const kind = (id: string): number => TRICKS.findIndex((t) => t.id === id);
  const runner = {};
  const move = (from: number, to: number) => ({ type: 'move', runner, from, to }) as never;

  it("is worth a trick's points, each repeat half the one before", () => {
    const wallFlip = kind('wallFlip');
    let packed = addTrick(0, wallFlip);
    expect(styleScore(packed)).toBe(250);
    packed = addTrick(packed, wallFlip);
    expect(styleScore(packed)).toBe(375);
    let tigers = 0;
    for (let i = 0; i < 4; i++) tigers = addTrick(tigers, kind('tigerJump'));
    expect(styleScore(tigers)).toBeCloseTo(18.75);
    expect(trickCounts(addTrick(tigers, wallFlip))).toEqual({ wallFlip: 1, tigerJump: 4 });
  });

  it('keeps up to seven of a kind', () => {
    let packed = 0;
    for (let i = 0; i < 12; i++) packed = addTrick(packed, kind('backFlip'));
    expect(trickCount(packed, kind('backFlip'))).toBe(7);
    expect(trickCount(packed, kind('frontFlip'))).toBe(0);
  });

  it('counts a trick once through its chained states, and tells a fail', () => {
    const fails = new Uint8Array(256);
    fails[82] = 1;
    // A tiger jump, then a spider jump in two states.
    let packed = styleStep(0, [move(2, 56)], runner, fails);
    packed = styleStep(packed, [move(56, 66)], runner, fails);
    packed = styleStep(packed, [move(66, 67)], runner, fails);
    expect(trickCounts(packed)).toEqual({ spiderJump: 1, tigerJump: 1 });
    // Another runner's moves are not this one's.
    expect(
      styleStep(packed, [{ type: 'move', runner: {}, from: 2, to: 48 } as never], runner, fails),
    ).toBe(packed);
    expect(styleStep(packed, [move(65, 82)], runner, fails)).toBe(-1);
    expect(styleStep(packed, [{ type: 'pit', runner } as never], runner, fails)).toBe(-1);
  });

  it('keeps the showier stylish run, then the faster', () => {
    const a = { timeMs: 30000, fragile: [], style: { score: 500, tricks: {}, failed: false } };
    const b = { timeMs: 25000, fragile: [], style: { score: 400, tricks: {}, failed: false } };
    expect(betterStyleRun(a, b)).toBe(true);
    expect(betterStyleRun(b, a)).toBe(false);
    expect(betterStyleRun({ ...a, timeMs: 29000 }, a)).toBe(true);
    expect(betterStyleRun({ ...a, fragile: [2] }, b)).toBe(false);
    expect(styleCap(20000, 15)).toBe(23000);
  });

  it('keys the job log by what a job searched', () => {
    const job = {
      variant: 'style-05',
      levelId: 3,
      mode: 'sprint',
      seed: 2,
      budgetSteps: 4e8,
      capMs: 31000,
    } as const;
    expect(jobKey(job)).toBe(jobKey({ ...job }));
    expect(jobKey(job)).not.toBe(jobKey({ ...job, seed: 1 }));
    expect(jobKey(job)).not.toBe(jobKey({ ...job, capMs: 30000 }));
  });
});

describe.skipIf(!existsSync(join(GENERATED_DIR, 'moves.json')))('TAS search', () => {
  const content = existsSync(join(GENERATED_DIR, 'moves.json')) ? levelContent(0) : null;
  let found: FinalRun[] = [];

  beforeAll(() => {
    const search = new Search(
      content!,
      'flags',
      { ...DEFAULT_SEARCH, seed: 1, budgetSteps: 2_000_000, minGap: DEFAULT_CONSTRAINTS.minGap },
      (presses, limit) =>
        countFragile(new Timeline(content!, 'flags', presses), DEFAULT_CONSTRAINTS, limit),
    );
    found = search.run().finals;
  }, 120000);

  it('finds a finished, keyboard-made run of level 1 flag hunt', () => {
    const best = found[0];
    expect(best).toBeDefined();
    const play = playFull(content!, 'flags', best!.presses);
    expect(play.finished).toBe(true);
    expect(play.time).toBe(best!.time);
    expect(play.splits).toHaveLength(5);
    // Faster than the original's default record of this mission (25 s).
    expect(play.time).toBeLessThan(25000);
    const checked = checkRun(content!, 'flags', best!.presses, DEFAULT_CONSTRAINTS);
    expect(checked.problem).toBeNull();
    expect(checked.time).toBe(best!.time);
  });

  it('keeps no run with a frame-perfect press', () => {
    for (const run of found) {
      const timeline = new Timeline(content!, 'flags', run.presses);
      expect(robustness(timeline, DEFAULT_CONSTRAINTS).fragile).toEqual([]);
    }
  });

  it('polishes a run without making it slower or adding a frame-perfect press', () => {
    const best = found[0]!;
    const polished = polish(content!, 'flags', best.presses, {
      ...DEFAULT_POLISH,
      maxEvaluations: 4000,
      constraints: DEFAULT_CONSTRAINTS,
    });
    expect(polished.time).toBeLessThanOrEqual(best.time);
    expect(polished.robustness.fragile).toEqual([]);
  }, 120000);

  it('searches again only where the stored run is missing, outdated or fragile', () => {
    const best = found[0]!;
    const search = { seed: 1, budgetSteps: 0, steps: 0, iterations: 0, cells: 0 };
    const run = runFile(0, 'flags', DEFAULT_CONSTRAINTS, best.presses, search);
    expect(needsSearch(run, 0)).toBe(false);
    expect(needsSearch(null, 0)).toBe(true);
    expect(needsSearch({ ...run, fragile: [3] }, 0)).toBe(true);
    expect(needsSearch({ ...run, simVersion: 'parapet-sim@0.0.0' }, 0)).toBe(true);
    expect(needsSearch(run, 1)).toBe(true);
  });

  it('finds the showiest run within a cap, never failing', () => {
    const base = found[0]!;
    const capMs = styleCap(base.time, 15);
    const fragility = (presses: readonly Press[], limit: number) =>
      countFragile(new Timeline(content!, 'flags', presses), DEFAULT_CONSTRAINTS, limit);
    const search = new Search(
      content!,
      'flags',
      {
        ...DEFAULT_SEARCH,
        seed: 3,
        budgetSteps: 2_000_000,
        minGap: DEFAULT_CONSTRAINTS.minGap,
        style: { capMs, tierPoints: 100, weightMs: 4 },
      },
      fragility,
    );
    search.seed(base.presses);
    const finals = search.run().finals;
    expect(finals.length).toBeGreaterThan(0);
    const seedStyle = styleOf(content!, 'flags', base.presses).score;
    for (let i = 0; i < finals.length; i++) {
      const run = finals[i]!;
      const style = styleOf(content!, 'flags', run.presses);
      expect(style.time).toBe(run.time);
      expect(run.time).toBeLessThanOrEqual(capMs);
      expect(style.failed).toBe(false);
      expect(style.score).toBeCloseTo(run.style);
      expect(fragility(run.presses, 0).count).toBe(0);
      if (i > 0) expect(run.style).toBeLessThanOrEqual(finals[i - 1]!.style);
    }
    expect(finals[0]!.style).toBeGreaterThan(seedStyle);
  }, 120000);

  it('searches a stylish record again when its cap changes', () => {
    const best = found[0]!;
    const search = { seed: 1, budgetSteps: 0, steps: 0, iterations: 0, cells: 0 };
    const stylish = { variant: 'style-15', capPct: 15, optimalMs: best.time };
    const run = runFile(0, 'flags', DEFAULT_CONSTRAINTS, best.presses, search, stylish);
    expect(run.style?.failed).toBe(false);
    expect(needsStyleSearch(run, 0, best.time)).toBe(false);
    expect(needsStyleSearch(run, 0, best.time - 30)).toBe(true);
    expect(needsStyleSearch(null, 0, best.time)).toBe(true);
    expect(failStates(content!.moves)[82]).toBe(1);
  });
});
