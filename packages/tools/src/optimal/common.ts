/**
 * What the optimal-run scripts share: the level and mode on their command line, the record
 * they start from, and where their results go (`tas-out/<folder>/<name>.json`).
 */
import { basename, join } from 'node:path';
import { LEVEL_COUNT } from '@parapet/sim';
import { writeJson } from '../files.ts';
import { readRun, runPath, TAS_OUT_DIR, type TasRunFile } from '../tas/files.ts';
import { isContestMode, type ContestMode } from '../tas/model.ts';

export interface LevelAndMode {
  level: number;
  mode: ContestMode;
}

/**
 * The level and mode a script was given: the first two of `argv` (`process.argv.slice(2)` for
 * a script that takes them first), `defaults` standing in for what is missing. On anything
 * else the script exits with a usage line, rather than searching level NaN.
 */
export function readArgs(
  argv: readonly (string | undefined)[],
  defaults: Partial<LevelAndMode> = {},
): LevelAndMode {
  const [levelArg, modeArg] = argv;
  const level = levelArg === undefined ? defaults.level : Number(levelArg);
  const mode = modeArg === undefined ? defaults.mode : modeArg;
  if (
    level !== undefined &&
    Number.isInteger(level) &&
    level >= 0 &&
    level < LEVEL_COUNT &&
    mode !== undefined &&
    isContestMode(mode)
  ) {
    return { level, mode };
  }
  const script = basename(process.argv[1] ?? 'script.ts');
  console.error(
    `usage: node src/optimal/${script} needs a level (0 to ${LEVEL_COUNT - 1}) and a mode (flags or sprint); the full line is at the top of the script`,
  );
  process.exit(2);
}

/** The record of `level` in `mode` (`tas-out/<level>-<mode>.json`); the script exits without one. */
export function readRecord(level: number, mode: ContestMode): TasRunFile {
  const run = readRun(level, mode);
  if (run) return run;
  console.error(
    `no record at ${runPath(level, mode)}: search one with \`npm run tas -- run --level ${level} --mode ${mode}\` or copy it from docs/tas-records`,
  );
  process.exit(2);
}

/** Where a script's result goes: `tas-out/<folder>/<name>.json`. */
export function resultPath(folder: string, name: string): string {
  return join(TAS_OUT_DIR, folder, `${name}.json`);
}

/** Writes a script's result as JSON to `tas-out/<folder>/<name>.json` and returns the path. */
export function writeResult(folder: string, name: string, data: unknown): string {
  const path = resultPath(folder, name);
  writeJson(path, data);
  return path;
}
