/**
 * The checkpoint-to-checkpoint idea, measured: an exact breadth-first search from the start to
 * the first flag taken, dropping every state that could not reach the flag's tile within the
 * record's split even at `speed` units per step. Prints the layer widths. Usage:
 *   node src/optimal/segment.ts <level> <mode> <speed> [maxWidth]
 */
import { Engine, STATE_INTS, type Successor } from './engine.ts';
import { Layer } from './layer.ts';
import { levelContent } from '../tas/content.ts';
import { newWorld } from '../tas/timeline.ts';
import { readJson } from '../files.ts';
import { TAS_OUT_DIR } from '../tas/files.ts';
import { join } from 'node:path';
import { keyBits, parsePresses, type ContestMode } from '../tas/model.ts';

const level = Number(process.argv[2] ?? 0);
const mode = (process.argv[3] ?? 'flags') as ContestMode;
const speed = Number(process.argv[4] ?? 146);
const maxWidth = Number(process.argv[5] ?? 3e6);
const content = levelContent(level);

// The record's first split and the marker it took.
const file = readJson<{ presses: string }>(join(TAS_OUT_DIR, `${level}-${mode}.json`));
const presses = parsePresses(file.presses);
const world = newWorld(content, mode);
let i = 0;
while ((world.rules.remainingMask & 31) === 31) {
  let b = 0;
  if (presses[i] && presses[i]!.step === world.stepCount)
    b = keyBits(presses[i++]!.key, world.player.facingRight);
  world.step(b);
}
const split = world.stepCount;
const marker = Math.log2(31 ^ (world.rules.remainingMask & 31));
const cp = world.level.checkpoints[marker]!;
const fx = (cp.x << 10) + 512;
console.log(`record takes marker ${marker} on step ${split}; pruning at ${speed} units/step`);

const engine = new Engine(content, mode);
let cur = new Layer();
let next = new Layer();
const start = new Int32Array(STATE_INTS);
engine.start(start);
cur.add(start, 0, -1, 0);
const out = new Int32Array(STATE_INTS * 16);
const succ: Successor[] = [];
const t0 = performance.now();
for (let step = 1; step <= split; step++) {
  next.clear();
  let pruned = 0;
  let reached = false;
  for (let s = 0; s < cur.count; s++) {
    const n = engine.expand(cur.rows, s * STATE_INTS, out, 0, succ);
    for (let k = 0; k < n; k++) {
      const o = k * STATE_INTS;
      if ((out[o + STATE_INTS - 1]! & 31) !== 31) {
        reached = true;
        continue;
      }
      const cx = out[o]! + (out[o + 2]! >> 1);
      const gap = Math.max(0, Math.abs(cx - fx) - 512);
      if (step + Math.ceil(gap / speed) > split) {
        pruned++;
        continue;
      }
      next.add(out, o, s, succ[k]!.press);
    }
  }
  if (step % 5 === 0 || reached)
    console.log(
      `step ${step}: ${next.count} states, ${pruned} pruned${reached ? ', MARKER REACHED' : ''}, ${((performance.now() - t0) / 1000).toFixed(0)} s`,
    );
  if (reached) break;
  [cur, next] = [next, cur];
  if (cur.count > maxWidth || cur.count === 0) break;
}
