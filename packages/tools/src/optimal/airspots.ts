/**
 * Where the air run is easiest: along a stored record, from every step where the runner runs on
 * the ground fast enough for a tiger jump, tries FORWARD after `d` steps and UP after `e` more,
 * and counts the (d, e) pairs that end with the runner faster than the ground cap. A spot's
 * windows are the widest runs of good d (for some e) and of good e (for the best d), in frames.
 * Usage: node src/optimal/airspots.ts <level> <mode>
 */
import { Input } from '@parapet/sim';
import { Engine, MOVE, STATE_INTS, VX, X, Y, writeState, type Successor } from './engine.ts';
import { readArgs, readRecord } from './common.ts';
import { levelContent } from '../tas/content.ts';
import { keyBits, parsePresses } from '../tas/model.ts';
import { newWorld } from '../tas/timeline.ts';

const { level, mode } = readArgs(process.argv.slice(2));
const content = levelContent(level);
const engine = new Engine(content, mode);

// The record's states, one row per step.
const file = readRecord(level, mode);
const presses = parsePresses(file.presses);
const world = newWorld(content, mode);
const rows: Int32Array[] = [];
let i = 0;
while (!world.finished) {
  const r = new Int32Array(STATE_INTS);
  writeState(world.player, world.rules, r, 0);
  engine.canon(r, 0);
  rows.push(r);
  let b = 0;
  if (presses[i] && presses[i]!.step === world.stepCount)
    b = keyBits(presses[i++]!.key, world.player.facingRight);
  world.step(b);
}

const out = new Int32Array(STATE_INTS * 16);
const succ: Successor[] = [];
/** From `row`: FORWARD after d steps, UP e steps later; does |vx| pass the cap within 80 steps? */
function tryIt(row: Int32Array, d: number, e: number): boolean {
  const a = row.slice();
  for (let s = 0; s < d + e + 80; s++) {
    const bits = s === d ? Input.FORWARD : s === d + e ? Input.UP : 0;
    engine.expand(a, 0, out, 0, succ, [bits]);
    a.set(out.subarray(0, STATE_INTS));
    if (Math.abs(a[VX]!) > 5300) return true;
    if (succ[0]!.finished) return false;
  }
  return false;
}
const widest = (ok: boolean[]): number => {
  let best = 0;
  let run = 0;
  for (const v of ok) {
    run = v ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
};

const spots: { step: number; x: number; y: number; dWin: number; eWin: number; vx: number }[] = [];
for (let s = 0; s < rows.length; s += 6) {
  const r = rows[s]!;
  if (r[MOVE] !== 2 || Math.abs(r[VX]!) < 1750) continue;
  const goodD: boolean[] = [];
  let bestE: boolean[] = [];
  for (let d = 0; d < 18; d++) {
    const es: boolean[] = [];
    for (let e = 3; e < 60; e++) es.push(tryIt(r, d, e));
    goodD.push(es.some(Boolean));
    if (widest(es) > widest(bestE)) bestE = es;
  }
  if (!goodD.some(Boolean)) continue;
  spots.push({
    step: s,
    x: r[X]! >> 10,
    y: r[Y]! >> 10,
    dWin: widest(goodD),
    eWin: widest(bestE),
    vx: r[VX]!,
  });
}
// Merge neighbouring record steps that find the same spot.
spots.sort((a, b) => b.dWin * b.eWin - a.dWin * a.eWin);
const seen = new Set<string>();
const best = spots.filter((p) => {
  const k = `${p.x},${p.y}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
console.log(
  `level ${level} ${mode}: ${best.length} spots` +
    best
      .slice(0, 4)
      .map(
        (p) =>
          `\n  tile ${p.x},${p.y} (record step ${p.step}): tiger jump window ${p.dWin} frames, UP window ${p.eWin} frames`,
      )
      .join(''),
);
