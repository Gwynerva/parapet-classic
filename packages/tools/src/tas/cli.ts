// Entry point: `npm run tas -- <command> [options]` (see USAGE).
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
import {
  GLIMPSE_AFTER_STEPS,
  GLIMPSE_BEFORE_STEPS,
  GLIMPSE_FORMAT,
  glimpseProblems,
  type GlimpseSet,
  type GlimpsesFile,
} from '@parapet/runtime/content/glimpses.ts';
import { checkRun, DEFAULT_CONSTRAINTS, type Constraints } from './constraints.ts';
import { levelContent, loadGameData } from './content.ts';
import { ANALYSIS_DIR, writeAnalysis } from './analyze.ts';
import {
  jobKey,
  logJob,
  readContests,
  readGlimpses,
  readJobLog,
  readRun,
  runPath,
  sha256,
  writeContests,
  writeGlimpses,
  writeRun,
  type ContestLevel,
  type TasRunFile,
} from './files.ts';
import { runGlimpses } from './glimpses.ts';
import {
  betterRun,
  betterStyleRun,
  isCurrent,
  needsSearch,
  needsStyleSearch,
  runFile,
  styleCap,
  type JobMessage,
  type StyleJob,
  type TasJob,
} from './job.ts';
import { tidy } from './polish.ts';
import { CONTEST_MODES, isContestMode, parsePresses, type ContestMode } from './model.ts';
import { styleOf } from './style.ts';
import { playFull } from './timeline.ts';

const USAGE = `usage: npm run tas -- <command> [options]

Finds the bosses' records: fast runs of every level's Flag hunt and Sprint (no rival) under
human limits (single key presses, at least --min-gap steps apart, no press that only works
on its exact step). Runs are kept in packages/tools/tas-out (git-ignored, the routes stay
secret); only the times are published, and two seconds around each flag as poses (glimpses).
A run with a frame-perfect press is never kept over one without, and never published.
With --style the runs sought are the showiest within a cap over the optimal run (style.ts),
kept in tas-out/style-<cap>; they are studied, not published.

commands:
  run       search and polish runs, keep each one if it beats the stored run
  tidy      drop the presses the stored runs do without (same time, no new precise press)
  verify    re-simulate the stored runs, check the limits and the published files
  publish   write packages/content/bosses/contests.json and glimpses.json from the stored runs
            (with --style, from the stylish ones: the bosses race those since 0.5.0)
  report    table of the stored runs next to the original's records (--markdown for notes)
  analyze   what tricks cost: the optimal runs next to the stylish ones (tas-out/analysis)
  campaign  every search of the study in a row, then analyze (resumes where it stopped)

options:
  --level <list>    levels, 0-based: 3, 0-11, 1,4,7   (default: all)
  --mode <mode>     flags, sprint or all               (default: all)
  --fragile         only where the stored run is missing, outdated or has a frame-perfect press
  --budget <steps>  simulation steps per run, e.g. 150M (default: 150M)
  --seed <list>     search seeds, one run each: 1, 1-4  (default: 1)
  --workers <n>     parallel runs                        (default: cores - 1)
  --resume          start from the stored run (repaired first if it has a frame-perfect press)
  --window <steps>  check every press as it is played, over this many steps (default: off)
  --style <pct>     stylish runs: the most style within this many percent over the optimal run
  --skip-done       leave out jobs the job log (tas-out/jobs.jsonl) has finished already
  --from <step>     campaign: start at this step (1-based)
  --min-gap <n>     fewest steps between presses         (default: ${DEFAULT_CONSTRAINTS.minGap})
  --tolerance <ms>  largest loss of a press one step off (default: ${DEFAULT_CONSTRAINTS.toleranceMs})
  --markdown        report as a Markdown table`;

interface Args {
  command: string;
  levels: number[];
  modes: ContestMode[];
  budget: number;
  seeds: number[];
  workers: number;
  resume: boolean;
  fragile: boolean;
  windowSteps: number;
  /** Cap of the stylish runs in percent, or null for the optimal ones. */
  style: number | null;
  skipDone: boolean;
  from: number;
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

/** A list of whole numbers such as `3`, `0-11` or `1,4,7`, sorted. */
function parseList(text: string): number[] {
  const out = new Set<number>();
  for (const part of text.split(',')) {
    const [a, b] = part.split('-').map((s) => Number(s.trim()));
    if (a === undefined || !Number.isInteger(a)) throw new Error(`bad list: ${text}`);
    const end = b === undefined ? a : b;
    if (!Number.isInteger(end)) throw new Error(`bad list: ${text}`);
    for (let n = a; n <= end; n++) out.add(n);
  }
  return [...out].sort((x, y) => x - y);
}

function parseLevels(text: string): number[] {
  const levels = parseList(text);
  for (const l of levels) {
    if (l < 0 || l >= LEVEL_COUNT) throw new Error(`level ${l} does not exist`);
  }
  return levels;
}

function parseArgs(argv: readonly string[]): Args | null {
  const args: Args = {
    command: '',
    levels: Array.from({ length: LEVEL_COUNT }, (_, i) => i),
    modes: [...CONTEST_MODES],
    budget: 150_000_000,
    seeds: [1],
    workers: Math.max(1, availableParallelism() - 1),
    resume: false,
    fragile: false,
    windowSteps: 0,
    style: null,
    skipDone: false,
    from: 1,
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
        args.seeds = parseList(value());
        break;
      case '--workers':
        args.workers = Math.max(1, parseCount(value()));
        break;
      case '--resume':
        args.resume = true;
        break;
      case '--fragile':
        args.fragile = true;
        break;
      case '--window':
        args.windowSteps = parseCount(value());
        break;
      case '--style':
        args.style = parseCount(value());
        break;
      case '--skip-done':
        args.skipDone = true;
        break;
      case '--from':
        args.from = parseCount(value());
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

/** The folder of the stylish runs with a cap: `style-05`. */
function styleVariant(pct: number): string {
  return `style-${String(pct).padStart(2, '0')}`;
}

/** The cap of a job in ms (0 for an optimal one), as the job log keys it. */
function jobCap(job: TasJob): number {
  return job.style ? styleCap(job.style.optimalMs, job.style.capPct) : 0;
}

async function commandRun(args: Args): Promise<number> {
  const variant = args.style === null ? '' : styleVariant(args.style);
  const done = args.skipDone ? new Set(readJobLog().map(jobKey)) : null;
  const jobs: TasJob[] = [];
  for (const levelId of args.levels) {
    for (const mode of args.modes) {
      const stored = readRun(levelId, mode, variant);
      let style: StyleJob | null = null;
      if (args.style !== null) {
        const optimal = readRun(levelId, mode);
        if (!optimal || !isCurrent(optimal, levelId) || optimal.fragile.length > 0) {
          console.log(`${label(levelId, mode)} no clean optimal run to measure the style against`);
          continue;
        }
        style = {
          variant,
          capPct: args.style,
          optimal: parsePresses(optimal.presses),
          optimalMs: optimal.timeMs,
        };
        if (args.fragile && !needsStyleSearch(stored, levelId, optimal.timeMs)) continue;
      } else if (args.fragile && !needsSearch(stored, levelId)) {
        continue;
      }
      const resumable =
        stored && isCurrent(stored, levelId) && (!style || stored.optimalMs === style.optimalMs);
      const start = args.resume && resumable ? parsePresses(stored.presses) : null;
      for (const seed of args.seeds) {
        const job: TasJob = {
          levelId,
          mode,
          seed,
          budgetSteps: args.budget,
          constraints: args.constraints,
          start,
          polishRoutes: 3,
          windowSteps: args.windowSteps,
          ...(style ? { style } : {}),
        };
        const key = jobKey({
          variant,
          levelId,
          mode,
          seed,
          budgetSteps: args.budget,
          capMs: jobCap(job),
        });
        if (done?.has(key)) continue;
        jobs.push(job);
      }
    }
  }
  if (jobs.length === 0) {
    console.log('nothing to search');
    return 0;
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
              const seed = args.seeds.length > 1 ? ` s${current.seed}` : '';
              const name = `${label(m.levelId, m.mode)}${seed}`;
              if (m.type === 'progress') {
                const best = m.progress.best === null ? '-' : seconds(m.progress.best);
                const style = current.style ? ` style ${Math.round(m.progress.style)}` : '';
                console.log(
                  `${name} ${(m.progress.steps / 1e6).toFixed(0).padStart(5)}M steps ` +
                    `${String(m.progress.cells).padStart(7)} cells  best ${best}${style}` +
                    `  (${m.progress.rejected} frame-perfect runs turned down)`,
                );
                return;
              }
              if (m.type === 'phase') {
                console.log(`${name} ${m.phase}`);
                return;
              }
              worker.off('message', onMessage);
              if (m.type !== 'error') {
                logJob({
                  variant,
                  levelId: current.levelId,
                  mode: current.mode,
                  seed: current.seed,
                  budgetSteps: current.budgetSteps,
                  capMs: jobCap(current),
                  timeMs: m.run?.timeMs ?? null,
                  style: m.run?.style?.score ?? null,
                  at: new Date().toISOString(),
                });
              }
              if (m.type === 'error') {
                failed++;
                console.error(`${name} FAILED\n${m.error}`);
              } else if (!m.run) {
                failed++;
                console.log(`${name} no run without a frame-perfect press found`);
              } else {
                const stored = readRun(current.levelId, current.mode, variant);
                const better = current.style ? betterStyleRun : betterRun;
                // A stored stylish run counts only against the same optimal run, within its cap.
                const sameCap =
                  !current.style ||
                  (stored?.optimalMs === current.style.optimalMs &&
                    stored.timeMs <= jobCap(current));
                const keep =
                  stored && isCurrent(stored, current.levelId) && sameCap && !better(m.run, stored);
                const fragileNote =
                  m.run.fragile.length > 0 ? `, ${m.run.fragile.length} fragile` : '';
                const note = current.style
                  ? `${fragileNote}, style ${m.run.style?.score ?? 0}`
                  : fragileNote;
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
 * Problems of one stored run, re-simulated from scratch; a frame-perfect press is one, and for a
 * stylish run a fail, its cap passed, or another optimal run than the one stored now.
 */
function checkStored(run: TasRunFile): string[] {
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
  } else if (run.fragile.length > 0) {
    problems.push(`frame-perfect presses ${run.fragile.join(', ')}`);
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
  if (run.variant !== undefined) {
    const optimal = readRun(levelId, mode);
    if (!optimal || optimal.timeMs !== run.optimalMs) {
      problems.push('measured against another optimal run');
    }
    if (run.timeMs > styleCap(run.optimalMs ?? 0, run.capPct ?? 0)) problems.push('over its cap');
    if (styleOf(content, mode, presses).failed) problems.push('fails somewhere');
  }
  return problems;
}

/** Problems of the published glimpses of a stored run, recorded again. */
function checkGlimpses(run: TasRunFile, glimpses: GlimpsesFile): string[] {
  const level = glimpses.levels.find((l) => l.levelId === run.levelId);
  const set: GlimpseSet | undefined = level?.[run.mode];
  if (!level || !set) return ['published without glimpses'];
  const problems: string[] = [];
  if (!sameContentHash(level.contentHash, run.contentHash)) {
    problems.push('glimpses of other level data');
  }
  if (set.runSha256 !== sha256(run.replay)) problems.push('glimpses of another run');
  const recorded = runGlimpses(run);
  problems.push(...recorded.problems);
  if (recorded.clips.join() !== set.clips.join()) problems.push('published glimpses differ');
  return problems;
}

function commandVerify(args: Args): number {
  const variant = args.style === null ? '' : styleVariant(args.style);
  const contests = readContests();
  const glimpses = readGlimpses();
  let bad = 0;
  if (contests) {
    const problems = glimpses ? glimpseProblems(glimpses) : ['missing'];
    if (glimpses && glimpses.simVersion !== SIM_VERSION) problems.push('another simulation');
    if (glimpses && glimpses.rulesetId !== RULESET_ID) problems.push('another ruleset');
    if (problems.length > 0) {
      bad++;
      console.log(`glimpses.json ${problems.join('; ')}`);
    }
  }
  for (const levelId of args.levels) {
    for (const mode of args.modes) {
      const name = label(levelId, mode);
      const run = readRun(levelId, mode, variant);
      const published = contests?.levels.find((l) => l.levelId === levelId)?.[mode];
      if (!run) {
        console.log(
          `${name} no stored run${published ? ' (published one cannot be checked)' : ''}`,
        );
        continue;
      }
      const problems = checkStored(run);
      if (published) {
        if (published.timeMs !== run.timeMs) problems.push('published time differs');
        if (published.splitsMs.join() !== run.splitsMs.join())
          problems.push('published splits differ');
        if (published.runSha256 !== sha256(run.replay)) problems.push('published run hash differs');
        if (glimpses) problems.push(...checkGlimpses(run, glimpses));
      }
      if (problems.length > 0) bad++;
      console.log(
        `${name} ${seconds(run.timeMs)} ${problems.length === 0 ? 'ok' : problems.join('; ')}`,
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

function commandPublish(args: Args): number {
  const variant = args.style === null ? '' : styleVariant(args.style);
  const levels: ContestLevel[] = [];
  const glimpseLevels: GlimpsesFile['levels'] = [];
  const missing: string[] = [];
  let constraints: Constraints | null = null;
  for (let levelId = 0; levelId < LEVEL_COUNT; levelId++) {
    const runs: Partial<Record<ContestMode, TasRunFile>> = {};
    for (const mode of CONTEST_MODES) {
      const run = readRun(levelId, mode, variant);
      if (!run) {
        missing.push(`${runPath(levelId, mode, variant)} is missing`);
        continue;
      }
      const problems = checkStored(run);
      if (problems.length > 0) missing.push(`${label(levelId, mode)}: ${problems.join('; ')}`);
      constraints ??= run.constraints;
      if (
        constraints.minGap !== run.constraints.minGap ||
        constraints.toleranceMs !== run.constraints.toleranceMs
      ) {
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
    const glimpseSet = (r: TasRunFile): GlimpseSet => {
      const { clips, problems } = runGlimpses(r);
      if (problems.length > 0) missing.push(`${label(levelId, r.mode)}: ${problems.join('; ')}`);
      return { runSha256: sha256(r.replay), clips };
    };
    glimpseLevels.push({
      levelId,
      contentHash: flags.contentHash,
      flags: glimpseSet(flags),
      sprint: glimpseSet(sprint),
    });
  }
  if (missing.length > 0 || !constraints) {
    console.error(`not published:\n  ${missing.join('\n  ')}`);
    return 1;
  }
  writeContests({
    simVersion: SIM_VERSION,
    rulesetId: RULESET_ID,
    constraints,
    ...(args.style === null ? {} : { style: { capPct: args.style } }),
    levels,
  });
  writeGlimpses({
    format: GLIMPSE_FORMAT,
    simVersion: SIM_VERSION,
    rulesetId: RULESET_ID,
    beforeSteps: GLIMPSE_BEFORE_STEPS,
    afterSteps: GLIMPSE_AFTER_STEPS,
    levels: glimpseLevels,
  });
  console.log(`published ${levels.length} levels`);
  return 0;
}

/** The stylish caps of the study, in percent. */
const STYLE_CAPS = [5, 15];

/** Every search of the study, in order (`campaign`). */
const CAMPAIGN: { title: string; args: Partial<Args> }[] = [
  {
    title: 'the optimal runs still with a frame-perfect press',
    args: { fragile: true, resume: true, seeds: [1, 2, 3], budget: 500_000_000 },
  },
  {
    title: 'one more seed for every optimal run',
    args: { resume: true, seeds: [4], budget: 500_000_000 },
  },
  ...STYLE_CAPS.map((cap) => ({
    title: `the showiest runs within +${cap} %`,
    args: { style: cap, resume: true, seeds: [1, 2], budget: 400_000_000 },
  })),
];

function commandAnalyze(): number {
  const markdown = writeAnalysis(
    STYLE_CAPS.map((cap) => ({ name: styleVariant(cap), capPct: cap })),
  );
  console.log(markdown);
  console.log(`written to ${ANALYSIS_DIR}`);
  return 0;
}

/**
 * The whole study in one process: every step of `CAMPAIGN` (from `--from`), each leaving out
 * the jobs the job log has finished, then `analyze`. Nothing needs watching: the runs are saved
 * as each job ends, and a stopped campaign goes on where it stopped.
 */
async function commandCampaign(args: Args): Promise<number> {
  const started = performance.now();
  let failed = 0;
  for (const [i, step] of CAMPAIGN.entries()) {
    if (i + 1 < args.from) continue;
    console.log(`== step ${i + 1} of ${CAMPAIGN.length}: ${step.title}`);
    failed += await commandRun({ ...args, ...step.args, skipDone: true, command: 'run' });
  }
  console.log(`== analyze`);
  commandAnalyze();
  console.log(`== campaign done in ${((performance.now() - started) / 3.6e6).toFixed(1)} h`);
  return failed > 0 ? 1 : 0;
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
      return commandPublish(args);
    case 'report':
      return commandReport(args);
    case 'analyze':
      return commandAnalyze();
    case 'campaign':
      return commandCampaign(args);
    default:
      console.error(`unknown command ${args.command}\n${USAGE}`);
      return 2;
  }
}

process.exitCode = await main();
