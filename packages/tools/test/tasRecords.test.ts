/**
 * The published machine records (`docs/tas-records`): on the current simulation and level data
 * every file's presses and replay code give the time and the splits the file says.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeReplay, simulateReplay, STEP } from '@parapet/sim';
import { EXTRACTED_DIR, REPO_ROOT } from '../src/files.ts';
import { levelContent } from '../src/tas/content.ts';
import type { TasRunFile } from '../src/tas/files.ts';
import { isCurrent } from '../src/tas/job.ts';
import { parsePresses } from '../src/tas/model.ts';
import { playFull } from '../src/tas/timeline.ts';

const RECORDS_DIR = join(REPO_ROOT, 'docs', 'tas-records');
/** 13:31.74, the README's total. */
const TOTAL_MS = 811740;

describe.skipIf(!existsSync(join(EXTRACTED_DIR, 'moves.json')))('published TAS records', () => {
  const files = readdirSync(RECORDS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const records = files.map(
    (f) => [f, JSON.parse(readFileSync(join(RECORDS_DIR, f), 'utf8')) as TasRunFile] as const,
  );

  it('are the 24 contests, 13:31.74 in all, found on this simulation and level data', () => {
    expect(files).toHaveLength(24);
    let total = 0;
    for (const [name, run] of records) {
      expect(isCurrent(run, run.levelId), name).toBe(true);
      expect(run.fragile, name).toEqual([]);
      expect(run.steps * STEP, name).toBe(run.timeMs);
      total += run.timeMs;
    }
    expect(total).toBe(TOTAL_MS);
  });

  it('re-run from their presses and from their replay codes to the times they say', () => {
    for (const [name, run] of records) {
      const content = levelContent(run.levelId);
      const play = playFull(content, run.mode, parsePresses(run.presses));
      expect(play.time, name).toBe(run.timeMs);
      expect(play.splits, name).toEqual(run.splitsMs);
      const decoded = decodeReplay(run.replay);
      expect(decoded.ok, name).toBe(true);
      if (!decoded.ok) continue;
      const outcome = simulateReplay(decoded.replay, content);
      expect(outcome.finished, name).toBe(true);
      expect(outcome.time, name).toBe(run.timeMs);
      expect(outcome.splits, name).toEqual(run.splitsMs);
    }
  });
});
