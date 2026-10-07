/**
 * Judges a finished run against its mission goal: the original's `boolean_b()` (d.java line
 * 5111) and the results logic of `x(7)` (line 5359). Shared by the results screen, the
 * progress bookkeeping and the server, so "mission completed" means the same everywhere.
 */
import { ChallengeBit } from '../runner/moves.ts';
import type { RunResult } from '../rules.ts';
import type { MissionGoal, MissionInfo, RunMode } from '../run.ts';

export interface MissionTarget {
  kind: 'time' | 'score';
  /** Time limit in ms (finish at or under it) or score to reach (at or over it). */
  value: number;
}

export type MissionOutcomeReason =
  /** The goal was met. */
  | 'won'
  /** The time limit ended the run before the finish (red "Time's up!"). */
  | 'timeUp'
  /** The run did not end at all (free run, abandoned run). */
  | 'notFinished'
  /** Finished, but slower than the time target (rival or limit). */
  | 'tooSlow'
  /** Finished, but under the score target. */
  | 'lowScore'
  /** Challenge finished without the required moves. */
  | 'missingMoves';

export interface MissionOutcome {
  won: boolean;
  reason: MissionOutcomeReason;
  target: MissionTarget | null;
  /** `ChallengeBit` mask of the required moves not performed (challenges only). */
  missingMoveBits: number;
}

/** Goal of a mode on a level, or null when the mode has none (free run, warm-ups). */
export function missionTarget(info: MissionInfo, mode: RunMode): MissionTarget | null {
  switch (mode) {
    case 'sprint':
      // The rival starts after the handicap, so its finish on the shared clock is later.
      return { kind: 'time', value: info.rivalTotalTime + info.rivalStartDelay };
    case 'flags': {
      const goal = goalOf(info, 1);
      return goal?.kind === 'time' && goal.value !== null
        ? { kind: 'time', value: goal.value }
        : null;
    }
    case 'score': {
      const goal = goalOf(info, 2);
      return goal?.kind === 'score' && goal.value !== null
        ? { kind: 'score', value: goal.value }
        : null;
    }
    case 'challenge': {
      const challenge = info.challenge;
      if (!challenge) return null;
      return challenge.scoreTarget > 0
        ? { kind: 'score', value: challenge.scoreTarget }
        : { kind: 'time', value: challenge.timeLimit };
    }
    default:
      return null;
  }
}

function goalOf(info: MissionInfo, missionType: number): MissionGoal | undefined {
  const slot = info.missionTypes.indexOf(missionType);
  return slot >= 0 ? info.goals[slot] : undefined;
}

function outcome(
  won: boolean,
  reason: MissionOutcomeReason,
  target: MissionTarget | null,
  missingMoveBits = 0,
): MissionOutcome {
  return { won, reason, target, missingMoveBits };
}

/**
 * Judge a run. `result` is `world.rules.result` (null while the run is going), `score` the
 * player's final score and `moveBits` the player's `RunnerState.moveBits`.
 */
export function evaluateMission(
  info: MissionInfo,
  mode: RunMode,
  result: RunResult | null,
  score: number,
  moveBits: number,
): MissionOutcome {
  const target = missionTarget(info, mode);
  if (!result) return outcome(false, 'notFinished', target);
  switch (mode) {
    case 'free':
      return outcome(false, 'notFinished', target);
    case 'warmup1':
    case 'warmup2':
      return result.finished ? outcome(true, 'won', target) : outcome(false, 'notFinished', target);
    case 'sprint':
    case 'flags': {
      if (result.timeUp) return outcome(false, 'timeUp', target);
      if (!result.finished) return outcome(false, 'notFinished', target);
      if (target && result.time > target.value) return outcome(false, 'tooSlow', target);
      return outcome(true, 'won', target);
    }
    case 'score': {
      if (result.timeUp) return outcome(false, 'timeUp', target);
      if (!result.finished) return outcome(false, 'notFinished', target);
      if (target && score < target.value) return outcome(false, 'lowScore', target);
      return outcome(true, 'won', target);
    }
    case 'challenge': {
      const challenge = info.challenge;
      if (!challenge) return outcome(false, 'notFinished', target);
      if (challenge.scoreTarget > 0) {
        // Score challenges (levels 8, 10, 11) are judged on the score alone; the timer ending
        // the run is the normal end on level 11, which has no finish line.
        return score >= challenge.scoreTarget
          ? outcome(true, 'won', target)
          : outcome(false, 'lowScore', target);
      }
      if (result.timeUp) return outcome(false, 'timeUp', target);
      if (!result.finished) return outcome(false, 'notFinished', target);
      const missing = challenge.requiredMoveBits & ~moveBits & ChallengeBit.ALL;
      if (missing !== 0) return outcome(false, 'missingMoves', target, missing);
      return outcome(true, 'won', target);
    }
  }
}
