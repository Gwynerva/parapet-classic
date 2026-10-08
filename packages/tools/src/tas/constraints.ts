/**
 * The "human" limits Gwynerva's runs are searched under, so her times are very hard but not
 * impossible to beat:
 *
 * - presses only, one direction key at a time (no held keys, no two keys on one step), the way
 *   the original's developers recorded their rival runs;
 * - at least `minGap` steps between presses (3 steps ≈ 100 ms);
 * - no frame-perfect timing: every press has a window of at least two steps (≈ 70 ms). The
 *   press one step early or one step late must also finish the run, losing at most
 *   `toleranceMs`, with the presses after it either unchanged (the slip did not matter) or
 *   moved by the same step (the player follows what they see). A press that only works on
 *   its exact step is fragile.
 */
import type { RunContent } from '@parapet/sim';
import { KEY_CODES, type ContestMode, type Press } from './model.ts';
import { Timeline } from './timeline.ts';

export interface Constraints {
  minGap: number;
  toleranceMs: number;
}

export const DEFAULT_CONSTRAINTS: Readonly<Constraints> = { minGap: 3, toleranceMs: 300 };

/** Why a press list breaks the press rules, or null when it keeps them. */
export function pressProblem(presses: readonly Press[], c: Constraints): string | null {
  let last = -Infinity;
  for (const [i, p] of presses.entries()) {
    if (!Number.isInteger(p.step) || p.step < 0) return `press ${i}: bad step ${p.step}`;
    if (!KEY_CODES.includes(p.key)) return `press ${i}: bad key ${p.key}`;
    if (p.step - last < c.minGap) {
      return `press ${i} at step ${p.step}: only ${p.step - last} steps after the previous one`;
    }
    last = p.step;
  }
  return null;
}

export interface Robustness {
  /** Indices of presses that only work on their exact step (frame-perfect). */
  fragile: number[];
  /** Largest time lost by moving a press to the better neighbouring step, in ms. */
  worstLossMs: number;
}

/**
 * The smallest time lost when press `i` lands one step early or late, or Infinity when the
 * run then breaks (the press is frame-perfect).
 */
function slipLoss(timeline: Timeline, i: number, c: Constraints): number {
  const base = timeline.time!;
  const presses = timeline.presses;
  const p = presses[i]!;
  const limit = base + c.toleranceMs;
  let loss = Infinity;
  for (const d of [-1, 1]) {
    const step = p.step + d;
    if (step < 0) continue;
    const alone = presses.slice();
    alone[i] = { step, key: p.key };
    const withTail = presses.map((q, j) => (j >= i ? { step: q.step + d, key: q.key } : q));
    for (const variant of [alone, withTail]) {
      const t = timeline.timeOf(variant, Math.min(step, p.step), limit);
      if (t !== null) loss = Math.min(loss, Math.max(0, t - base));
      if (loss === 0) return 0;
    }
  }
  return loss;
}

/** Moves every press one step each way and sees whether one of the two still works. */
export function robustness(timeline: Timeline, c: Constraints): Robustness {
  const presses = timeline.presses;
  if (timeline.time === null) return { fragile: presses.map((_, i) => i), worstLossMs: Infinity };
  const fragile: number[] = [];
  let worst = 0;
  for (let i = 0; i < presses.length; i++) {
    const loss = slipLoss(timeline, i, c);
    if (loss === Infinity) fragile.push(i);
    else worst = Math.max(worst, loss);
  }
  return { fragile, worstLossMs: worst };
}

/** Frame-perfect presses counted by `countFragile`. */
export interface FragileCount {
  /** How many, counting no further than the limit + 1. */
  count: number;
  /** Index of the earliest one found (they are searched from the end), or -1. */
  index: number;
}

/**
 * The frame-perfect presses of a run, searched from its end and counted no further than
 * `limit + 1` (cheaper than `robustness` when a run is turned down anyway).
 */
export function countFragile(timeline: Timeline, c: Constraints, limit: number): FragileCount {
  if (timeline.time === null) return { count: Infinity, index: -1 };
  let count = 0;
  let index = -1;
  for (let i = timeline.presses.length - 1; i >= 0 && count <= limit; i--) {
    if (slipLoss(timeline, i, c) === Infinity) {
      count++;
      index = i;
    }
  }
  return { count, index };
}

/** Builds the timeline of `presses` and checks its robustness. */
export function checkRun(
  content: RunContent,
  mode: ContestMode,
  presses: readonly Press[],
  c: Constraints,
): { time: number | null; problem: string | null; robustness: Robustness } {
  const timeline = new Timeline(content, mode, presses);
  return {
    time: timeline.time,
    problem: pressProblem(presses, c),
    robustness: robustness(timeline, c),
  };
}
