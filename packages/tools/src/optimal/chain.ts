/**
 * Segment-exact search: the run is cut at its flags (or checkpoints and the finish), and each
 * segment is searched exhaustively, breadth-first with exact merging, from every state that
 * reached the previous flag within `delta` steps of the earliest. A state is dropped when it
 * could not reach the next flag's tile within the segment's budget even at the envelope's pace:
 * the farthest the runner was ever seen to get in k steps on this level (the glitch hunt's
 * windows, snaps and speed glitches included), times `margin`. The budget starts at the
 * record's time for the segment and grows by 3 steps until the flag is reached: the cost grows
 * steeply with the slack, so it is kept as small as it can be. Not a proof (the envelope is
 * measured, and states arriving later than `delta` are left behind). Usage:
 *   node src/optimal/chain.ts <level> <mode> [delta=4] [margin=1.1] [order=record|0,1,2,3,4]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SIM_VERSION } from '@parapet/sim';
import { Engine, PRESSES, STATE_INTS, type Successor } from './engine.ts';
import { Layer } from './layer.ts';
import { readJson } from '../files.ts';
import { TAS_OUT_DIR } from '../tas/files.ts';
import { levelContent } from '../tas/content.ts';
import { newWorld } from '../tas/timeline.ts';
import { keyBits, parsePresses, type ContestMode } from '../tas/model.ts';
import { playBits, pressText } from './route.ts';

const level = Number(process.argv[2] ?? 0);
const mode = (process.argv[3] ?? 'flags') as ContestMode;
const delta = Number(process.argv[4] ?? 4);
const margin = Number(process.argv[5] ?? 1.1);
const orderArg = process.argv[6] ?? 'record';
const MASK = STATE_INTS - 1;

// The envelope: reach(k) through the hunt's measured windows, extended past the last one.
const hunt = readJson<{ stats: { maxDx: number }; windows: Record<string, number> }>(
  join(TAS_OUT_DIR, 'hunt', `${level}-${mode}.json`),
);
const points = [
  [0, 0] as [number, number],
  [1, hunt.stats.maxDx] as [number, number],
  ...Object.entries(hunt.windows).map(([k, d]) => [Number(k), d] as [number, number]),
].sort((a, b) => a[0] - b[0]);
for (let i = 1; i < points.length; i++) points[i]![1] = Math.max(points[i]![1], points[i - 1]![1]);
function reach(k: number): number {
  for (let i = 1; i < points.length; i++) {
    const [k1, d1] = points[i]!;
    if (k <= k1) {
      const [k0, d0] = points[i - 1]!;
      return margin * (d0 + ((d1 - d0) * (k - k0)) / (k1 - k0));
    }
  }
  const [kl, dl] = points[points.length - 1]!;
  return margin * dl * (k / kl);
}
const STEPS_FOR: number[] = [];
{
  let k = 0;
  for (let gap = 0; gap <= 400_000; gap += 64) {
    while (reach(k) < gap) k++;
    STEPS_FOR.push(k);
  }
}
/** Fewest steps the envelope needs to cover `gap` units. */
function stepsFor(gap: number): number {
  return STEPS_FOR[Math.min(STEPS_FOR.length - 1, Math.ceil(gap / 64))]!;
}

const content = levelContent(level);
const engine = new Engine(content, mode);
const lvl = engine.world.level;

// The record: its marker order and splits (absolute steps).
const record = readJson<{ presses: string; steps: number }>(
  join(TAS_OUT_DIR, `${level}-${mode}.json`),
);
const recordSplits: number[] = [];
const recordOrder: number[] = [];
{
  const presses = parsePresses(record.presses);
  const world = newWorld(content, mode);
  let i = 0;
  let mask = 31;
  while (!world.finished) {
    let b = 0;
    if (presses[i] && presses[i]!.step === world.stepCount)
      b = keyBits(presses[i++]!.key, world.player.facingRight);
    world.step(b);
    const m = world.rules.remainingMask & 31;
    if (m !== mask) {
      recordOrder.push(Math.log2(mask ^ m));
      recordSplits.push(world.stepCount);
      mask = m;
    }
  }
  if (mode === 'sprint') recordSplits.push(world.stepCount);
}
const order = orderArg === 'record' ? recordOrder : orderArg.split(',').map(Number);
/** Targets: markers by index, -1 for the sprint's finish. */
const targets = mode === 'sprint' ? [...order, -1] : order;
console.log(
  `level ${level} ${mode}: record ${record.steps} steps, splits ${recordSplits.join(' ')}, order ${order.join(',')}; envelope ${[10, 40, 100].map((k) => `${k}:${Math.round(reach(k))}`).join(' ')}`,
);

/** Horizontal gap from a row's feet and body centre to target `t`'s tile (units). */
function gapTo(a: Int32Array, o: number, t: number): number {
  const tx = t === -1 ? lvl.finish!.x : lvl.checkpoints[t]!.x;
  const lo = tx << 10;
  const hi = lo + 1023;
  const feet = a[o]!;
  const centre = feet + (a[o + 2]! >> 1);
  const g = (x: number): number => (x < lo ? lo - x : x > hi ? x - hi : 0);
  return t === -1 ? g(centre) : Math.min(g(feet), g(centre));
}

// Every state kept, numbered globally, with its parent's number and its press.
let parents = new Int32Array(1 << 20);
let pressOf = new Uint8Array(1 << 20);
let total = 0;
function remember(parent: number, press: number): number {
  if (total === parents.length) {
    const p = new Int32Array(parents.length * 2);
    p.set(parents);
    parents = p;
    const q = new Uint8Array(pressOf.length * 2);
    q.set(pressOf);
    pressOf = q;
  }
  parents[total] = parent;
  pressOf[total] = press;
  return total++;
}

/** Rows that reached a target, with the step each arrived on and its number. */
interface Frontier {
  rows: Int32Array;
  steps: number[];
  ids: number[];
}

const out = new Int32Array(STATE_INTS * 16);
const succ: Successor[] = [];

interface SegmentResult {
  arrived: number;
  reached: Frontier;
  peak: number;
}

/** One segment from `frontier` to `target` within `budget` (absolute step); null if out of reach. */
function segment(
  frontier: Frontier,
  target: number,
  budget: number,
  last: boolean,
): SegmentResult | null {
  const mark = total;
  const firstStep = Math.min(...frontier.steps);
  const lastSource = Math.max(...frontier.steps);
  const bySourceStep = new Map<number, number[]>();
  frontier.steps.forEach((s, k) => {
    const list = bySourceStep.get(s) ?? [];
    list.push(k);
    bySourceStep.set(s, list);
  });
  let cur = new Layer();
  let curIds: number[] = [];
  let next = new Layer();
  let arrived = -1;
  const reached: Frontier = { rows: new Int32Array(0), steps: [], ids: [] };
  const reachedLayer = new Layer();
  let peak = 0;
  for (let step = firstStep; step < budget; step++) {
    for (const k of bySourceStep.get(step) ?? []) {
      const o = k * STATE_INTS;
      if (step + stepsFor(gapTo(frontier.rows, o, target)) > budget) continue;
      const before = cur.count;
      if (cur.add(frontier.rows, o, -1, 0) === before) curIds.push(frontier.ids[k]!);
    }
    if (cur.count === 0) {
      if (step >= lastSource) break;
      continue;
    }
    next.clear();
    const nextIds: number[] = [];
    for (let s = 0; s < cur.count; s++) {
      const n = engine.expand(cur.rows, s * STATE_INTS, out, 0, succ);
      for (let k = 0; k < n; k++) {
        const o = k * STATE_INTS;
        const done = target === -1 ? succ[k]!.finished : (out[o + MASK]! & (1 << target)) === 0;
        if (done) {
          if (arrived === -1) {
            arrived = step + 1;
            budget = Math.min(budget, arrived + (last ? 0 : delta));
          }
          const before = reachedLayer.count;
          if (reachedLayer.add(out, o, 0, 0) === before) {
            reached.steps.push(step + 1);
            reached.ids.push(remember(curIds[s]!, succ[k]!.press));
          }
          continue;
        }
        if (succ[k]!.finished) continue;
        if (step + 1 + stepsFor(gapTo(out, o, target)) > budget) continue;
        const before = next.count;
        if (next.add(out, o, 0, 0) === before) nextIds.push(remember(curIds[s]!, succ[k]!.press));
      }
    }
    peak = Math.max(peak, next.count);
    [cur, next] = [next, cur];
    curIds = nextIds;
    if (last && arrived !== -1) break;
  }
  if (arrived === -1) {
    total = mark; // forget this attempt's states
    return null;
  }
  reached.rows = reachedLayer.rows.slice(0, reachedLayer.count * STATE_INTS);
  return { arrived, reached, peak };
}

const startRow = new Int32Array(STATE_INTS);
engine.start(startRow);
let frontier: Frontier = { rows: startRow, steps: [0], ids: [remember(-1, 0)] };
const t0 = performance.now();
const splits: number[] = [];
let finalId = -1;
let finalStep = -1;
for (let seg = 0; seg < targets.length; seg++) {
  const target = targets[seg]!;
  const last = seg === targets.length - 1;
  const recordTime = recordSplits[seg]! - (seg > 0 ? recordSplits[seg - 1]! : 0);
  const from = Math.min(...frontier.steps);
  let budget = from + recordTime + (last ? 0 : delta);
  let res: SegmentResult | null = null;
  for (let tries = 0; tries < 12 && !res; tries++, budget += 3) {
    res = segment(frontier, target, budget, last);
    if (!res)
      console.log(
        `  segment ${seg}: nothing by step ${budget}, ${((performance.now() - t0) / 1000).toFixed(0)} s`,
      );
  }
  if (!res) {
    console.log(`segment ${seg} (target ${target}) not reached; giving up`);
    process.exit(1);
  }
  splits.push(res.arrived);
  console.log(
    `segment ${seg} → ${target === -1 ? 'finish' : `flag ${target}`}: first on step ${res.arrived} (record ${recordSplits[seg]}), ${res.reached.ids.length} states within ${last ? 0 : delta}, peak layer ${res.peak}, ${((performance.now() - t0) / 1000).toFixed(0)} s`,
  );
  if (last) {
    finalId = res.reached.ids[res.reached.steps.indexOf(res.arrived)]!;
    finalStep = res.arrived;
  }
  frontier = res.reached;
}

const bits: number[] = new Array(finalStep).fill(0);
{
  let id = finalId;
  for (let s = finalStep - 1; s >= 0; s--) {
    bits[s] = PRESSES[pressOf[id]!]!;
    id = parents[id]!;
  }
  if (id !== 0) throw new Error(`parent chain ends at ${id}, not the start`);
}
const check = playBits(newWorld(content, mode), bits);
if (!check.finished || check.steps !== finalStep)
  throw new Error(`replay disagrees: ${JSON.stringify(check)} vs ${finalStep}`);
const secs = (performance.now() - t0) / 1000;
console.log(
  `level ${level} ${mode}: ${finalStep} steps (${(finalStep * 0.03).toFixed(2)} s) against the record's ${record.steps}, splits ${splits.join(' ')}, ${engine.steps} simulated steps, ${secs.toFixed(0)} s`,
);
const dir = join(TAS_OUT_DIR, 'optimal');
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, `${level}-${mode}-chain.json`),
  JSON.stringify(
    {
      levelId: level,
      mode,
      simVersion: SIM_VERSION,
      steps: finalStep,
      timeMs: check.timeMs,
      record: record.steps,
      splits,
      recordSplits,
      order,
      search: { delta, margin, simulated: engine.steps, seconds: Math.round(secs) },
      presses: pressText(bits),
    },
    null,
    2,
  ) + '\n',
);
