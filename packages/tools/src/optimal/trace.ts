/**
 * Prints a stored record's progress every 50 steps: x, flags left, the straight-line distance.
 * Usage: node src/optimal/trace.ts <level> <mode>
 */
import { readArgs, readRecord } from './common.ts';
import { levelContent } from '../tas/content.ts';
import { LowerBound, TOP_SPEED } from '../tas/bound.ts';
import { newWorld } from '../tas/timeline.ts';
import { keyBits, parsePresses } from '../tas/model.ts';

const { level, mode } = readArgs(process.argv.slice(2), { level: 0, mode: 'flags' });
const file = readRecord(level, mode);
const presses = parsePresses(file.presses);
const world = newWorld(levelContent(level), mode);
const bound = new LowerBound(world, mode);
let i = 0;
while (!world.finished) {
  let bits = 0;
  if (presses[i] && presses[i]!.step === world.stepCount)
    bits = keyBits(presses[i++]!.key, world.player.facingRight);
  world.step(bits);
  if (world.stepCount % 50 === 0)
    console.log(
      `step ${world.stepCount}: x ${world.player.x} y ${world.player.y} mask ${world.rules.remainingMask & 31} dist ${(bound.ms(world) * TOP_SPEED).toFixed(0)}`,
    );
}
console.log(`finished ${world.stepCount}; presses ${file.presses}`);
