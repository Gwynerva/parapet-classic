/**
 * Glitch hunt: a Go-Explore over cells (flags taken, tile, move, facing) with presses that no
 * human limit holds back (any chord, any step), watching every step for what a parkour game
 * should not do. The first example of each finding per level and move is kept with the presses
 * that reproduce it from the start. Usage:
 *   node src/optimal/hunt.ts <level> <flags|sprint> [budgetSteps=20M] [seed=1]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Engine, PRESSES, STATE_INTS, type Successor } from './engine.ts';
import { TAS_OUT_DIR } from '../tas/files.ts';
import { levelContent } from '../tas/content.ts';
import type { ContestMode } from '../tas/model.ts';
import { pressText } from './route.ts';

const level = Number(process.argv[2] ?? 0);
const mode = (process.argv[3] ?? 'flags') as ContestMode;
const budget = Number(process.argv[4] ?? 20e6);
let seed = Number(process.argv[5] ?? 1) >>> 0;
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
const moves = engine.world.moves;
const SOLID = new Set([1, 5, 6, 13, 14, 17, 18, 19, 21, 25, 26]);
const X = 0,
  Y = 1,
  HDX = 2,
  HDY = 3,
  VX = 8,
  FLAGS = 19,
  MOVE = 41,
  MASK = STATE_INTS - 1;

/** Presses as a linked list, so cells share their prefixes. */
interface Path {
  parent: Path | null;
  bits: number[];
}
function flatten(p: Path | null): number[] {
  const parts: number[][] = [];
  for (let q = p; q; q = q.parent) parts.push(q.bits);
  return parts.reverse().flat();
}

interface Cell {
  row: Int32Array;
  path: Path | null;
  steps: number;
  picks: number;
  idx: number;
}
const cells = new Map<string, Cell>();
const cellList: Cell[] = [];
function cellKey(a: Int32Array, o: number): string {
  const cx = (a[o + X]! + (a[o + HDX]! >> 1)) >> 10;
  const cy = (a[o + Y]! + (a[o + HDY]! >> 1)) >> 10;
  return `${a[o + MASK]! & 31},${cx},${cy},${a[o + MOVE]},${a[o + FLAGS]! & 2}`;
}

interface Finding {
  kind: string;
  detail: string;
  move: number;
  steps: number;
  presses: string;
}
const findings = new Map<string, Finding>();
const counts: Record<string, number> = {};
function report(
  kind: string,
  move: number,
  detail: string,
  path: Path | null,
  extra: number[],
): void {
  counts[kind] = (counts[kind] ?? 0) + 1;
  const key = `${kind}/${move}`;
  if (findings.has(key)) return;
  const bits = [...flatten(path), ...extra];
  findings.set(key, { kind, detail, move, steps: bits.length, presses: pressText(bits) });
}

const stats = {
  maxDx: 0,
  maxDxAt: '',
  maxUp: 0,
  maxUpAt: '',
  maxDown: 0,
  maxVx: 0,
  minY: Infinity,
};
/** Largest horizontal distance covered in a window of k steps, per k (any rollout, either way). */
const WINDOWS = [5, 10, 20, 40, 80];
const windowMax = WINDOWS.map(() => 0);
const xs: number[] = [];

const start = new Int32Array(STATE_INTS);
engine.start(start);
const first: Cell = { row: start, path: null, steps: 0, picks: 0, idx: 0 };
cells.set(cellKey(start, 0), first);
cellList.push(first);

const out = new Int32Array(STATE_INTS * 16);
const cur = new Int32Array(STATE_INTS);
const succ: Successor[] = [];
const clipless = new Set(moves.states.filter((s) => s.clipOffset === -1).map((s) => s.id));
const W = lvl.width << 10;
const H = lvl.height << 10;
const t0 = performance.now();

while (engine.steps < budget) {
  // Pick: a few random cells, the least picked wins.
  let cell = cellList[Math.floor(rand() * cellList.length)]!;
  for (let k = 0; k < 3; k++) {
    const c = cellList[Math.floor(rand() * cellList.length)]!;
    if (c.picks < cell.picks) cell = c;
  }
  cell.picks++;
  cur.set(cell.row);
  const bits: number[] = [];
  const base: Path | null = cell.path;
  let inWall = 0;
  let flips = 0;
  let still = 0;
  let clip = 0;
  const len = 40 + Math.floor(rand() * 100);
  xs.length = 0;
  xs.push(cur[X]!);
  for (let s = 0; s < len; s++) {
    const press = rand() < 0.3 ? PRESSES[1 + Math.floor(rand() * 15)]! : 0;
    engine.expand(cur, 0, out, 0, succ, [press]);
    bits.push(press);
    const dx = out[X]! - cur[X]!;
    const dy = out[Y]! - cur[Y]!;
    const move = out[MOVE]!;
    const at = `${cell.steps + bits.length}`;
    if (Math.abs(dx) > stats.maxDx) {
      stats.maxDx = Math.abs(dx);
      stats.maxDxAt = `${at}, move ${cur[MOVE]}→${move}`;
    }
    if (-dy > stats.maxUp && move !== 11) {
      stats.maxUp = -dy;
      stats.maxUpAt = `${at}, move ${cur[MOVE]}→${move}`;
    }
    stats.maxDown = Math.max(stats.maxDown, dy);
    xs.push(out[X]!);
    for (let w = 0; w < WINDOWS.length; w++) {
      const k = WINDOWS[w]!;
      if (xs.length > k)
        windowMax[w] = Math.max(windowMax[w]!, Math.abs(out[X]! - xs[xs.length - 1 - k]!));
    }
    stats.maxVx = Math.max(stats.maxVx, Math.abs(out[VX]!));
    stats.minY = Math.min(stats.minY, out[Y]! + out[HDY]!);
    if (Math.abs(dx) > 400)
      report('jump-x', move, `dx ${dx}, move ${cur[MOVE]}→${move}`, base, bits);
    if (-dy > 1200 && move !== 11)
      report('jump-up', move, `dy ${dy}, move ${cur[MOVE]}→${move}`, base, bits);
    if (move === 11 && cur[MOVE] !== 11) report('pit', move, `dy ${dy}`, base, bits);
    const cx = (out[X]! + (out[HDX]! >> 1)) >> 10;
    const cy = (out[Y]! + (out[HDY]! >> 1)) >> 10;
    inWall = SOLID.has(lvl.tileAt(cx, cy)) ? inWall + 1 : 0;
    if (inWall === 6)
      report('in-wall', move, `centre in tile ${lvl.tileAt(cx, cy)} at ${cx},${cy}`, base, bits);
    if (out[X]! < 0 || out[X]! >= W || out[Y]! + out[HDY]! < 0 || out[Y]! > H) {
      report('outside', move, `x ${out[X]} y ${out[Y]}`, base, bits);
    }
    flips = (out[FLAGS]! & 2) !== (cur[FLAGS]! & 2) ? flips + 1 : 0;
    if (flips === 8) report('flicker', move, `facing flips 8 steps running`, base, bits);
    clip = clipless.has(move) && (dx !== 0 || dy !== 0) ? clip + 1 : 0;
    if (clip === 20) report('no-clip', move, `20 steps moving without an animation`, base, bits);
    let same = true;
    for (let k = 0; k < STATE_INTS && same; k++) if (k !== 39 && out[k] !== cur[k]) same = false;
    still = same ? still + 1 : 0;
    if (still === 60)
      report('frozen', move, `state unchanged 60 steps under random presses`, base, bits);
    if (Math.abs(out[VX]!) > 5300) report('fast', move, `vx ${out[VX]}`, base, bits);
    cur.set(out.subarray(0, STATE_INTS));
    if (succ[0]!.finished) break;
    const key = cellKey(cur, 0);
    const known = cells.get(key);
    const steps = cell.steps + bits.length;
    if (!known || known.steps > steps) {
      const path: Path = { parent: base, bits: bits.slice() };
      const c: Cell = {
        row: cur.slice(),
        path,
        steps,
        picks: known?.picks ?? 0,
        idx: known?.idx ?? cellList.length,
      };
      if (!known) cellList.push(c);
      else cellList[known.idx] = c;
      cells.set(key, c);
    }
  }
}

const secs = (performance.now() - t0) / 1000;
const result = {
  level,
  mode,
  budget,
  cells: cells.size,
  seconds: Math.round(secs),
  stats,
  windows: Object.fromEntries(WINDOWS.map((k, w) => [k, windowMax[w]])),
  counts,
  findings: [...findings.values()],
};
const dir = join(TAS_OUT_DIR, 'hunt');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `${level}-${mode}.json`), JSON.stringify(result, null, 2) + '\n');
console.log(
  `level ${level} ${mode}: ${cells.size} cells, ${secs.toFixed(0)} s, counts ${JSON.stringify(counts)}, max dx ${stats.maxDx} (${stats.maxDxAt}), max up ${stats.maxUp} (${stats.maxUpAt}), max |vx| ${stats.maxVx}, windows ${WINDOWS.map((k, w) => `${k}:${windowMax[w]} (${(windowMax[w]! / k).toFixed(0)}/step)`).join(' ')}`,
);
