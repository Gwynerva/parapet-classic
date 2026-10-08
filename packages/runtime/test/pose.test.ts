/**
 * How scene objects are drawn: every canvas call of `SceneRenderer.drawObject` for the character
 * in all its keyframes (both facings, the original's skin rules) and for the level art is
 * recorded on a fake context and hashed. The hash pins the drawing down, so the pure pose
 * composition (`Pose.ts`) and the raster of the tools stay pixel-exact with the game.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { skinSwap } from '../src/render/CharacterRenderer.ts';
import { CHARACTER_OBJECT, SceneRenderer, type SpriteSwap } from '../src/render/SceneRenderer.ts';
import { mirrorTransform, SpriteSheet } from '../src/render/SpriteSheet.ts';
import { hasContent, loadScenes } from './helpers/content.ts';

/** A 2D context that writes every call it gets into a log. */
function recordingContext(log: string[]): CanvasRenderingContext2D {
  const ctx = {
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    _fill: '',
    set fillStyle(v: string) {
      this._fill = v;
      log.push(`fill ${v}`);
    },
    get fillStyle(): string {
      return this._fill;
    },
    drawImage: (...a: unknown[]) => log.push(`img ${a.slice(1).join(',')}`),
    transform: (...a: number[]) => log.push(`tr ${a.join(',')}`),
    save: () => log.push('save'),
    restore: () => log.push('restore'),
    fillRect: (...a: number[]) => log.push(`rect ${a.join(',')}`),
    beginPath: () => log.push('path'),
    rect: (...a: number[]) => log.push(`clip ${a.join(',')}`),
    clip: () => log.push('clip'),
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

/** A look-like swap: the near arm and leg take other sprite ids (`SkinLibrary` near parts). */
const nearSwap: SpriteSwap = (id, _t, primitive) =>
  [9, 10, 11, 12, 16, 17, 18].includes(primitive) && id >= 1 && id <= 12 ? 1000 + id : id;

function hash(log: string[]): string {
  return createHash('sha256').update(log.join('\n')).digest('hex').slice(0, 16);
}

describe.skipIf(!hasContent())('scene drawing', () => {
  it('draws the character exactly as before', () => {
    const { scenes, frames } = loadScenes();
    const near = frames.slice();
    for (let id = 1; id <= 12; id++) near[1000 + id] = frames[id];
    const scene = new SceneRenderer(new SpriteSheet({} as CanvasImageSource, near), scenes);
    const obj = scene.getObject(CHARACTER_OBJECT)!;
    const log: string[] = [];
    const ctx = recordingContext(log);
    const swaps: (SpriteSwap | undefined)[] = [undefined, skinSwap(1), skinSwap(0, 76), nearSwap];
    for (const swap of swaps) {
      for (const flip of [false, true]) {
        for (let f = 0; f < obj.frames; f++) {
          const next = (f + 1) % obj.frames;
          scene.drawObject(
            ctx,
            CHARACTER_OBJECT,
            f,
            next,
            (f * 2477) % 65536,
            200,
            150,
            flip,
            swap,
          );
        }
      }
    }
    expect(log.length).toBeGreaterThan(50_000);
    expect(hash(log)).toBe(CHARACTER_HASH);
  });

  it('draws the level art exactly as before', () => {
    const { scenes, frames } = loadScenes();
    const scene = new SceneRenderer(new SpriteSheet({} as CanvasImageSource, frames), scenes);
    scene.setViewport(640, 480);
    const log: string[] = [];
    const ctx = recordingContext(log);
    for (const file of scenes.slice(1)) {
      for (const obj of file.objects) {
        for (const flip of [false, true]) {
          scene.drawObject(ctx, obj.id, 0, Math.min(1, obj.frames - 1), 30000, 320, 240, flip);
        }
      }
    }
    expect(log.length).toBeGreaterThan(1000);
    expect(hash(log)).toBe(LEVEL_ART_HASH);
  });

  it('mirroring turns a rotation into a reflection and back', () => {
    for (let t = 0; t < 8; t++) {
      expect(mirrorTransform(t) >= 4).toBe(t < 4);
      expect(mirrorTransform(mirrorTransform(t))).toBe(t);
    }
  });
});

const CHARACTER_HASH = 'f51ca7c6dcfa1a0d';
const LEVEL_ART_HASH = 'e6f69c868a229139';
