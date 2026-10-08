/** Loads generated game data from packages/content for tests (Node only). */
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { LevelData } from '../../src/level/level.ts';
import type { MoveTableData } from '../../src/runner/moves.ts';
import type { PhysicsTables } from '../../src/tables.ts';
import type { RivalRecording } from '../../src/replay.ts';
import type { MissionInfo } from '../../src/run.ts';

export type { MissionInfo };

const here = dirname(fileURLToPath(import.meta.url));
export const CONTENT_DIR = join(here, '..', '..', '..', 'content', 'playman', 'extracted');

export function hasContent(): boolean {
  return existsSync(join(CONTENT_DIR, 'moves.json'));
}

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(CONTENT_DIR, rel), 'utf8')) as T;
}

export function loadMoves(): MoveTableData {
  return readJson<MoveTableData>('moves.json');
}

export function loadTables(): PhysicsTables {
  return readJson<PhysicsTables>('tables.json');
}

export function loadLevel(id: number): LevelData {
  return readJson<LevelData>(`levels/${id}.json`);
}

export function loadRival(level: number): RivalRecording {
  return readJson<RivalRecording>(`rivals/${level}.json`);
}

export function loadMissions(): { levels: MissionInfo[] } {
  return readJson<{ levels: MissionInfo[] }>('missions.json');
}

/** Golden trace files are stored gzipped (`.jsonl.gz`); plain `.jsonl` is accepted too. */
export function isGoldenTrace(file: string): boolean {
  return file.endsWith('.jsonl') || file.endsWith('.jsonl.gz');
}

/** Reads a golden trace as text, inflating it when it is gzipped. */
export function readGolden(file: string): string {
  const raw = readFileSync(file);
  return file.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
}
