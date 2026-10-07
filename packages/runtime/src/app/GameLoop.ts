/**
 * Fixed-step loop with the original's timing rules: game time advances by
 * `realMs * 900 >> 10` per frame, capped at 150, and the simulation runs one step per 30 units.
 * Rendering interpolates between the previous and the current step with `alpha`.
 */
import { STEP } from '@parapet/sim';

export const TIME_SCALE_NUM = 900;
export const TIME_SCALE_SHIFT = 10;
export const MAX_FRAME_UNITS = 150;

export interface FixedStepTarget {
  /** Advance the simulation by one step. Return false to stop stepping this frame. */
  step(): boolean;
}

export class FixedStepClock {
  private accumulator = 0;

  /** Convert real elapsed milliseconds to game time units and run the due steps. */
  advance(realMs: number, target: FixedStepTarget): number {
    let units = (realMs * TIME_SCALE_NUM) >> TIME_SCALE_SHIFT;
    if (units > MAX_FRAME_UNITS) units = MAX_FRAME_UNITS;
    if (units < 0) units = 0;
    this.accumulator += units;
    let steps = 0;
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      steps++;
      if (!target.step()) {
        this.accumulator = 0;
        break;
      }
    }
    return steps;
  }

  /** Interpolation fraction 0..1 of the pending step. */
  get alpha(): number {
    return this.accumulator / STEP;
  }

  reset(): void {
    this.accumulator = 0;
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
