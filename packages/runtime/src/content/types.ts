/**
 * Shapes of the generated content files (`packages/content/playman/extracted`). Loaders live
 * in the apps; the runtime only needs the types.
 */
import type {
  LevelData,
  MissionInfo,
  MoveTableData,
  PhysicsTables,
  RivalRecording,
} from '@parapet/sim';

// ---------------------------------------------------------------------------------------------
// JSON shapes
// ---------------------------------------------------------------------------------------------

/** One sprite's rectangle inside `atlas.png`. */
export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Shape of `atlas.json`. */
export interface AtlasData {
  width: number;
  height: number;
  frames: Record<string, AtlasFrame>;
}

export interface Atlas {
  image: HTMLImageElement;
  width: number;
  height: number;
  /** Indexed by sprite id (0..313); missing ids are `undefined`. */
  frames: readonly (AtlasFrame | undefined)[];
}

export type PrimitiveKind = 'rect' | 'sprite' | 'nested' | 'tiled';

/**
 * One primitive of a composite scene object (k-file). Every present parameter array has
 * exactly `frames` entries (shared values are expanded by the extractor); absent parameters are
 * empty arrays. `value` is an RGB565 colour for rects, `(spriteId << 3) | transform` for sprites
 * and tiles, and a nested object id `(file << 11) | index` for nested objects.
 */
export interface ScenePrimitive {
  /** 0 rect, 1 sprite, 2 nested, 3 tiled. */
  type: number;
  kind: PrimitiveKind;
  hidden: boolean;
  /** Body-part swap allowed (skins, ghosts). */
  swapParts: boolean;
  paramCount: number;
  x: number[];
  y: number[];
  value: number[];
  w: number[];
  h: number[];
}

export interface SceneObject {
  /** `(file << 11) | index`. */
  id: number;
  index: number;
  frames: number;
  pivotX: number;
  pivotY: number;
  width: number;
  height: number;
  primitives: ScenePrimitive[];
}

/** Shape of `scenes/k<N>.json`. */
export interface SceneFile {
  file: number;
  objects: SceneObject[];
}

/** Shape of `anims.json`. */
export interface AnimData {
  /** Clip offset (the original `short_h` index of the count word) → keyframe ids. */
  clips: Record<string, number[]>;
  /** Moves-menu demos: clip offset, frame count, description string. */
  demos: { clipOffset: number; frameCount: number; stringId: number }[];
  /** Per keyframe: minX, minY, maxX, maxY of the character. */
  keyframeBounds: number[][];
}

export type { MissionGoal } from '@parapet/sim';

/** One entry of `missions.json` `levels[]` (12 × 28 ints of the mission table, decoded). */
export interface MissionLevel extends MissionInfo {
  nameStringId: number;
  mapBlob: number;
  missionCount: number;
  rivalBlob: number;
  unlockThreshold: number;
  /** k-file holding the level art. */
  backgroundFile: number;
  backgroundLength: number;
  /** Object id of the level art (`(backgroundFile << 11) | index`). */
  backgroundSceneId: number;
  /** Character id of the rival ghost / coach. */
  rivalCharacter: number;
}

export interface MissionsData {
  levels: MissionLevel[];
}

export interface GameContent {
  moves: MoveTableData;
  tables: PhysicsTables;
  anims: AnimData;
  atlas: Atlas;
  /** Scene files by file number (k0 → 0 ... k13 → 13). */
  scenes: Map<number, SceneFile>;
  /** Level tile maps, indexed by level id. */
  levels: LevelData[];
  missions: MissionsData;
  /** Original rival recordings by level id. */
  rivals: Map<number, RivalRecording>;
  /** The 205 original (Russian) strings. */
  strings: string[];
  /** URLs of the bundled MIDI tracks by track id (0..13), fetched on demand. */
  music: Map<number, string>;
}

/** What the level renderer needs from the content: the art object per level and the theme table. */
export interface LevelArtContent {
  missions: { levels: { backgroundSceneId: number }[] };
  tables: { M: number[] };
}
