/** The Lab's sources read from the repository's files (Node). */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LevelData, MoveTableData, PhysicsTables, RivalRecording } from '@parapet/sim';
import type {
  AnimData,
  AtlasData,
  AtlasFrame,
  MissionsData,
  SceneFile,
} from '@parapet/runtime/content/types.ts';
import type { MoveDemoData } from '@parapet/runtime/moves/MoveDemo.ts';
import { Lab } from '@parapet/lab/lab.ts';
import { CONTENT_DIR, EXTRACTED_DIR, loadRasterFont, readJson } from '../files.ts';
import { decodePng } from '../png.ts';

let cached: Lab | null = null;

export function loadLab(): Lab {
  cached ??= new Lab({
    moves: extracted<MoveTableData>('moves.json'),
    tables: extracted<PhysicsTables>('tables.json'),
    anims: extracted<AnimData>('anims.json'),
    scenes: readdirSync(join(EXTRACTED_DIR, 'scenes')).map((f) =>
      extracted<SceneFile>(`scenes/${f}`),
    ),
    levels: numbered<LevelData>('levels').map(([, level]) => level),
    missions: extracted<MissionsData>('missions.json'),
    rivals: new Map(numbered<RivalRecording>('rivals').map(([, r]) => [r.level, r])),
    atlas: loadAtlas(),
    fonts: { small: loadRasterFont('text-12'), text: loadRasterFont('text-16') },
    demos: readJson<{ demos: MoveDemoData[] }>(join(CONTENT_DIR, 'moves', 'demos.json')).demos,
    levelNames: levelNames(),
  });
  return cached;
}

/** The levels' English names (`i18n/en/levels.json`). */
function levelNames(): string[] {
  const keys = readJson<Record<string, string>>(join(CONTENT_DIR, 'i18n', 'en', 'levels.json'));
  const out: string[] = [];
  for (const [key, name] of Object.entries(keys)) {
    const id = /^level\.names\.(\d+)$/.exec(key)?.[1];
    if (id !== undefined) out[Number(id)] = name;
  }
  return out;
}

function extracted<T>(rel: string): T {
  return readJson<T>(join(EXTRACTED_DIR, rel));
}

/** The files `<n>.json` of a folder, by number. */
function numbered<T>(dir: string): [number, T][] {
  return readdirSync(join(EXTRACTED_DIR, dir))
    .map((f) => [Number(/^(\d+)\.json$/.exec(f)?.[1]), f] as const)
    .filter(([n]) => Number.isInteger(n))
    .sort((a, b) => a[0] - b[0])
    .map(([n, f]) => [n, extracted<T>(`${dir}/${f}`)]);
}

function loadAtlas(): Lab['atlas'] {
  const png = decodePng(new Uint8Array(readFileSync(join(EXTRACTED_DIR, 'atlas.png'))));
  const data = extracted<AtlasData>('atlas.json');
  const frames: (AtlasFrame | undefined)[] = [];
  for (const [id, f] of Object.entries(data.frames)) frames[Number(id)] = f;
  return { image: { width: png.width, height: png.height, data: png.rgba }, frames };
}
