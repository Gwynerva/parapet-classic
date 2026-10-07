/**
 * Run setup shared by the client and the server: turns a level, a game mode and the mission
 * table entry into a `World`. Both sides must build runs identically for replays to verify.
 */
import type { LevelData } from './level/level.ts';
import type { MoveTableData } from './runner/moves.ts';
import type { RivalRecording } from './replay.ts';
import { MissionType } from './rules.ts';
import type { PhysicsTables } from './tables.ts';
import { World } from './world.ts';

/**
 * Game modes offered by Parapet. They map one to one onto the original's mission types,
 * plus `free`: our own endless run on the Sprint layout.
 */
export type RunMode = 'free' | 'sprint' | 'flags' | 'score' | 'challenge' | 'warmup1' | 'warmup2';

export const RUN_MODES: readonly RunMode[] = [
  'free',
  'sprint',
  'flags',
  'score',
  'challenge',
  'warmup1',
  'warmup2',
];

export function isRunMode(value: unknown): value is RunMode {
  return typeof value === 'string' && (RUN_MODES as readonly string[]).includes(value);
}

export type GoalKind = 'sprint' | 'time' | 'score';

/** One goal of the mission table (`z[13 + 3m]` plus the two default record values). */
export interface MissionGoal {
  raw: number;
  /** -2 = sprint (the target is the rival's time); sign bit set = time limit; otherwise a score. */
  kind: GoalKind;
  /** Time limit in ms or score target; null for sprint. */
  value: number | null;
  defaultTime: number;
  defaultScore: number;
}

/** Challenge rules of a level; hard-coded in the original (d.java lines 5359-5393). */
export interface ChallengeInfo {
  /** Time limit in ms (the goal word of the challenge mission). */
  timeLimit: number;
  /** `ChallengeBit` mask the player must have performed (levels 3, 5 and 6; 0 elsewhere). */
  requiredMoveBits: number;
  /** Score to reach on levels 8, 10 and 11; 0 when the challenge is not a score challenge. */
  scoreTarget: number;
}

/** Mission table entry as produced by the extractor (`missions.json`, `levels[]`). */
export interface MissionInfo {
  id: number;
  /** Mission type per mission slot, in the order of the original's mission menu. */
  missionTypes: number[];
  scoreTimeLimit: number;
  sprintTimeLimit: number;
  rivalStartDelay: number;
  goals: MissionGoal[];
  challenge: ChallengeInfo | null;
  /** Finish time of the rival recording in ms; the Sprint target is this plus the start delay. */
  rivalTotalTime: number;
}

export interface RunConfig {
  mode: RunMode;
  level: LevelData;
  mission: MissionInfo;
  moves: MoveTableData;
  tables: PhysicsTables;
  /** Sprint only: the original rival recording for this level, or null to race alone. */
  rival?: RivalRecording | null;
}

/** Mission type used by a mode. Free run uses the sprint layout (every level has one). */
export function missionTypeForMode(mode: RunMode): number {
  switch (mode) {
    case 'sprint':
    case 'free':
      return MissionType.SPRINT;
    case 'flags':
      return MissionType.FLAG_HUNT;
    case 'score':
      return MissionType.SCORE_RUN;
    case 'challenge':
      return MissionType.CHALLENGE;
    case 'warmup1':
      return MissionType.WARM_UP_1;
    case 'warmup2':
      return MissionType.WARM_UP_2;
  }
}

/** The mode that plays a mission type of the original, or null for an unknown type. */
export function modeForMissionType(type: number): RunMode | null {
  switch (type) {
    case MissionType.SPRINT:
      return 'sprint';
    case MissionType.FLAG_HUNT:
      return 'flags';
    case MissionType.SCORE_RUN:
      return 'score';
    case MissionType.CHALLENGE:
      return 'challenge';
    case MissionType.WARM_UP_1:
      return 'warmup1';
    case MissionType.WARM_UP_2:
      return 'warmup2';
    default:
      return null;
  }
}

/** Index of the mission a mode plays in the level's mission list, or -1 (free run, missing). */
export function missionSlot(info: MissionInfo, mode: RunMode): number {
  if (mode === 'free') return -1;
  return info.missionTypes.indexOf(missionTypeForMode(mode));
}

/**
 * Time limit the rules enforce for a mode, in ms, or -1: Score runs end at `z[4]`, Challenges
 * at their goal word. Flag hunts are judged against their limit afterwards but never cut off
 * in single player.
 */
export function timeLimitForMode(info: MissionInfo, mode: RunMode): number {
  switch (mode) {
    case 'score':
      return info.scoreTimeLimit;
    case 'challenge':
      return info.challenge?.timeLimit ?? -1;
    default:
      return -1;
  }
}

export function createRun(cfg: RunConfig): World {
  const missionType = missionTypeForMode(cfg.mode);
  const rivals =
    cfg.mode === 'sprint' && cfg.rival
      ? [{ recording: cfg.rival, startDelay: cfg.mission.rivalStartDelay }]
      : [];
  return new World({
    level: cfg.level,
    moves: cfg.moves,
    tables: cfg.tables,
    levelId: cfg.level.id,
    rivals,
    rules: {
      missionType,
      freeRun: cfg.mode === 'free',
      timeLimit: timeLimitForMode(cfg.mission, cfg.mode),
    },
  });
}
