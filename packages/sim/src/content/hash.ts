/**
 * Content hashes carried by replays. A leaderboard entry is only comparable with runs made on
 * the same level data, move table and physics tables; the hashes let the server refuse a
 * replay recorded on edited content instead of ranking it. FNV-1a over canonical JSON (keys
 * sorted) so the value does not depend on the serialiser or the key order of a file.
 */
import type { LevelData } from '../level/level.ts';
import type { MoveTableData } from '../runner/moves.ts';
import type { PhysicsTables } from '../tables.ts';

export interface ContentHash {
  level: number;
  moves: number;
  tables: number;
}

/** 32-bit FNV-1a over the UTF-16 code units of `text`. */
export function fnv1a(text: string, seed = 2166136261): number {
  let h = seed;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** JSON with object keys sorted at every level, so equal data gives equal text. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((k) => record[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function hashJson(value: unknown): number {
  return fnv1a(canonicalJson(value));
}

/** Hash of what the simulation reads from a level: size, tiles and the mission sections. */
export function hashLevel(level: LevelData): number {
  return hashJson({
    width: level.width,
    height: level.height,
    tiles: level.tiles,
    missions: level.missions,
  });
}

export function hashMoves(moves: MoveTableData): number {
  return hashJson(moves.states);
}

export function hashTables(tables: PhysicsTables): number {
  return hashJson(tables);
}

export function contentHashes(
  level: LevelData,
  moves: MoveTableData,
  tables: PhysicsTables,
): ContentHash {
  return { level: hashLevel(level), moves: hashMoves(moves), tables: hashTables(tables) };
}

export function sameContentHash(a: ContentHash, b: ContentHash): boolean {
  return a.level === b.level && a.moves === b.moves && a.tables === b.tables;
}
