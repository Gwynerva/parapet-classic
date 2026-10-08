/**
 * `npm run demo`: authoring the Moves screen's demos (packages/content/moves/demos.json).
 *
 *   npm run demo -- check                      every demo: does it show its move cleanly?
 *   npm run demo -- show wallJump              the runner's states step by step
 *   npm run demo -- search wallJump back@20..90 [up@+2..+20] [--write]
 *
 * `search` tries every press timing in the ranges (`+a..b` is relative to the press before),
 * keeps the timings whose demo passes `checkDemo`, and picks the one with the most passing
 * neighbours (one or two steps off on any press), so the demo does not hang on one exact step.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkDemo,
  traceDemo,
  type DemoKey,
  type DemoPress,
  type MoveDemoData,
} from '@parapet/runtime/moves/MoveDemo.ts';
import { REPO_ROOT, loadGameData } from './tas/content.ts';

export const DEMOS_FILE = join(REPO_ROOT, 'packages', 'content', 'moves', 'demos.json');

interface DemosFile {
  demos: MoveDemoData[];
}

function load(): DemosFile {
  return JSON.parse(readFileSync(DEMOS_FILE, 'utf8')) as DemosFile;
}

function save(file: DemosFile): void {
  writeFileSync(DEMOS_FILE, JSON.stringify(file, null, 2) + '\n');
}

function find(file: DemosFile, move: string): MoveDemoData {
  const demo = file.demos.find((d) => d.move === move);
  if (!demo)
    throw new Error(`no demo '${move}' (have: ${file.demos.map((d) => d.move).join(', ')})`);
  return demo;
}

const content = (): {
  moves: ReturnType<typeof loadGameData>['moves'];
  tables: ReturnType<typeof loadGameData>['tables'];
} => {
  const data = loadGameData();
  return { moves: data.moves, tables: data.tables };
};

function show(demo: MoveDemoData): void {
  const trace = traceDemo(demo, content());
  let from = 0;
  for (let i = 1; i <= trace.states.length; i++) {
    if (i < trace.states.length && trace.states[i] === trace.states[from]) continue;
    const pos = `${trace.x[from]!.toFixed(2)},${trace.y[from]!.toFixed(2)} -> ${trace.x[i - 1]!.toFixed(2)},${trace.y[i - 1]!.toFixed(2)}`;
    const press = demo.presses
      .filter((p) => p.step >= from && p.step < i)
      .map((p) => `${p.key}@${p.step}`);
    console.log(
      `${String(from).padStart(4)}-${String(i - 1).padEnd(4)} state ${String(trace.states[from]).padStart(3)}  at ${pos}  ${press.join(' ')}`,
    );
    from = i;
  }
  const problems = checkDemo(demo, content());
  console.log(problems.length ? `problems: ${problems.join('; ')}` : 'ok');
}

interface PressSpec {
  key: DemoKey;
  relative: boolean;
  from: number;
  to: number;
}

function parseSpec(text: string): PressSpec {
  const m = /^(up|down|fwd|back)@(\+?)(-?\d+)\.\.\+?(-?\d+)$/.exec(text);
  if (!m) throw new Error(`press range '${text}': use key@from..to or key@+from..to`);
  return { key: m[1] as DemoKey, relative: m[2] === '+', from: Number(m[3]), to: Number(m[4]) };
}

function search(demo: MoveDemoData, specs: PressSpec[]): DemoPress[] | null {
  const passing = new Map<string, DemoPress[]>();
  const walk = (i: number, presses: DemoPress[]): void => {
    if (i === specs.length) {
      const candidate = { ...demo, presses };
      if (checkDemo(candidate, content()).length === 0) {
        passing.set(presses.map((p) => p.step).join(','), presses);
      }
      return;
    }
    const spec = specs[i]!;
    const base = spec.relative ? (presses[i - 1]?.step ?? 0) : 0;
    for (let s = base + spec.from; s <= base + spec.to; s++) {
      if (s < 0 || s >= demo.steps) continue;
      walk(i + 1, [...presses, { step: s, key: spec.key }]);
    }
  };
  walk(0, []);
  if (passing.size === 0) return null;
  // Robustness: how many timings one or two steps off (each press alone) still pass.
  // Among the most robust, the one in the middle of the passing timings.
  const all = [...passing.values()];
  const middle = all.reduce((sum, p) => sum + p[0]!.step, 0) / all.length;
  let best: DemoPress[] | null = null;
  let bestScore = -1;
  let bestDistance = Infinity;
  for (const presses of all) {
    let score = 0;
    for (let i = 0; i < presses.length; i++) {
      for (const d of [-2, -1, 1, 2]) {
        const steps = presses.map((p, j) => (j === i ? p.step + d : p.step));
        if (passing.has(steps.join(','))) score++;
      }
    }
    const distance = Math.abs(presses[0]!.step - middle);
    if (score > bestScore || (score === bestScore && distance < bestDistance)) {
      bestScore = score;
      bestDistance = distance;
      best = presses;
    }
  }
  console.log(
    `${passing.size} timings pass; the chosen one keeps ${bestScore} of ${specs.length * 4} neighbours`,
  );
  return best;
}

function main(argv: string[]): void {
  const [command, move, ...rest] = argv;
  const file = load();
  switch (command) {
    case 'check': {
      let bad = 0;
      for (const demo of file.demos) {
        const problems = checkDemo(demo, content());
        if (problems.length) bad++;
        console.log(`${demo.move.padEnd(12)} ${problems.length ? problems.join('; ') : 'ok'}`);
      }
      if (bad) process.exitCode = 1;
      return;
    }
    case 'show':
      show(find(file, move ?? ''));
      return;
    case 'search': {
      const demo = find(file, move ?? '');
      const specs = rest.filter((a) => !a.startsWith('--')).map(parseSpec);
      const presses = search(demo, specs);
      if (!presses) {
        console.log('no timing passes');
        process.exitCode = 1;
        return;
      }
      console.log(presses.map((p) => `${p.key}@${p.step}`).join(' '));
      if (rest.includes('--write')) {
        demo.presses = presses;
        save(file);
        console.log(`written to ${DEMOS_FILE}`);
      }
      show({ ...demo, presses });
      return;
    }
    case 'try': {
      // Plays the demo with the given presses (key@step ...), without saving them.
      const demo = find(file, move ?? '');
      const presses = rest.map((a) => {
        const m = /^(up|down|fwd|back)@(\d+)$/.exec(a);
        if (!m) throw new Error(`press '${a}': use key@step`);
        return { key: m[1] as DemoKey, step: Number(m[2]) };
      });
      show({ ...demo, presses });
      return;
    }
    default:
      console.log(
        'usage: npm run demo -- check | show <move> | try <move> <key@step>... | search <move> <key@a..b>... [--write]',
      );
  }
}

main(process.argv.slice(2));
