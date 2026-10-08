/**
 * Playing press lists headlessly. A `Timeline` plays one list once and keeps the world state
 * before every press, so a variant that only changes the list from some press on is
 * re-simulated from there instead of from the start (the local optimisation and the
 * robustness check try hundreds of variants of one run).
 */
import {
  createRun,
  isSplitEvent,
  type InputRun,
  type RunContent,
  type World,
  type WorldState,
} from '@parapet/sim';
import { keyBits, type ContestMode, type Press } from './model.ts';

/** Clock (ms) after which a run that has not finished is given up. */
export const MAX_RUN_CLOCK = 240000;

export function newWorld(content: RunContent, mode: ContestMode): World {
  return createRun({
    mode,
    level: content.level,
    mission: content.mission,
    moves: content.moves,
    tables: content.tables,
    rival: null,
  });
}

/**
 * Steps `world` with `presses[from…]` until the run finishes (returns its time) or the clock
 * passes `limitClock` (returns null). Presses before the world's current step are skipped.
 */
export function runPresses(
  world: World,
  presses: readonly Press[],
  from: number,
  limitClock: number,
): number | null {
  let i = from;
  while (i < presses.length && presses[i]!.step < world.stepCount) i++;
  for (;;) {
    let bits = 0;
    const p = presses[i];
    if (p && p.step === world.stepCount) {
      bits = keyBits(p.key, world.player.facingRight);
      i++;
    }
    if (!world.step(bits)) break;
    if (world.clock > limitClock) return null;
  }
  const result = world.rules.result;
  return result?.finished ? result.time : null;
}

export interface FullPlay {
  finished: boolean;
  time: number;
  steps: number;
  /** Clock at every flag or checkpoint, in the order reached. */
  splits: number[];
  /** Flag or checkpoint index in the order reached. */
  order: number[];
  /** The input log a keyboard would have produced. */
  input: InputRun[];
}

/** Plays a press list from the start and reports everything about the run. */
export function playFull(
  content: RunContent,
  mode: ContestMode,
  presses: readonly Press[],
  limitClock = MAX_RUN_CLOCK,
): FullPlay {
  const world = newWorld(content, mode);
  const splits: number[] = [];
  const order: number[] = [];
  let i = 0;
  for (;;) {
    let bits = 0;
    const p = presses[i];
    if (p && p.step === world.stepCount) {
      bits = keyBits(p.key, world.player.facingRight);
      i++;
    }
    const going = world.step(bits);
    for (const e of world.events) {
      if (isSplitEvent(e)) {
        splits.push(world.clock);
        if (e.type === 'flag' || e.type === 'checkpoint') order.push(e.index);
      }
    }
    if (!going || world.clock > limitClock) break;
  }
  const result = world.rules.result;
  return {
    finished: result?.finished ?? false,
    time: result?.time ?? world.clock,
    steps: world.stepCount,
    splits,
    order,
    input: world.recorder.finish(),
  };
}

interface Checkpoint {
  step: number;
  state: WorldState;
}

export class Timeline {
  readonly presses: readonly Press[];
  /** Finish time, or null when the run does not finish within the limit. */
  readonly time: number | null;
  private readonly world: World;
  private readonly checkpoints: Checkpoint[] = [];

  constructor(
    content: RunContent,
    mode: ContestMode,
    presses: readonly Press[],
    limitClock = MAX_RUN_CLOCK,
  ) {
    this.presses = presses;
    this.world = newWorld(content, mode);
    const world = this.world;
    this.checkpoints.push({ step: 0, state: world.saveState(false) });
    let time: number | null = null;
    let i = 0;
    for (;;) {
      let bits = 0;
      const p = presses[i];
      if (p && p.step === world.stepCount) {
        this.checkpoints.push({ step: world.stepCount, state: world.saveState(false) });
        bits = keyBits(p.key, world.player.facingRight);
        i++;
      }
      if (!world.step(bits)) {
        time = world.rules.result?.finished ? world.rules.result.time : null;
        break;
      }
      if (world.clock > limitClock) break;
    }
    this.time = time;
  }

  /**
   * Finish time of `variant`, a press list equal to this timeline's up to step `fromStep`
   * (exclusive), or null when it does not finish by `limitClock`.
   */
  timeOf(variant: readonly Press[], fromStep: number, limitClock: number): number | null {
    let cp = this.checkpoints[0]!;
    for (const c of this.checkpoints) {
      if (c.step <= fromStep) cp = c;
      else break;
    }
    this.world.restoreState(cp.state);
    let from = 0;
    while (from < variant.length && variant[from]!.step < cp.step) from++;
    return runPresses(this.world, variant, from, limitClock);
  }
}
