/**
 * One TAS job: search a level and mode, polish the best runs, keep the fastest robust one.
 * Runs inside a worker thread (`worker.ts`) or in-process.
 */
import { RULESET_ID, SIM_VERSION } from '@parapet/sim';
import { countFragile, robustness, type Constraints, type FragileCount } from './constraints.ts';
import { levelContent, levelHash } from './content.ts';
import { gwynervaReplay, replayCode, type TasRunFile } from './files.ts';
import { formatPresses, type ContestMode, type Press } from './model.ts';
import { polish, DEFAULT_POLISH, tidy } from './polish.ts';
import { DEFAULT_SEARCH, Search, type SearchProgress } from './search.ts';
import { playFull, Timeline } from './timeline.ts';

export interface TasJob {
  levelId: number;
  mode: ContestMode;
  seed: number;
  budgetSteps: number;
  constraints: Constraints;
  /** A known run to start from (resume); its time becomes the first target. */
  start: Press[] | null;
  /** Finished runs with different routes polished at most. */
  polishRoutes: number;
}

export type JobMessage =
  | { type: 'progress'; levelId: number; mode: ContestMode; progress: SearchProgress }
  | { type: 'phase'; levelId: number; mode: ContestMode; phase: string }
  | { type: 'done'; levelId: number; mode: ContestMode; run: TasRunFile | null }
  | { type: 'error'; levelId: number; mode: ContestMode; error: string };

export function runJob(job: TasJob, post: (m: JobMessage) => void): TasRunFile | null {
  const { levelId, mode, constraints } = job;
  const content = levelContent(levelId);
  const fragility = (presses: readonly Press[], limit: number): FragileCount =>
    countFragile(new Timeline(content, mode, presses), constraints, limit);
  const search = new Search(
    content,
    mode,
    { ...DEFAULT_SEARCH, seed: job.seed, budgetSteps: job.budgetSteps, minGap: constraints.minGap },
    fragility,
  );
  if (job.start) search.seed(job.start);
  const result = search.run((progress) => post({ type: 'progress', levelId, mode, progress }));
  const candidates: Press[][] = [];
  if (job.start) candidates.push(job.start);
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
  let best: { presses: Press[]; score: number; fragile: number[]; worst: number } | null = null;
  for (const presses of candidates) {
    const polished = polish(content, mode, presses, { ...DEFAULT_POLISH, constraints });
    const score =
      polished.time + DEFAULT_POLISH.fragilePenaltyMs * polished.robustness.fragile.length;
    if (!best || score < best.score) {
      best = {
        presses: polished.presses,
        score,
        fragile: polished.robustness.fragile,
        worst: polished.robustness.worstLossMs,
      };
    }
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

/** The stored form of a run: re-simulated, with its robustness and its replay. */
export function runFile(
  levelId: number,
  mode: ContestMode,
  constraints: Constraints,
  presses: readonly Press[],
  search: TasRunFile['search'],
): TasRunFile {
  const content = levelContent(levelId);
  const play = playFull(content, mode, presses);
  if (!play.finished) throw new Error(`level ${levelId} ${mode}: the run does not finish`);
  const rob = robustness(new Timeline(content, mode, presses), constraints);
  const hash = levelHash(levelId);
  return {
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
    presses: formatPresses(presses),
    replay: replayCode(gwynervaReplay(levelId, mode, hash, play.input)),
  };
}
