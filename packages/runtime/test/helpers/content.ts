/** Loads generated game data from packages/content-classic for runtime tests (Node only). */
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { LevelData, MoveTableData, PhysicsTables, RivalRecording } from '@parapet/sim';

const here = dirname(fileURLToPath(import.meta.url));
export const CONTENT_DIR = join(here, '..', '..', '..', 'content-classic', 'generated');
export const GOLDEN_DIR = join(here, '..', '..', '..', 'sim', 'test', 'golden');

export function hasContent(): boolean {
  return existsSync(join(CONTENT_DIR, 'moves.json'));
}

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(CONTENT_DIR, rel), 'utf8')) as T;
}

export const loadMoves = (): MoveTableData => readJson<MoveTableData>('moves.json');
export const loadTables = (): PhysicsTables => readJson<PhysicsTables>('tables.json');
export const loadLevel = (id: number): LevelData => readJson<LevelData>(`levels/${id}.json`);
export const loadRival = (level: number): RivalRecording =>
  readJson<RivalRecording>(`rivals/${level}.json`);
export const loadAnims = (): { clips: Record<string, number[]> } =>
  readJson<{ clips: Record<string, number[]> }>('anims.json');
export const loadMissions = (): { levels: { rivalStartDelay: number }[] } =>
  readJson<{ levels: { rivalStartDelay: number }[] }>('missions.json');

/** Golden trace files are stored gzipped (`.jsonl.gz`); plain `.jsonl` is accepted too. */
export function isGoldenTrace(file: string): boolean {
  return file.endsWith('.jsonl') || file.endsWith('.jsonl.gz');
}

/** Reads a golden trace as text, inflating it when it is gzipped. */
export function readGolden(file: string): string {
  const raw = readFileSync(file);
  return file.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
}
