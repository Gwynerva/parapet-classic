/**
 * One run of a level: owns the `World`, paces it with the fixed-step clock, collects presses
 * between steps and produces the replay of the run when it ends.
 *
 * A run may race a ghost: a recorded run (someone's shared replay or the player's own best)
 * re-simulated in a second `World` of its own, stepped in lockstep right after the player's.
 * The two worlds never touch each other, so a ghost can change nothing about the player's
 * run: same input, same result, with or without one.
 */
import {
  cleanReplayName,
  contentHashes,
  createReplayWorld,
  createRun,
  InputPlayer,
  isSplitEvent,
  NO_INPUT,
  RULESET_ID,
  SIM_VERSION,
  type ContentHash,
  type InputRun,
  type LevelData,
  type MissionInfo,
  type MoveTableData,
  type PhysicsTables,
  type Replay,
  type ReplayOutcome,
  type RivalRecording,
  type RunMode,
  type World,
  type WorldEvent,
} from '@parapet/sim';
import { FixedStepClock } from './GameLoop.ts';

/** Whose run a ghost is. */
export type GhostKind = 'challenger' | 'best';

export interface GhostSetup {
  kind: GhostKind;
  /** The recorded run; its level and mode match the run it races. */
  replay: Replay;
  /** What the replay produces (`simulateReplay`): final result and splits. */
  outcome: ReplayOutcome;
}

/**
 * A race against a published record (a boss's): only its time and split times are known, so
 * nothing is simulated for it; the screens show how the player stands against them.
 */
export interface ContestSetup {
  timeMs: number;
  /** Clock at the record's k-th flag or checkpoint. */
  splitsMs: number[];
  /** The character the record holder races in (the look the winner gets). */
  character: number;
}

export interface RunSetup {
  levelId: number;
  mode: RunMode;
  withRival: boolean;
  playerName: string;
  character: number;
  /** Dev/replay mode: feed this input log instead of the player's presses. */
  script?: InputRun[];
  /**
   * Development only: feed this input log instead of the player's presses, but count the run
   * as the player's (to try the results of a contest without playing it).
   */
  autopilot?: InputRun[];
  /** A recorded run to race. */
  ghost?: GhostSetup;
  /** A record to beat (the bosses' contests). */
  contest?: ContestSetup;
}

export interface RunData {
  level: LevelData;
  mission: MissionInfo;
  moves: MoveTableData;
  tables: PhysicsTables;
  rival: RivalRecording | null;
}

export type StepListener = (events: readonly WorldEvent[], world: World) => void;

export class RunSession {
  readonly world: World;
  readonly setup: RunSetup;
  readonly clock = new FixedStepClock();
  /** The ghost's world, or null when the run has no ghost. */
  readonly ghostWorld: World | null;
  /** Game clock at every checkpoint or flag the player reached, in order (see `splits`). */
  readonly splits: number[] = [];
  private pendingBits = 0;
  private readonly script: InputPlayer | null;
  private readonly ghostInput: InputPlayer | null;
  private ghostExhausted = false;
  private readonly listeners: StepListener[] = [];
  private readonly ghostListeners: StepListener[] = [];
  private readonly data: RunData;
  private hashes: ContentHash | null = null;
  /** Wall-clock milliseconds spent in the run (for display only). */
  elapsedMs = 0;
  paused = false;

  constructor(setup: RunSetup, data: RunData) {
    this.setup = setup;
    this.data = data;
    const scripted = setup.script ?? setup.autopilot;
    this.script = scripted ? new InputPlayer(scripted) : null;
    this.world = createRun({
      mode: setup.mode,
      level: data.level,
      mission: data.mission,
      moves: data.moves,
      tables: data.tables,
      rival: setup.withRival ? data.rival : null,
    });
    const ghost = setup.ghost;
    this.ghostWorld = ghost ? createReplayWorld(ghost.replay, data) : null;
    this.ghostInput = ghost ? new InputPlayer(ghost.replay.input) : null;
  }

  get finished(): boolean {
    return this.world.finished;
  }

  /** Whether the ghost has run out of input or reached the end of its run. */
  get ghostDone(): boolean {
    return this.ghostWorld === null || this.ghostWorld.finished || this.ghostExhausted;
  }

  /** Called after every player step with the events of that step. */
  onStep(listener: StepListener): void {
    this.listeners.push(listener);
  }

  /** Called after every ghost step, before the player's listeners of the same step. */
  onGhostStep(listener: StepListener): void {
    this.ghostListeners.push(listener);
  }

  /** Presses are OR-ed together until the next simulation step consumes them. */
  queueInput(bits: number): void {
    this.pendingBits |= bits;
  }

  /** Advance by real time; returns the number of simulation steps run. */
  advance(dtMs: number): number {
    if (this.paused || this.finished) return 0;
    this.elapsedMs += dtMs;
    return this.clock.advance(dtMs, {
      step: () => {
        let bits = this.pendingBits;
        this.pendingBits = 0;
        if (this.script) {
          const scripted = this.script.next();
          bits = scripted === NO_INPUT ? 0 : scripted;
        }
        const running = this.world.step(bits);
        for (const e of this.world.events) if (isSplitEvent(e)) this.splits.push(this.world.clock);
        this.stepGhost();
        for (const l of this.listeners) l(this.world.events, this.world);
        return running;
      },
    });
  }

  private stepGhost(): void {
    const ghost = this.ghostWorld;
    if (!ghost || !this.ghostInput || this.ghostDone) return;
    const bits = this.ghostInput.next();
    if (bits === NO_INPUT) {
      this.ghostExhausted = true;
      return;
    }
    ghost.step(bits);
    for (const l of this.ghostListeners) l(ghost.events, ghost);
  }

  get alpha(): number {
    return this.finished ? 1 : this.clock.alpha;
  }

  /** Hashes of the content this run was played on (computed once per session). */
  get contentHash(): ContentHash {
    this.hashes ??= contentHashes(this.data.level, this.data.moves, this.data.tables);
    return this.hashes;
  }

  /** The replay of this run; null while the run is still going. */
  buildReplay(): Replay | null {
    if (!this.world.rules.result) return null;
    return {
      simVersion: SIM_VERSION,
      rulesetId: RULESET_ID,
      contentHash: this.contentHash,
      levelId: this.setup.levelId,
      mode: this.setup.mode,
      // Only a sprint has a rival; the flag may be left over from the sprint before.
      withRival: this.setup.mode === 'sprint' && this.setup.withRival,
      character: this.setup.character,
      playerName: cleanReplayName(this.setup.playerName),
      input: this.world.recorder.finish(),
    };
  }
}
