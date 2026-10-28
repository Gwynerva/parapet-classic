/**
 * A flag hunt searched in a forced flag order under the bosses' human limits, then polished,
 * so an order can be compared with the record's on equal terms. Writes
 * tas-out/orders/<level>-<order>.json. Usage:
 *   node src/tas/orderSearch.ts <level> <order, e.g. 10243> [budget=150M] [seed=1]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { countFragile, DEFAULT_CONSTRAINTS } from './constraints.ts';
import { levelContent } from './content.ts';
import { TAS_OUT_DIR } from './files.ts';
import { formatPresses, type Press } from './model.ts';
import { polish, DEFAULT_POLISH, tidy } from './polish.ts';
import { DEFAULT_SEARCH, Search } from './search.ts';
import { playFull, Timeline } from './timeline.ts';

const level = Number(process.argv[2]);
const order = [...(process.argv[3] ?? '01234')].map(Number);
const budget = Number((process.argv[4] ?? '150M').replace(/M$/i, 'e6'));
const seed = Number(process.argv[5] ?? 1);
const mode = 'flags' as const;
const constraints = DEFAULT_CONSTRAINTS;
const content = levelContent(level);
const fragility = (presses: readonly Press[], limit: number) =>
  countFragile(new Timeline(content, mode, presses), constraints, limit);
const t0 = performance.now();
const search = new Search(
  content,
  mode,
  {
    ...DEFAULT_SEARCH,
    seed,
    budgetSteps: budget,
    minGap: constraints.minGap,
    windowSteps: 0,
    order,
  },
  fragility,
);
const result = search.run(() => {});
const label = order.join('');
if (result.finals.length === 0) {
  console.log(`level ${level} order ${label}: no run within ${budget} steps`);
  process.exit(1);
}
let best: { presses: Press[]; time: number } | null = null;
for (const final of result.finals.slice(0, 3)) {
  const p = polish(content, mode, final.presses, { ...DEFAULT_POLISH, constraints });
  if (p.robustness.fragile.length > 0) continue;
  if (!best || p.time < best.time) best = { presses: p.presses, time: p.time };
}
if (!best) {
  console.log(`level ${level} order ${label}: only frame-perfect runs`);
  process.exit(1);
}
const presses = tidy(content, mode, best.presses, constraints).presses;
const play = playFull(content, mode, presses);
const dir = join(TAS_OUT_DIR, 'orders');
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, `${level}-${label}.json`),
  JSON.stringify(
    {
      level,
      order: play.order,
      timeMs: play.time,
      steps: play.steps,
      presses: formatPresses(presses),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `level ${level} order ${label}: ${(play.time / 1000).toFixed(2)} s (${play.steps} steps), taken ${play.order.join('')}, ${((performance.now() - t0) / 1000).toFixed(0)} s`,
);
