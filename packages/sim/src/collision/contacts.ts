/**
 * Helpers that force a hands contact without a sweep (`a(boolean,int,int)` line 9098 and
 * `b(boolean,int,int)` line 9107). Used by the entry snaps of hanging and climbing moves.
 */
import type { RunnerState } from '../runner/runner.ts';
import { testHorizontalLine, testVerticalLine } from './shapes.ts';

/** Put a wall contact (surface 8 when facing right, 9 otherwise) on the hands probe at cell origin (cx, cy). */
export function setHandsWallContact(
  r: RunnerState,
  facingRight: boolean,
  cx: number,
  cy: number,
): void {
  const hands = r.probes[0];
  if (facingRight) {
    testVerticalLine(hands, cx, cy, 0, 0, 1024, 0, true);
  } else {
    testVerticalLine(hands, cx, cy, 1024, 0, 0, 1024, false);
  }
  r.probes[2].surface = 0;
}

/** Put a floor (surface 1) or ceiling (surface 17) contact on the hands probe at cell origin (cx, cy). */
export function setHandsFloorContact(r: RunnerState, floor: boolean, cx: number, cy: number): void {
  const hands = r.probes[0];
  if (floor) {
    testHorizontalLine(hands, cx, cy, 0, 0, 1024, 0, true);
  } else {
    testHorizontalLine(hands, cx, cy, 0, 1024, 0, 0, false);
  }
  r.probes[2].surface = 0;
}
