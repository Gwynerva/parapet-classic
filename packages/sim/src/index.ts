export const SIM_VERSION = 'parapet-sim@0.2.0';
/** Identifier of the rule set replays are recorded under: the original game's move table and rules. */
export const RULESET_ID = 'classic';

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
export { InputRecorder, InputPlayer, expandRuns, NO_INPUT } from './replay.ts';
export type { InputRun, RivalRecording } from './replay.ts';
export { MissionRules, MissionType } from './rules.ts';
export type { RulesOptions, RunResult, RulesEvent } from './rules.ts';
export { World } from './world.ts';
export type { WorldOptions, WorldEvent, RivalOptions } from './world.ts';
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
