/**
 * A human recipe for a glitch: the shortest run from the race's start, under a player's limits
 * (one key at a time, at least 3 steps between presses), that makes the glitch happen; then the
 * presses it does without are dropped and each press's window is measured (how many steps
 * early or late it may come, the others staying put, with the glitch still happening). Usage:
 *   node src/optimal/recipe.ts <glitch> <level> <mode> [budgetSteps=30M] [seed=1]
 * Glitches: air-speed (|vx| over the ground cap in the air), sky-lift (a pit throws the runner
 * above the map), zip-up (more than a tile up in one step, no pit), flicker (facing flips on
 * 8 steps running).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Input } from '@parapet/sim';
import { Engine, STATE_INTS, type Successor } from './engine.ts';
import { TAS_OUT_DIR } from '../tas/files.ts';
import { levelContent } from '../tas/content.ts';
import type { ContestMode } from '../tas/model.ts';

const glitch = process.argv[2] ?? 'air-speed';
const level = Number(process.argv[3] ?? 2);
const mode = (process.argv[4] ?? 'flags') as ContestMode;
const budget = Number(process.argv[5] ?? 30e6);
let seed = Number(process.argv[6] ?? 1) >>> 0;
function rand(): number {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const engine = new Engine(levelContent(level), mode);
const X = 0,
  Y = 1,
  HDX = 2,
  HDY = 3,
  VX = 8,
  FLAGS = 19,
  MOVE = 41,
  MASK = STATE_INTS - 1;
const KEYS = [Input.UP, Input.DOWN, Input.FORWARD, Input.BACK];
const GAP = 3;

/** Per-run detector state; returns true on the step the glitch shows. */
interface Detector {
  flips: number;
}
function detect(prev: Int32Array, cur: Int32Array, d: Detector): boolean {
  switch (glitch) {
    case 'air-speed':
      return Math.abs(cur[VX]!) > 5300;
    case 'sky-lift':
      return cur[MOVE] === 11 && prev[MOVE] !== 11 && cur[Y]! < 0;
    case 'zip-big':
      return prev[Y]! - cur[Y]! > 2048 && cur[MOVE] !== 11;
    case 'zip-up':
      return prev[Y]! - cur[Y]! > 1200 && cur[MOVE] !== 11;
    case 'flicker':
      d.flips = (cur[FLAGS]! & 2) !== (prev[FLAGS]! & 2) ? d.flips + 1 : 0;
      return d.flips >= 8;
    default:
      throw new Error(`unknown glitch ${glitch}`);
  }
}

/** Plays `presses` (step → key bits) from the start; the step the glitch shows, or -1. */
function play(presses: Map<number, number>, limit: number): number {
  const a = new Int32Array(STATE_INTS);
  const b = new Int32Array(STATE_INTS * 16);
  engine.start(a);
  const succ: Successor[] = [];
  const d: Detector = { flips: 0 };
  for (let s = 0; s < limit; s++) {
    engine.expand(a, 0, b, 0, succ, [presses.get(s) ?? 0]);
    const hit = detect(a, b, d);
    a.set(b.subarray(0, STATE_INTS));
    if (hit) return s + 1;
    if (succ[0]!.finished) return -1;
  }
  return -1;
}

// Go-Explore under the human limits. A cell keeps its earliest arrival and the presses there.
interface Cell {
  row: Int32Array;
  steps: number;
  lastPress: number;
  presses: [number, number][];
  picks: number;
  flips: number;
}
const cells = new Map<string, Cell>();
const list: Cell[] = [];
const key = (a: Int32Array): string =>
  `${a[MASK]! & 31},${(a[X]! + (a[HDX]! >> 1)) >> 10},${(a[Y]! + (a[HDY]! >> 1)) >> 10},${a[MOVE]},${a[FLAGS]! & 2}`;
const start = new Int32Array(STATE_INTS);
engine.start(start);
const first: Cell = { row: start, steps: 0, lastPress: -GAP, presses: [], picks: 0, flips: 0 };
cells.set(key(start), first);
list.push(first);
const cur = new Int32Array(STATE_INTS);
const out = new Int32Array(STATE_INTS * 16);
const succ: Successor[] = [];
let found: { presses: [number, number][]; step: number } | null = null;
// PRESSES="16:B 40:U" checks a given recipe instead of searching for one.
if (process.env.PRESSES) {
  const given = process.env.PRESSES.trim()
    .split(/\s+/)
    .map((p) => {
      const [s, k] = p.split(':');
      return [Number(s), KEYS['UDFB'.indexOf(k!)]!] as [number, number];
    });
  const at = play(new Map(given), 4000);
  if (at === -1) {
    console.log(`${glitch} on level ${level} ${mode}: the given presses do not make it`);
    process.exit(1);
  }
  found = { presses: given, step: at };
}
const t0 = performance.now();
while (engine.steps < budget && !found) {
  let cell = list[Math.floor(rand() * list.length)]!;
  for (let k = 0; k < 3; k++) {
    const c = list[Math.floor(rand() * list.length)]!;
    if (c.picks + c.steps / 200 < cell.picks + cell.steps / 200) cell = c;
  }
  cell.picks++;
  cur.set(cell.row);
  const presses = cell.presses.slice();
  let last = cell.lastPress;
  const d: Detector = { flips: cell.flips };
  const len = 20 + Math.floor(rand() * 60);
  for (let i = 0; i < len; i++) {
    const s = cell.steps + i;
    let bits = 0;
    if (s - last >= GAP && rand() < 0.12) {
      bits = KEYS[Math.floor(rand() * 4)]!;
      presses.push([s, bits]);
      last = s;
    }
    engine.expand(cur, 0, out, 0, succ, [bits]);
    if (detect(cur, out, d)) {
      found = { presses, step: s + 1 };
      break;
    }
    cur.set(out.subarray(0, STATE_INTS));
    if (succ[0]!.finished) break;
    const k = key(cur);
    const known = cells.get(k);
    if (!known || known.steps > s + 1) {
      const c: Cell = {
        row: cur.slice(),
        steps: s + 1,
        lastPress: last,
        presses: presses.slice(),
        picks: known?.picks ?? 0,
        flips: d.flips,
      };
      if (!known) list.push(c);
      else list[list.indexOf(known)] = c;
      cells.set(k, c);
    }
  }
}
if (!found) {
  console.log(
    `${glitch} on level ${level} ${mode}: not found within ${budget} steps (${cells.size} cells)`,
  );
  process.exit(1);
}

// Drop presses the glitch does without, then shorten: the glitch's earliest step stays.
let presses = new Map(found.presses);
let step = play(presses, found.step + 1);
for (const s of process.env.PRESSES ? [] : [...presses.keys()].sort((a, b) => b - a)) {
  const trial = new Map(presses);
  trial.delete(s);
  const st = play(trial, step + 1);
  if (st !== -1 && st <= step) {
    presses = trial;
    step = st;
  }
}
// Windows: each press alone moved by -k..+k (keeping the gap rule) while the glitch still shows.
const sorted = [...presses.entries()].sort((a, b) => a[0] - b[0]);
const windows = sorted.map(([s, bits], i) => {
  const ok = (d: number): boolean => {
    const t = s + d;
    const prev = sorted[i - 1]?.[0] ?? -GAP;
    const next = sorted[i + 1]?.[0] ?? Infinity;
    if (t < 0 || t - prev < GAP || next - t < GAP) return false;
    const trial = new Map(presses);
    trial.delete(s);
    trial.set(t, bits);
    return play(trial, step + 40) !== -1;
  };
  let early = 0;
  while (early < 30 && ok(-(early + 1))) early++;
  let late = 0;
  while (late < 30 && ok(late + 1)) late++;
  return {
    step: s,
    key: ['U', 'D', 'F', 'B'][(KEYS as readonly number[]).indexOf(bits)]!,
    early,
    late,
    frames: early + late + 1,
  };
});
const result = {
  glitch,
  level,
  mode,
  showsOnStep: step,
  presses: windows,
  hardest: Math.min(...windows.map((w) => w.frames)),
  searched: {
    steps: engine.steps,
    cells: cells.size,
    seconds: Math.round((performance.now() - t0) / 1000),
  },
};
const dir = join(TAS_OUT_DIR, 'recipes');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `${glitch}-${level}-${mode}.json`), JSON.stringify(result, null, 2) + '\n');
console.log(
  `${glitch} on level ${level} ${mode}: shows on step ${step} (${(step * 0.03).toFixed(2)} s) with ${windows.length} presses: ${windows.map((w) => `${w.step}:${w.key} [-${w.early},+${w.late}]`).join(' ')}; tightest window ${result.hardest} frames`,
);
