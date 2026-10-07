/**
 * Loads the generated game data (`packages/content-classic/generated`) for run verification. Every file
 * is parsed once and cached: the data is immutable and the sim never mutates it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contentHashes,
  type ContentHash,
  type LevelData,
  type MissionInfo,
  type MoveTableData,
  type PhysicsTables,
  type RivalRecording,
} from '@parapet/sim';
import { LEVEL_COUNT } from '@parapet/protocol';

const here = dirname(fileURLToPath(import.meta.url));
export const CONTENT_DIR = join(here, '..', '..', 'content-classic', 'generated');

const cache = new Map<string, unknown>();

function readJson<T>(rel: string): T {
  const cached = cache.get(rel);
  if (cached !== undefined) return cached as T;
  const parsed = JSON.parse(readFileSync(join(CONTENT_DIR, rel), 'utf8')) as T;
  cache.set(rel, parsed);
  return parsed;
}

/** True when `npm run extract` has produced the generated data. */
export function hasContent(): boolean {
  return existsSync(join(CONTENT_DIR, 'moves.json'));
}

export function loadMoves(): MoveTableData {
  return readJson<MoveTableData>('moves.json');
}

export function loadTables(): PhysicsTables {
  return readJson<PhysicsTables>('tables.json');
}

export function loadMissions(): { levels: MissionInfo[] } {
  return readJson<{ levels: MissionInfo[] }>('missions.json');
}

export function isLevelId(levelId: number): boolean {
  return Number.isInteger(levelId) && levelId >= 0 && levelId < LEVEL_COUNT;
}

export function loadLevel(levelId: number): LevelData {
  if (!isLevelId(levelId)) throw new RangeError(`unknown level ${levelId}`);
  return readJson<LevelData>(`levels/${levelId}.json`);
}

export function loadRival(levelId: number): RivalRecording {
  if (!isLevelId(levelId)) throw new RangeError(`unknown level ${levelId}`);
  return readJson<RivalRecording>(`rivals/${levelId}.json`);
}

const hashCache = new Map<number, ContentHash>();

/** Hashes of the server's copy of a level, the move table and the physics tables. */
export function contentHashFor(levelId: number): ContentHash {
  const cached = hashCache.get(levelId);
  if (cached) return cached;
  const hashes = contentHashes(loadLevel(levelId), loadMoves(), loadTables());
  hashCache.set(levelId, hashes);
  return hashes;
}

/** Everything `createRun` needs for a level, except the mode. */
export interface RunData {
  level: LevelData;
  mission: MissionInfo;
  moves: MoveTableData;
  tables: PhysicsTables;
  rival: RivalRecording | null;
}

export function loadRunData(levelId: number, withRival: boolean): RunData {
  const level = loadLevel(levelId);
  const mission = loadMissions().levels[levelId];
  if (!mission) throw new RangeError(`no mission entry for level ${levelId}`);
  return {
    level,
    mission,
    moves: loadMoves(),
    tables: loadTables(),
    rival: withRival ? loadRival(levelId) : null,
  };
}
