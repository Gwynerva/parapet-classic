/**
 * Flag orders ranked by the guide (time around the blocks, rough speeds): every order of a flag
 * hunt from the start, next to the order the record takes. Usage: node src/optimal/orders.ts [level]
 */
import { Engine } from './engine.ts';
import { Guide } from './guide.ts';
import { readJson } from '../files.ts';
import { TAS_OUT_DIR } from '../tas/files.ts';
import { levelContent } from '../tas/content.ts';
import { newWorld } from '../tas/timeline.ts';
import { keyBits, parsePresses } from '../tas/model.ts';
import { join } from 'node:path';

function perms(a: number[]): number[][] {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}
const levels = process.argv[2]
  ? [Number(process.argv[2])]
  : Array.from({ length: 12 }, (_, i) => i);
for (const level of levels) {
  const content = levelContent(level);
  const engine = new Engine(content, 'flags');
  const lvl = engine.world.level;
  const guide = new Guide(lvl, 'flags');
  const rec = readJson<{ presses: string; steps: number }>(
    join(TAS_OUT_DIR, `${level}-flags.json`),
  );
  const world = newWorld(content, 'flags');
  const presses = parsePresses(rec.presses);
  const order: number[] = [];
  let mask = 31;
  let i = 0;
  while (!world.finished) {
    let b = 0;
    if (presses[i] && presses[i]!.step === world.stepCount)
      b = keyBits(presses[i++]!.key, world.player.facingRight);
    world.step(b);
    const m = world.rules.remainingMask & 31;
    if (m !== mask) {
      order.push(Math.log2(mask ^ m));
      mask = m;
    }
  }
  const sx = lvl.start.x;
  const sy = lvl.start.y;
  const ranked = perms([0, 1, 2, 3, 4])
    .map((o) => ({ o, s: guide.orderSteps(sx, sy, o) }))
    .sort((a, b) => a.s - b.s);
  const recS = guide.orderSteps(sx, sy, order);
  const rank = ranked.findIndex((r) => r.o.join() === order.join()) + 1;
  console.log(
    `level ${level}: record ${rec.steps} steps, order ${order.join('')} (guide ${recS.toFixed(0)}, rank ${rank}); best guide orders: ${ranked
      .slice(0, 4)
      .map((r) => `${r.o.join('')} ${r.s.toFixed(0)}`)
      .join(', ')}`,
  );
}
