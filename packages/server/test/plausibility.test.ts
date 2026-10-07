import { describe, expect, it } from 'vitest';
import type { MissionInfo } from '@parapet/sim';
import type { RunClaim, RunSubmission } from '@parapet/protocol';
import { checkPlausibility, MIN_SPRINT_TIME_RATIO } from '../src/plausibility.ts';

const mission: MissionInfo = {
  id: 0,
  missionTypes: [4, 5, 0, 1, 2],
  scoreTimeLimit: 120000,
  sprintTimeLimit: 120000,
  rivalStartDelay: 3000,
  goals: [],
  challenge: null,
  rivalTotalTime: 58500,
};

function submission(mode: RunSubmission['mode']): RunSubmission {
  return {
    protocolVersion: 2,
    simVersion: 'x',
    rulesetId: 'classic',
    contentHash: { level: 0, moves: 0, tables: 0 },
    levelId: 0,
    mode,
    withRival: false,
    playerName: 'p',
    character: 0,
    input: [{ ticks: 1, bits: 0 }],
    claimed: { finished: true, timeUp: false, time: 0, score: 0, steps: 0, hash: 0 },
  };
}

function computed(patch: Partial<RunClaim>): RunClaim {
  return { finished: true, timeUp: false, time: 40000, score: 500, steps: 1300, hash: 1, ...patch };
}

describe('checkPlausibility', () => {
  it('accepts an ordinary run', () => {
    expect(checkPlausibility(submission('sprint'), computed({}), mission)).toEqual({
      flagged: false,
      reason: null,
    });
  });

  it('flags a sprint far faster than the reference run', () => {
    const fast = computed({ time: Math.floor(58500 * MIN_SPRINT_TIME_RATIO) - 1 });
    expect(checkPlausibility(submission('sprint'), fast, mission).flagged).toBe(true);
    expect(checkPlausibility(submission('flags'), fast, mission).flagged).toBe(false);
  });

  it('flags scores the run length cannot carry and runs with almost no steps', () => {
    expect(
      checkPlausibility(submission('score'), computed({ score: 200000 }), mission).flagged,
    ).toBe(true);
    expect(checkPlausibility(submission('score'), computed({ steps: 3 }), mission).flagged).toBe(
      true,
    );
  });
});
