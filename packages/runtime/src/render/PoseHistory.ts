/**
 * The last few poses of a runner, one per simulation step: the afterimages of echoes and of
 * the trails are drawn from them, and only while the runner moves fast.
 */
import type { CharacterPose } from './CharacterRenderer.ts';

/** Steps of history kept. */
export const HISTORY_LENGTH = 7;
/**
 * Distance (world units) covered over the history above which a runner counts as fast: 900 is
 * beyond running speed (jumps, falls, dashes), 450 includes a good run (top speed covers about
 * 650 over the history).
 */
export const FAST_UNITS = 900;
export const RUNNING_UNITS = 450;

export class PoseHistory {
  private readonly poses: (CharacterPose | null)[] = new Array<CharacterPose | null>(
    HISTORY_LENGTH,
  ).fill(null);
  private steps = 0;

  push(pose: CharacterPose | null): void {
    this.poses[this.steps % HISTORY_LENGTH] = pose;
    this.steps++;
  }

  /** The pose `n` steps before the latest (0 = the latest), or null. */
  back(n: number): CharacterPose | null {
    if (n < 0 || n >= HISTORY_LENGTH || n >= this.steps) return null;
    return this.poses[(this.steps - 1 - n) % HISTORY_LENGTH] ?? null;
  }

  /** Whether the runner covered more than `units` over the whole history. */
  movedOver(units: number): boolean {
    if (this.steps < HISTORY_LENGTH) return false;
    const now = this.back(0);
    const then = this.back(HISTORY_LENGTH - 1);
    if (!now || !then) return false;
    return Math.abs(now.x - then.x) + Math.abs(now.y - then.y) > units;
  }

  /** Faster than running (the echoes' speed trail). */
  get fast(): boolean {
    return this.movedOver(FAST_UNITS);
  }
}
