/**
 * Which runs count as records and how two runs compare. The original keeps a best time for
 * its races and a best score for its score runs; local records, shared replays and ghost
 * races all follow the same rules.
 */
import type { RunMode } from './run.ts';

/** Number of levels in the original game (`levels/0.json` .. `levels/11.json`). */
export const LEVEL_COUNT = 12;

/** Levels whose challenge is judged on the score (the others on time with required moves). */
export const SCORE_CHALLENGE_LEVELS: readonly number[] = [8, 10, 11];

/** Modes with records. Free runs never finish and warm-ups are tutorials. */
export const RANKED_MODES: readonly RunMode[] = ['sprint', 'flags', 'score', 'challenge'];

export type RankingSort = 'time' | 'score';

export function isRankedMode(mode: RunMode): boolean {
  return RANKED_MODES.includes(mode);
}

/**
 * What a mode is ranked on: races by time, score runs and the score challenges (levels 8, 10
 * and 11) by score.
 */
export function rankingSort(mode: RunMode, levelId = -1): RankingSort {
  if (mode === 'score') return 'score';
  if (mode === 'challenge' && SCORE_CHALLENGE_LEVELS.includes(levelId)) return 'score';
  return 'time';
}

/** The parts of a run's outcome that rank it. */
export interface RankedOutcome {
  finished: boolean;
  /** Finish time in ms of game clock. */
  time: number;
  score: number;
}

/**
 * Orders two runs of the same board: negative when `a` is better, positive when `b` is, 0 for
 * a tie. A finished race beats an unfinished one; scores compare whatever ended the run.
 */
export function compareRuns(sort: RankingSort, a: RankedOutcome, b: RankedOutcome): number {
  if (sort === 'score') return b.score - a.score;
  if (a.finished !== b.finished) return a.finished ? -1 : 1;
  if (!a.finished) return 0;
  return a.time - b.time;
}
