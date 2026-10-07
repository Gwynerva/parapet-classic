import { describe, expect, it } from 'vitest';
import { decodeScene, SCENE_FILE_COUNT, sceneObjectId, type Scene } from '../src/decodeScenes.ts';
import { jar } from './helpers.ts';

let cache: Scene[] | undefined;
function scenes(): Scene[] {
  if (!cache) {
    cache = [];
    for (let n = 0; n < SCENE_FILE_COUNT; n++) cache.push(decodeScene(jar().read(`k${n}`), n));
  }
  return cache;
}

describe('composite scenes (files k0..k13)', () => {
  it('consumes every word of every file', () => {
    for (const scene of scenes()) {
      expect(scene.consumed).toBe(scene.length);
      expect(scene.objects.length).toBeGreaterThan(0);
    }
  });

  it('k0 is the character: 463 keyframes, pivot (50, 76), 134 x 142, 19 body-part sprites', () => {
    const character = scenes()[0]?.objects[0];
    expect(scenes()[0]?.objects.length).toBe(1);
    expect(character).toMatchObject({
      id: 0,
      frames: 463,
      pivotX: 50,
      pivotY: 76,
      width: 134,
      height: 142,
    });
    expect(character?.primitives.length).toBe(19);
    for (const primitive of character?.primitives ?? []) {
      expect(primitive.kind).toBe('sprite');
      expect(primitive.swapParts).toBe(true);
      expect(primitive.x.length).toBe(463);
      expect(primitive.y.length).toBe(463);
      expect(primitive.value.length).toBe(463);
    }
  });

  it('k1 holds 23 single-frame props with ids 2048..2070', () => {
    const props = scenes()[1]?.objects ?? [];
    expect(props.length).toBe(23);
    props.forEach((prop, i) => {
      expect(prop.id).toBe(sceneObjectId(1, i));
      expect(prop.id).toBe(2048 + i);
      expect(prop.frames).toBe(1);
    });
  });

  it('backgrounds have 1, 3 or 5 frames', () => {
    for (const scene of scenes().slice(2)) {
      for (const object of scene.objects) expect([1, 3, 5]).toContain(object.frames);
    }
  });

  it('expands every parameter to one value per frame and keeps references in range', () => {
    // Nested object ids may point into another file: the backgrounds reuse the k1 props.
    const ids = new Set(scenes().flatMap((scene) => scene.objects.map((o) => o.id)));
    for (const scene of scenes()) {
      for (const object of scene.objects) {
        for (const primitive of object.primitives) {
          const arrays = [primitive.x, primitive.y, primitive.value, primitive.w, primitive.h];
          arrays
            .slice(0, primitive.paramCount)
            .forEach((a) => expect(a.length).toBe(object.frames));
          arrays.slice(primitive.paramCount).forEach((a) => expect(a.length).toBe(0));
          if (primitive.kind === 'sprite' || primitive.kind === 'tiled') {
            expect(primitive.paramCount).toBe(primitive.kind === 'sprite' ? 3 : 5);
            for (const v of primitive.value) {
              if (v === -1) continue;
              expect(v >> 3).toBeGreaterThanOrEqual(0);
              expect(v >> 3).toBeLessThanOrEqual(313);
            }
          } else if (primitive.kind === 'nested') {
            expect(primitive.paramCount).toBe(3);
            for (const v of primitive.value) expect(ids.has(v)).toBe(true);
          } else {
            expect(primitive.paramCount).toBe(5);
            for (const v of primitive.value) {
              expect(v).toBeGreaterThanOrEqual(-32768);
              expect(v).toBeLessThanOrEqual(32767);
            }
          }
        }
      }
    }
  });
});
