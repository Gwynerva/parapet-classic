/**
 * Soft checks on a verified run. The replay already proves the result is what the inputs
 * produce under the rules; these checks catch results no human produces (a sprint far faster
 * than the designers' own run, a score the step count cannot carry). A flagged run is kept
 * but stays off the boards, so an honest breakthrough is reviewed rather than lost.
 */
import type { MissionInfo } from '@parapet/sim';
import type { RunClaim, RunSubmission } from '@parapet/protocol';

/** A sprint faster than this fraction of the rival's recorded time is flagged. */
export const MIN_SPRINT_TIME_RATIO = 0.4;
/** Points a run can plausibly score per simulation step, plus a fixed allowance. */
export const MAX_POINTS_PER_STEP = 100;
export const SCORE_ALLOWANCE = 5000;
/** Runs shorter than this many steps cannot have reached anything. */
export const MIN_STEPS = 10;

export interface PlausibilityVerdict {
  flagged: boolean;
  reason: string | null;
}

export function checkPlausibility(
  submission: RunSubmission,
  computed: RunClaim,
  mission: MissionInfo,
): PlausibilityVerdict {
  if (computed.steps < MIN_STEPS) return { flagged: true, reason: 'too few steps' };
  if (computed.score > computed.steps * MAX_POINTS_PER_STEP + SCORE_ALLOWANCE) {
    return { flagged: true, reason: 'score too high for the run length' };
  }
  if (submission.mode === 'sprint' && mission.rivalTotalTime > 0) {
    if (computed.time < mission.rivalTotalTime * MIN_SPRINT_TIME_RATIO) {
      return { flagged: true, reason: 'sprint far faster than the reference run' };
    }
  }
  return { flagged: false, reason: null };
}
