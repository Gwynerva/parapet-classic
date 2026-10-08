// Entry point: `npm run tas -- <run|verify|publish|report> [options]` (see USAGE).
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import {
  LEVEL_COUNT,
  RULESET_ID,
  SIM_VERSION,
  decodeReplay,
  sameContentHash,
  simulateReplay,
} from '@parapet/sim';
import { checkRun, DEFAULT_CONSTRAINTS, type Constraints } from './constraints.ts';
import { levelContent, levelHash, loadGameData } from './content.ts';
import {
  readContests,
  readRun,
  runPath,
  sha256,
  writeContests,
  writeRun,
  type ContestLevel,
  type TasRunFile,
} from './files.ts';
import { runFile, type JobMessage, type TasJob } from './job.ts';
import { tidy } from './polish.ts';
import { CONTEST_MODES, isContestMode, parsePresses, type ContestMode } from './model.ts';
import { DEFAULT_POLISH } from './polish.ts';
import { playFull } from './timeline.ts';

const USAGE = `usage: npm run tas -- <command> [options]

Finds the bosses' records: fast runs of every level's Flag hunt and Sprint (no rival) under
human limits (single key presses, at least --min-gap steps apart, no press that only works
on its exact step). Runs are kept in packages/tools/tas-out (git-ignored, the routes stay
secret); only times are published.

commands:
  run       search and polish runs, keep each one if it beats the stored run
  tidy      drop the presses the stored runs do without (same time, no new precise press)
  verify    re-simulate the stored runs, check the limits and the published table
  publish   write packages/content/bosses/contests.json from the stored runs
  report    table of the stored runs next to the original's records (--markdown for notes)

options:
  --level <list>    levels, 0-based: 3, 0-11, 1,4,7   (default: all)
  --mode <mode>     flags, sprint or all               (default: all)
  --budget <steps>  simulation steps per run, e.g. 150M (default: 150M)
  --seed <n>        search seed                          (default: 1)
  --workers <n>     parallel runs                        (default: cores - 1)
  --resume          start from the stored run
  --min-gap <n>     fewest steps between presses         (default: ${DEFAULT_CONSTRAINTS.minGap})
  --tolerance <ms>  largest loss of a press one step off (default: ${DEFAULT_CONSTRAINTS.toleranceMs})
  --markdown        report as a Markdown table`;

interface Args {
  command: string;
  levels: number[];
  modes: ContestMode[];
  budget: number;
  seed: number;
  workers: number;
  resume: boolean;
  constraints: Constraints;
  markdown: boolean;
}

function parseCount(text: string): number {
  const m = /^(\d+(?:\.\d+)?)([kKmMgG]?)$/.exec(text.trim());
  if (!m) {
    const n = Number(text);
    if (!Number.isFinite(n)) throw new Error(`not a number: ${text}`);
    return Math.round(n);
  }
  const scale = { '': 1, k: 1e3, m: 1e6, g: 1e9 }[m[2]!.toLowerCase() as '' | 'k' | 'm' | 'g'];
  return Math.round(Number(m[1]) * scale);
}

function parseLevels(text: string): number[] {
  const out = new Set<number>();
  for (const part of text.split(',')) {
    const [a, b] = part.split('-').map((s) => Number(s.trim()));
    if (a === undefined || !Number.isInteger(a)) throw new Error(`bad level list: ${text}`);
    const end = b === undefined ? a : b;
    for (let l = a; l <= end; l++) {
      if (l < 0 || l >= LEVEL_COUNT) throw new Error(`level ${l} does not exist`);
      out.add(l);
    }
  }
  return [...out].sort((x, y) => x - y);
}

function parseArgs(argv: readonly string[]): Args | null {
  const args: Args = {
    command: '',
    levels: Array.from({ length: LEVEL_COUNT }, (_, i) => i),
    modes: [...CONTEST_MODES],
    budget: 150_000_000,
    seed: 1,
    workers: Math.max(1, availableParallelism() - 1),
    resume: false,
    constraints: { ...DEFAULT_CONSTRAINTS },
    markdown: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const value = (): string => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };
    switch (arg) {
      case '--help':
      case '-h':
        return null;
      case '--level':
        args.levels = parseLevels(value());
        break;
      case '--mode': {
        const mode = value();
        if (mode === 'all') args.modes = [...CONTEST_MODES];
        else if (isContestMode(mode)) args.modes = [mode];
        else throw new Error(`unknown mode ${mode}`);
        break;
      }
      case '--budget':
        args.budget = parseCount(value());
        break;
      case '--seed':
        args.seed = parseCount(value());
        break;
      case '--workers':
        args.workers = Math.max(1, parseCount(value()));
        break;
      case '--resume':
        args.resume = true;
        break;
      case '--min-gap':
        args.constraints.minGap = parseCount(value());
        break;
      case '--tolerance':
        args.constraints.toleranceMs = parseCount(value());
        break;
      case '--markdown':
        args.markdown = true;
        break;
      default:
        if (arg.startsWith('-') || args.command !== '') throw new Error(`unexpected ${arg}`);
        args.command = arg;
    }
  }
  return args.command === '' ? null : args;
}

function seconds(ms: number): string {
  return (ms / 1000).toFixed(2);
}

function label(levelId: number, mode: ContestMode): string {
  return `L${String(levelId + 1).padStart(2, '0')} ${mode.padEnd(6)}`;
}

/** Score used to compare runs: time plus the polish penalty per fragile press. */
function runScore(run: TasRunFile): number {
  return run.timeMs + DEFAULT_POLISH.fragilePenaltyMs * run.fragile.length;
}

function isCurrent(run: TasRunFile, levelId: number): boolean {
  return (
    run.simVersion === SIM_VERSION &&
    run.rulesetId === RULESET_ID &&
    sameContentHash(run.contentHash, levelHash(levelId))
  );
}

async function commandRun(args: Args): Promise<number> {
  const jobs: TasJob[] = [];
  for (const levelId of args.levels) {
    for (const mode of args.modes) {
      const stored = readRun(levelId, mode);
      const start =
        args.resume && stored && isCurrent(stored, levelId) ? parsePresses(stored.presses) : null;
      jobs.push({
        levelId,
        mode,
        seed: args.seed,
        budgetSteps: args.budget,
        constraints: args.constraints,
        start,
        polishRoutes: 3,
      });
    }
  }
  const workerCount = Math.min(args.workers, jobs.length);
  console.log(
    `${jobs.length} runs, ${workerCount} workers, ${(args.budget / 1e6).toFixed(0)}M steps each`,
  );
  const started = performance.now();
  let failed = 0;
  const queue = jobs.slice();
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      const worker = new Worker(new URL('./worker.ts', import.meta.url));
      try {
        for (let job = queue.shift(); job; job = queue.shift()) {
          const current = job;
          await new Promise<void>((resolve) => {
            const onMessage = (m: JobMessage): void => {
              const name = label(m.levelId, m.mode);
              if (m.type === 'progress') {
                const best = m.progress.best === null ? '-' : seconds(m.progress.best);
                console.log(
                  `${name} ${(m.progress.steps / 1e6).toFixed(0).padStart(5)}M steps ` +
                    `${String(m.progress.cells).padStart(7)} cells  best ${best}` +
                    `  (${m.progress.rejected} frame-perfect runs turned down)`,
                );
                return;
              }
              if (m.type === 'phase') {
                console.log(`${name} ${m.phase}`);
                return;
              }
              worker.off('message', onMessage);
              if (m.type === 'error') {
                failed++;
                console.error(`${name} FAILED\n${m.error}`);
              } else if (!m.run) {
                failed++;
                console.log(`${name} no finished run found`);
              } else {
                const stored = readRun(current.levelId, current.mode);
                const keep =
                  stored &&
                  isCurrent(stored, current.levelId) &&
                  runScore(stored) <= runScore(m.run);
                const note = m.run.fragile.length > 0 ? `, ${m.run.fragile.length} fragile` : '';
                if (keep) {
                  console.log(
                    `${name} ${seconds(m.run.timeMs)}${note}: stored run ${seconds(stored.timeMs)} stays`,
                  );
                } else {
                  writeRun(m.run);
                  console.log(`${name} ${seconds(m.run.timeMs)}${note}: saved`);
                }
              }
              resolve();
            };
            worker.on('message', onMessage);
            worker.postMessage(current);
          });
        }
      } finally {
        await worker.terminate();
      }
    }),
  );
  console.log(`done in ${((performance.now() - started) / 60000).toFixed(1)} min`);
  return failed > 0 ? 1 : 0;
}

/**
 * Problems of one stored run, re-simulated from scratch, and its frame-perfect presses (allowed
 * when the search found no run without them, but reported).
 */
function checkStored(run: TasRunFile): { problems: string[]; fragile: number[] } {
  const problems: string[] = [];
  const { levelId, mode } = run;
  if (!isCurrent(run, levelId)) problems.push('recorded on another simulation or level data');
  const content = levelContent(levelId);
  const presses = parsePresses(run.presses);
  const checked = checkRun(content, mode, presses, run.constraints);
  if (checked.problem) problems.push(checked.problem);
  if (checked.time !== run.timeMs)
    problems.push(`presses give ${checked.time}, file says ${run.timeMs}`);
  if (checked.robustness.fragile.join() !== run.fragile.join()) {
    problems.push(
      `frame-perfect presses ${checked.robustness.fragile.join(', ')}, file says ${run.fragile.join(', ')}`,
    );
  }
  const play = playFull(content, mode, presses);
  if (play.splits.join() !== run.splitsMs.join()) problems.push('splits differ');
  const decoded = decodeReplay(run.replay);
  if (!decoded.ok) {
    problems.push(`replay does not decode: ${decoded.error}`);
  } else {
    const outcome = simulateReplay(decoded.replay, content);
    if (!outcome.finished || outcome.time !== run.timeMs) {
      problems.push(`replay gives ${outcome.time}, file says ${run.timeMs}`);
    }
    if (outcome.splits.join() !== run.splitsMs.join()) problems.push('replay splits differ');
  }
  return { problems, fragile: checked.robustness.fragile };
}

function commandVerify(args: Args): number {
  const contests = readContests();
  let bad = 0;
  for (const levelId of args.levels) {
    for (const mode of args.modes) {
      const name = label(levelId, mode);
      const run = readRun(levelId, mode);
      const published = contests?.levels.find((l) => l.levelId === levelId)?.[mode];
      if (!run) {
        console.log(
          `${name} no stored run${published ? ' (published one cannot be checked)' : ''}`,
        );
        continue;
      }
      const { problems, fragile } = checkStored(run);
      if (published) {
        if (published.timeMs !== run.timeMs) problems.push('published time differs');
        if (published.splitsMs.join() !== run.splitsMs.join())
          problems.push('published splits differ');
        if (published.runSha256 !== sha256(run.replay)) problems.push('published run hash differs');
      }
      if (problems.length > 0) bad++;
      const precise = fragile.length > 0 ? ` (${fragile.length} frame-perfect)` : '';
      console.log(
        `${name} ${seconds(run.timeMs)} ${problems.length === 0 ? 'ok' : problems.join('; ')}${precise}`,
      );
    }
  }
  return bad > 0 ? 1 : 0;
}

function commandTidy(args: Args): number {
  for (const levelId of args.levels) {
    for (const mode of args.modes) {
      const run = readRun(levelId, mode);
      if (!run || !isCurrent(run, levelId)) continue;
      const presses = parsePresses(run.presses);
      const tidied = tidy(levelContent(levelId), mode, presses, run.constraints);
      const name = label(levelId, mode);
      if (tidied.removed === 0) {
        console.log(`${name} ${presses.length} presses, none to drop`);
        continue;
      }
      const next = runFile(levelId, mode, run.constraints, tidied.presses, run.search);
      if (next.timeMs > run.timeMs || next.fragile.length > run.fragile.length) {
        console.log(`${name} tidying would make it worse; kept`);
        continue;
      }
      writeRun(next);
      console.log(`${name} ${presses.length} → ${tidied.presses.length} presses`);
    }
  }
  return 0;
}

function commandPublish(): number {
  const levels: ContestLevel[] = [];
  const missing: string[] = [];
  let constraints: Constraints | null = null;
  for (let levelId = 0; levelId < LEVEL_COUNT; levelId++) {
    const runs: Partial<Record<ContestMode, TasRunFile>> = {};
    for (const mode of CONTEST_MODES) {
      const run = readRun(levelId, mode);
      if (!run) {
        missing.push(`${runPath(levelId, mode)} is missing`);
        continue;
      }
      const { problems } = checkStored(run);
      if (problems.length > 0) missing.push(`${label(levelId, mode)}: ${problems.join('; ')}`);
      constraints ??= run.constraints;
      if (constraints.minGap !== run.constraints.minGap) {
        missing.push(`${label(levelId, mode)}: searched under other limits`);
      }
      runs[mode] = run;
    }
    const { flags, sprint } = runs;
    if (!flags || !sprint) continue;
    const record = (r: TasRunFile) => ({
      timeMs: r.timeMs,
      splitsMs: r.splitsMs,
      runSha256: sha256(r.replay),
    });
    levels.push({
      levelId,
      contentHash: flags.contentHash,
      flags: record(flags),
      sprint: record(sprint),
    });
  }
  if (missing.length > 0 || !constraints) {
    console.error(`not published:\n  ${missing.join('\n  ')}`);
    return 1;
  }
  writeContests({ simVersion: SIM_VERSION, rulesetId: RULESET_ID, constraints, levels });
  console.log(`published ${levels.length} levels`);
  return 0;
}

function commandReport(args: Args): number {
  const { missions } = loadGameData();
  const rows: string[][] = [];
  for (const levelId of args.levels) {
    const info = missions[levelId]!;
    for (const mode of args.modes) {
      const run = readRun(levelId, mode);
      const slot = info.missionTypes.indexOf(mode === 'flags' ? 1 : 0);
      const goal = info.goals[slot];
      const original = goal ? seconds(goal.defaultTime) : '-';
      const target =
        mode === 'flags'
          ? goal?.value
            ? seconds(goal.value)
            : '-'
          : seconds(info.rivalTotalTime + info.rivalStartDelay);
      rows.push([
        String(levelId + 1),
        mode,
        run ? seconds(run.timeMs) : '-',
        original,
        target,
        run ? run.order.map((i) => i + 1).join(' ') : '-',
        run ? String(run.fragile.length) : '-',
      ]);
    }
  }
  const head = [
    'level',
    'mode',
    'Gwynerva',
    'original record',
    'mission target',
    'order',
    'fragile',
  ];
  if (args.markdown) {
    console.log(`| ${head.join(' | ')} |`);
    console.log(`| ${head.map(() => '---').join(' | ')} |`);
    for (const r of rows) console.log(`| ${r.join(' | ')} |`);
  } else {
    const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
    const line = (r: string[]): string => r.map((c, i) => c.padEnd(widths[i]!)).join('  ');
    console.log(line(head));
    for (const r of rows) console.log(line(r));
  }
  return 0;
}

async function main(): Promise<number> {
  let args: Args | null;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(USAGE);
    return 2;
  }
  if (!args) {
    console.log(USAGE);
    return 0;
  }
  switch (args.command) {
    case 'run':
      return commandRun(args);
    case 'tidy':
      return commandTidy(args);
    case 'verify':
      return commandVerify(args);
    case 'publish':
      return commandPublish();
    case 'report':
      return commandReport(args);
    default:
      console.error(`unknown command ${args.command}\n${USAGE}`);
      return 2;
  }
}

process.exitCode = await main();
