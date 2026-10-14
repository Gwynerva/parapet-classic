/**
 * Style: how showy a run is, for the stylish records (`run --style`). A trick counts when the
 * runner enters its state (a state chained from the same trick, such as the second half of a
 * spider jump, is the same trick). Its worth is its points in the original's Score mode
 * (`reference/notes/02-moves.md`), and every repeat of a kind is worth half the one before, so
 * a varied run beats one trick done over and over. The tiger jump (kong) is worth next to
 * nothing: the fastest runs are full of it already.
 *
 * A run's tricks are kept as their counts packed into one number (three bits a kind, up to 7
 * of each; the eighth repeat would add under 1 %), which the search stores per cell. The score
 * follows from the counts: `weight × (2 − 2 × 0.5ⁿ)` for n tricks of a kind.
 *
 * A stylish run must not fail anywhere: no stumble, crash or pit (`scoreType` 0 states, the
 * original's fails), so no trick that ends on the ground counts as style.
 */
import type { MoveTableData, RunContent, WorldEvent } from '@parapet/sim';
import { keyBits, type ContestMode, type Press } from './model.ts';
import { newWorld, MAX_RUN_CLOCK } from './timeline.ts';

export interface TrickKind {
  id: string;
  /** Points of the trick in the original's Score mode (the tiger jump: next to none). */
  weight: number;
  /** States that start it. */
  states: readonly number[];
}

export const TRICKS: readonly TrickKind[] = [
  { id: 'wallFlip', weight: 250, states: [48] },
  { id: 'spiderJump', weight: 250, states: [66, 67] },
  { id: 'monkeyFlip', weight: 250, states: [68, 69] },
  { id: 'monkeyVault', weight: 200, states: [62] },
  { id: 'backFlip', weight: 150, states: [64] },
  { id: 'frontFlip', weight: 100, states: [63] },
  { id: 'dash', weight: 100, states: [94] },
  { id: 'kongToLedge', weight: 100, states: [102] },
  { id: 'ticTac', weight: 50, states: [29, 39] },
  { id: 'poleJump', weight: 50, states: [123] },
  { id: 'poleSpin', weight: 50, states: [125] },
  { id: 'tigerJump', weight: 10, states: [56] },
];

const BITS = 3;
const MAX_COUNT = (1 << BITS) - 1;

/** Kind index of a state, or -1. */
const KIND_OF_STATE = new Int8Array(256).fill(-1);
TRICKS.forEach((t, k) => {
  for (const s of t.states) KIND_OF_STATE[s] = k;
});

/** The most a run can score. */
export const MAX_STYLE = TRICKS.reduce((sum, t) => sum + 2 * t.weight, 0);

/** How many tricks of kind `k` packed counts hold. */
export function trickCount(packed: number, k: number): number {
  return Math.floor(packed / 2 ** (BITS * k)) % (MAX_COUNT + 1);
}

/** Packed counts with one more trick of kind `k` (no more than 7 are kept). */
export function addTrick(packed: number, k: number): number {
  return trickCount(packed, k) >= MAX_COUNT ? packed : packed + 2 ** (BITS * k);
}

/** The style score of packed counts. */
export function styleScore(packed: number): number {
  let score = 0;
  for (let k = 0; k < TRICKS.length; k++) {
    const n = trickCount(packed, k);
    if (n > 0) score += TRICKS[k]!.weight * (2 - 2 * 0.5 ** n);
  }
  return score;
}

/** Packed counts as a readable record, kinds with none left out. */
export function trickCounts(packed: number): Record<string, number> {
  const out: Record<string, number> = {};
  TRICKS.forEach((t, k) => {
    const n = trickCount(packed, k);
    if (n > 0) out[t.id] = n;
  });
  return out;
}

/** The states a run fails in (the original's `scoreType` 0: stumbles, crashes). */
export function failStates(moves: MoveTableData): Uint8Array {
  const out = new Uint8Array(256);
  for (const m of moves.states) if (m.scoreType === 0) out[m.id] = 1;
  return out;
}

/**
 * Applies a step's events of `runner` to packed counts: the new counts, or -1 when the runner
 * failed (a fail state or a pit).
 */
export function styleStep(
  packed: number,
  events: readonly WorldEvent[],
  runner: unknown,
  fails: Uint8Array,
  onTrick?: (kind: number) => void,
): number {
  let out = packed;
  for (const e of events) {
    if (e.type === 'pit' && e.runner === runner) return -1;
    if (e.type !== 'move' || e.runner !== runner) continue;
    if (fails[e.to]) return -1;
    const k = KIND_OF_STATE[e.to]!;
    if (k >= 0 && KIND_OF_STATE[e.from] !== k) {
      out = addTrick(out, k);
      onTrick?.(k);
    }
  }
  return out;
}

export interface RunStyle {
  /** Finish time, or null when the run does not finish by the limit. */
  time: number | null;
  /** The tricks, packed (`trickCount`), counted up to the first fail. */
  packed: number;
  score: number;
  /** Every trick of each kind, however many (the packed counts stop at 7). */
  tricks: Record<string, number>;
  /** Whether the runner failed anywhere (a stumble, a crash, a pit). */
  failed: boolean;
}

/** Plays a press list and tells its style. */
export function styleOf(
  content: RunContent,
  mode: ContestMode,
  presses: readonly Press[],
  limitClock = MAX_RUN_CLOCK,
): RunStyle {
  const world = newWorld(content, mode);
  const fails = failStates(content.moves);
  let packed = 0;
  let failed = false;
  const tricks: Record<string, number> = {};
  const count = (k: number): void => {
    const id = TRICKS[k]!.id;
    tricks[id] = (tricks[id] ?? 0) + 1;
  };
  let i = 0;
  for (;;) {
    let bits = 0;
    const p = presses[i];
    if (p && p.step === world.stepCount) {
      bits = keyBits(p.key, world.player.facingRight);
      i++;
    }
    const going = world.step(bits);
    if (!failed) {
      const next = styleStep(packed, world.events, world.player, fails, count);
      if (next < 0) failed = true;
      else packed = next;
    }
    if (!going || world.clock > limitClock) break;
  }
  const result = world.rules.result;
  // A run finishing on the step that passes the limit is over it too.
  const finished = result?.finished === true && result.time <= limitClock;
  return {
    time: finished ? result.time : null,
    packed,
    score: styleScore(packed),
    tricks,
    failed,
  };
}
