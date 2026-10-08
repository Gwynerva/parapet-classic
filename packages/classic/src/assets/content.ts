/**
 * Typed loaders for the generated game content (`packages/content/generated`, produced by
 * `@parapet/tools` from the original jar). JSON is bundled by Vite through the `@playman`
 * alias; the sprite atlas is loaded as an image.
 */
import animsJson from '@playman/anims.json';
import atlasJson from '@playman/atlas.json';
import atlasUrl from '@playman/atlas.png';
import missionsJson from '@playman/missions.json';
import movesJson from '@playman/moves.json';
import stringsJson from '@playman/strings/ru.json';
import tablesJson from '@playman/tables.json';

import type { LevelData, MoveTableData, PhysicsTables, RivalRecording } from '@parapet/sim';
import type {
  AtlasFrame,
  AtlasData,
  Atlas,
  PrimitiveKind,
  ScenePrimitive,
  SceneObject,
  SceneFile,
  AnimData,
  MissionGoal,
  MissionLevel,
  MissionsData,
  GameContent,
} from '@parapet/runtime/content/types.ts';
export type {
  AtlasFrame,
  AtlasData,
  Atlas,
  PrimitiveKind,
  ScenePrimitive,
  SceneObject,
  SceneFile,
  AnimData,
  MissionGoal,
  MissionLevel,
  MissionsData,
  GameContent,
} from '@parapet/runtime/content/types.ts';

// ---------------------------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------------------------

const sceneModules = import.meta.glob('@playman/scenes/*.json', { eager: true, import: 'default' });
const levelModules = import.meta.glob('@playman/levels/*.json', { eager: true, import: 'default' });
const rivalModules = import.meta.glob('@playman/rivals/*.json', { eager: true, import: 'default' });
const musicModules = import.meta.glob('@playman/music/*.mid', {
  eager: true,
  query: '?url',
  import: 'default',
});

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`failed to load ${url}`));
    image.src = url;
  });
}

function atlasFrames(data: AtlasData): (AtlasFrame | undefined)[] {
  const frames: (AtlasFrame | undefined)[] = [];
  for (const [id, frame] of Object.entries(data.frames)) {
    frames[Number(id)] = frame;
  }
  return frames;
}

let cached: Promise<GameContent> | null = null;

/** Load (once) every piece of generated content the client needs. */
export function loadContent(): Promise<GameContent> {
  if (!cached) {
    cached = load();
  }
  return cached;
}

async function load(): Promise<GameContent> {
  const atlasData = atlasJson as AtlasData;
  const image = await loadImage(atlasUrl);
  if ('decode' in image) {
    try {
      await image.decode();
    } catch {
      // Some browsers reject decode() for already-complete images; the load event suffices.
    }
  }

  const scenes = new Map<number, SceneFile>();
  for (const mod of Object.values(sceneModules)) {
    const scene = mod as SceneFile;
    scenes.set(scene.file, scene);
  }

  const levels: LevelData[] = [];
  for (const mod of Object.values(levelModules)) {
    const level = mod as LevelData;
    levels[level.id] = level;
  }

  const rivals = new Map<number, RivalRecording>();
  for (const mod of Object.values(rivalModules)) {
    const rival = mod as RivalRecording;
    rivals.set(rival.level, rival);
  }

  const music = new Map<number, string>();
  for (const [path, url] of Object.entries(musicModules)) {
    const id = Number(/(\d+)\.mid$/.exec(path)?.[1]);
    if (Number.isInteger(id) && typeof url === 'string') music.set(id, url);
  }

  return {
    moves: movesJson as MoveTableData,
    tables: tablesJson as PhysicsTables,
    anims: animsJson as AnimData,
    atlas: {
      image,
      width: atlasData.width,
      height: atlasData.height,
      frames: atlasFrames(atlasData),
    },
    scenes,
    levels,
    missions: missionsJson as MissionsData,
    rivals,
    strings: stringsJson as string[],
    music,
  };
}
