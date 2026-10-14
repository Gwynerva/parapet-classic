/**
 * The score never drops: a fail computes a penalty, the chain's pending points times the
 * multiplier, and the original never subtracts it. What a fail costs is the trick in progress
 * and 2048 of the meter, which lowers the multiplier.
 */
import { viewScene } from '../experiments/camera.ts';
import { hudScene, scoreChart, scoreRun } from '../experiments/score.ts';
import type { Facts, Finding } from '../finding.ts';
import type { Lab } from '../lab.ts';
import { gridScene, STEP_MS } from '../scene.ts';

/** The level and mission of the run, and the length of the animation. */
const LEVEL = 2;
const MODE = 'score';
const HUD_STEPS = 170;

interface ScoreFacts extends Facts {
  fails: number;
  /** The penalties computed, their sum, the largest. */
  penalties: readonly number[];
  total: number;
  /** The final score, and what the penalties would have left. */
  score: number;
  withPenalty: number;
  /** The score fell on some step. */
  everDrops: boolean;
  /** The meter before and after each fail. */
  meters: readonly number[];
  /** Every fail leaves the meter 2048 lower, or empty. */
  meterRule: boolean;
}

/** Pairs `before → after`. */
function pairs(values: readonly number[]): string {
  const out: string[] = [];
  for (let i = 0; i + 1 < values.length; i += 2) out.push(`${values[i]} → ${values[i + 1]}`);
  return out.join(', ');
}

export const scoreNeverDrops: Finding<ScoreFacts> = {
  slug: '13-the-score-never-drops',
  title: 'The score never drops',
  claim:
    'A fail works out a penalty and never applies it: the score only goes up. A fail costs the trick in progress and part of the multiplier.',

  facts(lab: Lab): ScoreFacts {
    const s = scoreRun(lab, LEVEL, MODE);
    const last = s.scores.at(-1)!;
    let everDrops = false;

    for (let i = 1; i < s.scores.length; i++) {
      if (s.scores[i]!.score < s.scores[i - 1]!.score) everDrops = true;
    }
    const meters = s.fails.flatMap((f) => {
      const i = f.step - s.run.track.start + 1;
      return [s.scores[i - 1]!.meter, s.scores[i]!.meter];
    });
    return {
      fails: s.fails.length,
      penalties: s.fails.map((f) => f.penalty),
      total: s.fails.reduce((n, f) => n + f.penalty, 0),
      score: last.score,
      withPenalty: last.withPenalty,
      everDrops,
      meters,
      meterRule: s.fails.every((_, k) => meters[2 * k + 1] === Math.max(0, meters[2 * k]! - 2048)),
    };
  },

  measured(f: ScoreFacts): [string, string][] {
    return [
      ['Fails of the run, and their penalties', `${f.fails}: ${f.penalties.join(', ')}`],
      ['Final score, and with the penalties subtracted', `${f.score}, ${f.withPenalty}`],
      ['Steps on which the score went down', f.everDrops ? 'some' : 'none'],
      ['The meter before and after each fail (of 5120)', pairs(f.meters)],
    ];
  },

  checks(f: ScoreFacts): string[] {
    const out: string[] = [];
    if (f.everDrops) out.push('the score went down');
    if (f.penalties.filter((p) => p < 0).length < 2)
      out.push('fewer than two fails with a penalty');
    if (!f.meterRule) out.push('a fail does not take 2048 off the meter');
    return out;
  },

  clips(lab: Lab) {
    const s = scoreRun(lab, LEVEL, MODE);
    // Around the biggest penalty.
    const worst = s.fails.reduce((a, b) => (b.penalty < a.penalty ? b : a));
    const from = Math.max(s.run.track.start, worst.step - 100);
    const to = from + HUD_STEPS;
    const view = viewScene(lab, s.run, from, to, false);
    const hud = hudScene(lab, s, from, to, view.width);
    const scene = gridScene([hud, view], 1, 0);
    return [
      {
        name: 'fail',
        alt: `A run of ${lab.levelName(LEVEL)} fails; the penalty (${worst.penalty}) floats up by the score and fades, and the score (white) stays as it was; under it in red, the score the penalties would have left. The meter and the multiplier drop.`,
        scene,
        gifScale: 1,
        script: [
          { from, to: worst.step - 10 },
          { from: worst.step - 10, to: worst.step + 30, speed: 0.5 },
          { from: worst.step + 30, to },
          { at: to, holdMs: 800 },
        ],
      },
    ];
  },

  charts(lab: Lab) {
    return [
      {
        name: 'score',
        alt: 'The score of a run with fails rises in steps and never falls; a dashed line shows what it would be if each fail’s penalty were subtracted, and under it the multiplier falls at every fail.',
        svg: scoreChart(
          scoreRun(lab, LEVEL, MODE),
          STEP_MS,
          'The score only goes up',
          `The rival’s presses of ${lab.levelName(LEVEL)}, pressed by the player from the player’s start: a run that fails`,
        ),
      },
    ];
  },
};
