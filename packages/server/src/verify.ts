/**
 * Replay verification: rebuilds the run exactly like the client did (`createRun`), plays the
 * submitted input log and compares the outcome with what the client claimed. The sim is
 * deterministic, so any disagreement means the claim (or the input) was tampered with or the
 * client ran a different simulation version or different content.
 */
import { createRun, evaluateMission, RULESET_ID, sameContentHash, SIM_VERSION } from '@parapet/sim';
import {
  isLeaderboardMode,
  MAX_STEPS,
  type ErrorCode,
  type RunClaim,
  type RunSubmission,
} from '@parapet/protocol';
import { contentHashFor, isLevelId, loadRunData } from './content.ts';

/** The values the replay produced, in the same shape as the client's claim, plus the verdict. */
export interface VerifyComputed extends RunClaim {
  /** Whether the run met the mission goal (`evaluateMission`). */
  won: boolean;
}

export type VerifyResult =
  | { ok: true; computed: VerifyComputed }
  | { ok: false; code: ErrorCode; error: string; computed?: VerifyComputed };

const CLAIM_FIELDS: (keyof RunClaim)[] = ['finished', 'timeUp', 'time', 'score', 'steps', 'hash'];

/** Replay a submission and return what the simulation produced, without judging the claim. */
export function replaySubmission(submission: RunSubmission): VerifyComputed {
  const data = loadRunData(submission.levelId, submission.withRival);
  const world = createRun({
    mode: submission.mode,
    level: data.level,
    mission: data.mission,
    moves: data.moves,
    tables: data.tables,
    rival: data.rival,
  });
  world.replay(submission.input);
  const result = world.rules.result;
  const score = world.player.score?.score ?? 0;
  const outcome = evaluateMission(
    data.mission,
    submission.mode,
    result,
    score,
    world.player.moveBits,
  );
  return {
    finished: result?.finished ?? false,
    timeUp: result?.timeUp ?? false,
    time: result?.time ?? world.clock,
    score,
    steps: world.stepCount,
    hash: world.hash(),
    won: outcome.won,
  };
}

export function verifyRun(submission: RunSubmission): VerifyResult {
  if (submission.simVersion !== SIM_VERSION) {
    return {
      ok: false,
      code: 'unsupported',
      error: `simulation version ${submission.simVersion} is not supported (server runs ${SIM_VERSION})`,
    };
  }
  if (submission.rulesetId !== RULESET_ID) {
    return {
      ok: false,
      code: 'unsupported',
      error: `ruleset ${submission.rulesetId} is not supported (server runs ${RULESET_ID})`,
    };
  }
  if (!isLeaderboardMode(submission.mode)) {
    return { ok: false, code: 'unsupported', error: `${submission.mode} has no leaderboard` };
  }
  if (!isLevelId(submission.levelId)) {
    return { ok: false, code: 'invalid', error: `unknown level ${submission.levelId}` };
  }
  if (!sameContentHash(submission.contentHash, contentHashFor(submission.levelId))) {
    return {
      ok: false,
      code: 'unsupported',
      error: 'the run was recorded on different level or move data than the server has',
    };
  }
  let totalTicks = 0;
  for (const run of submission.input) totalTicks += run.ticks;
  if (totalTicks > MAX_STEPS) {
    return { ok: false, code: 'limit', error: `input covers more than ${MAX_STEPS} steps` };
  }

  const computed = replaySubmission(submission);
  const claimed = submission.claimed;
  for (const field of CLAIM_FIELDS) {
    if (claimed[field] !== computed[field]) {
      return {
        ok: false,
        code: 'mismatch',
        error: `claimed ${field} ${String(claimed[field])} but the replay produced ${String(computed[field])}`,
        computed,
      };
    }
  }
  if (!computed.won) {
    const error = computed.timeUp
      ? 'the time ran out before the finish'
      : computed.finished
        ? 'the run did not meet the mission goal'
        : 'the run did not finish';
    return { ok: false, code: 'invalid', error, computed };
  }
  return { ok: true, computed };
}
