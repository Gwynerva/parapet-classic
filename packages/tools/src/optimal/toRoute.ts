/**
 * Turns a recipe (tas-out/recipes/*.json, keys U D F B) into a route the emulator plays
 * (`step:K` with U D L R): forward and back become the arrow the runner faces or turns from at
 * that step. Usage: node src/optimal/toRoute.ts <recipe.json> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { Input } from '@parapet/sim';
import { readJson } from '../files.ts';
import { levelContent } from '../tas/content.ts';
import { newWorld } from '../tas/timeline.ts';
import type { ContestMode } from '../tas/model.ts';

const recipe = readJson<{
  level: number;
  mode: ContestMode;
  showsOnStep: number;
  presses: { step: number; key: string }[];
}>(process.argv[2]!);
const world = newWorld(levelContent(recipe.level), recipe.mode);
const BITS: Record<string, number> = {
  U: Input.UP,
  D: Input.DOWN,
  F: Input.FORWARD,
  B: Input.BACK,
};
const at = new Map(recipe.presses.map((p) => [p.step, p.key]));
const out: string[] = [];
for (let s = 0; s <= recipe.showsOnStep; s++) {
  const key = at.get(s);
  let bits = 0;
  if (key) {
    const right = world.player.facingRight;
    const arrow = key === 'F' ? (right ? 'R' : 'L') : key === 'B' ? (right ? 'L' : 'R') : key;
    out.push(`${s}:${arrow}`);
    bits = BITS[key]!;
  }
  world.step(bits);
}
writeFileSync(
  process.argv[3]!,
  JSON.stringify(
    {
      level: recipe.level,
      mode: recipe.mode,
      showsOnStep: recipe.showsOnStep,
      presses: out.join(' '),
    },
    null,
    2,
  ) + '\n',
);
console.log(out.join(' '));
