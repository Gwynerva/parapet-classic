import { describe, expect, it } from 'vitest';
import { evaluateMission, missionTarget } from '../src/mission/evaluate.ts';
import { ChallengeBit } from '../src/runner/moves.ts';
import type { RunResult } from '../src/rules.ts';
import type { MissionInfo } from '../src/run.ts';
import { hasContent, loadMissions, loadRival } from './helpers/content.ts';

function info(patch: Partial<MissionInfo> = {}): MissionInfo {
  return {
    id: 0,
    missionTypes: [0, 1, 2],
    scoreTimeLimit: 60000,
    sprintTimeLimit: 120000,
    rivalStartDelay: 3000,
    goals: [
      { raw: -2, kind: 'sprint', value: null, defaultTime: 35000, defaultScore: 2000 },
      { raw: -2147353648, kind: 'time', value: 130000, defaultTime: 25000, defaultScore: 1000 },
      { raw: 500, kind: 'score', value: 500, defaultTime: 80000, defaultScore: 650 },
    ],
    challenge: null,
    rivalTotalTime: 58500,
    ...patch,
  };
}

function result(patch: Partial<RunResult> = {}): RunResult {
  return { finished: true, timeUp: false, time: 30000, splits: [], ...patch };
}

describe('missionTarget', () => {
  it('derives the sprint target from the rival time plus the handicap', () => {
    expect(missionTarget(info(), 'sprint')).toEqual({ kind: 'time', value: 61500 });
  });

  it('reads the flag hunt limit and the score target from the goals', () => {
    expect(missionTarget(info(), 'flags')).toEqual({ kind: 'time', value: 130000 });
    expect(missionTarget(info(), 'score')).toEqual({ kind: 'score', value: 500 });
  });

  it('has no target for free runs, warm-ups and levels without a challenge', () => {
    expect(missionTarget(info(), 'free')).toBeNull();
    expect(missionTarget(info(), 'warmup1')).toBeNull();
    expect(missionTarget(info(), 'challenge')).toBeNull();
  });

  it('uses the score target of score challenges and the limit of move challenges', () => {
    const score = info({ challenge: { timeLimit: 20000, requiredMoveBits: 0, scoreTarget: 5000 } });
    expect(missionTarget(score, 'challenge')).toEqual({ kind: 'score', value: 5000 });
    const moves = info({ challenge: { timeLimit: 20000, requiredMoveBits: 2, scoreTarget: 0 } });
    expect(missionTarget(moves, 'challenge')).toEqual({ kind: 'time', value: 20000 });
  });
});

describe('evaluateMission', () => {
  it('judges a sprint against the rival time', () => {
    expect(evaluateMission(info(), 'sprint', result({ time: 61500 }), 0, 0).won).toBe(true);
    const slow = evaluateMission(info(), 'sprint', result({ time: 61501 }), 0, 0);
    expect(slow).toMatchObject({ won: false, reason: 'tooSlow' });
    expect(evaluateMission(info(), 'sprint', null, 0, 0).reason).toBe('notFinished');
  });

  it('judges a flag hunt against its time limit', () => {
    expect(evaluateMission(info(), 'flags', result({ time: 130000 }), 0, 0).reason).toBe('won');
    expect(evaluateMission(info(), 'flags', result({ time: 130001 }), 0, 0).reason).toBe('tooSlow');
  });

  it('judges a score run by the score and reports time up', () => {
    expect(evaluateMission(info(), 'score', result(), 500, 0).won).toBe(true);
    expect(evaluateMission(info(), 'score', result(), 499, 0).reason).toBe('lowScore');
    const up = result({ finished: false, timeUp: true, time: 60000 });
    expect(evaluateMission(info(), 'score', up, 9999, 0).reason).toBe('timeUp');
  });

  it('requires the moves of a move challenge', () => {
    const level3 = info({
      id: 3,
      missionTypes: [3, 0, 1, 2],
      challenge: { timeLimit: 20000, requiredMoveBits: ChallengeBit.WALL_FLIP, scoreTarget: 0 },
    });
    const noFlip = evaluateMission(level3, 'challenge', result({ time: 15000 }), 100, 0);
    expect(noFlip).toMatchObject({
      won: false,
      reason: 'missingMoves',
      missingMoveBits: ChallengeBit.WALL_FLIP,
    });
    const flip = evaluateMission(
      level3,
      'challenge',
      result({ time: 15000 }),
      100,
      ChallengeBit.WALL_FLIP | ChallengeBit.TIC_TAC_JUMP,
    );
    expect(flip).toMatchObject({ won: true, reason: 'won', missingMoveBits: 0 });
    const late = result({ finished: false, timeUp: true, time: 20000 });
    expect(evaluateMission(level3, 'challenge', late, 100, ChallengeBit.WALL_FLIP).reason).toBe(
      'timeUp',
    );
  });

  it('judges a score challenge on the score even when the timer ended the run', () => {
    const level11 = info({
      id: 11,
      missionTypes: [3, 0, 1, 2],
      challenge: { timeLimit: 20000, requiredMoveBits: 0, scoreTarget: 5000 },
    });
    const ended = result({ finished: false, timeUp: true, time: 20000 });
    expect(evaluateMission(level11, 'challenge', ended, 5000, 0).won).toBe(true);
    expect(evaluateMission(level11, 'challenge', ended, 4999, 0).reason).toBe('lowScore');
  });

  it('counts a finished warm-up as won and never a free run', () => {
    expect(evaluateMission(info(), 'warmup1', result(), 0, 0).won).toBe(true);
    expect(evaluateMission(info(), 'warmup2', null, 0, 0).won).toBe(false);
    expect(evaluateMission(info(), 'free', result(), 0, 0).reason).toBe('notFinished');
  });
});

describe.skipIf(!hasContent())('mission data of the original', () => {
  it('stores the rival finish time of every level in missions.json', () => {
    const missions = loadMissions();
    for (const level of missions.levels) {
      expect(level.rivalTotalTime).toBe(loadRival(level.id).totalTime);
      expect(missionTarget(level, 'sprint')).toEqual({
        kind: 'time',
        value: level.rivalTotalTime + level.rivalStartDelay,
      });
    }
  });

  it('carries the challenge rules of levels 2, 3, 5, 6, 8, 10 and 11', () => {
    const levels = loadMissions().levels;
    expect(levels[3]?.challenge).toEqual({
      timeLimit: 20000,
      requiredMoveBits: ChallengeBit.WALL_FLIP,
      scoreTarget: 0,
    });
    expect(levels[5]?.challenge?.requiredMoveBits).toBe(
      ChallengeBit.SPIDER_JUMP | ChallengeBit.MONKEY_VAULT | ChallengeBit.MONKEY_FLIP,
    );
    expect(levels[6]?.challenge?.requiredMoveBits).toBe(
      ChallengeBit.POLE_JUMP | ChallengeBit.POLE_SPIN,
    );
    expect(levels[2]?.challenge).toEqual({ timeLimit: 25000, requiredMoveBits: 0, scoreTarget: 0 });
    expect(levels[8]?.challenge?.scoreTarget).toBe(2000);
    expect(levels[10]?.challenge?.scoreTarget).toBe(3200);
    expect(levels[11]?.challenge?.scoreTarget).toBe(5000);
    for (const id of [0, 1, 4, 7, 9]) expect(levels[id]?.challenge).toBeNull();
  });
});
