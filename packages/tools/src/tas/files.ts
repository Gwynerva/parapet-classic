/**
 * Where TAS runs live.
 *
 * - `packages/tools/tas-out/<level>-<mode>.json`: a run with its input. Git-ignored: the route
 *   of Gwynerva's records is her secret and is published nowhere.
 * - `packages/content/bosses/contests.json`: what the game ships, only her time and
 *   split times per level and mode, plus a SHA-256 of the replay so a local run can be shown
 *   to be the one published.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RULESET_ID,
  SIM_VERSION,
  encodeReplay,
  type ContentHash,
  type InputRun,
  type Replay,
} from '@parapet/sim';
import type { Constraints } from './constraints.ts';
import { REPO_ROOT } from './content.ts';
import { contestCharacter, type ContestMode } from './model.ts';

export const TAS_OUT_DIR = join(REPO_ROOT, 'packages', 'tools', 'tas-out');
export const CONTESTS_FILE = join(REPO_ROOT, 'packages', 'content', 'bosses', 'contests.json');

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
  /** Presses whose one-step jitter breaks the run (should be empty). */
  fragile: number[];
  worstLossMs: number;
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
  levels: ContestLevel[];
}

export function runPath(levelId: number, mode: ContestMode): string {
  return join(TAS_OUT_DIR, `${levelId}-${mode}.json`);
}

export function readRun(levelId: number, mode: ContestMode): TasRunFile | null {
  const path = runPath(levelId, mode);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as TasRunFile;
}

export function writeRun(run: TasRunFile): void {
  mkdirSync(TAS_OUT_DIR, { recursive: true });
  writeFileSync(runPath(run.levelId, run.mode), JSON.stringify(run, null, 2) + '\n');
}

export function readContests(): ContestsFile | null {
  if (!existsSync(CONTESTS_FILE)) return null;
  return JSON.parse(readFileSync(CONTESTS_FILE, 'utf8')) as ContestsFile;
}

export function writeContests(file: ContestsFile): void {
  mkdirSync(join(CONTESTS_FILE, '..'), { recursive: true });
  writeFileSync(CONTESTS_FILE, JSON.stringify(file, null, 2) + '\n');
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
