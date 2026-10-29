/**
 * Free polish: frame-level hill climbing on a run without human limits. Every step's press is
 * tried as each of the 16 chords, every press is moved by up to `reach` steps or dropped, and
 * pairs of nearby edits are sampled; an edit is kept when the run finishes earlier, or as early
 * with its flags taken earlier (the sum of the split steps). Re-simulation starts from the
 * state saved before the edited step. Usage:
 *   node src/optimal/polish.ts <level> <mode> [from=record|beam] [seconds=300]
 */
import { existsSync } from 'node:fs';
import { Input, SIM_VERSION } from '@parapet/sim';
import { Engine, MASK, PRESSES, STATE_INTS } from './engine.ts';
import { readArgs, readRecord, resultPath, writeResult } from './common.ts';
import { readJson } from '../files.ts';
import { levelContent } from '../tas/content.ts';
import { newWorld } from '../tas/timeline.ts';
import { keyBits, parsePresses } from '../tas/model.ts';
import { parsePressText, playBits, pressText } from './route.ts';

const { level, mode } = readArgs(process.argv.slice(2), { level: 0, mode: 'flags' });
const from = process.argv[4] ?? 'record';
const seconds = Number(process.argv[5] ?? 300);
const reach = 6;
const PHYSICS = Input.UP | Input.DOWN | Input.FORWARD | Input.BACK;

const content = levelContent(level);
const engine = new Engine(content, mode);
/** The polished run's own file, and the beam search's. */
const own = resultPath('optimal', `${level}-${mode}`);
const beam = resultPath('optimal', `${level}-${mode}-beam`);

/** The human record's presses as the bits each step received. */
function recordBits(): number[] {
  const file = readRecord(level, mode);
  const presses = parsePresses(file.presses);
  const world = newWorld(content, mode);
  const bits: number[] = [];
  let i = 0;
  while (!world.finished) {
    let b = 0;
    if (presses[i] && presses[i]!.step === world.stepCount) {
      b = keyBits(presses[i++]!.key, world.player.facingRight) & PHYSICS;
    }
    bits.push(b);
    world.step(b);
  }
  return bits;
}

function startBits(): number[] {
  if (from === 'best' && existsSync(own))
    return parsePressText(readJson<{ presses: string }>(own).presses);
  if (from === 'beam' && existsSync(beam))
    return parsePressText(readJson<{ presses: string }>(beam).presses);
  return recordBits();
}

/** Score of a run: finish step, then the sum of its split steps (lower is better). */
interface Score {
  steps: number;
  splits: number;
}
const better = (a: Score, b: Score): boolean =>
  a.steps < b.steps || (a.steps === b.steps && a.splits < b.splits);

let bits = startBits();
/** Rows before each step of the current run, and its split steps. */
let rows = new Int32Array(0);
let best: Score = { steps: 0, splits: 0 };

/** Plays `b` from step `s` (loading `rows` there); null when it does not beat `limit`. */
function play(
  b: readonly number[],
  s: number,
  splitsBefore: number,
  limit: Score,
  keep: boolean,
): Score | null {
  const cur = new Int32Array(STATE_INTS);
  const out = new Int32Array(STATE_INTS * 16);
  cur.set(rows.subarray(s * STATE_INTS, (s + 1) * STATE_INTS));
  let splits = splitsBefore;
  const succ: { press: number; finished: boolean }[] = [];
  const saved = keep ? new Int32Array((limit.steps + 1) * STATE_INTS) : null;
  if (saved) saved.set(rows.subarray(0, (s + 1) * STATE_INTS));
  for (let t = s; t < limit.steps; t++) {
    engine.expand(cur, 0, out, 0, succ, [b[t] ?? 0]);
    if ((out[MASK]! & 31) !== (cur[MASK]! & 31)) splits += t + 1;
    cur.set(out.subarray(0, STATE_INTS));
    if (saved) saved.set(cur, (t + 1) * STATE_INTS);
    if (succ[0]!.finished) {
      const score = { steps: t + 1, splits };
      if (!better(score, limit) && !keep) return null;
      if (saved) rows = saved;
      return score;
    }
  }
  return null;
}

/** Split sum of the current run up to step s (from the stored rows). */
function splitsUpTo(s: number): number {
  let sum = 0;
  for (let t = 0; t < s; t++) {
    if ((rows[(t + 1) * STATE_INTS + MASK]! & 31) !== (rows[t * STATE_INTS + MASK]! & 31))
      sum += t + 1;
  }
  return sum;
}

function adopt(b: number[]): void {
  bits = b;
  rows = new Int32Array(STATE_INTS);
  engine.start(rows);
  best = play(bits, 0, 0, { steps: 8000, splits: 1e18 }, true)!;
  bits.length = best.steps;
}

adopt(bits);
const startSteps = best.steps;
console.log(`level ${level} ${mode}: start ${best.steps} steps from ${from}`);
const t0 = performance.now();
let evals = 0;
let seed = 12345;
const rand = (): number => {
  seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
  return seed / 4294967296;
};

/** Tries a candidate whose first change is at step s; keeps it when better. */
function attempt(b: number[], s: number): boolean {
  evals++;
  const score = play(b, s, splitsUpTo(s), best, false);
  if (score && process.env.DEBUG)
    console.log('try', s, JSON.stringify(score), JSON.stringify(best), b.slice(s, s + 3));
  if (!score) return false;
  b.length = score.steps;
  adopt(b);
  return true;
}

const elapsed = (): number => (performance.now() - t0) / 1000;
let improved = true;
while (improved && elapsed() < seconds) {
  improved = false;
  // Single-step chords, from the end backwards (cheap to re-simulate first).
  for (let s = best.steps - 1; s >= 0 && elapsed() < seconds; s--) {
    for (const v of PRESSES) {
      if (v === (bits[s] ?? 0)) continue;
      const b = bits.slice();
      b[s] = v;
      if (attempt(b, s)) {
        improved = true;
        console.log(
          `  ${best.steps} steps (splits ${best.splits}) by step ${s} := ${v}, ${elapsed().toFixed(0)} s`,
        );
      }
    }
  }
  // Moves of each press.
  for (let s = 0; s < best.steps && elapsed() < seconds; s++) {
    if (!bits[s]) continue;
    for (let d = -reach; d <= reach; d++) {
      const t = s + d;
      if (d === 0 || t < 0 || t >= best.steps || bits[t]) continue;
      const b = bits.slice();
      b[t] = b[s]!;
      b[s] = 0;
      if (attempt(b, Math.min(s, t))) {
        improved = true;
        console.log(
          `  ${best.steps} steps (splits ${best.splits}) by moving step ${s} to ${t}, ${elapsed().toFixed(0)} s`,
        );
        break;
      }
    }
  }
  // Random pairs of nearby edits.
  for (let k = 0; k < 20000 && elapsed() < seconds; k++) {
    const s = Math.floor(rand() * best.steps);
    const t = Math.min(best.steps - 1, s + 1 + Math.floor(rand() * 12));
    const b = bits.slice();
    b[s] = PRESSES[Math.floor(rand() * 16)]!;
    b[t] = PRESSES[Math.floor(rand() * 16)]!;
    if (attempt(b, s)) {
      improved = true;
      console.log(
        `  ${best.steps} steps (splits ${best.splits}) by a pair at ${s},${t}, ${elapsed().toFixed(0)} s`,
      );
    }
  }
}

const check = playBits(newWorld(content, mode), bits);
if (!check.finished || check.steps !== best.steps)
  throw new Error(`replay disagrees: ${JSON.stringify(check)}`);
console.log(
  `level ${level} ${mode}: ${startSteps} → ${best.steps} steps (${(best.steps * 0.03).toFixed(2)} s), ${evals} tries, ${elapsed().toFixed(0)} s`,
);
const prev = existsSync(own) ? readJson<{ steps: number }>(own).steps : Infinity;
if (best.steps <= prev) {
  writeResult('optimal', `${level}-${mode}`, {
    levelId: level,
    mode,
    simVersion: SIM_VERSION,
    steps: best.steps,
    timeMs: check.timeMs,
    presses: pressText(bits),
  });
}
