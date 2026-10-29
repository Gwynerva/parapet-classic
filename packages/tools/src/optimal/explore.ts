/**
 * Measures the problem: a breadth-first search by steps from the start with exact merging and
 * no bound, printing how many distinct states each step holds. Usage:
 *   node src/optimal/explore.ts <level> <flags|sprint> [steps=200] [maxWidth=4000000]
 */
import { Engine, STATE_INTS, type Successor } from './engine.ts';
import { Layer } from './layer.ts';
import { readArgs } from './common.ts';
import { levelContent } from '../tas/content.ts';

const { level, mode } = readArgs(process.argv.slice(2), { level: 0, mode: 'flags' });
const maxSteps = Number(process.argv[4] ?? 200);
const maxWidth = Number(process.argv[5] ?? 4_000_000);
/** `phys`: merge on the physical situation only (an underestimate of the exact width). */
const phys = process.argv[6] === 'phys';
const PHYS = new Set([0, 1, 2, 3, 8, 9, 19, 41, 42, STATE_INTS - 1]);

const engine = new Engine(levelContent(level), mode);
let cur = new Layer();
let next = new Layer();
const start = new Int32Array(STATE_INTS);
engine.start(start);
cur.add(start, 0, -1, 0);
const out = new Int32Array(STATE_INTS * 16);
const succ: Successor[] = [];
const t0 = performance.now();
let generated = 0;
console.log('step\twidth\tsims/state\tgen/state\tx-span(tiles)\tms');
for (let step = 1; step <= maxSteps; step++) {
  next.clear();
  const seen = new Set<string>();
  const simsBefore = engine.steps;
  const genBefore = generated;
  let finished = false;
  for (let i = 0; i < cur.count; i++) {
    const n = engine.expand(cur.rows, i * STATE_INTS, out, 0, succ);
    generated += n;
    for (let k = 0; k < n; k++) {
      if (succ[k]!.finished) finished = true;
      if (phys) {
        const o = k * STATE_INTS;
        let key = '';
        for (const f of PHYS) key += out[o + f] + ',';
        if (seen.has(key)) continue;
        seen.add(key);
      }
      next.add(out, k * STATE_INTS, i, succ[k]!.press);
    }
  }
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < next.count; i++) {
    const x = next.rows[i * STATE_INTS]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  console.log(
    [
      step,
      next.count,
      ((engine.steps - simsBefore) / cur.count).toFixed(2),
      ((generated - genBefore) / cur.count).toFixed(2),
      ((maxX - minX) / 1024).toFixed(1),
      Math.round(performance.now() - t0),
    ].join('\t'),
  );
  if (finished) console.log(`finished on step ${step}`);
  [cur, next] = [next, cur];
  if (cur.count > maxWidth) break;
}
const secs = (performance.now() - t0) / 1000;
console.log(
  `${engine.steps} simulated steps in ${secs.toFixed(1)} s: ${(engine.steps / secs / 1e3).toFixed(0)}k steps/s`,
);
