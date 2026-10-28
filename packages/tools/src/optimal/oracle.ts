/**
 * Checks a route against the original game: writes an oracle script from the presses, runs
 * the original classes on the JVM (reference/oracle) and compares move, position and speed on
 * every step with the remake. Usage:
 *   node src/optimal/oracle.ts <level> <mode> <kind/move | file.json> [steps]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson } from '../files.ts';
import { TAS_OUT_DIR } from '../tas/files.ts';
import { levelContent } from '../tas/content.ts';
import { newWorld } from '../tas/timeline.ts';
import type { ContestMode } from '../tas/model.ts';
import { parsePressText } from './route.ts';

const level = Number(process.argv[2]);
const mode = process.argv[3] as ContestMode;
const what = process.argv[4]!;
let presses: string;
let steps: number;
if (what.endsWith('.json')) {
  const f = readJson<{ presses: string; steps: number }>(what);
  presses = f.presses;
  steps = f.steps;
} else {
  const [kind, move] = what.split('/');
  const hunt = readJson<{
    findings: { kind: string; move: number; presses: string; steps: number }[];
  }>(join(TAS_OUT_DIR, 'hunt', `${level}-${mode}.json`));
  const f = hunt.findings.find((x) => x.kind === kind && String(x.move) === move);
  if (!f) throw new Error(`no finding ${what}`);
  presses = f.presses;
  steps = f.steps;
}
if (process.argv[5]) steps = Number(process.argv[5]);
const bits = parsePressText(presses);

// Script: `ticks keys` blocks, keys pressed on the first step of each block (raw bits).
const lines = [`# level: ${level}`, `# mission: ${mode === 'sprint' ? 0 : 1}`];
const pressSteps = bits.map((b, i) => (b ? i : -1)).filter((i) => i >= 0 && i < steps);
if (pressSteps.length === 0 || pressSteps[0]! > 0) lines.push(`${pressSteps[0] ?? steps} 0`);
pressSteps.forEach((s, k) => {
  const end = pressSteps[k + 1] ?? steps;
  lines.push(`${end - s} ${bits[s]}`);
});
const dir = join(TAS_OUT_DIR, 'oracle');
mkdirSync(dir, { recursive: true });
const name = `${level}-${mode}-${what.replace(/[^\w]+/g, '_')}`;
const script = join(dir, `${name}.txt`);
const out = join(dir, `${name}.jsonl`);
writeFileSync(script, lines.join('\n') + '\n');
const root = join(import.meta.dirname, '..', '..', '..', '..');
execFileSync('node', [join(root, 'reference', 'oracle', 'run.mjs'), script, out], {
  stdio: 'inherit',
});

const trace = readFileSync(out, 'utf8')
  .trim()
  .split('\n')
  .slice(1)
  .map((l) => JSON.parse(l) as Record<string, number>);
const world = newWorld(levelContent(level), mode);
let mismatches = 0;
for (const t of trace) {
  if (t.step! > 0) world.step(bits[t.step! - 1] ?? 0);
  const p = world.player;
  const mine = { move: p.moveId, k: p.x, l: p.y, q: p.vx, r: p.vy };
  const theirs = { move: t.move, k: t.k, l: t.l, q: t.q, r: t.r };
  if (JSON.stringify(mine) !== JSON.stringify(theirs)) {
    if (mismatches++ < 5)
      console.log(
        `step ${t.step}: remake ${JSON.stringify(mine)} original ${JSON.stringify(theirs)}`,
      );
  }
}
const lastT = trace[trace.length - 1]!;
console.log(
  `${trace.length - 1} steps compared, ${mismatches} differ; the original ends on move ${lastT.move} at (${lastT.k}, ${lastT.l}) with speed (${lastT.q}, ${lastT.r})`,
);
