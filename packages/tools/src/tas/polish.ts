/**
 * Local optimisation of a finished run. The search finds the route; polishing shaves it: every
 * press is tried deleted, moved a few steps, swapped for another key, and new presses are
 * tried in the pauses. The score is the time plus a penalty per frame-perfect press
 * (`robustness`), so a change is kept when the run gets faster without becoming harder to
 * repeat, or when it removes a frame-perfect press for less time than the penalty.
 */
import type { RunContent } from '@parapet/sim';
import {
  countFragile,
  pressProblem,
  robustness,
  type Constraints,
  type Robustness,
} from './constraints.ts';
import { KEY_CODES, type ContestMode, type Press } from './model.ts';
import { Timeline } from './timeline.ts';

export interface PolishOptions {
  constraints: Constraints;
  /** Score penalty per fragile press, in ms. */
  fragilePenaltyMs: number;
  /** Variants evaluated at most. */
  maxEvaluations: number;
}

export const DEFAULT_POLISH: Readonly<Omit<PolishOptions, 'constraints'>> = {
  fragilePenaltyMs: 1500,
  maxEvaluations: 60000,
};

export interface PolishResult {
  presses: Press[];
  time: number;
  robustness: Robustness;
  evaluations: number;
}

const SHIFTS = [-8, -5, -3, -2, -1, 1, 2, 3, 5, 8];

/** Every variant of `presses` one edit away, with the first step it changes. */
function* variants(presses: readonly Press[], minGap: number): Generator<[Press[], number]> {
  const n = presses.length;
  for (let i = 0; i < n; i++) {
    const p = presses[i]!;
    const without = presses.slice(0, i).concat(presses.slice(i + 1));
    yield [without, p.step];
    for (const d of SHIFTS) {
      const step = p.step + d;
      if (step < 0) continue;
      const v = presses.slice();
      v[i] = { step, key: p.key };
      yield [v, Math.min(step, p.step)];
    }
    for (const key of KEY_CODES) {
      if (key === p.key) continue;
      const v = presses.slice();
      v[i] = { step: p.step, key };
      yield [v, p.step];
    }
  }
  // New presses in the pauses: right after a press, in the middle, right before the next one.
  for (let i = -1; i < n; i++) {
    const from = i < 0 ? 0 : presses[i]!.step + minGap;
    const to = i + 1 < n ? presses[i + 1]!.step - minGap : from + 4 * minGap;
    if (to < from) continue;
    const spots = new Set([from, Math.floor((from + to) / 2), to]);
    for (const step of spots) {
      for (const key of KEY_CODES) {
        const v = presses.slice();
        v.splice(i + 1, 0, { step, key });
        yield [v, step];
      }
    }
  }
}

export function polish(
  content: RunContent,
  mode: ContestMode,
  start: readonly Press[],
  options: PolishOptions,
): PolishResult {
  const c = options.constraints;
  let timeline = new Timeline(content, mode, start);
  if (timeline.time === null) throw new Error('polish: the run does not finish');
  let evaluations = 0;
  const budgetLeft = (): boolean => evaluations < options.maxEvaluations;

  let rob = robustness(timeline, c);
  let score = timeline.time! + options.fragilePenaltyMs * rob.fragile.length;
  let improved = true;
  while (improved && budgetLeft()) {
    improved = false;
    for (const [variant, from] of variants(timeline.presses, c.minGap)) {
      if (!budgetLeft()) break;
      if (pressProblem(variant, c) !== null) continue;
      evaluations++;
      const t = timeline.timeOf(variant, from, score - 1);
      if (t === null || t >= score) continue;
      const candidate = new Timeline(content, mode, variant);
      evaluations += 2 * variant.length;
      // A run without frame-perfect presses only takes changes that keep it so.
      if (rob.fragile.length === 0) {
        if (countFragile(candidate, c, 0).count > 0) continue;
        timeline = candidate;
        score = t;
        improved = true;
        break;
      }
      const candidateRob = robustness(candidate, c);
      const candidateScore = t + options.fragilePenaltyMs * candidateRob.fragile.length;
      if (candidateScore < score) {
        timeline = candidate;
        rob = candidateRob;
        score = candidateScore;
        improved = true;
        break;
      }
    }
  }

  return {
    presses: timeline.presses.slice(),
    time: timeline.time!,
    robustness: robustness(timeline, c),
    evaluations,
  };
}

/**
 * Drops every press the run does without: one whose removal keeps the time and adds no
 * frame-perfect press. A search leaves many presses that change nothing (a jump key while
 * already in the air); a human would not press them, and fewer presses read as the run it is.
 */
export function tidy(
  content: RunContent,
  mode: ContestMode,
  start: readonly Press[],
  c: Constraints,
): { presses: Press[]; removed: number } {
  let timeline = new Timeline(content, mode, start);
  const time = timeline.time;
  if (time === null) throw new Error('tidy: the run does not finish');
  const fragile = robustness(timeline, c).fragile.length;
  let removed = 0;
  for (let i = timeline.presses.length - 1; i >= 0; i--) {
    const presses = timeline.presses;
    const p = presses[i]!;
    const variant = presses.slice(0, i).concat(presses.slice(i + 1));
    const t = timeline.timeOf(variant, p.step, time);
    if (t === null || t > time) continue;
    const candidate = new Timeline(content, mode, variant);
    if (countFragile(candidate, c, fragile).count > fragile) continue;
    timeline = candidate;
    removed++;
  }
  return { presses: timeline.presses.slice(), removed };
}
