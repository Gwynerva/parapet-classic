/** The generated game data a TAS run needs, read from packages/content in Node. */
import { join } from 'node:path';
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
import { buildClipTable } from '@parapet/runtime/anim/Animator.ts';
import { EXTRACTED_DIR, readJson } from '../files.ts';

function extracted<T>(rel: string): T {
  return readJson<T>(join(EXTRACTED_DIR, rel));
}

export interface GameData {
  moves: MoveTableData;
  tables: PhysicsTables;
  missions: MissionInfo[];
}

let cached: GameData | null = null;

export function loadGameData(): GameData {
  cached ??= {
    moves: extracted<MoveTableData>('moves.json'),
    tables: extracted<PhysicsTables>('tables.json'),
    missions: extracted<{ levels: MissionInfo[] }>('missions.json').levels,
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
    level: extracted<LevelData>(`levels/${levelId}.json`),
    mission,
    moves: data.moves,
    tables: data.tables,
    rival: null,
  };
}

export function levelHash(levelId: number): ContentHash {
  return runContentHash(levelContent(levelId));
}

let clipTable: Int16Array | null = null;

/** The animation clip table (`short_h`) the renderer plays the moves with, for the glimpses. */
export function loadClipTable(): Int16Array {
  clipTable ??= buildClipTable(extracted<{ clips: Record<string, number[]> }>('anims.json').clips);
  return clipTable;
}
