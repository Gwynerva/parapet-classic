/**
 * Files `k0..k13` - composite vector art (parser `void_g` d.java line 3020, drawing `b(8 ints)`
 * line 3218). A file is an i16 array: S[0] = object count, S[1 + i] = offset of object i.
 * Object id = (file << 11) | index.
 *
 * Object: [frames, pivotX, pivotY, w, h], then primitives until a 0 header:
 *   hdr: low 8 bits = parameter count; bits 8-13 = type; 0x4000 hidden; 0x8000 swap body parts
 *   if frames > 1: a mask word; bit i set = parameter i has one value per frame, else one shared value
 *   parameters: [0] x, [1] y, [2] colour RGB565 | sprite (id << 3) | transform | nested object id,
 *               [3] w, [4] h
 * Types: 0 filled rectangle, 1 sprite drawn centred (-1 = skip), 2 nested object (frame 0,
 * top-left), 3 sprite tiled across the w x h rectangle. Sprites and nested objects carry
 * 3 parameters, rectangles and tiles 5.
 */
import { readI16Array } from './binary.ts';
import { at } from './util.ts';

export const SCENE_FILE_COUNT = 14;
export const SCENE_MAX_PARAMS = 5;

export type PrimitiveType = 0 | 1 | 2 | 3;
export type PrimitiveKind = 'rect' | 'sprite' | 'nested' | 'tiled';
export const PRIMITIVE_KINDS: readonly PrimitiveKind[] = ['rect', 'sprite', 'nested', 'tiled'];

export interface ScenePrimitive {
  type: PrimitiveType;
  kind: PrimitiveKind;
  hidden: boolean;
  swapParts: boolean;
  paramCount: number;
  /** Per-frame values (shared values are expanded); empty when the parameter is absent. */
  x: number[];
  y: number[];
  value: number[];
  w: number[];
  h: number[];
}

export interface SceneObject {
  id: number;
  index: number;
  frames: number;
  pivotX: number;
  pivotY: number;
  width: number;
  height: number;
  primitives: ScenePrimitive[];
}

export interface Scene {
  file: number;
  objects: SceneObject[];
  /** Number of i16 words in the file. */
  length: number;
  /** Number of distinct words covered by the object table and the objects. */
  consumed: number;
}

export function sceneObjectId(file: number, index: number): number {
  return (file << 11) | index;
}

export function decodeScene(bytes: Uint8Array, file: number): Scene {
  const label = `k${file}`;
  const s = readI16Array(bytes, label);
  const covered = new Uint8Array(s.length);
  const count = at(s, 0, label);
  covered.fill(1, 0, 1 + count);
  const objects: SceneObject[] = [];
  for (let index = 0; index < count; index++) {
    const offset = at(s, 1 + index, label);
    let p = offset;
    const next = (): number => at(s, p++, label);
    const frames = next();
    const pivotX = next();
    const pivotY = next();
    const width = next();
    const height = next();
    if (frames < 1) throw new Error(`${label}: object ${index} has ${frames} frames`);
    const primitives: ScenePrimitive[] = [];
    for (;;) {
      const hdr = next();
      if (hdr === 0) break;
      const paramCount = hdr & 0xff;
      const type = (hdr >> 8) & 0x3f;
      if (type > 3) throw new Error(`${label}: object ${index} has a primitive of type ${type}`);
      if (paramCount > SCENE_MAX_PARAMS) {
        throw new Error(`${label}: object ${index} has a primitive with ${paramCount} parameters`);
      }
      const mask = frames > 1 ? next() : 0;
      const params: number[][] = [];
      for (let q = 0; q < paramCount; q++) {
        if ((mask >> q) & 1) {
          const values: number[] = [];
          for (let f = 0; f < frames; f++) values.push(next());
          params.push(values);
        } else {
          params.push(new Array<number>(frames).fill(next()));
        }
      }
      primitives.push({
        type: type as PrimitiveType,
        kind: at(PRIMITIVE_KINDS, type),
        hidden: (hdr & 0x4000) !== 0,
        swapParts: (hdr & 0x8000) !== 0,
        paramCount,
        x: params[0] ?? [],
        y: params[1] ?? [],
        value: params[2] ?? [],
        w: params[3] ?? [],
        h: params[4] ?? [],
      });
    }
    covered.fill(1, offset, p);
    objects.push({
      id: sceneObjectId(file, index),
      index,
      frames,
      pivotX,
      pivotY,
      width,
      height,
      primitives,
    });
  }
  let consumed = 0;
  for (const c of covered) consumed += c;
  return { file, objects, length: s.length, consumed };
}
