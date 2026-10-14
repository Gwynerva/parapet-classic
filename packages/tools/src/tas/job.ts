/**
 * One TAS job: search a level and mode, polish the best runs, keep the fastest one without a
 * frame-perfect press (never one with); or, for a stylish record (`TasJob.style`), the showiest
 * one within a time cap that never fails. Runs inside a worker thread (`worker.ts`) or
 * in-process.
 */
import { RULESET_ID, SIM_VERSION, sameContentHash } from '@parapet/sim';
import { countFragile, robustness, type Constraints, type FragileCount } from './constraints.ts';
import { levelContent, levelHash } from './content.ts';
import { gwynervaReplay, replayCode, type TasRunFile } from './files.ts';
import { formatPresses, type ContestMode, type Press } from './model.ts';
import { polish, polishStyle, DEFAULT_POLISH, tidy, tidyStyle } from './polish.ts';
import { DEFAULT_SEARCH, Search, type SearchProgress } from './search.ts';
import { styleOf } from './style.ts';
import { playFull, Timeline } from './timeline.ts';

export interface TasJob {
  levelId: number;
  mode: ContestMode;
  seed: number;
  budgetSteps: number;
  constraints: Constraints;
  /**
   * A known run to start from (resume); its time becomes the first target. One with
   * frame-perfect presses is repaired first (`polish`), and left out if that fails.
   */
  start: Press[] | null;
  /** Finished runs with different routes polished at most. */
  polishRoutes: number;
  /** `SearchParams.windowSteps`: 0, or steps over which every press is checked as played. */
  windowSteps: number;
  /** A stylish record: the most style within `capMs`, starting from the optimal run. */
  style?: StyleJob;
}

/** What a stylish job is after (`run --style`). */
export interface StyleJob {
  /** Where its runs are kept (`style-05`). */
  variant: string;
  /** The cap over the optimal run, in percent. */
  capPct: number;
  /** The optimal run it is measured against, and its time. */
  optimal: Press[];
  optimalMs: number;
}

/** The time a stylish run may take: the optimal run's plus the cap. */
export function styleCap(optimalMs: number, capPct: number): number {
  return Math.round(optimalMs * (1 + capPct / 100));
}

/** Style points worth a millisecond of clock when the search picks a cell to play from. */
const STYLE_WEIGHT_MS = 4;
/** Style points per level of style the search keeps a cell for. */
const STYLE_TIER_POINTS = 100;

export type JobMessage =
  | { type: 'progress'; levelId: number; mode: ContestMode; progress: SearchProgress }
  | { type: 'phase'; levelId: number; mode: ContestMode; phase: string }
  | { type: 'done'; levelId: number; mode: ContestMode; run: TasRunFile | null }
  | { type: 'error'; levelId: number; mode: ContestMode; error: string };

export function runJob(job: TasJob, post: (m: JobMessage) => void): TasRunFile | null {
  if (job.style) return runStyleJob(job, job.style, post);
  const { levelId, mode, constraints } = job;
  const content = levelContent(levelId);
  const fragility = (presses: readonly Press[], limit: number): FragileCount =>
    countFragile(new Timeline(content, mode, presses), constraints, limit);
  const search = new Search(
    content,
    mode,
    {
      ...DEFAULT_SEARCH,
      seed: job.seed,
      budgetSteps: job.budgetSteps,
      minGap: constraints.minGap,
      windowSteps: job.windowSteps,
    },
    fragility,
  );
  let start = job.start;
  if (start && fragility(start, 0).count > 0) {
    post({ type: 'phase', levelId, mode, phase: 'repairing the stored run' });
    const repaired = polish(content, mode, start, { ...DEFAULT_POLISH, constraints });
    start = repaired.robustness.fragile.length === 0 ? repaired.presses : null;
    post({
      type: 'phase',
      levelId,
      mode,
      phase: start
        ? `repaired: ${(repaired.time / 1000).toFixed(2)}`
        : `not repaired (${repaired.robustness.fragile.length} frame-perfect left), searching afresh`,
    });
  }
  if (start) search.seed(start);
  const result = search.run((progress) => post({ type: 'progress', levelId, mode, progress }));
  const candidates: Press[][] = [];
  if (start) candidates.push(start);
  // One candidate per route (flag order), fastest first.
  const routes = new Set<string>();
  for (const final of result.finals) {
    if (routes.size >= job.polishRoutes) break;
    const route = playFull(content, mode, final.presses).order.join(',');
    if (routes.has(route)) continue;
    routes.add(route);
    candidates.push(final.presses);
  }
  if (candidates.length === 0) return null;

  post({ type: 'phase', levelId, mode, phase: `polishing ${candidates.length} routes` });
  let best: { presses: Press[]; time: number } | null = null;
  for (const presses of candidates) {
    const polished = polish(content, mode, presses, { ...DEFAULT_POLISH, constraints });
    if (polished.robustness.fragile.length > 0) continue;
    if (!best || polished.time < best.time)
      best = { presses: polished.presses, time: polished.time };
  }
  if (!best) return null;
  const presses = tidy(content, mode, best.presses, constraints).presses;
  return runFile(levelId, mode, constraints, presses, {
    seed: job.seed,
    budgetSteps: job.budgetSteps,
    steps: result.steps,
    iterations: result.iterations,
    cells: result.cells,
  });
}

/**
 * A stylish job: the search with a style objective, seeded with the optimal run (and the stored
 * stylish run when resuming), then the showiest of its runs polished for more style.
 */
function runStyleJob(
  job: TasJob,
  style: StyleJob,
  post: (m: JobMessage) => void,
): TasRunFile | null {
  const { levelId, mode, constraints } = job;
  const content = levelContent(levelId);
  const capMs = styleCap(style.optimalMs, style.capPct);
  const fragility = (presses: readonly Press[], limit: number): FragileCount =>
    countFragile(new Timeline(content, mode, presses), constraints, limit);
  const search = new Search(
    content,
    mode,
    {
      ...DEFAULT_SEARCH,
      seed: job.seed,
      budgetSteps: job.budgetSteps,
      minGap: constraints.minGap,
      windowSteps: job.windowSteps,
      style: { capMs, tierPoints: STYLE_TIER_POINTS, weightMs: STYLE_WEIGHT_MS },
    },
    fragility,
  );
  const usable = (presses: Press[] | null): presses is Press[] => {
    if (!presses) return false;
    const s = styleOf(content, mode, presses, capMs);
    return s.time !== null && !s.failed && fragility(presses, 0).count === 0;
  };
  const starts = [style.optimal, job.start].filter(usable);
  for (const presses of starts) search.seed(presses);
  const result = search.run((progress) => post({ type: 'progress', levelId, mode, progress }));
  const candidates = [...starts, ...result.finals.slice(0, job.polishRoutes).map((f) => f.presses)];
  if (candidates.length === 0) return null;

  post({ type: 'phase', levelId, mode, phase: `polishing ${candidates.length} stylish runs` });
  let best: { presses: Press[]; score: number; time: number } | null = null;
  for (const presses of candidates) {
    const polished = polishStyle(content, mode, presses, {
      ...DEFAULT_POLISH,
      maxEvaluations: 30000,
      constraints,
      capMs,
    });
    if (polished.robustness.fragile.length > 0) continue;
    const { score } = polished.style;
    const time = polished.time;
    if (
      !best ||
      score > best.score + 1e-6 ||
      (Math.abs(score - best.score) <= 1e-6 && time < best.time)
    )
      best = { presses: polished.presses, score, time };
  }
  if (!best) return null;
  const presses = tidyStyle(content, mode, best.presses, constraints, capMs).presses;
  return runFile(
    levelId,
    mode,
    constraints,
    presses,
    {
      seed: job.seed,
      budgetSteps: job.budgetSteps,
      steps: result.steps,
      iterations: result.iterations,
      cells: result.cells,
    },
    { variant: style.variant, capPct: style.capPct, optimalMs: style.optimalMs },
  );
}

/** Whether a stored run was found on the current simulation, ruleset and level data. */
export function isCurrent(run: TasRunFile, levelId: number): boolean {
  return (
    run.simVersion === SIM_VERSION &&
    run.rulesetId === RULESET_ID &&
    sameContentHash(run.contentHash, levelHash(levelId))
  );
}

/**
 * Whether a level and mode still need a search (`run --fragile`): no run stored, or one found
 * on other data, or one with frame-perfect presses.
 */
export function needsSearch(run: TasRunFile | null, levelId: number): boolean {
  return !run || !isCurrent(run, levelId) || run.fragile.length > 0;
}

/**
 * Whether a stylish record still needs a search: no run stored, one found on other data, one
 * with a frame-perfect press or a fail, one over its cap, or one measured against another
 * optimal run (its cap has changed).
 */
export function needsStyleSearch(
  run: TasRunFile | null,
  levelId: number,
  optimalMs: number,
): boolean {
  return (
    !run ||
    !isCurrent(run, levelId) ||
    run.fragile.length > 0 ||
    run.optimalMs !== optimalMs ||
    run.timeMs > styleCap(optimalMs, run.capPct ?? 0) ||
    run.style?.failed !== false
  );
}

/**
 * Whether stylish run `a` is better than `b`: fewer frame-perfect presses, then more style,
 * then faster.
 */
export function betterStyleRun(
  a: Pick<TasRunFile, 'timeMs' | 'fragile' | 'style'>,
  b: Pick<TasRunFile, 'timeMs' | 'fragile' | 'style'>,
): boolean {
  if (a.fragile.length !== b.fragile.length) return a.fragile.length < b.fragile.length;
  const sa = a.style?.score ?? 0;
  const sb = b.style?.score ?? 0;
  if (Math.abs(sa - sb) > 1e-6) return sa > sb;
  return a.timeMs < b.timeMs;
}

/**
 * Whether run `a` is better than `b`: one without frame-perfect presses beats one with them,
 * whatever the times; otherwise fewer of them, then the faster.
 */
export function betterRun(
  a: Pick<TasRunFile, 'timeMs' | 'fragile'>,
  b: Pick<TasRunFile, 'timeMs' | 'fragile'>,
): boolean {
  if (a.fragile.length !== b.fragile.length) return a.fragile.length < b.fragile.length;
  return a.timeMs < b.timeMs;
}

/**
 * The stored form of a run: re-simulated, with its robustness, its style and its replay;
 * `stylish` marks a stylish record and what it was measured against.
 */
export function runFile(
  levelId: number,
  mode: ContestMode,
  constraints: Constraints,
  presses: readonly Press[],
  search: TasRunFile['search'],
  stylish?: Pick<TasRunFile, 'variant' | 'capPct' | 'optimalMs'>,
): TasRunFile {
  const content = levelContent(levelId);
  const play = playFull(content, mode, presses);
  if (!play.finished) throw new Error(`level ${levelId} ${mode}: the run does not finish`);
  const rob = robustness(new Timeline(content, mode, presses), constraints);
  const hash = levelHash(levelId);
  const style = styleOf(content, mode, presses);
  return {
    ...stylish,
    format: 1,
    levelId,
    mode,
    simVersion: SIM_VERSION,
    rulesetId: RULESET_ID,
    contentHash: hash,
    constraints,
    search,
    timeMs: play.time,
    splitsMs: play.splits,
    order: play.order,
    steps: play.steps,
    fragile: rob.fragile,
    worstLossMs: rob.worstLossMs,
    style: {
      score: Math.round(style.score),
      tricks: style.tricks,
      failed: style.failed,
    },
    presses: formatPresses(presses),
    replay: replayCode(gwynervaReplay(levelId, mode, hash, play.input)),
  };
}
