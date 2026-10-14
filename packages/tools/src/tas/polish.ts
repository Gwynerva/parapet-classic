/**
 * Local optimisation of a finished run. The search finds the route; polishing shaves it: every
 * press is tried deleted, moved a few steps, swapped for another key, and new presses are
 * tried in the pauses. A change is kept when it removes a frame-perfect press (`robustness`),
 * whatever that costs, or when it makes the run faster without adding one. So a run without
 * frame-perfect presses stays without, and one with them is repaired as far as single changes
 * go before it gets faster.
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
import { styleOf, type RunStyle } from './style.ts';
import { MAX_RUN_CLOCK, Timeline } from './timeline.ts';

export interface PolishOptions {
  constraints: Constraints;
  /** Variants evaluated at most. */
  maxEvaluations: number;
}

export const DEFAULT_POLISH: Readonly<Omit<PolishOptions, 'constraints'>> = {
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

  let fragile = robustness(timeline, c).fragile.length;
  let time = timeline.time!;
  let improved = true;
  while (improved && budgetLeft()) {
    improved = false;
    for (const [variant, from] of variants(timeline.presses, c.minGap)) {
      if (!budgetLeft()) break;
      if (pressProblem(variant, c) !== null) continue;
      evaluations++;
      // While a frame-perfect press is left, a slower run may still be better.
      const t = timeline.timeOf(variant, from, fragile > 0 ? MAX_RUN_CLOCK : time - 1);
      if (t === null || (fragile === 0 && t >= time)) continue;
      const candidate = new Timeline(content, mode, variant);
      evaluations += 2 * variant.length;
      if (fragile === 0) {
        // A run without frame-perfect presses only takes changes that keep it so.
        if (countFragile(candidate, c, 0).count > 0) continue;
      } else {
        const count = countFragile(candidate, c, fragile).count;
        if (count > fragile || (count === fragile && t >= time)) continue;
        fragile = count;
      }
      timeline = candidate;
      time = t;
      improved = true;
      break;
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

/** Whether a style result is better than another: showier, or as showy and faster. */
function showier(a: RunStyle, b: RunStyle): boolean {
  if (Math.abs(a.score - b.score) > 1e-6) return a.score > b.score;
  return a.time! < b.time!;
}

/**
 * Polishing of a stylish run (`run --style`): a change is kept when it makes the run showier
 * (`style.ts`) within the cap, or as showy and faster; never one that fails anywhere or adds a
 * frame-perfect press. The run is to have none to start with.
 */
export function polishStyle(
  content: RunContent,
  mode: ContestMode,
  start: readonly Press[],
  options: PolishOptions & { capMs: number },
): PolishResult & { style: RunStyle } {
  const c = options.constraints;
  let timeline = new Timeline(content, mode, start);
  let current = styleOf(content, mode, start, options.capMs);
  if (current.time === null || current.failed) {
    throw new Error('polishStyle: the run does not finish within the cap without a fail');
  }
  let evaluations = 0;
  const budgetLeft = (): boolean => evaluations < options.maxEvaluations;
  let improved = true;
  while (improved && budgetLeft()) {
    improved = false;
    for (const [variant, from] of variants(timeline.presses, c.minGap)) {
      if (!budgetLeft()) break;
      if (pressProblem(variant, c) !== null) continue;
      evaluations++;
      if (timeline.timeOf(variant, from, options.capMs) === null) continue;
      const style = styleOf(content, mode, variant, options.capMs);
      evaluations++;
      if (style.time === null || style.failed || !showier(style, current)) continue;
      const candidate = new Timeline(content, mode, variant);
      evaluations += 2 * variant.length;
      if (countFragile(candidate, c, 0).count > 0) continue;
      timeline = candidate;
      current = style;
      improved = true;
      break;
    }
  }
  return {
    presses: timeline.presses.slice(),
    time: current.time!,
    robustness: robustness(timeline, c),
    evaluations,
    style: current,
  };
}

/**
 * `tidy` for a stylish run: drops every press it does without, keeping its style, its time (or
 * better), no fail and no new frame-perfect press.
 */
export function tidyStyle(
  content: RunContent,
  mode: ContestMode,
  start: readonly Press[],
  c: Constraints,
  capMs: number,
): { presses: Press[]; removed: number } {
  let presses = start.slice();
  const base = styleOf(content, mode, presses, capMs);
  if (base.time === null) throw new Error('tidyStyle: the run does not finish within the cap');
  const fragile = robustness(new Timeline(content, mode, presses), c).fragile.length;
  let removed = 0;
  for (let i = presses.length - 1; i >= 0; i--) {
    const variant = presses.slice(0, i).concat(presses.slice(i + 1));
    const style = styleOf(content, mode, variant, capMs);
    if (style.time === null || style.failed || style.time > base.time) continue;
    if (style.score < base.score - 1e-6) continue;
    if (countFragile(new Timeline(content, mode, variant), c, fragile).count > fragile) continue;
    presses = variant;
    removed++;
  }
  return { presses, removed };
}
