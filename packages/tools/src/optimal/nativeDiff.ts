/**
 * Differential test (and benchmark) of the native simulation against the TS engine.
 *
 * For every level and both contest modes it random-walks the TS `Engine` (random successor
 * picks, restarts on finish, from the start or from rows kept from deep in earlier walks),
 * records every expansion (input row, successor rows, presses, finish flags) into a cases file
 * and has `native/build/simtest diff` expand the same rows and compare byte for byte.
 *
 * Usage:
 *   node src/optimal/nativeDiff.ts [--per N] [--levels 0,3] [--modes flags] [--seed S]
 *        [--bench SECONDS]
 * `--per` is the number of expansions per level and mode (default 100000). With `--bench`,
 * after the diff it times the TS engine and the native code on the same rows.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Engine, STATE_INTS, writeState, type Successor } from './engine.ts';
import { writeNativeBlob } from './exportNative.ts';
import { levelContent } from '../tas/content.ts';
import { keyBits, parsePresses, type ContestMode } from '../tas/model.ts';
import { readRun } from '../tas/files.ts';
import { rng } from '../tas/search.ts';
import { newWorld } from '../tas/timeline.ts';

const NATIVE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../native');
const BUILD_DIR = join(NATIVE_DIR, 'build');
const SIMTEST = join(BUILD_DIR, process.platform === 'win32' ? 'simtest.exe' : 'simtest');
const CHUNK = 20_000;

/** Growing int32 buffer of case records. */
class Cases {
  buf = new Int32Array(1 << 20);
  length = 0;
  count = 0;
  /** Coverage of everything added so far (not reset by `clear`). */
  finished = 0;
  offMap = 0;
  maxFall = 0;
  readonly moves = new Set<number>();
  width = 0;
  height = 0;

  private room(n: number): void {
    if (this.length + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.length + n) size *= 2;
    const next = new Int32Array(size);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
  }

  add(row: Int32Array, out: Int32Array, succ: Successor[]): void {
    const n = succ.length;
    this.room(STATE_INTS + 1 + n * (STATE_INTS + 2));
    this.buf.set(row, this.length);
    this.length += STATE_INTS;
    this.moves.add(row[41]!);
    if (row[0]! < 0 || row[0]! >= this.width << 10 || row[1]! < 0 || row[1]! >= this.height << 10)
      this.offMap++;
    if (row[9]! > this.maxFall) this.maxFall = row[9]!;
    this.buf[this.length++] = n;
    for (let k = 0; k < n; k++) {
      this.buf.set(out.subarray(k * STATE_INTS, (k + 1) * STATE_INTS), this.length);
      this.length += STATE_INTS;
      this.buf[this.length++] = succ[k]!.press;
      this.buf[this.length++] = succ[k]!.finished ? 1 : 0;
      if (succ[k]!.finished) this.finished++;
    }
    this.count++;
  }

  write(path: string): void {
    const b = this.buf.subarray(0, this.length);
    writeFileSync(path, new Uint8Array(b.buffer, b.byteOffset, b.byteLength));
  }

  clear(): void {
    this.length = 0;
    this.count = 0;
  }
}

/**
 * The rows along the recorded TAS runs of a level and mode (packages/tools/tas-out, kept
 * locally and git-ignored): finishing routes deep into the level. Empty when there are none.
 */
function routes(level: number, mode: ContestMode, engine: Engine): Int32Array[][] {
  const out: Int32Array[][] = [];
  for (const variant of ['', 'style-05', 'style-15', 'style-16', 'style-20']) {
    const run = readRun(level, mode, variant);
    if (!run) continue;
    const presses = parsePresses(run.presses);
    const world = newWorld(levelContent(level), mode);
    const rows: Int32Array[] = [];
    const push = (): void => {
      const row = new Int32Array(STATE_INTS);
      writeState(world.player, world.rules, row, 0);
      engine.canon(row, 0);
      rows.push(row);
    };
    push();
    let i = 0;
    while (!world.finished && world.stepCount < 20_000) {
      let bits = 0;
      const p = presses[i];
      if (p && p.step === world.stepCount) {
        bits = keyBits(p.key, world.player.facingRight);
        i++;
      }
      world.step(bits);
      push();
    }
    out.push(rows);
  }
  return out;
}

/** Overwrites a few fields of a row with values reachable play rarely or never produces. */
function fuzz(row: Int32Array, rand: () => number, width: number, height: number): void {
  const pick = (lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1));
  const w = width << 10;
  const h = height << 10;
  for (let k = 1 + Math.floor(rand() * 3); k > 0; k--) {
    switch (Math.floor(rand() * 9)) {
      case 0: // off the map sideways (killRows and tiles read out of range)
        row[0] = rand() < 0.5 ? pick(-8192, 2048) : pick(w - 2048, w + 8192);
        row[13] = row[0]!;
        break;
      case 1: // above or below the map
        row[1] = rand() < 0.5 ? pick(-8192, 2048) : pick(h - 2048, h + 8192);
        row[14] = row[1]!;
        break;
      case 2:
        row[8] = pick(-20000, 20000);
        break;
      case 3:
        row[9] = pick(-20000, 20000);
        break;
      case 4:
        row[10] = pick(-6000, 6000);
        break;
      case 5:
        row[42] = pick(-2, 1200);
        break;
      case 6:
        row[27] = pick(0, Math.max(0, row[28]!));
        break;
      case 7:
        row[37] = pick(0, 65536);
        row[38] = pick(0, 65536);
        break;
      default:
        row[15] = pick(0, 29);
        break;
    }
  }
}

/**
 * Random play, in episodes: free walks from the start or from rows kept deep in earlier walks;
 * walks that branch off a recorded route (or replay its tail); and short walks from fuzzed
 * rows. Half of the picks follow press 0 (the runner keeps going, so walks get deep into the
 * level), half are uniform over the successors. Yields every expansion.
 */
function* randomWalk(
  engine: Engine,
  rand: () => number,
  routeRows: Int32Array[][],
): Generator<{ row: Int32Array; out: Int32Array; succ: Successor[] }> {
  const start = new Int32Array(STATE_INTS);
  engine.start(start);
  const level = engine.world.level;
  const pool: { row: Int32Array }[] = [];
  const out = new Int32Array(STATE_INTS * 16);
  const succ: Successor[] = [];
  for (;;) {
    const r = rand();
    if (pool.length > 0 && r < 0.3) {
      // A batch of short walks from fuzzed rows.
      for (let b = 0; b < 100; b++) {
        const cur = pool[Math.floor(rand() * pool.length)]!.row.slice();
        fuzz(cur, rand, level.width, level.height);
        yield* walk(cur, Math.floor(rand() * 60));
      }
      continue;
    }
    if (routeRows.length > 0 && r < 0.4) {
      // Replay the tail of a route (its last step finishes the run).
      const rows = routeRows[Math.floor(rand() * routeRows.length)]!;
      for (let i = Math.floor(rand() * rows.length); i < rows.length; i++) {
        engine.expand(rows[i]!, 0, out, 0, succ);
        yield { row: rows[i]!, out, succ };
      }
      continue;
    }
    if (routeRows.length > 0 && r < 0.7) {
      // Branch off a route.
      for (let b = 0; b < 10; b++) {
        const rows = routeRows[Math.floor(rand() * routeRows.length)]!;
        yield* walk(rows[Math.floor(rand() * rows.length)]!.slice(), Math.floor(rand() * 600));
      }
      continue;
    }
    const p = pool.length > 0 && rand() < 0.5 ? pool[Math.floor(rand() * pool.length)]! : null;
    yield* walk(p ? p.row.slice() : start.slice(), 500 + Math.floor(rand() * 5500));
  }

  function* walk(
    cur: Int32Array,
    len: number,
  ): Generator<{ row: Int32Array; out: Int32Array; succ: Successor[] }> {
    for (let s = 0; s <= len; s++) {
      const n = engine.expand(cur, 0, out, 0, succ);
      yield { row: cur, out, succ };
      if (n === 0) break;
      const k = rand() < 0.5 ? 0 : Math.floor(rand() * n);
      if (succ[k]!.finished) break;
      cur = out.slice(k * STATE_INTS, (k + 1) * STATE_INTS);
      if (rand() < 0.003) {
        if (pool.length < 512) pool.push({ row: cur.slice() });
        else pool[Math.floor(rand() * pool.length)] = { row: cur.slice() };
      }
    }
  }
}

interface DiffStats {
  expansions: number;
  successors: number;
  steps: number;
  mismatches: number;
}

function parseLine(text: string): Record<string, number> {
  const r: Record<string, number> = {};
  for (const m of text.matchAll(/(\w+)=([\d.]+)/g)) r[m[1]!] = Number(m[2]);
  return r;
}

function runSimtest(args: string[]): { stdout: string; failed: boolean } {
  try {
    return { stdout: execFileSync(SIMTEST, args, { encoding: 'utf8' }), failed: false };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    if (err.status === 1 && err.stdout) {
      process.stderr.write(err.stderr ?? '');
      return { stdout: err.stdout, failed: true };
    }
    throw e;
  }
}

function args(): {
  per: number;
  levels: number[];
  modes: ContestMode[];
  seed: number;
  bench: number;
} {
  const a = process.argv.slice(2);
  const get = (name: string): string | undefined => {
    const i = a.indexOf(name);
    return i >= 0 ? a[i + 1] : undefined;
  };
  return {
    per: Number(get('--per') ?? 100_000),
    levels: (get('--levels') ?? '0,1,2,3,4,5,6,7,8,9,10,11').split(',').map(Number),
    modes: (get('--modes') ?? 'flags,sprint').split(',') as ContestMode[],
    seed: Number(get('--seed') ?? 1),
    bench: Number(get('--bench') ?? 0),
  };
}

function main(): void {
  const opt = args();
  mkdirSync(BUILD_DIR, { recursive: true });
  execFileSync('bash', [join(NATIVE_DIR, 'build.sh')], { stdio: 'inherit' });
  const total: DiffStats = { expansions: 0, successors: 0, steps: 0, mismatches: 0 };
  const benchRows: { level: number; mode: ContestMode; data: string; cases: string }[] = [];
  const t0 = performance.now();
  for (const level of opt.levels) {
    for (const mode of opt.modes) {
      const data = join(BUILD_DIR, `data-${level}-${mode}.bin`);
      writeNativeBlob(level, mode, data);
      const engine = new Engine(levelContent(level), mode);
      const rand = rng(opt.seed * 1000 + level * 2 + (mode === 'flags' ? 0 : 1));
      const cases = new Cases();
      cases.width = engine.world.level.width;
      cases.height = engine.world.level.height;
      const routeRows = routes(level, mode, engine);
      const casesPath = join(BUILD_DIR, `cases-${level}-${mode}.bin`);
      const stats: DiffStats = { expansions: 0, successors: 0, steps: 0, mismatches: 0 };
      const flush = (): void => {
        cases.write(casesPath);
        const { stdout } = runSimtest(['diff', data, casesPath]);
        const r = parseLine(stdout);
        stats.expansions += r.expansions!;
        stats.successors += r.successors!;
        stats.steps += r.steps!;
        stats.mismatches += r.mismatches!;
        cases.clear();
      };
      for (const e of randomWalk(engine, rand, routeRows)) {
        cases.add(e.row, e.out, e.succ);
        if (cases.count >= CHUNK || stats.expansions + cases.count >= opt.per) {
          flush();
          if (stats.expansions >= opt.per) break;
        }
      }
      // The cases file now holds the last chunk: the benchmark runs on its rows.
      if (opt.bench > 0) benchRows.push({ level, mode, data, cases: casesPath });
      console.log(
        `level ${level} ${mode}: ${stats.expansions} expansions, ${stats.successors} successors, ` +
          `${stats.steps} steps, ${stats.mismatches} mismatches | coverage: ${routeRows.length} ` +
          `routes, ${cases.moves.size} moves, ${cases.finished} finishing successors, ` +
          `${cases.offMap} off-map rows, max vy ${cases.maxFall}`,
      );
      total.expansions += stats.expansions;
      total.successors += stats.successors;
      total.steps += stats.steps;
      total.mismatches += stats.mismatches;
    }
  }
  console.log(
    `total: ${total.expansions} expansions, ${total.successors} successors, ${total.steps} ` +
      `native steps, ${total.mismatches} mismatches (${((performance.now() - t0) / 1000).toFixed(1)} s)`,
  );
  if (opt.bench > 0) bench(benchRows, opt.bench);
  if (total.mismatches > 0) process.exit(1);
}

/** Reads the input rows of a cases file. */
function caseRows(path: string): Int32Array[] {
  const b = readFileSync(path);
  const buf = new Int32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  const rows: Int32Array[] = [];
  for (let pos = 0; pos + STATE_INTS + 1 <= buf.length;) {
    rows.push(buf.slice(pos, pos + STATE_INTS));
    const n = buf[pos + STATE_INTS]!;
    pos += STATE_INTS + 1 + n * (STATE_INTS + 2);
  }
  return rows;
}

function bench(
  list: { level: number; mode: ContestMode; data: string; cases: string }[],
  seconds: number,
): void {
  let tsExp = 0;
  let tsSteps = 0;
  let tsTime = 0;
  let cExp = 0;
  let cSteps = 0;
  let cTime = 0;
  for (const b of list) {
    const rows = caseRows(b.cases);
    const engine = new Engine(levelContent(b.level), b.mode);
    const out = new Int32Array(STATE_INTS * 16);
    const succ: Successor[] = [];
    // Warm up, then time whole passes over the rows.
    for (let i = 0; i < Math.min(rows.length, 2000); i++) engine.expand(rows[i]!, 0, out, 0, succ);
    engine.steps = 0;
    let exp = 0;
    const t0 = performance.now();
    let t = 0;
    do {
      for (const row of rows) engine.expand(row, 0, out, 0, succ);
      exp += rows.length;
      t = (performance.now() - t0) / 1000;
    } while (t < seconds);
    const r = parseLine(runSimtest(['bench', b.data, b.cases, String(seconds)]).stdout);
    console.log(
      `bench level ${b.level} ${b.mode} (${rows.length} rows): TS ${(exp / t).toFixed(0)} exp/s ` +
        `${(engine.steps / t).toFixed(0)} steps/s | C ${r.expansions_per_s} exp/s ` +
        `${r.steps_per_s} steps/s | x${(r.expansions_per_s! / (exp / t)).toFixed(1)}`,
    );
    tsExp += exp;
    tsSteps += engine.steps;
    tsTime += t;
    cExp += r.expansions!;
    cSteps += r.steps!;
    cTime += r.seconds!;
  }
  console.log(
    `bench total: TS ${(tsExp / tsTime).toFixed(0)} exp/s ${(tsSteps / tsTime).toFixed(0)} steps/s | ` +
      `C ${(cExp / cTime).toFixed(0)} exp/s ${(cSteps / cTime).toFixed(0)} steps/s | ` +
      `x${(cExp / cTime / (tsExp / tsTime)).toFixed(1)}`,
  );
}

if (import.meta.main) main();
