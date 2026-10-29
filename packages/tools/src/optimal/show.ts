/**
 * Replays the presses of a hunt finding (or any `step:LETTERS` list) and prints the last steps:
 * move, position, speed, facing, flags taken. Usage:
 *   node src/optimal/show.ts <level> <mode> <kind/move | file.json> [lastSteps=40]
 */
import { readJson } from '../files.ts';
import { readArgs, resultPath } from './common.ts';
import { levelContent } from '../tas/content.ts';
import { newWorld } from '../tas/timeline.ts';
import { parsePressText } from './route.ts';

const { level, mode } = readArgs(process.argv.slice(2));
const what = process.argv[4]!;
const last = Number(process.argv[5] ?? 40);
let presses: string;
if (what.endsWith('.json')) {
  const f = readJson<{ presses: string; steps?: number }>(what);
  presses = f.presses;
  (globalThis as { steps?: number }).steps = f.steps;
} else {
  const [kind, move] = what.split('/');
  const hunt = readJson<{
    findings: { kind: string; move: number; presses: string; steps: number }[];
  }>(resultPath('hunt', `${level}-${mode}`));
  const f = hunt.findings.find((x) => x.kind === kind && String(x.move) === move);
  if (!f) throw new Error(`no finding ${what}`);
  presses = f.presses;
  // Steps of a finding: the presses list may end before the finding's last step.
  (globalThis as { steps?: number }).steps = f.steps;
}
const bits = parsePressText(presses);
const total = (globalThis as { steps?: number }).steps ?? bits.length;
const world = newWorld(levelContent(level), mode);
const rows: string[] = [];
for (let i = 0; i < total; i++) {
  const b = bits[i] ?? 0;
  const p = world.player;
  const before = `${p.moveId}`;
  world.step(b);
  rows.push(
    `${String(i + 1).padStart(5)} press ${String(b).padStart(2)} move ${before.padStart(3)}→${String(p.moveId).padStart(3)} x ${p.x} y ${p.y} vx ${p.vx} vy ${p.vy} ${p.facingRight ? 'R' : 'L'} mask ${world.rules.remainingMask & 31}`,
  );
  if (world.finished) break;
}
console.log(rows.slice(-last).join('\n'));
