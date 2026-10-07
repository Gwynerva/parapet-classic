/**
 * Mission rules: checkpoints, flags, finish and time limits. Port of `boolean_c()`
 * (d.java line 9477) for the mission types we support.
 */
import type { Level } from './level/level.ts';
import { CHECKPOINT_TILE_BASE } from './level/level.ts';
import type { RunnerState } from './runner/runner.ts';

export const MissionType = {
  SPRINT: 0,
  FLAG_HUNT: 1,
  SCORE_RUN: 2,
  CHALLENGE: 3,
  WARM_UP_1: 4,
  WARM_UP_2: 5,
} as const;

export interface RulesOptions {
  missionType: number;
  /** Free run: never finishes, checkpoints still light up. */
  freeRun?: boolean;
  /** Hot-seat multiplayer semantics (hard time cut-offs). */
  multiplayer?: boolean;
  /** Time limit in ms for Score runs (`z[4]`), Challenges (goal word) and multiplayer races. */
  timeLimit?: number;
  /**
   * Flags to collect (`aS`): 5 in a flag hunt, 1 in the challenges of levels 2/3/5/6 and 0 in
   * the other challenges. `World` passes the number of checkpoints of the mission section.
   */
  flagCount?: number;
}

export interface RunResult {
  finished: boolean;
  timeUp: boolean;
  /** Finish time in ms (game clock), 0 when the time ran out. */
  time: number;
  /** Checkpoint split times (Sprint). */
  splits: number[];
}

export type RulesEvent =
  | { type: 'checkpoint'; index: number }
  | { type: 'flag'; index: number; remaining: number }
  | { type: 'finished'; result: RunResult };

export class MissionRules {
  readonly missionType: number;
  readonly freeRun: boolean;
  readonly multiplayer: boolean;
  readonly timeLimit: number;
  /** Bit i set = checkpoint/flag i not yet taken (`bM`, starts at -1 = all). */
  remainingMask = -1;
  /** Flags still to collect in a flag hunt (`aS`). */
  flagsLeft = 5;
  /** Next checkpoint index in a sprint (`aP`). */
  nextCheckpoint = 0;
  readonly splits: number[] = [];
  /** Last collected marker, for HUD flashes (`bO`). */
  lastCollected = -1;
  result: RunResult | null = null;

  constructor(opts: RulesOptions) {
    this.missionType = opts.missionType;
    this.freeRun = opts.freeRun ?? false;
    this.multiplayer = opts.multiplayer ?? false;
    this.timeLimit = opts.timeLimit ?? -1;
    this.flagsLeft = opts.flagCount ?? 5;
  }

  get finished(): boolean {
    return this.result !== null;
  }

  private finish(time: number, timeUp: boolean, events: RulesEvent[]): boolean {
    this.result = { finished: !timeUp, timeUp, time, splits: this.splits.slice() };
    events.push({ type: 'finished', result: this.result });
    return true;
  }

  /**
   * Check the player after its step. Returns true when the run ended. `clock` is the game
   * clock in ms after the step.
   */
  check(player: RunnerState, level: Level, clock: number, events: RulesEvent[]): boolean {
    if (this.result) return true;
    const cx = (player.x + (player.handsDx >> 1)) >> 10;
    const cy = (player.y + (player.handsDy >> 1)) >> 10;
    const fx = player.x >> 10;
    const fy = player.y >> 10;
    const atCentre = level.tileAt(cx, cy) - CHECKPOINT_TILE_BASE;
    const atFeet = level.tileAt(fx, fy) - CHECKPOINT_TILE_BASE;
    const marker = atFeet >= 0 ? atFeet : atCentre;
    const finish = level.finish;
    const atFinish = finish !== null && cx === finish.x && (cy === finish.y || cy === finish.y - 1);
    switch (this.missionType) {
      case MissionType.SPRINT: {
        if (atFinish && (this.remainingMask & 0x10) === 0 && !this.freeRun) {
          return this.finish(clock, false, events);
        }
        if (
          marker >= 0 &&
          (this.remainingMask & (1 << marker)) !== 0 &&
          (marker === 0 || (this.remainingMask & (1 << (marker - 1))) === 0)
        ) {
          this.remainingMask ^= 1 << marker;
          this.lastCollected = marker;
          this.splits[this.nextCheckpoint++] = clock;
          events.push({ type: 'checkpoint', index: marker });
        }
        if (this.multiplayer && this.timeLimit >= 0 && clock >= this.timeLimit && !this.freeRun) {
          return this.finish(0, true, events);
        }
        return false;
      }
      case MissionType.FLAG_HUNT: {
        if (marker >= 0 && (this.remainingMask & (1 << marker)) !== 0) {
          this.remainingMask ^= 1 << marker;
          this.lastCollected = marker;
          this.flagsLeft--;
          events.push({ type: 'flag', index: marker, remaining: this.flagsLeft });
          if (this.flagsLeft === 0 && !this.freeRun) {
            return this.finish(clock, false, events);
          }
        }
        if (this.multiplayer && this.timeLimit >= 0 && clock >= this.timeLimit && !this.freeRun) {
          return this.finish(0, true, events);
        }
        return false;
      }
      case MissionType.SCORE_RUN: {
        if (this.freeRun) return false;
        if (atFinish) {
          return this.finish(clock, false, events);
        }
        if (this.timeLimit >= 0 && this.timeLimit - clock < 0) {
          return this.finish(this.multiplayer ? 0 : this.timeLimit, true, events);
        }
        return false;
      }
      case MissionType.CHALLENGE: {
        if (marker >= 0 && (this.remainingMask & (1 << marker)) !== 0) {
          this.remainingMask ^= 1 << marker;
          this.lastCollected = marker;
          this.flagsLeft--;
          events.push({ type: 'flag', index: marker, remaining: this.flagsLeft });
        }
        if (this.freeRun) return false;
        // The original ends a challenge on `aR > 0 && aR - cg <= 0` without setting the
        // time-up flag; the results screen repeats the same test to show "Time up".
        if (this.timeLimit > 0 && this.timeLimit - clock <= 0) {
          return this.finish(clock, true, events);
        }
        if (!(atFinish && this.flagsLeft === 0)) return false;
        return this.finish(clock, false, events);
      }
      case MissionType.WARM_UP_1:
      case MissionType.WARM_UP_2: {
        if (marker >= 0 && (this.remainingMask & (1 << marker)) !== 0) {
          this.remainingMask ^= 1 << marker;
          this.lastCollected = marker;
          events.push({ type: 'flag', index: marker, remaining: 0 });
        }
        if (this.freeRun) return false;
        if (!atFinish || (this.remainingMask & 1) !== 0) return false;
        // The original stands the player up at the coach when the warm-up ends.
        player.renderHandsDy = -1536;
        player.handsDy = -1536;
        player.y = player.renderY = ((finish!.y + 1) << 10) - 1;
        player.handsAnchored = false;
        return this.finish(clock, false, events);
      }
      default:
        return false;
    }
  }
}
