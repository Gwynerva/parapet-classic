/**
 * When the pale finish flag at the screen's edge shows the way to the finish (only while the
 * finish is off screen): all the way through a score run, which ends there and nowhere else, and from the last flag on in the
 * runs that end at the finish once their flags are taken: the sprint (after its fifth
 * checkpoint, as the original's arrow did), the challenges with a flag and the warm-ups. A flag
 * hunt ends on its last flag and a free run never ends: no flag there.
 */
import type { RunMode } from '@parapet/sim';

/** What the rule needs of a level: its finish cell and its flags (checkpoints). */
export interface FinishPointerLevel {
  finish: { x: number; y: number } | null;
  checkpoints: readonly unknown[];
}

/** `remainingMask` is the rules' mask of flags still up (bit i: flag i). */
export function showsFinishPointer(
  mode: RunMode,
  level: FinishPointerLevel,
  remainingMask: number,
): boolean {
  if (!level.finish) return false;
  switch (mode) {
    case 'score':
      return true;
    case 'sprint':
    case 'challenge':
    case 'warmup1':
    case 'warmup2': {
      const flags = level.checkpoints.length;
      return flags > 0 && (remainingMask & ((1 << flags) - 1)) === 0;
    }
    default:
      return false;
  }
}
