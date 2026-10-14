/**
 * Where TAS runs live.
 *
 * - `packages/tools/tas-out/<level>-<mode>.json`: a run with its input. Git-ignored: the route
 *   of Gwynerva's records is her secret, but for two seconds around each flag.
 * - `packages/content/bosses/contests.json`: what the game ships, only her time and
 *   split times per level and mode, plus a SHA-256 of the replay so a local run can be shown
 *   to be the one published.
 * - `packages/content/bosses/glimpses.json`: those two seconds around each flag or checkpoint,
 *   published as the poses the game draws (`@parapet/runtime/content/glimpses.ts`), never as
 *   input.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RULESET_ID,
  SIM_VERSION,
  encodeReplay,
  type ContentHash,
  type InputRun,
  type Replay,
} from '@parapet/sim';
import type { GlimpsesFile } from '@parapet/runtime/content/glimpses.ts';
import type { Constraints } from './constraints.ts';
import { REPO_ROOT } from './content.ts';
import { contestCharacter, type ContestMode } from './model.ts';

export const TAS_OUT_DIR = join(REPO_ROOT, 'packages', 'tools', 'tas-out');
export const CONTESTS_FILE = join(REPO_ROOT, 'packages', 'content', 'bosses', 'contests.json');
export const GLIMPSES_FILE = join(REPO_ROOT, 'packages', 'content', 'bosses', 'glimpses.json');

/** Name the runs carry (Gwynerva searched them all; the bosses hold them in the game). */
export const GWYNERVA = 'Gwynerva';

export interface TasRunFile {
  format: 1;
  levelId: number;
  mode: ContestMode;
  simVersion: string;
  rulesetId: string;
  contentHash: ContentHash;
  constraints: Constraints;
  search: { seed: number; budgetSteps: number; steps: number; iterations: number; cells: number };
  timeMs: number;
  splitsMs: number[];
  /** Flag or checkpoint indices in the order taken. */
  order: number[];
  steps: number;
  /**
   * Presses whose one-step jitter breaks the run: a run with one is never kept over one
   * without, and never published.
   */
  fragile: number[];
  worstLossMs: number;
  /** A stylish record's folder (`style-05`), the cap it was searched with and the optimal time. */
  variant?: string;
  capPct?: number;
  optimalMs?: number;
  /** Its tricks (`style.ts`), and whether it fails anywhere (older files have none). */
  style?: { score: number; tricks: Record<string, number>; failed: boolean };
  /** `step:K` pairs, K one of U D R L. */
  presses: string;
  /** The run as a replay code (`encodeReplay`), for watching it on the dev server. */
  replay: string;
}

export interface ContestRecord {
  timeMs: number;
  splitsMs: number[];
  /** SHA-256 (hex) of the replay code of the run. */
  runSha256: string;
}

export interface ContestLevel {
  levelId: number;
  contentHash: ContentHash;
  flags: ContestRecord;
  sprint: ContestRecord;
}

export interface ContestsFile {
  simVersion: string;
  rulesetId: string;
  constraints: Constraints;
  /** When the records are stylish runs: their cap over the optimal ones, in percent. */
  style?: { capPct: number };
  levels: ContestLevel[];
}

/** A run's file: the optimal one in `tas-out`, a stylish one in its variant's folder. */
export function runPath(levelId: number, mode: ContestMode, variant = ''): string {
  return join(TAS_OUT_DIR, variant, `${levelId}-${mode}.json`);
}

export function readRun(levelId: number, mode: ContestMode, variant = ''): TasRunFile | null {
  const path = runPath(levelId, mode, variant);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as TasRunFile;
}

export function writeRun(run: TasRunFile): void {
  const path = runPath(run.levelId, run.mode, run.variant);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(run, null, 2) + '\n');
}

/** The finished jobs of `run` (`tas-out/jobs.jsonl`), so a campaign can go on where it stopped. */
export const JOBS_FILE = join(TAS_OUT_DIR, 'jobs.jsonl');

export interface JobRecord {
  /** '' for the optimal runs, the folder of a stylish one. */
  variant: string;
  levelId: number;
  mode: ContestMode;
  seed: number;
  budgetSteps: number;
  /** The cap of a stylish job (ms), else 0. */
  capMs: number;
  /** The run it found, or null. */
  timeMs: number | null;
  style: number | null;
  at: string;
}

/** The key a job is found by in the log. */
export function jobKey(
  j: Pick<JobRecord, 'variant' | 'levelId' | 'mode' | 'seed' | 'budgetSteps' | 'capMs'>,
): string {
  return `${j.variant}|${j.levelId}|${j.mode}|${j.seed}|${j.budgetSteps}|${j.capMs}`;
}

export function readJobLog(): JobRecord[] {
  if (!existsSync(JOBS_FILE)) return [];
  return readFileSync(JOBS_FILE, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as JobRecord);
}

export function logJob(record: JobRecord): void {
  mkdirSync(TAS_OUT_DIR, { recursive: true });
  appendFileSync(JOBS_FILE, JSON.stringify(record) + '\n');
}

export function readContests(): ContestsFile | null {
  if (!existsSync(CONTESTS_FILE)) return null;
  return JSON.parse(readFileSync(CONTESTS_FILE, 'utf8')) as ContestsFile;
}

export function writeContests(file: ContestsFile): void {
  mkdirSync(join(CONTESTS_FILE, '..'), { recursive: true });
  writeFileSync(CONTESTS_FILE, JSON.stringify(file, null, 2) + '\n');
}

export function readGlimpses(): GlimpsesFile | null {
  if (!existsSync(GLIMPSES_FILE)) return null;
  return JSON.parse(readFileSync(GLIMPSES_FILE, 'utf8')) as GlimpsesFile;
}

export function writeGlimpses(file: GlimpsesFile): void {
  mkdirSync(join(GLIMPSES_FILE, '..'), { recursive: true });
  writeFileSync(GLIMPSES_FILE, JSON.stringify(file, null, 2) + '\n');
}

/** The replay of a TAS run, as Gwynerva's. */
export function gwynervaReplay(
  levelId: number,
  mode: ContestMode,
  contentHash: ContentHash,
  input: InputRun[],
): Replay {
  return {
    simVersion: SIM_VERSION,
    rulesetId: RULESET_ID,
    contentHash,
    levelId,
    mode,
    withRival: false,
    character: contestCharacter(levelId, mode),
    playerName: GWYNERVA,
    input,
  };
}

export function replayCode(replay: Replay): string {
  return encodeReplay(replay);
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
