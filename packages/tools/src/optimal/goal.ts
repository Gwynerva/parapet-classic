/**
 * One segment of a record searched by a free Go-Explore (any chord on any step) from the
 * record's state at its previous flag, for the earliest arrival at its next one: an archive of
 * earliest arrivals per cell (tile, move, facing, speed bucket), rollouts of random presses with
 * the air-run's pieces (BACK in the air, UP) tried often, states that cannot beat the best
 * arrival at the envelope's pace dropped. The best arrival's presses are checked on a plain
 * World from the start. Usage:
 *   node src/optimal/goal.ts <level> <mode> <segment> [budget=200M] [seed=1]
 */
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Input } from '@parapet/sim';
import { Engine, PRESSES, STATE_INTS, writeState, type Successor } from './engine.ts';
import { readJson } from '../files.ts';
import { TAS_OUT_DIR } from '../tas/files.ts';
import { levelContent } from '../tas/content.ts';
import { newWorld } from '../tas/timeline.ts';
import { keyBits, parsePresses, type ContestMode } from '../tas/model.ts';
import { pressText, playBits } from './route.ts';

const level = Number(process.argv[2]);
const mode = process.argv[3] as ContestMode;
const seg = Number(process.argv[4] ?? 0);
const budget = Number(process.argv[5] ?? 200e6);
let seed = Number(process.argv[6] ?? 1) >>> 0;
function rand(): number {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const content = levelContent(level);
const engine = new Engine(content, mode);
const lvl = engine.world.level;
const X = 0,
  Y = 1,
  HDX = 2,
  HDY = 3,
  VX = 8,
  FLAGS = 19,
  MOVE = 41,
  MASK = STATE_INTS - 1;

// The record: per-step bits, rows, splits and order.
const file = readJson<{ presses: string }>(join(TAS_OUT_DIR, `${level}-${mode}.json`));
const presses = parsePresses(file.presses);
const world = newWorld(content, mode);
const rows: Int32Array[] = [];
const recBits: number[] = [];
const splits: number[] = [];
const order: number[] = [];
let pi = 0;
let mask = 31;
for (;;) {
  const r = new Int32Array(STATE_INTS);
  writeState(world.player, world.rules, r, 0);
  engine.canon(r, 0);
  rows.push(r);
  if (world.finished) break;
  let b = 0;
  if (presses[pi] && presses[pi]!.step === world.stepCount)
    b = keyBits(presses[pi++]!.key, world.player.facingRight) & 51;
  recBits.push(b);
  world.step(b);
  const m = world.rules.remainingMask & 31;
  if (m !== mask) {
    order.push(Math.log2(mask ^ m));
    splits.push(world.stepCount);
    mask = m;
  }
}
if (mode === 'sprint') {
  order.push(-1);
  splits.push(world.stepCount);
}
const from = seg === 0 ? 0 : splits[seg - 1]!;
const target = order[seg]!;
let best = splits[seg]!; // arrivals must beat this step
const tx = target === -1 ? lvl.finish!.x : lvl.checkpoints[target]!.x;
const gapTo = (a: Int32Array): number => {
  const lo = tx << 10;
  const hi = lo + 1023;
  const g = (x: number): number => (x < lo ? lo - x : x > hi ? x - hi : 0);
  const feet = a[X]!;
  return Math.min(g(feet), g(feet + (a[HDX]! >> 1)));
};
/** Fewest steps to cover a gap: the air run's top speed (17300 units per 1024 ms ≈ 507 a step). */
const stepsFor = (gap: number): number => Math.ceil(gap / 507);
console.log(`level ${level} ${mode} segment ${seg}: from step ${from}, record arrives on ${best}`);

interface Path {
  parent: Path | null;
  bits: number[];
}
interface Cell {
  row: Int32Array;
  step: number;
  path: Path | null;
  picks: number;
  idx: number;
}
const cells = new Map<string, Cell>();
const list: Cell[] = [];
const key = (a: Int32Array): string => {
  const v = Math.abs(a[VX]!);
  const vb = v < 1500 ? 0 : v < 3000 ? 1 : v < 5300 ? 2 : v < 8000 ? 3 : 4;
  return `${a[MASK]! & 31},${(a[X]! + (a[HDX]! >> 1)) >> 10},${(a[Y]! + (a[HDY]! >> 1)) >> 10},${a[MOVE]},${a[FLAGS]! & 6},${vb}`;
};
const first: Cell = { row: rows[from]!, step: from, path: null, picks: 0, idx: 0 };
cells.set(key(first.row), first);
list.push(first);
const out = new Int32Array(STATE_INTS * 16);
const cur = new Int32Array(STATE_INTS);
const succ: Successor[] = [];
let bestPath: number[] | null = null;
const flat = (p: Path | null): number[] => {
  const parts: number[][] = [];
  for (let q = p; q; q = q.parent) parts.push(q.bits);
  return parts.reverse().flat();
};
const t0 = performance.now();
let lastReport = 0;
while (engine.steps < budget) {
  let cell = list[Math.floor(rand() * list.length)]!;
  for (let k = 0; k < 4; k++) {
    const c = list[Math.floor(rand() * list.length)]!;
    const score = (x: Cell): number => x.step + stepsFor(gapTo(x.row)) * 2 + x.picks * 3;
    if (score(c) < score(cell)) cell = c;
  }
  cell.picks++;
  cur.set(cell.row);
  const bits: number[] = [];
  const len = 10 + Math.floor(rand() * 50);
  for (let i = 0; i < len; i++) {
    const step = cell.step + i;
    let press = 0;
    const r = rand();
    if (r < 0.06) press = Input.UP;
    else if (r < 0.1) press = Input.BACK;
    else if (r < 0.13) press = Input.FORWARD;
    else if (r < 0.15) press = Input.DOWN;
    else if (r < 0.17) press = PRESSES[1 + Math.floor(rand() * 15)]!;
    engine.expand(cur, 0, out, 0, succ, [press]);
    bits.push(press);
    const done = target === -1 ? succ[0]!.finished : (out[MASK]! & (1 << target)) === 0;
    if (done) {
      if (step + 1 < best) {
        best = step + 1;
        bestPath = [...flat(cell.path), ...bits];
        console.log(
          `  arrives on ${best} (${splits[seg]! - best} steps ahead of the record), ${((performance.now() - t0) / 1000).toFixed(0)} s`,
        );
      }
      break;
    }
    if (succ[0]!.finished) break;
    if (step + 1 + stepsFor(gapTo(out)) >= best) break;
    cur.set(out.subarray(0, STATE_INTS));
    const k = key(cur);
    const known = cells.get(k);
    if (!known || known.step > step + 1) {
      const c: Cell = {
        row: cur.slice(),
        step: step + 1,
        path: { parent: cell.path, bits: bits.slice() },
        picks: known?.picks ?? 0,
        idx: known?.idx ?? list.length,
      };
      if (!known) list.push(c);
      else list[known.idx] = c;
      cells.set(k, c);
    }
  }
  if (engine.steps - lastReport > 50e6) {
    lastReport = engine.steps;
    console.log(`  ${(engine.steps / 1e6).toFixed(0)}M steps, ${cells.size} cells, best ${best}`);
  }
}
if (!bestPath) {
  console.log(`nothing beat the record's ${splits[seg]} (${cells.size} cells)`);
  process.exit(0);
}
// The whole run: the record up to `from`, then the found presses; check it on a plain World.
const all = [...recBits.slice(0, from), ...bestPath];
const check = newWorld(content, mode);
for (const b of all) check.step(b);
const ok = target === -1 ? check.finished : (check.rules.remainingMask & (1 << target)) === 0;
console.log(
  `check from the start: ${ok ? 'flag taken' : 'NOT taken'} on step ${check.stepCount}; route ${pressText(all.slice(from))}`,
);
const dir = join(TAS_OUT_DIR, 'goal');
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, `${level}-${mode}-seg${seg}.json`),
  JSON.stringify(
    { level, mode, seg, from, arrives: best, record: splits[seg], presses: pressText(all) },
    null,
    2,
  ) + '\n',
);
void playBits;
