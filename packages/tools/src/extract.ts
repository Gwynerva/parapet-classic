/**
 * Decodes the original jar into `packages/content-classic/generated`. Pure orchestration: every format
 * lives in its own decode module.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
  BLOB,
  decodeAnims,
  decodeKeyframeBounds,
  decodeLevelMap,
  decodeMissionTable,
  decodeMoveDemos,
  decodeMoves,
  decodeRival,
  decodeTables,
  readBlob,
  readBlobInts,
  readBlobShorts,
} from './decodeBlobs.ts';
import { decodeIndex, SPRITE_FILE_COUNT, STRING_GROUP_OFFSET_BASE } from './decodeIndex.ts';
import { decodePalettes } from './decodePalettes.ts';
import { decodeScene, SCENE_FILE_COUNT } from './decodeScenes.ts';
import { decodeSprites, spriteToRgba } from './decodeSprites.ts';
import { cleanMenuIcon, MENU_ICON_IDS } from './cleanSprites.ts';
import { decodeStrings } from './decodeStrings.ts';
import { packAtlas } from './packAtlas.ts';
import { encodePng } from './png.ts';
import { splitMidi } from './splitMidi.ts';
import { at } from './util.ts';
import { ZipArchive } from './zip.ts';

export interface ManifestEntry {
  path: string;
  size: number;
}

export interface ExtractResult {
  jar: string;
  outDir: string;
  files: ManifestEntry[];
  counts: Record<string, number>;
}

export function extract(jarPath: string, outDir: string): ExtractResult {
  const zip = ZipArchive.fromFile(jarPath);
  const files: ManifestEntry[] = [];
  const encoder = new TextEncoder();
  const write = (relativePath: string, content: Uint8Array | string): void => {
    const bytes = typeof content === 'string' ? encoder.encode(content) : content;
    const target = join(outDir, ...relativePath.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    files.push({ path: relativePath, size: bytes.length });
  };
  const writeJson = (relativePath: string, value: unknown): void => {
    write(relativePath, JSON.stringify(value, null, 2) + '\n');
  };
  const counts: Record<string, number> = {};

  // Index
  const index = decodeIndex(zip.read('i'));
  writeJson('index.json', index);

  // Palettes
  const palettes = decodePalettes(zip.read('p'));
  writeJson('palettes.json', palettes);
  counts.palettes = palettes.length;

  // Sprites: one PNG per base image, a sprites.json description and a packed atlas
  const spriteFiles: Uint8Array[] = [];
  for (let g = 0; g < SPRITE_FILE_COUNT; g++) spriteFiles.push(zip.read(`g${g}`));
  const sprites = decodeSprites(spriteFiles);
  const rgbaById = new Map<number, Uint8Array>();
  for (const sprite of sprites) {
    const rgba = spriteToRgba(sprite, palettes);
    if (MENU_ICON_IDS.includes(sprite.id)) cleanMenuIcon(rgba, sprite.w, sprite.h);
    rgbaById.set(sprite.id, rgba);
    write(`sprites/${sprite.id}.png`, encodePng(sprite.w, sprite.h, rgba));
  }
  writeJson('sprites.json', {
    sprites: sprites.map(({ id, file, w, h, paletteIndex, transforms }) => ({
      id,
      file: `g${file}`,
      w,
      h,
      paletteIndex,
      transforms,
    })),
  });
  counts.sprites = sprites.length;

  const layout = packAtlas(sprites.map(({ id, w, h }) => ({ id, w, h })));
  const atlas = new Uint8Array(layout.width * layout.height * 4);
  for (const sprite of sprites) {
    const frame = layout.frames[sprite.id];
    if (!frame) throw new Error(`atlas: sprite ${sprite.id} was not packed`);
    const rgba = rgbaById.get(sprite.id);
    if (!rgba) throw new Error(`atlas: sprite ${sprite.id} has no pixels`);
    const stride = sprite.w * 4;
    for (let y = 0; y < sprite.h; y++) {
      atlas.set(
        rgba.subarray(y * stride, (y + 1) * stride),
        ((frame.y + y) * layout.width + frame.x) * 4,
      );
    }
  }
  write('atlas.png', encodePng(layout.width, layout.height, atlas));
  writeJson('atlas.json', layout);

  // Scenes (composite vector art)
  let sceneObjects = 0;
  for (let n = 0; n < SCENE_FILE_COUNT; n++) {
    const scene = decodeScene(zip.read(`k${n}`), n);
    if (scene.consumed !== scene.length) {
      throw new Error(`k${n}: ${scene.length - scene.consumed} word(s) not covered by any object`);
    }
    writeJson(`scenes/k${n}.json`, { file: scene.file, objects: scene.objects });
    sceneObjects += scene.objects.length;
  }
  counts.scenes = SCENE_FILE_COUNT;
  counts.sceneObjects = sceneObjects;

  // Data blobs
  const bFiles = [zip.read('b0'), zip.read('b1'), zip.read('b2')];
  const moves = decodeMoves(readBlobInts(index, bFiles, BLOB.MOVES));
  writeJson('moves.json', { states: moves.states, rawTransitionLists: moves.rawTransitionLists });
  counts.moveStates = moves.states.length;

  const anims = decodeAnims(readBlobShorts(index, bFiles, BLOB.ANIMS));
  writeJson('anims.json', {
    clips: anims.clips,
    raw: anims.raw,
    demos: decodeMoveDemos(readBlobShorts(index, bFiles, BLOB.MOVE_DEMOS)),
    keyframeBounds: decodeKeyframeBounds(readBlobShorts(index, bFiles, BLOB.KEYFRAME_BOUNDS)),
  });
  counts.animClips = Object.keys(anims.clips).length;

  writeJson('tables.json', decodeTables(index, bFiles));

  const missions = decodeMissionTable(readBlobInts(index, bFiles, BLOB.MISSIONS));
  const levels = missions.levels.map((level) => {
    const map = decodeLevelMap(readBlobShorts(index, bFiles, level.mapBlob));
    writeJson(`levels/${level.id}.json`, {
      id: level.id,
      nameStringId: level.nameStringId,
      width: map.width,
      height: map.height,
      tiles: map.tiles,
      missions: map.missions,
    });
    const rival = decodeRival(readBlob(index, bFiles, level.rivalBlob));
    writeJson(`rivals/${level.id}.json`, { level: level.id, ...rival });
    // The rival's finish time is the Sprint target; keeping it next to the goals saves the
    // consumers from loading the recording just to judge a run.
    return { ...level, rivalTotalTime: rival.totalTime };
  });
  writeJson('missions.json', { levels, raw: missions.raw });
  counts.levels = levels.length;

  // Strings
  const strings = decodeStrings(zip.read('l'), at(index.ints, STRING_GROUP_OFFSET_BASE, 'D'));
  writeJson('strings/ru.json', strings);
  counts.strings = strings.length;

  // Music
  const tracks = splitMidi(zip.read('s'), index);
  for (const track of tracks) write(`music/${track.id}.mid`, track.data);
  writeJson('music.json', {
    tracks: tracks.map(({ id, offset, length, duration }) => ({
      id,
      file: `music/${id}.mid`,
      offset,
      length,
      duration,
      soundType: at(index.soundTypes, 2 + id, 'sound types'),
    })),
  });
  counts.music = tracks.length;

  // Manifest (lists everything written before it)
  writeJson('manifest.json', { jar: basename(jarPath), files: [...files] });
  counts.files = files.length;
  counts.bytes = files.reduce((sum, f) => sum + f.size, 0);
  return { jar: jarPath, outDir, files, counts };
}
