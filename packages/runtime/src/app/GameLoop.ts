/**
 * Fixed-step loop with the original's timing: game time runs at 900/1024 of real time, at most
 * 150 units a frame (a slow device plays in slow motion rather than skipping), and the
 * simulation runs one step per 30 units. Rendering interpolates between the previous and the
 * current step with `alpha`.
 */
import { STEP } from '@parapet/sim';

export const TIME_SCALE_NUM = 900;
export const TIME_SCALE_SHIFT = 10;
export const MAX_FRAME_UNITS = 150;

/**
 * The game time units a frame of `realMs` gives in the original: `realMs * 900 >> 10`, cut to
 * whole units and capped at 150 (`boolean_d`, d.java line 10477). The cut loses up to a unit
 * every frame, so the original ran slower the more frames a second it drew: 95.6 % of its own
 * pace at 60, 82 % at 240 (reference/findings/07-slow-phones-slow-down).
 */
export function originalFrameUnits(realMs: number): number {
  const units = (realMs * TIME_SCALE_NUM) >> TIME_SCALE_SHIFT;
  return units < 0 ? 0 : units > MAX_FRAME_UNITS ? MAX_FRAME_UNITS : units;
}

/**
 * Real time into whole game time units, frame by frame, with the original's cap but without
 * its loss: the fraction a frame leaves is carried to the next, so the game keeps its own pace
 * whatever the screen's frame rate.
 */
export class FrameUnits {
  /** The fraction carried over, in 1024ths of a unit. */
  private carry = 0;

  /** The whole units of a frame of `realMs`. */
  take(realMs: number): number {
    const cap = MAX_FRAME_UNITS << TIME_SCALE_SHIFT;
    let fine = Math.round(realMs * TIME_SCALE_NUM) + this.carry;
    if (fine > cap) fine = cap;
    if (fine < 0) fine = 0;
    const units = fine >> TIME_SCALE_SHIFT;
    this.carry = fine - (units << TIME_SCALE_SHIFT);
    return units;
  }

  /** The fraction of a unit carried over, 0..1. */
  get fraction(): number {
    return this.carry / (1 << TIME_SCALE_SHIFT);
  }

  reset(): void {
    this.carry = 0;
  }
}

export interface FixedStepTarget {
  /** Advance the simulation by one step. Return false to stop stepping this frame. */
  step(): boolean;
}

export class FixedStepClock {
  private accumulator = 0;
  private readonly units = new FrameUnits();

  /** Convert real elapsed milliseconds to game time units and run the due steps. */
  advance(realMs: number, target: FixedStepTarget): number {
    this.accumulator += this.units.take(realMs);
    let steps = 0;
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      steps++;
      if (!target.step()) {
        this.accumulator = 0;
        this.units.reset();
        break;
      }
    }
    return steps;
  }

  /** Interpolation fraction 0..1 of the pending step. */
  get alpha(): number {
    return (this.accumulator + this.units.fraction) / STEP;
  }

  reset(): void {
    this.accumulator = 0;
    this.units.reset();
  }
}

export class GameLoop {
  private handle = 0;
  private last = 0;
  private running = false;
  private readonly frame: (dtMs: number) => void;

  constructor(frame: (dtMs: number) => void) {
    this.frame = frame;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number): void => {
      if (!this.running) return;
      let dt = now - this.last;
      this.last = now;
      // A tab that was hidden for a while must not catch up with a burst of steps.
      if (dt > 250) dt = 250;
      if (dt < 0) dt = 0;
      this.frame(dt);
      this.handle = requestAnimationFrame(tick);
    };
    this.handle = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
  }
}
