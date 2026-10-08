/**
 * Input logs. The original records the per-step press byte as runs of (count, value) and
 * replays them with `byte_a(int)` (d.java line 4919); the same format drives rivals, ghosts and
 * our leaderboard replays.
 */

export interface InputRun {
  /** Number of steps this value is held. */
  ticks: number;
  /** Press bits (see `Input`), or -1 for "no more input". */
  bits: number;
}

/** End-of-input marker returned by `InputPlayer.next()`. */
export const NO_INPUT = -1;

/** Records per-step press bits as runs (`a(byte)`, line 4907). */
export class InputRecorder {
  readonly runs: InputRun[] = [];
  private current = 0;
  private count = 0;

  push(bits: number): void {
    if (bits !== this.current) {
      if (this.count > 0) {
        this.runs.push({ ticks: this.count, bits: this.current });
      }
      this.current = bits;
      this.count = 1;
    } else {
      this.count++;
    }
  }

  /** Flush the open run and return a copy of the log. */
  finish(): InputRun[] {
    const runs = this.runs.slice();
    if (this.count > 0) {
      runs.push({ ticks: this.count, bits: this.current });
    }
    return runs;
  }

  /** Forget everything recorded so far. */
  clear(): void {
    this.runs.length = 0;
    this.current = 0;
    this.count = 0;
  }

  /** Replace the log with `runs` (as returned by `finish()`), continuing after its last run. */
  restore(runs: readonly InputRun[]): void {
    this.clear();
    for (const run of runs) this.runs.push({ ticks: run.ticks, bits: run.bits });
    const last = this.runs.pop();
    if (last) {
      this.current = last.bits;
      this.count = last.ticks;
    }
  }
}

/**
 * Plays an input log back one step at a time, with the exact semantics of `byte_a`: a run of
 * `ticks` steps yields its bits on every step; a run with 0 ticks or the end of the log yields
 * `NO_INPUT` forever.
 */
export class InputPlayer {
  private readonly runs: readonly InputRun[];
  private index = 0;
  private remaining = 0;
  private value = 0;
  private ended = false;

  constructor(runs: readonly InputRun[]) {
    this.runs = runs;
  }

  next(): number {
    if (this.ended) return NO_INPUT;
    if (this.remaining === 0) {
      const run = this.runs[this.index];
      if (!run || run.ticks === 0) {
        this.ended = true;
        return NO_INPUT;
      }
      this.index++;
      this.remaining = run.ticks;
      this.value = run.bits;
    }
    this.remaining--;
    return this.value;
  }

  reset(): void {
    this.index = 0;
    this.remaining = 0;
    this.value = 0;
    this.ended = false;
  }
}

/** Upper bound on the steps an input log may cover (100 minutes of game clock). */
export const MAX_STEPS = 200000;
/** Largest press byte: UP | DOWN | RIGHT | LEFT | FORWARD | BACK. */
export const MAX_INPUT_BITS = 63;

/**
 * Validates an untrusted input log (parsed JSON or decoded bytes): an array of runs with
 * 1..MAX_STEPS ticks and press bits 0..MAX_INPUT_BITS, covering at most `MAX_STEPS` steps.
 * Returns a normalised copy, or null.
 */
export function parseInputRuns(raw: unknown): InputRun[] | null {
  if (!Array.isArray(raw)) return null;
  const out: InputRun[] = [];
  let total = 0;
  for (const run of raw as unknown[]) {
    if (typeof run !== 'object' || run === null) return null;
    const { ticks, bits } = run as { ticks?: unknown; bits?: unknown };
    if (!Number.isInteger(ticks) || !Number.isInteger(bits)) return null;
    const t = ticks as number;
    const b = bits as number;
    if (t < 1 || t > MAX_STEPS || b < 0 || b > MAX_INPUT_BITS) return null;
    total += t;
    if (total > MAX_STEPS) return null;
    out.push({ ticks: t, bits: b });
  }
  return out;
}

/** Expand runs into one value per step (helper for tests and tools). */
export function expandRuns(runs: readonly InputRun[]): number[] {
  const out: number[] = [];
  for (const run of runs) {
    for (let i = 0; i < run.ticks; i++) out.push(run.bits);
  }
  return out;
}

/**
 * A rival recording as decoded from the original jar (`packages/content/playman/extracted/rivals/<n>.json`).
 * `snapshot` holds the 28 ints written by `W()` (line 4824), `flags` the facing and
 * hands-anchored bytes.
 */
export interface RivalRecording {
  level: number;
  snapshot: number[];
  flags: [number, number];
  totalTime: number;
  entries: { ticks: number; input: number }[];
}
