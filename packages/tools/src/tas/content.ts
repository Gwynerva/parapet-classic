/** The generated game data a TAS run needs, read from packages/content in Node. */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEVEL_COUNT,
  runContentHash,
  type ContentHash,
  type LevelData,
  type MissionInfo,
  type MoveTableData,
  type PhysicsTables,
  type RunContent,
} from '@parapet/sim';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
export const GENERATED_DIR = join(REPO_ROOT, 'packages', 'content', 'playman', 'extracted');

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(GENERATED_DIR, rel), 'utf8')) as T;
}

export interface GameData {
  moves: MoveTableData;
  tables: PhysicsTables;
  missions: MissionInfo[];
}

let cached: GameData | null = null;

export function loadGameData(): GameData {
  cached ??= {
    moves: readJson<MoveTableData>('moves.json'),
    tables: readJson<PhysicsTables>('tables.json'),
    missions: readJson<{ levels: MissionInfo[] }>('missions.json').levels,
  };
  return cached;
}

/** What one level is run with (no rival: Gwynerva's contests never have one). */
export function levelContent(levelId: number): RunContent {
  if (!Number.isInteger(levelId) || levelId < 0 || levelId >= LEVEL_COUNT) {
    throw new Error(`level ${levelId} does not exist`);
  }
  const data = loadGameData();
  const mission = data.missions[levelId];
  if (!mission) throw new Error(`level ${levelId} has no mission data`);
  return {
    level: readJson<LevelData>(`levels/${levelId}.json`),
    mission,
    moves: data.moves,
    tables: data.tables,
    rival: null,
  };
}

export function levelHash(levelId: number): ContentHash {
  return runContentHash(levelContent(levelId));
}
