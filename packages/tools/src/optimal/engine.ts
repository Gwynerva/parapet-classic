/**
 * The simulation as an exact search sees it: a state is a flat row of ints holding everything
 * the next steps can depend on, and a step is the world's step without scoring or events.
 *
 * What the row leaves out, and why that is exact:
 * - `clock`, `stepCount`: the physics never reads them (scoring and splits do); a search layer
 *   holds states of one step anyway.
 * - `prevVx`, `prevVy`: `stepRunner` overwrites them before anything reads them.
 * - `pressedBits`: zero between steps.
 * - `spare`, `moveBits`, `moveEntryCount`, `score`, `Probe.isHands`: never read by the physics
 *   (`isHands` is fixed per probe).
 * - Rules: `flagsLeft`, `nextCheckpoint` follow from `remainingMask`; splits are bookkeeping.
 * - `Probe.hit`, `Probe.distSq`: the sweep sets them before every read (rows hold zeros).
 * - Input buffer bits no move can read before the buffer is cleared (`liveBuffer`).
 * Everything else is kept, including the probes' leftovers from earlier steps (`surface`,
 * `push`, `tile` and the rest are read across steps).
 */
import {
  inputReads,
  Input,
  MissionRules,
  MoveFlag,
  RunnerState,
  STEP,
  stepRunner,
  type Probe,
  type RulesEvent,
  type MoveTableData,
  type RunContent,
  type StepContext,
  type World,
} from '@parapet/sim';
import { newWorld } from '../tas/timeline.ts';
import type { ContestMode } from '../tas/model.ts';

/** Ints per probe in a state row. */
const PROBE_INTS = 12;
/** Runner fields before the probes. */
const RUNNER_INTS = 44;
/** Ints in a state row: the runner, four probes, the rules' mask. */
export const STATE_INTS = RUNNER_INTS + 4 * PROBE_INTS + 1;

/** The four bits the physics reads; a press is any subset of them. */
export const PRESS_BITS = [Input.UP, Input.DOWN, Input.FORWARD, Input.BACK] as const;
/** All 16 presses (bit subsets of U, D, F, B), 0 first. */
export const PRESSES: readonly number[] = Array.from({ length: 16 }, (_, i) =>
  PRESS_BITS.reduce((acc, b, k) => (i & (1 << k) ? acc | b : acc), 0),
);
/** An input bit no condition reads, used to see whether a step cleared the buffer. */
const MARK = 64;

function writeProbe(p: Probe, a: Int32Array, o: number): void {
  a[o] = 0;
  a[o + 1] = p.px;
  a[o + 2] = p.py;
  a[o + 3] = p.pushX;
  a[o + 4] = p.pushY;
  a[o + 5] = p.nx;
  a[o + 6] = p.ny;
  a[o + 7] = 0;
  a[o + 8] = p.tile;
  a[o + 9] = p.tx;
  a[o + 10] = p.ty;
  a[o + 11] = p.surface;
}

function readProbe(p: Probe, a: Int32Array, o: number): void {
  p.hit = false;
  p.px = a[o + 1]!;
  p.py = a[o + 2]!;
  p.pushX = a[o + 3]!;
  p.pushY = a[o + 4]!;
  p.nx = a[o + 5]!;
  p.ny = a[o + 6]!;
  p.distSq = 0;
  p.tile = a[o + 8]!;
  p.tx = a[o + 9]!;
  p.ty = a[o + 10]!;
  p.surface = a[o + 11]!;
}

/** Writes the runner and the rules into `a` at `o`. */
export function writeState(r: RunnerState, rules: MissionRules, a: Int32Array, o: number): void {
  a[o] = r.x;
  a[o + 1] = r.y;
  a[o + 2] = r.handsDx;
  a[o + 3] = r.handsDy;
  a[o + 4] = r.handsDeltaX;
  a[o + 5] = r.handsDeltaY;
  a[o + 6] = r.rootDeltaX;
  a[o + 7] = r.rootDeltaY;
  a[o + 8] = r.vx;
  a[o + 9] = r.vy;
  a[o + 10] = r.tangentSpeed;
  a[o + 11] = r.renderHandsDx;
  a[o + 12] = r.renderHandsDy;
  a[o + 13] = r.renderX;
  a[o + 14] = r.renderY;
  a[o + 15] = r.subStepAcc;
  a[o + 16] = r.contactProbe;
  a[o + 17] = r.accelX;
  a[o + 18] = r.accelY;
  a[o + 19] =
    (r.handsPinned ? 1 : 0) |
    (r.facingRight ? 2 : 0) |
    (r.handsAnchored ? 4 : 0) |
    (r.facingLocked ? 8 : 0);
  a[o + 20] = r.snapType;
  a[o + 21] = r.snapY;
  a[o + 22] = r.impulseType;
  a[o + 23] = r.paramA;
  a[o + 24] = r.paramB;
  a[o + 25] = r.paramC;
  a[o + 26] = r.paramD;
  a[o + 27] = r.phaseTime;
  a[o + 28] = r.phaseDuration;
  a[o + 29] = r.scratchG;
  a[o + 30] = r.scratchH;
  a[o + 31] = r.scratchI;
  a[o + 32] = r.scratchJ;
  a[o + 33] = r.impulseX;
  a[o + 34] = r.impulseY;
  a[o + 35] = r.accX;
  a[o + 36] = r.accY;
  a[o + 37] = r.jumpPowerA;
  a[o + 38] = r.jumpPowerB;
  a[o + 39] = r.inputBuffer;
  a[o + 40] = r.storedSpeed;
  a[o + 41] = r.moveId;
  a[o + 42] = r.moveTimer;
  a[o + 43] = 0;
  let p = o + RUNNER_INTS;
  for (let i = 0; i < 3; i++, p += PROBE_INTS) writeProbe(r.probes[i]!, a, p);
  writeProbe(r.lookahead, a, p);
  a[p + PROBE_INTS] = rules.remainingMask;
}

/** Puts a state row back into the runner and the rules. */
export function readState(r: RunnerState, rules: MissionRules, a: Int32Array, o: number): void {
  r.x = a[o]!;
  r.y = a[o + 1]!;
  r.handsDx = a[o + 2]!;
  r.handsDy = a[o + 3]!;
  r.handsDeltaX = a[o + 4]!;
  r.handsDeltaY = a[o + 5]!;
  r.rootDeltaX = a[o + 6]!;
  r.rootDeltaY = a[o + 7]!;
  r.vx = a[o + 8]!;
  r.vy = a[o + 9]!;
  r.prevVx = 0;
  r.prevVy = 0;
  r.tangentSpeed = a[o + 10]!;
  r.renderHandsDx = a[o + 11]!;
  r.renderHandsDy = a[o + 12]!;
  r.renderX = a[o + 13]!;
  r.renderY = a[o + 14]!;
  r.subStepAcc = a[o + 15]!;
  r.contactProbe = a[o + 16]!;
  r.accelX = a[o + 17]!;
  r.accelY = a[o + 18]!;
  const f = a[o + 19]!;
  r.handsPinned = (f & 1) !== 0;
  r.facingRight = (f & 2) !== 0;
  r.handsAnchored = (f & 4) !== 0;
  r.facingLocked = (f & 8) !== 0;
  r.snapType = a[o + 20]!;
  r.snapY = a[o + 21]!;
  r.impulseType = a[o + 22]!;
  r.paramA = a[o + 23]!;
  r.paramB = a[o + 24]!;
  r.paramC = a[o + 25]!;
  r.paramD = a[o + 26]!;
  r.phaseTime = a[o + 27]!;
  r.phaseDuration = a[o + 28]!;
  r.scratchG = a[o + 29]!;
  r.scratchH = a[o + 30]!;
  r.scratchI = a[o + 31]!;
  r.scratchJ = a[o + 32]!;
  r.impulseX = a[o + 33]!;
  r.impulseY = a[o + 34]!;
  r.accX = a[o + 35]!;
  r.accY = a[o + 36]!;
  r.jumpPowerA = a[o + 37]!;
  r.jumpPowerB = a[o + 38]!;
  r.inputBuffer = a[o + 39]!;
  r.storedSpeed = a[o + 40]!;
  r.moveId = a[o + 41]!;
  r.moveTimer = a[o + 42]!;
  r.pressedBits = 0;
  let p = o + RUNNER_INTS;
  for (let i = 0; i < 3; i++, p += PROBE_INTS) readProbe(r.probes[i]!, a, p);
  readProbe(r.lookahead, a, p);
  rules.remainingMask = a[p + PROBE_INTS]!;
  rules.result = null;
}

/**
 * Per move, the buffer bits that can still be read before the buffer is cleared: those its
 * transitions (and its parents') test with conditions 10–13, and those of every move it can
 * enter while keeping the buffer (flag 0x40), or fall into from anywhere (the pit's move 11,
 * entered without touching the buffer). A fixpoint over the move graph.
 */
export function liveBuffer(moves: MoveTableData): Int32Array {
  const states = moves.states;
  const n = states.length;
  const BUFFERED: Record<number, number> = {
    10: Input.BACK,
    11: Input.FORWARD,
    12: Input.UP,
    13: Input.DOWN,
  };
  const live = new Int32Array(n);
  const targets: number[][] = [];
  for (let i = 0; i < n; i++) {
    const t = new Set<number>();
    for (let id = i; id !== -1; id = states[id]!.parent) {
      for (const tr of states[id]!.transitions) {
        t.add(tr.target);
        for (const c of tr.conditions) live[i] = live[i]! | (BUFFERED[c] ?? 0);
      }
    }
    if (states[i]!.next !== -1) t.add(states[i]!.next);
    targets.push([...t]);
  }
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < n; i++) {
      let v = live[i]! | live[PIT_MOVE]!;
      for (const t of targets[i]!)
        if ((states[t]!.flags & MoveFlag.KEEP_BUFFER) !== 0) v |= live[t]!;
      if (v !== live[i]) {
        live[i] = v;
        changed = true;
      }
    }
  }
  return live;
}

const PIT_MOVE = 11;
const BUFFER = 39;
const MOVE = 41;

/** Does input condition `c` (bit c of `inputReads.mask`, condition 6 + c) hold for `bits`? */
function conditionHolds(c: number, bits: number, buffer: number): boolean {
  switch (c) {
    case 0:
      return (bits & Input.BACK) !== 0;
    case 1:
      return (bits & Input.FORWARD) !== 0;
    case 2:
      return (bits & Input.UP) !== 0;
    case 3:
      return (bits & Input.DOWN) !== 0;
    default: {
      const mask = [Input.BACK, Input.FORWARD, Input.UP, Input.DOWN][c - 4]!;
      return bits === 0 && ((buffer | bits) & mask) !== 0;
    }
  }
}

/** One successor of an expansion: the presses that lead to it share one simulated step. */
export interface Successor {
  /** Index into `PRESSES` of the cheapest press of the group (fewest bits). */
  press: number;
  /** The run finished on this step. */
  finished: boolean;
}

export class Engine {
  readonly world: World;
  readonly runner: RunnerState;
  readonly rules: MissionRules;
  private readonly ctx: StepContext;
  private readonly rulesEvents: RulesEvent[] = [];
  private readonly live: Int32Array;
  private readonly flagCount: number;
  private readonly flagBits: number;
  private readonly startRow: Int32Array;
  /** Steps simulated so far (each costs one `stepRunner`). */
  steps = 0;

  constructor(content: RunContent, mode: ContestMode) {
    this.world = newWorld(content, mode);
    this.runner = this.world.player;
    this.runner.score = null;
    this.rules = this.world.rules;
    this.live = liveBuffer(content.moves);
    this.flagCount = this.rules.flagsLeft;
    this.flagBits = (1 << this.flagCount) - 1;
    this.startRow = new Int32Array(STATE_INTS);
    writeState(this.runner, this.rules, this.startRow, 0);
    this.startRow[BUFFER] = this.startRow[BUFFER]! & this.live[this.startRow[MOVE]!]!;
    const sink = { push: () => 0, length: 0 } as unknown as StepContext['events'];
    this.ctx = {
      level: this.world.level,
      tables: this.world.tables,
      moves: this.world.moves,
      sine: this.world.sine,
      clock: 0,
      events: sink,
    };
  }

  /** The start of the run as a row. */
  start(out: Int32Array, o = 0): void {
    out.set(this.startRow, o);
  }

  /** Drops the buffer bits the row's move can never read. */
  canon(a: Int32Array, o: number): void {
    a[o + BUFFER] = a[o + BUFFER]! & this.live[a[o + MOVE]!]!;
  }

  /** Loads a row into the runner and the rules (with the flag count its mask implies). */
  load(a: Int32Array, o: number): void {
    readState(this.runner, this.rules, a, o);
    const mask = this.rules.remainingMask & this.flagBits;
    let left = 0;
    for (let m = mask; m !== 0; m &= m - 1) left++;
    this.rules.flagsLeft = left;
    this.rules.nextCheckpoint = this.flagCount - left;
  }

  /** Steps the loaded state with `bits`; true when the run finished on this step. */
  stepLoaded(bits: number): boolean {
    const r = this.runner;
    r.pressedBits = bits;
    stepRunner(r, this.ctx, STEP);
    r.pressedBits = 0;
    this.steps++;
    this.rulesEvents.length = 0;
    return (
      this.rules.check(r, this.world.level, 0, this.rulesEvents) && !!this.rules.result?.finished
    );
  }

  /**
   * Every distinct successor of the state at `src[so]`: written one row each into `out` from
   * `oo`, with the press that reaches it in `succ`. Presses that the step cannot tell apart
   * (they agree on every input condition it evaluated) are simulated once; their rows differ
   * only in the input buffer, and only when the step kept it. Returns the number written.
   */
  expand(
    src: Int32Array,
    so: number,
    out: Int32Array,
    oo: number,
    succ: Successor[],
    presses: readonly number[] = PRESSES,
  ): number {
    succ.length = 0;
    const buffer = src[so + 39]!;
    let pending = 0;
    for (let i = 0; i < presses.length; i++) pending |= 1 << i;
    let n = 0;
    while (pending !== 0) {
      const lead = 31 - Math.clz32(pending & -pending);
      const bits = presses[lead]!;
      this.load(src, so);
      this.runner.inputBuffer |= MARK;
      inputReads.mask = 0;
      const finished = this.stepLoaded(bits);
      const read = inputReads.mask;
      const r = this.runner;
      const kept = (r.inputBuffer & MARK) !== 0;
      r.inputBuffer &= ~MARK;
      // The group of `lead`: presses agreeing with it on every condition the step read.
      let group = 0;
      for (let i = 0; i < presses.length; i++) {
        if ((pending & (1 << i)) === 0) continue;
        let same = true;
        for (let c = 0; c < 8 && same; c++) {
          if ((read & (1 << c)) === 0) continue;
          if (conditionHolds(c, presses[i]!, buffer) !== conditionHolds(c, bits, buffer)) {
            same = false;
          }
        }
        if (same) group |= 1 << i;
      }
      pending &= ~group;
      if (!kept) {
        writeState(r, this.rules, out, oo + n * STATE_INTS);
        this.canon(out, oo + n * STATE_INTS);
        succ.push({ press: lead, finished });
        n++;
        continue;
      }
      // The buffer was kept (it is `buffer | press`): one row per distinct buffer value.
      const seen = new Set<number>();
      for (let i = 0; i < presses.length; i++) {
        if ((group & (1 << i)) === 0) continue;
        const b = (buffer | presses[i]!) & this.live[r.moveId]!;
        if (seen.has(b)) continue;
        seen.add(b);
        r.inputBuffer = b;
        writeState(r, this.rules, out, oo + n * STATE_INTS);
        succ.push({ press: i, finished });
        n++;
      }
    }
    return n;
  }
}
