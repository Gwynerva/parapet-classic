/**
 * One segment of a record searched exhaustively from the record's own state: from the step the
 * record takes flag k-1 (or the start) to its next flag, breadth-first with exact merging, the
 * time cut using the glitch hunt's envelope for the level (speed glitches included), budget
 * the record's time for the segment. Prints whether anything is faster and by what moves.
 * Usage: node src/optimal/seg2.ts <level> <mode> <segment> [margin=1.0]
 */
import { join } from 'node:path';
import { Engine, STATE_INTS, writeState, type Successor } from './engine.ts';
import { Layer } from './layer.ts';
import { readJson } from '../files.ts';
import { TAS_OUT_DIR } from '../tas/files.ts';
import { levelContent } from '../tas/content.ts';
import { newWorld } from '../tas/timeline.ts';
import { keyBits, parsePresses, type ContestMode } from '../tas/model.ts';

const level = Number(process.argv[2]);
const mode = process.argv[3] as ContestMode;
const seg = Number(process.argv[4] ?? 0);
const margin = Number(process.argv[5] ?? 1.0);
const content = levelContent(level);
const engine = new Engine(content, mode);
const lvl = engine.world.level;
const MASK = STATE_INTS - 1;

const hunt = readJson<{ stats: { maxDx: number }; windows: Record<string, number> }>(
  join(TAS_OUT_DIR, 'hunt', `${level}-${mode}.json`),
);
const pts: [number, number][] = [
  [0, 0],
  [1, hunt.stats.maxDx],
  ...Object.entries(hunt.windows).map(([k, d]) => [Number(k), d] as [number, number]),
];
pts.sort((a, b) => a[0] - b[0]);
for (let i = 1; i < pts.length; i++) pts[i]![1] = Math.max(pts[i]![1], pts[i - 1]![1]);
const reach = (k: number): number => {
  for (let i = 1; i < pts.length; i++) {
    const [k1, d1] = pts[i]!;
    if (k <= k1) {
      const [k0, d0] = pts[i - 1]!;
      return margin * (d0 + ((d1 - d0) * (k - k0)) / (k1 - k0));
    }
  }
  const [kl, dl] = pts[pts.length - 1]!;
  return (margin * dl * k) / kl;
};
const stepsFor = (gap: number): number => {
  let k = 0;
  while (reach(k) < gap) k++;
  return k;
};

// The record's rows, splits and order.
const file = readJson<{ presses: string }>(join(TAS_OUT_DIR, `${level}-${mode}.json`));
const presses = parsePresses(file.presses);
const world = newWorld(content, mode);
const rows: Int32Array[] = [];
const splits: number[] = [];
const order: number[] = [];
let i = 0;
let mask = 31;
for (;;) {
  const r = new Int32Array(STATE_INTS);
  writeState(world.player, world.rules, r, 0);
  engine.canon(r, 0);
  rows.push(r);
  if (world.finished) break;
  let b = 0;
  if (presses[i] && presses[i]!.step === world.stepCount)
    b = keyBits(presses[i++]!.key, world.player.facingRight);
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
const budget = splits[seg]! - 1; // look for strictly faster
const tx = target === -1 ? lvl.finish!.x : lvl.checkpoints[target]!.x;
const gapTo = (a: Int32Array, o: number): number => {
  const lo = tx << 10;
  const hi = lo + 1023;
  const g = (x: number): number => (x < lo ? lo - x : x > hi ? x - hi : 0);
  const feet = a[o]!;
  const centre = feet + (a[o + 2]! >> 1);
  return target === -1 ? g(centre) : Math.min(g(feet), g(centre));
};
console.log(
  `level ${level} ${mode} segment ${seg}: from step ${from} to ${target === -1 ? 'finish' : `flag ${target}`}, record arrives on ${splits[seg]}; searching for ${budget} or earlier`,
);

let cur = new Layer();
let next = new Layer();
cur.add(rows[from]!, 0, -1, 0);
const out = new Int32Array(STATE_INTS * 16);
const succ: Successor[] = [];
const t0 = performance.now();
let peak = 0;
let fastest = 0;
for (let step = from; step < budget && cur.count > 0; step++) {
  next.clear();
  let found = false;
  for (let s = 0; s < cur.count; s++) {
    const n = engine.expand(cur.rows, s * STATE_INTS, out, 0, succ);
    for (let k = 0; k < n; k++) {
      const o = k * STATE_INTS;
      const done = target === -1 ? succ[k]!.finished : (out[o + MASK]! & (1 << target)) === 0;
      if (done) found = true;
      if (done || succ[k]!.finished) continue;
      fastest = Math.max(fastest, Math.abs(out[o + 8]!));
      if (step + 1 + stepsFor(gapTo(out, o)) > budget) continue;
      next.add(out, o, 0, 0);
    }
  }
  if (found) {
    console.log(
      `  reached on step ${step + 1}: ${splits[seg]! - step - 1} steps faster than the record (fastest |vx| seen ${fastest})`,
    );
    process.exit(0);
  }
  peak = Math.max(peak, next.count);
  [cur, next] = [next, cur];
  if (cur.count > 25e6) {
    console.log(`  gave up at step ${step + 1}: ${cur.count} states`);
    process.exit(2);
  }
}
console.log(
  `  nothing faster: the record's segment is optimal under this envelope (peak ${peak} states, ${((performance.now() - t0) / 1000).toFixed(0)} s, fastest |vx| seen ${fastest})`,
);
