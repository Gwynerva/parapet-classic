/**
 * What a runner is doing, as the effects see it: from its move (`RunnerState.moveId`) and how
 * far it went, the triggers going on this step and the ones that just started.
 */
import { FX_TRIGGERS, type FxTrigger } from './FxData.ts';

/** Moves of each trigger (see `MoveId` in the simulation and reference/notes/02-moves.md). */
export const TRIGGER_MOVES: Readonly<Partial<Record<FxTrigger, readonly number[]>>> = {
  idle: [0, 1, 5],
  run: [2, 3, 4],
  jump: [18, 19, 20, 121, 123],
  flip: [48, 63, 64, 65, 66, 67, 68, 69, 125],
  wall: [13, 20, 28, 29, 30, 33, 36, 37, 39, 40],
  roll: [21],
  slide: [13, 120, 127],
  ladder: [118, 119, 120],
  pole: [122, 123, 124, 125, 126, 127],
  vault: [56, 62],
  dash: [94, 95],
  hang: [100, 112, 115],
  turn: [6, 8],
  fail: [11, 54, 71, 72, 82, 83, 84, 85, 86, 87],
};

/** Moves in the air (a landing is a ground move entered from one of these). */
export const AIR_MOVES: ReadonlySet<number> = new Set([
  15, 18, 19, 20, 22, 48, 56, 63, 64, 65, 66, 67, 68, 69, 121, 123, 125,
]);
/** Moves on the ground. */
export const GROUND_MOVES: ReadonlySet<number> = new Set([2, 3, 4, 5, 21, 23, 24, 25, 51, 82, 84]);

/** Speed (pixels per second) above which a runner counts as fast: beyond a good run. */
export const FAST_PX = 140;
/** Steps per second of the simulation. */
const STEPS_PER_SECOND = 1000 / 30;

export function triggerBit(t: FxTrigger): number {
  return 1 << FX_TRIGGERS.indexOf(t);
}

const BY_MOVE = new Map<number, number>();
for (const [t, moves] of Object.entries(TRIGGER_MOVES)) {
  for (const m of moves ?? []) BY_MOVE.set(m, (BY_MOVE.get(m) ?? 0) | triggerBit(t as FxTrigger));
}

/** Trigger bits of being in `move` (without speed or landing). */
export function moveTriggers(move: number): number {
  let bits = (BY_MOVE.get(move) ?? 0) | triggerBit('any');
  if (AIR_MOVES.has(move)) bits |= triggerBit('air');
  return bits;
}

export interface MotionStep {
  /** Triggers going on (bits of `FX_TRIGGERS`). */
  active: number;
  /** Triggers that started this step. */
  entered: number;
  /** The move entered this step, or -1. */
  enteredMove: number;
  /** Pixels travelled this step. */
  distance: number;
  /** Pixels per second, over the last few steps. */
  speed: number;
  /** World units per step, for particles keeping part of the runner's motion. */
  vx: number;
  vy: number;
}

/** Follows one runner step by step. */
export class MotionTracker {
  private move = -1;
  private x = 0;
  private y = 0;
  private active = 0;
  private started = false;
  private readonly recent: number[] = [];
  private readonly out: MotionStep = {
    active: 0,
    entered: 0,
    enteredMove: -1,
    distance: 0,
    speed: 0,
    vx: 0,
    vy: 0,
  };

  /** Advance one step with the runner's move and position (world units). */
  step(move: number, x: number, y: number): MotionStep {
    const o = this.out;
    const dx = this.started ? x - this.x : 0;
    const dy = this.started ? y - this.y : 0;
    o.distance = Math.hypot(dx, dy) / 32;
    o.vx = dx;
    o.vy = dy;
    this.recent.push(o.distance);
    if (this.recent.length > 6) this.recent.shift();
    o.speed = (this.recent.reduce((a, b) => a + b, 0) / this.recent.length) * STEPS_PER_SECOND;
    let active = moveTriggers(move);
    if (o.speed > FAST_PX) active |= triggerBit('fast');
    const changed = this.started && move !== this.move;
    o.enteredMove = changed ? move : -1;
    if (changed && GROUND_MOVES.has(move) && AIR_MOVES.has(this.move)) {
      active |= triggerBit('land');
    }
    o.entered = this.started ? active & ~this.active : 0;
    // A move entered again (a second flip in a row) starts its triggers again.
    if (changed) o.entered |= moveTriggers(move) & ~triggerBit('any');
    o.active = active;
    this.active = active & ~triggerBit('land');
    this.move = move;
    this.x = x;
    this.y = y;
    this.started = true;
    return o;
  }
}
