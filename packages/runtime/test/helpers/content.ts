/**
 * The extracted game data for runtime tests (Node only): the simulation's loaders, plus the
 * animation clips and the scenes the renderers need.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AtlasData, AtlasFrame, SceneFile } from '../../src/content/types.ts';
import { CONTENT_DIR } from '../../../sim/test/helpers/content.ts';

export {
  CONTENT_DIR,
  hasContent,
  isGoldenTrace,
  loadLevel,
  loadMissions,
  loadMoves,
  loadRival,
  loadTables,
  readGolden,
} from '../../../sim/test/helpers/content.ts';

export const GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'sim',
  'test',
  'golden',
);

export const loadAnims = (): { clips: Record<string, number[]> } =>
  JSON.parse(readFileSync(join(CONTENT_DIR, 'anims.json'), 'utf8')) as {
    clips: Record<string, number[]>;
  };

/** The scene files k0..k13 and the atlas frames by sprite id. */
export function loadScenes(): { scenes: SceneFile[]; frames: (AtlasFrame | undefined)[] } {
  const atlas = JSON.parse(readFileSync(join(CONTENT_DIR, 'atlas.json'), 'utf8')) as AtlasData;
  const frames: (AtlasFrame | undefined)[] = [];
  for (const [id, f] of Object.entries(atlas.frames)) frames[Number(id)] = f;
  const scenes: SceneFile[] = [];
  for (let k = 0; k <= 13; k++) {
    scenes.push(JSON.parse(readFileSync(join(CONTENT_DIR, 'scenes', `k${k}.json`), 'utf8')));
  }
  return { scenes, frames };
}
