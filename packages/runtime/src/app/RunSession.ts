/**
 * One run of a level: owns the `World`, paces it with the fixed-step clock, collects presses
 * between steps and produces the submission for the leaderboard when the run ends.
 */
import {
  contentHashes,
  createRun,
  InputPlayer,
  NO_INPUT,
  RULESET_ID,
  SIM_VERSION,
  type ContentHash,
  type InputRun,
  type LevelData,
  type MissionInfo,
  type MoveTableData,
  type PhysicsTables,
  type RivalRecording,
  type RunMode,
  type World,
  type WorldEvent,
} from '@parapet/sim';
import { PROTOCOL_VERSION, type RunSubmission } from '@parapet/protocol';
import { FixedStepClock } from './GameLoop.ts';

export interface RunSetup {
  levelId: number;
  mode: RunMode;
  withRival: boolean;
  playerName: string;
  character: number;
  /** Dev/replay mode: feed this input log instead of the player's presses. */
  script?: InputRun[];
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
  private pendingBits = 0;
  private readonly script: InputPlayer | null;
  private readonly listeners: StepListener[] = [];
  private readonly data: RunData;
  private hashes: ContentHash | null = null;
  /** Wall-clock milliseconds spent in the run (for display only). */
  elapsedMs = 0;
  paused = false;

  constructor(setup: RunSetup, data: RunData) {
    this.setup = setup;
    this.data = data;
    this.script = setup.script ? new InputPlayer(setup.script) : null;
    this.world = createRun({
      mode: setup.mode,
      level: data.level,
      mission: data.mission,
      moves: data.moves,
      tables: data.tables,
      rival: setup.withRival ? data.rival : null,
    });
  }

  get finished(): boolean {
    return this.world.finished;
  }

  onStep(listener: StepListener): void {
    this.listeners.push(listener);
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
        for (const l of this.listeners) l(this.world.events, this.world);
        return running;
      },
    });
  }

  get alpha(): number {
    return this.finished ? 1 : this.clock.alpha;
  }

  /** Hashes of the content this run was played on (computed once per session). */
  get contentHash(): ContentHash {
    this.hashes ??= contentHashes(this.data.level, this.data.moves, this.data.tables);
    return this.hashes;
  }

  /** Build the leaderboard submission; null while the run is still going. */
  buildSubmission(): RunSubmission | null {
    const result = this.world.rules.result;
    if (!result) return null;
    return {
      protocolVersion: PROTOCOL_VERSION,
      simVersion: SIM_VERSION,
      rulesetId: RULESET_ID,
      contentHash: this.contentHash,
      levelId: this.setup.levelId,
      mode: this.setup.mode,
      withRival: this.setup.withRival,
      playerName: this.setup.playerName,
      character: this.setup.character,
      input: this.world.recorder.finish(),
      claimed: {
        finished: result.finished,
        timeUp: result.timeUp,
        time: result.time,
        score: this.world.player.score?.score ?? 0,
        steps: this.world.stepCount,
        hash: this.world.hash(),
      },
    };
  }
}
