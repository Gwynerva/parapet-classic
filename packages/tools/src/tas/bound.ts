/**
 * A lower bound on the time still needed from a state: the horizontal distance of the shortest
 * tour through what is left (flags in any order, or checkpoints in order and the finish) at
 * the runner's top speed. It ignores walls, height and detours, so it never overestimates; the
 * search uses it to drop states that cannot beat the best run found and to steer towards
 * promising ones.
 */
import type { World } from '@parapet/sim';
import type { ContestMode } from './model.ts';

/**
 * Horizontal speed the bound assumes, in units per ms: the top running speed (about 3800
 * units per 1024 ms) with a margin for the snaps of ledge grabs and vaults.
 */
export const TOP_SPEED = 4.6;
/** A flag or checkpoint counts from anywhere in its tile, so half a tile is free. */
const REACH = 512;

export class LowerBound {
  private readonly mode: ContestMode;
  private readonly targets: number[];
  private readonly finishX: number | null;
  /** Flags: `tour[mask * n + j]` = shortest path starting at flag j through all of `mask`. */
  private readonly tour: Float64Array;

  constructor(world: World, mode: ContestMode) {
    this.mode = mode;
    const level = world.level;
    this.targets = level.checkpoints.map((p) => (p.x << 10) + 512);
    this.finishX = level.finish ? (level.finish.x << 10) + 512 : null;
    const n = this.targets.length;
    this.tour = new Float64Array((1 << n) * n);
    if (mode === 'flags') this.buildTours(n);
  }

  private buildTours(n: number): void {
    const t = this.targets;
    const gap = (a: number, b: number): number => Math.max(0, Math.abs(t[a]! - t[b]!) - 2 * REACH);
    for (let mask = 1; mask < 1 << n; mask++) {
      for (let j = 0; j < n; j++) {
        if ((mask & (1 << j)) === 0) continue;
        const rest = mask & ~(1 << j);
        if (rest === 0) {
          this.tour[mask * n + j] = 0;
          continue;
        }
        let best = Infinity;
        for (let k = 0; k < n; k++) {
          if ((rest & (1 << k)) === 0) continue;
          best = Math.min(best, gap(j, k) + this.tour[rest * n + k]!);
        }
        this.tour[mask * n + j] = best;
      }
    }
  }

  /** Lower bound in ms on the time to finish from `world`'s current state. */
  ms(world: World): number {
    const x = world.player.x;
    const t = this.targets;
    const rules = world.rules;
    let dist = 0;
    if (this.mode === 'flags') {
      const n = t.length;
      const mask = rules.remainingMask & ((1 << n) - 1);
      if (mask === 0) return 0;
      let best = Infinity;
      for (let j = 0; j < n; j++) {
        if ((mask & (1 << j)) === 0) continue;
        const d = Math.max(0, Math.abs(x - t[j]!) - REACH) + this.tour[mask * n + j]!;
        if (d < best) best = d;
      }
      dist = best;
    } else {
      let at = x;
      for (let k = rules.nextCheckpoint; k < t.length; k++) {
        dist += Math.max(0, Math.abs(at - t[k]!) - REACH);
        at = t[k]!;
      }
      if (this.finishX !== null) dist += Math.max(0, Math.abs(at - this.finishX) - REACH);
    }
    return dist / TOP_SPEED;
  }
}
