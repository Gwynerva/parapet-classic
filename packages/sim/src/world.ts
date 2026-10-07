/**
 * The simulation world: level, runners, rules and the fixed-step loop. One `step()` advances
 * every runner by 30 time units in the order of the original frame loop (`boolean_d`, d.java
 * line 10473): rivals first, then the player, then scoring and the mission rules.
 */
import { buildSineTable } from './math/int.ts';
import { Level, type LevelData } from './level/level.ts';
import {
  InputPlayer,
  InputRecorder,
  NO_INPUT,
  type InputRun,
  type RivalRecording,
} from './replay.ts';
import { MoveTable, type MoveTableData } from './runner/moves.ts';
import { RunnerState } from './runner/runner.ts';
import {
  enterMove,
  moveDuration,
  STEP,
  stepRunner,
  type SimEvent,
  type StepContext,
} from './runner/step.ts';
import { initImpulse } from './runner/rootMotion.ts';
import { MissionRules, type RulesEvent, type RulesOptions } from './rules.ts';
import { ScoreState } from './scoring.ts';
import type { PhysicsTables } from './tables.ts';

export interface RivalOptions {
  recording: RivalRecording;
  /** Steps are skipped until the game clock reaches this many ms (`z[7]`). */
  startDelay: number;
}

export interface WorldOptions {
  level: LevelData;
  moves: MoveTableData;
  tables: PhysicsTables;
  rules: RulesOptions;
  rivals?: RivalOptions[];
  /** Level id 2 + challenge forces facing right at spawn in the original. */
  levelId?: number;
}

export type WorldEvent = SimEvent | RulesEvent;

interface RivalRuntime {
  runner: RunnerState;
  player: InputPlayer;
  startDelay: number;
}

export class World {
  readonly level: Level;
  readonly tables: PhysicsTables;
  readonly moves: MoveTable;
  readonly sine: Int16Array;
  readonly rules: MissionRules;
  readonly runners: RunnerState[] = [];
  readonly player: RunnerState;
  readonly playerIndex: number;
  /** Game clock in time units (ms), `cg`. */
  clock = 0;
  stepCount = 0;
  /** Events of the last step. */
  readonly events: WorldEvent[] = [];
  /** The player's input log, recorded like the original does for its own replays. */
  readonly recorder = new InputRecorder();
  private readonly rivals: RivalRuntime[] = [];
  private readonly ctx: StepContext;

  constructor(opts: WorldOptions) {
    this.level = new Level(opts.level, opts.rules.missionType);
    this.tables = opts.tables;
    this.moves = new MoveTable(opts.moves);
    this.sine = buildSineTable(10, true);
    this.rules = new MissionRules({
      ...opts.rules,
      flagCount: opts.rules.flagCount ?? this.level.checkpoints.length,
    });
    const faceRight =
      this.level.spawnX() < this.level.width << 9 ||
      (opts.levelId === 2 && opts.rules.missionType === 3);
    for (const rival of opts.rivals ?? []) {
      const runner = new RunnerState();
      runner.spawn(this.level.spawnX(), this.level.spawnY(), faceRight);
      applySnapshot(runner, rival.recording);
      this.runners.push(runner);
      this.rivals.push({
        runner,
        player: new InputPlayer(
          rival.recording.entries.map((e) => ({ ticks: e.ticks, bits: e.input })),
        ),
        startDelay: rival.startDelay,
      });
    }
    this.player = new RunnerState();
    this.player.spawn(this.level.spawnX(), this.level.spawnY(), faceRight);
    this.player.score = new ScoreState();
    this.playerIndex = this.runners.length;
    this.runners.push(this.player);
    this.ctx = {
      level: this.level,
      tables: this.tables,
      moves: this.moves,
      sine: this.sine,
      clock: 0,
      events: this.events as SimEvent[],
    };
  }

  get finished(): boolean {
    return this.rules.finished;
  }

  /**
   * Advance the world by one step. `playerBits` are the presses collected since the previous
   * step (0 when none). Returns true while the run is still going.
   */
  step(playerBits: number): boolean {
    if (this.rules.finished) return false;
    this.events.length = 0;
    for (const rival of this.rivals) {
      if (this.clock < rival.startDelay) continue;
      const bits = rival.player.next();
      const r = rival.runner;
      if (bits === NO_INPUT && r.moveId !== 5) {
        // Recording exhausted: the original enters the stop move and re-initialises its
        // impulse (lines 10500-10503) without the transition-path entry effects.
        this.ctx.clock = this.clock;
        enterMove(r, this.ctx, 5);
        const stop = this.moves.get(5);
        initImpulse(
          r,
          stop.impulseType,
          stop.paramB,
          stop.paramC,
          stop.paramD,
          moveDuration(r, stop),
        );
      }
      r.pressedBits = bits;
      this.ctx.clock = this.clock;
      stepRunner(r, this.ctx, STEP);
      r.pressedBits = 0;
    }
    this.recorder.push(playerBits);
    this.clock += STEP;
    this.stepCount++;
    this.ctx.clock = this.clock;
    this.player.pressedBits = playerBits;
    stepRunner(this.player, this.ctx, STEP);
    this.player.pressedBits = 0;
    if (this.rules.check(this.player, this.level, this.clock, this.events as RulesEvent[])) {
      return false;
    }
    const score = this.player.score!;
    const move = this.moves.get(this.player.moveId);
    score.step(this.player.moveId, move.scoreType === 5, this.player.vy, this.clock);
    return true;
  }

  /** Run a recorded input log to its end (or until the run finishes). */
  replay(runs: readonly InputRun[]): void {
    const input = new InputPlayer(runs);
    for (;;) {
      const bits = input.next();
      if (bits === NO_INPUT) break;
      if (!this.step(bits)) break;
    }
  }

  /** Cheap deterministic digest of the dynamic state, for determinism tests and verification. */
  hash(): number {
    let h = 2166136261;
    const mix = (v: number): void => {
      h ^= v & 0xffff;
      h = Math.imul(h, 16777619);
      h ^= v >>> 16;
      h = Math.imul(h, 16777619);
    };
    mix(this.clock);
    for (const r of this.runners) {
      mix(r.x);
      mix(r.y);
      mix(r.vx);
      mix(r.vy);
      mix(r.handsDx);
      mix(r.handsDy);
      mix(r.moveId);
      mix(r.moveTimer);
      mix(r.inputBuffer);
      mix(r.facingRight ? 1 : 0);
      mix(r.jumpPowerA);
      mix(r.jumpPowerB);
      if (r.score) {
        mix(r.score.score);
        mix(r.score.meter);
      }
    }
    return h >>> 0;
  }
}

/** Apply the 28-int physics snapshot of a rival recording (`W()`, line 4824). */
function applySnapshot(r: RunnerState, rec: RivalRecording): void {
  const s = rec.snapshot;
  const at = (i: number): number => s[i] ?? 0;
  r.subStepAcc = at(1);
  r.moveId = at(2);
  r.moveTimer = at(3);
  r.x = at(4);
  r.y = at(5);
  r.renderX = r.x;
  r.renderY = r.y;
  r.vx = at(6);
  r.vy = at(7);
  r.spare = at(8);
  r.tangentSpeed = at(9);
  r.prevVx = at(10);
  r.prevVy = at(11);
  r.inputBuffer = at(12);
  r.impulseType = at(13);
  r.paramA = at(14);
  r.paramB = at(15);
  r.paramC = at(16);
  r.paramD = at(17);
  r.phaseTime = at(18);
  r.phaseDuration = at(19);
  r.scratchG = at(20);
  r.scratchH = at(21);
  r.scratchI = at(22);
  r.scratchJ = at(23);
  r.impulseX = at(24);
  r.impulseY = at(25);
  r.accX = at(26);
  r.accY = at(27);
  r.facingRight = rec.flags[0] === 1;
  r.handsAnchored = rec.flags[1] === 1;
}
