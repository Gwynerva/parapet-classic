export { SIM_VERSION, RULESET_ID } from './version.ts';

export { idiv, iabs, imin, isqrt, approxLength, buildSineTable } from './math/int.ts';
export { Level, TILE, TILE_SHIFT, CHECKPOINT_TILE_BASE, BIRD_TILE } from './level/level.ts';
export type { LevelData, MissionSection, Point } from './level/level.ts';
export { Probe, Surface } from './collision/probe.ts';
export { rayMarch, followSurface, cellIndex } from './collision/raymarch.ts';
export * from './collision/shapes.ts';
export {
  tileHasFlag,
  bitIn,
  TileFlag,
  WALL_AHEAD_LEFT,
  WALL_AHEAD_RIGHT,
  ANY_SLOPE,
  AIR_OR_POLE,
} from './tables.ts';
export type { PhysicsTables } from './tables.ts';
export { RunnerState, DEFAULT_HANDS_DY, DEFAULT_GRAVITY } from './runner/runner.ts';
export { MoveTable, MoveFlag, MoveId, ChallengeBit } from './runner/moves.ts';
export type { MoveDef, MoveTableData, MoveTransition } from './runner/moves.ts';
export {
  Input,
  evalCondition,
  tileRelative,
  lookaheadRay,
  isOnSurface,
} from './runner/conditions.ts';
export type { ConditionContext } from './runner/conditions.ts';
export { applyImpulse } from './runner/impulses.ts';
export { snapOnEntry, applyRootMotion, initImpulse, advancePhase } from './runner/rootMotion.ts';
export {
  stepRunner,
  sweepProbes,
  enterMove,
  updateTransitions,
  moveDuration,
  STEP,
} from './runner/step.ts';
export type { StepContext, SimEvent, MoveEntrySnapshot } from './runner/step.ts';
export { ScoreState } from './scoring.ts';
export type { ScorePopup } from './scoring.ts';
export {
  InputRecorder,
  InputPlayer,
  expandRuns,
  NO_INPUT,
  MAX_STEPS,
  MAX_INPUT_BITS,
  parseInputRuns,
} from './replay.ts';
export type { InputRun, RivalRecording } from './replay.ts';
export { MissionRules, MissionType } from './rules.ts';
export type { RulesOptions, RunResult, RulesEvent } from './rules.ts';
export { World } from './world.ts';
export type { WorldOptions, WorldEvent, RivalOptions, WorldState } from './world.ts';
export {
  createRun,
  missionTypeForMode,
  modeForMissionType,
  missionSlot,
  timeLimitForMode,
  isRunMode,
  RUN_MODES,
} from './run.ts';
export type {
  RunMode,
  RunConfig,
  MissionInfo,
  MissionGoal,
  GoalKind,
  ChallengeInfo,
} from './run.ts';
export { evaluateMission, missionTarget } from './mission/evaluate.ts';
export type { MissionOutcome, MissionOutcomeReason, MissionTarget } from './mission/evaluate.ts';
export {
  fnv1a,
  canonicalJson,
  hashJson,
  hashLevel,
  hashMoves,
  hashTables,
  contentHashes,
  sameContentHash,
} from './content/hash.ts';
export type { ContentHash } from './content/hash.ts';
export {
  LEVEL_COUNT,
  SCORE_CHALLENGE_LEVELS,
  RANKED_MODES,
  isRankedMode,
  rankingSort,
  compareRuns,
} from './ranking.ts';
export type { RankingSort, RankedOutcome } from './ranking.ts';
export {
  REPLAY_FORMAT,
  MAX_REPLAY_NAME_LENGTH,
  encodeReplay,
  decodeReplay,
  cleanReplayName,
  hasControlChars,
  toBase64Url,
  fromBase64Url,
  versionKey,
  contentKey,
  replayKeys,
} from './replayCodec.ts';
export type { Replay, ReplayKeys, DecodeResult } from './replayCodec.ts';
export {
  simulateReplay,
  createReplayWorld,
  replayCompatibility,
  runContentHash,
  isSplitEvent,
} from './verify.ts';
export type { RunContent, ReplayOutcome, Compatibility } from './verify.ts';
