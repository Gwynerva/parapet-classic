/**
 * Frame-by-frame beam search without human limits: any chord of U, D, F, B on any step. Each
 * step's states are merged exactly (canonical rows), states that cannot beat the best known
 * run under the admissible bound are dropped, and the rest are ranked by the distance still
 * to go; at most `cellCap` of them per cell (flags taken, tile, move) and `width` in all go
 * on. Not a proof: the beam may drop the state an optimal run passes through. Usage:
 *   node src/optimal/beam.ts <level> <mode> [width=100000] [cellCap=6] [speedWeight=8]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SIM_VERSION } from '@parapet/sim';
import { Engine, PRESSES, STATE_INTS, type Successor } from './engine.ts';
import { Layer } from './layer.ts';
import { DEFAULT_SPEEDS, Guide } from './guide.ts';
import { readJson } from '../files.ts';
import { TAS_OUT_DIR } from '../tas/files.ts';
import { levelContent } from '../tas/content.ts';
import { LowerBound, TOP_SPEED } from '../tas/bound.ts';
import { newWorld } from '../tas/timeline.ts';
import type { ContestMode } from '../tas/model.ts';
import { pressText, playBits } from './route.ts';

const level = Number(process.argv[2] ?? 0);
const mode = (process.argv[3] ?? 'flags') as ContestMode;
const width = Number(process.argv[4] ?? 100_000);
const cellCap = Number(process.argv[5] ?? 6);
const speedWeight = Number(process.argv[6] ?? 8);

const content = levelContent(level);
const engine = new Engine(content, mode);
const bound = new LowerBound(engine.world, mode);
const guide = new Guide(engine.world.level, mode);
const record = readJson<{ steps: number }>(join(TAS_OUT_DIR, `${level}-${mode}.json`)).steps;
let best = record;
console.log(`record ${record}`);

/** What `LowerBound.ms` reads from a world, filled from a row. */
const probe = {
  player: { x: 0 },
  rules: { remainingMask: -1, nextCheckpoint: 0 },
} as unknown as Parameters<LowerBound['ms']>[0];
const MASK = STATE_INTS - 1;

/** Distance still to go (units) for the row at `a[o]`. */
function distance(a: Int32Array, o: number): number {
  const p = probe as unknown as {
    player: { x: number };
    rules: { remainingMask: number; nextCheckpoint: number };
  };
  p.player.x = a[o]!;
  const mask = a[o + MASK]!;
  p.rules.remainingMask = mask;
  let next = 0;
  while (next < 5 && (mask & (1 << next)) === 0) next++;
  p.rules.nextCheckpoint = next;
  return bound.ms(probe) * TOP_SPEED;
}

/** Steps the admissible bound says are still needed. */
function stepsLeft(dist: number): number {
  return Math.ceil(dist / (TOP_SPEED * 30));
}

const history: { parent: Int32Array; press: Uint8Array }[] = [];
let cur = new Layer();
let next = new Layer(1 << 16);
const startRow = new Int32Array(STATE_INTS);
engine.start(startRow);
cur.add(startRow, 0, -1, 0);
const out = new Int32Array(STATE_INTS * 16);
const succ: Successor[] = [];
const t0 = performance.now();
let found: { step: number; index: number } | null = null;

for (let step = 1; step < best; step++) {
  next.clear();
  if (step < 3) console.log(`step ${step} start, ${cur.count} states`);
  for (let i = 0; i < cur.count && !found; i++) {
    const n = engine.expand(cur.rows, i * STATE_INTS, out, 0, succ);
    for (let k = 0; k < n; k++) {
      const idx = next.add(out, k * STATE_INTS, i, succ[k]!.press);
      if (succ[k]!.finished) {
        found = { step, index: idx };
        break;
      }
    }
  }
  if (found) {
    history.push({
      parent: next.parent.slice(0, next.count),
      press: next.press.slice(0, next.count),
    });
    break;
  }
  // Rank, prune by the bound, keep the best per cell.
  const n = next.count;
  const score = new Float64Array(n);
  const order: number[] = [];
  const rows = next.rows;
  for (let i = 0; i < n; i++) {
    const o = i * STATE_INTS;
    const dist = distance(rows, o);
    if (step + stepsLeft(dist) >= best) continue;
    // The guide's steps around the blocks; speed counts as distance already covered.
    const vx = rows[o + 8]!;
    const cx = rows[o]! + (rows[o + 2]! >> 1);
    const cy = rows[o + 1]! + (rows[o + 3]! >> 1);
    const g = guide.steps(cx, cy, rows[o + MASK]!);
    score[i] = g * DEFAULT_SPEEDS.run - (speedWeight * Math.abs(vx) * 30) / 1024;
    order.push(i);
  }
  order.sort((a, b) => score[a]! - score[b]!);
  const kept = new Layer(Math.min(order.length, width) + 1);
  const perCell = new Map<number, number>();
  for (const i of order) {
    if (kept.count >= width) break;
    const o = i * STATE_INTS;
    const cell =
      ((rows[o + MASK]! & 31) * 4096 + (rows[o]! >> 10)) * 256 * 160 +
      ((rows[o + 1]! >> 10) & 255) * 160 +
      rows[o + 41]!;
    const c = perCell.get(cell) ?? 0;
    if (c >= cellCap) continue;
    perCell.set(cell, c + 1);
    kept.add(rows, o, next.parent[i]!, next.press[i]!);
  }
  history.push({
    parent: kept.parent.slice(0, kept.count),
    press: kept.press.slice(0, kept.count),
  });
  [cur, next] = [kept, cur];
  if (step % 50 === 0 || step < 4) {
    const secs = (performance.now() - t0) / 1000;
    let fl = 0;
    for (let i = 0; i < cur.count; i++) {
      let m = cur.rows[i * STATE_INTS + MASK]! & 31,
        c = 0;
      for (; m; m &= m - 1) c++;
      fl = Math.max(fl, 5 - c);
    }
    const d0 = order.length ? distance(rows, order[0]! * STATE_INTS).toFixed(0) : '-';
    console.log(
      `step ${step}: ${n} merged, ${order.length} within the bound, ${kept.count} kept, best dist ${d0}, most flags ${fl}, ${secs.toFixed(0)} s`,
    );
  }
  if (cur.count === 0) break;
}

const secs = ((performance.now() - t0) / 1000).toFixed(0);
if (!found) {
  console.log(
    `no run under ${best} steps (record ${record}) after ${secs} s, ${engine.steps} simulated steps`,
  );
  process.exit(0);
}
// Walk the parents back to the start.
const bits: number[] = new Array(found.step);
let idx = found.index;
for (let s = found.step; s >= 1; s--) {
  const h = history[s - 1]!;
  bits[s - 1] = PRESSES[h.press[idx]!]!;
  idx = h.parent[idx]!;
}
const check = playBits(newWorld(content, mode), bits);
if (!check.finished || check.steps !== found.step) {
  throw new Error(`replay disagrees: ${JSON.stringify(check)} vs step ${found.step}`);
}
console.log(
  `level ${level} ${mode}: ${found.step} steps (${(found.step * 0.03).toFixed(2)} s), record ${record} (${(record * 0.03).toFixed(2)} s), ${secs} s, ${engine.steps} simulated steps`,
);
const dir = join(TAS_OUT_DIR, 'optimal');
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, `${level}-${mode}-beam.json`),
  JSON.stringify(
    {
      levelId: level,
      mode,
      simVersion: SIM_VERSION,
      steps: found.step,
      timeMs: check.timeMs,
      record,
      search: { width, cellCap, speedWeight, simulated: engine.steps, seconds: Number(secs) },
      presses: pressText(bits),
    },
    null,
    2,
  ) + '\n',
);
