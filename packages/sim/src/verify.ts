/**
 * Re-running a replay: builds the run exactly like a live one (`createRun`), plays the input
 * log and reports what the simulation produced. The simulation is deterministic, so the
 * result of a shared replay is computed by whoever opens it and cannot be faked by editing a
 * number; only the input itself can be crafted.
 */
import { contentHashes, sameContentHash, type ContentHash } from './content/hash.ts';
import type { LevelData } from './level/level.ts';
import { evaluateMission } from './mission/evaluate.ts';
import { InputPlayer, NO_INPUT, type RivalRecording } from './replay.ts';
import { contentKey, versionKey, type Replay } from './replayCodec.ts';
import type { MoveTableData } from './runner/moves.ts';
import { createRun, type MissionInfo } from './run.ts';
import type { PhysicsTables } from './tables.ts';
import type { World } from './world.ts';
import { RULESET_ID, SIM_VERSION } from './version.ts';

/** The content a run of one level is built from. */
export interface RunContent {
  level: LevelData;
  mission: MissionInfo;
  moves: MoveTableData;
  tables: PhysicsTables;
  /** The level's original rival recording (used when the replay raced it). */
  rival: RivalRecording | null;
}

export interface ReplayOutcome {
  finished: boolean;
  timeUp: boolean;
  /** Finish time in ms of game clock, or the clock when the input ran out. */
  time: number;
  score: number;
  steps: number;
  hash: number;
  /** Whether the run met the mission goal (`evaluateMission`). */
  won: boolean;
  /**
   * Game clock at every checkpoint or flag, in the order they were reached: entry k is the
   * k-th one, so runs that collect flags in different orders still compare by progress.
   */
  splits: number[];
}

export type Compatibility = 'ok' | 'version' | 'content';

/**
 * Whether a replay can be re-run here: same simulation and ruleset, same level data (by their
 * keys for a replay decoded from a compact code).
 */
export function replayCompatibility(replay: Replay, content: ContentHash): Compatibility {
  if (replay.keys) {
    if (replay.keys.version !== versionKey(SIM_VERSION, RULESET_ID)) return 'version';
    return replay.keys.content === contentKey(content) ? 'ok' : 'content';
  }
  if (replay.simVersion !== SIM_VERSION || replay.rulesetId !== RULESET_ID) return 'version';
  return sameContentHash(replay.contentHash, content) ? 'ok' : 'content';
}

/** Hashes of a level's run content, in the form replays carry. */
export function runContentHash(content: RunContent): ContentHash {
  return contentHashes(content.level, content.moves, content.tables);
}

/** The world a replay runs in: same level, mode and rival as when it was recorded. */
export function createReplayWorld(replay: Replay, content: RunContent): World {
  return createRun({
    mode: replay.mode,
    level: content.level,
    mission: content.mission,
    moves: content.moves,
    tables: content.tables,
    rival: replay.withRival ? content.rival : null,
  });
}

/** True for the events that mark progress along a route (`splits`). */
export function isSplitEvent(event: { type: string }): boolean {
  return event.type === 'checkpoint' || event.type === 'flag';
}

/** Plays the whole input log headlessly and reports the outcome. */
export function simulateReplay(replay: Replay, content: RunContent): ReplayOutcome {
  const world = createReplayWorld(replay, content);
  const input = new InputPlayer(replay.input);
  const splits: number[] = [];
  for (;;) {
    const bits = input.next();
    if (bits === NO_INPUT) break;
    const running = world.step(bits);
    for (const e of world.events) if (isSplitEvent(e)) splits.push(world.clock);
    if (!running) break;
  }
  const result = world.rules.result;
  const score = world.player.score?.score ?? 0;
  const outcome = evaluateMission(
    content.mission,
    replay.mode,
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
    splits,
  };
}
