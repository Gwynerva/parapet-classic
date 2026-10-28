/**
 * How much of a layer's width is real: the distinct physical situations (position, speed,
 * move, timer, facing, hands, flags taken) next to the distinct full states. Usage:
 *   node src/optimal/diversity.ts <level> <mode> [steps=40]
 */
import { Engine, STATE_INTS, type Successor } from './engine.ts';
import { Layer } from './layer.ts';
import { levelContent } from '../tas/content.ts';
import type { ContestMode } from '../tas/model.ts';

const level = Number(process.argv[2] ?? 0);
const mode = (process.argv[3] ?? 'flags') as ContestMode;
const maxSteps = Number(process.argv[4] ?? 40);
const engine = new Engine(levelContent(level), mode);
let cur = new Layer();
let next = new Layer();
const start = new Int32Array(STATE_INTS);
engine.start(start);
cur.add(start, 0, -1, 0);
const out = new Int32Array(STATE_INTS * 16);
const succ: Successor[] = [];
const PHYS = [0, 1, 2, 3, 8, 9, 19, 41, 42, STATE_INTS - 1];
console.log('step\tfull\tno-buffer\tphysical\tpos+move');
for (let step = 1; step <= maxSteps; step++) {
  next.clear();
  for (let i = 0; i < cur.count; i++) {
    const n = engine.expand(cur.rows, i * STATE_INTS, out, 0, succ);
    for (let k = 0; k < n; k++) next.add(out, k * STATE_INTS, i, succ[k]!.press);
  }
  const noBuf = new Set<string>();
  const phys = new Set<string>();
  const pos = new Set<string>();
  const r = next.rows;
  for (let i = 0; i < next.count; i++) {
    const o = i * STATE_INTS;
    const row = Array.from(r.subarray(o, o + STATE_INTS));
    row[39] = 0;
    noBuf.add(row.join(','));
    phys.add(PHYS.map((k) => r[o + k]).join(','));
    pos.add([r[o], r[o + 1], r[o + 41]].join(','));
  }
  console.log([step, next.count, noBuf.size, phys.size, pos.size].join('\t'));
  [cur, next] = [next, cur];
}
