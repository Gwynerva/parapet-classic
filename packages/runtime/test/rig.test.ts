/**
 * The character skeleton as body parts (`render/Rig.ts`) and the raster of the tools
 * (`render/Raster.ts`): every sprite of the character has a family, the body's own mirroring is
 * decided per keyframe, the anchors sit on the body, and the raster turns sprites like the
 * canvas does.
 */
import { describe, expect, it } from 'vitest';
import { composePose, poseAnchors, type DrawCommand } from '../src/render/Pose.ts';
import { blitSprite, newImage } from '../src/render/Raster.ts';
import {
  bodyMirror,
  CHARACTER_SPRITES,
  emptyAnchors,
  Family,
  familyOf,
  partSide,
  rotationIndex,
  Side,
} from '../src/render/Rig.ts';
import { isRotated, transformPixel } from '../src/render/SpriteSheet.ts';
import { hasContent, loadScenes } from './helpers/content.ts';

/** Destination of source pixel (sx, sy) in the w × h box, as the original's pixel loops. */
function reference(t: number, sx: number, sy: number, w: number, h: number): [number, number] {
  switch (t) {
    case 1:
      return [w - 1 - sy, sx];
    case 2:
      return [w - 1 - sx, h - 1 - sy];
    case 3:
      return [sy, h - 1 - sx];
    case 4:
      return [w - 1 - sx, sy];
    case 5:
      return [sx, h - 1 - sy];
    case 6:
      return [sy, sx];
    case 7:
      return [w - 1 - sy, h - 1 - sx];
    default:
      return [sx, sy];
  }
}

describe('raster', () => {
  it('turns pixels like the original for every transform', () => {
    for (let t = 0; t < 8; t++) {
      const fw = 5;
      const fh = 3;
      const w = isRotated(t) ? fh : fw;
      const h = isRotated(t) ? fw : fh;
      for (let sy = 0; sy < fh; sy++) {
        for (let sx = 0; sx < fw; sx++) {
          expect(transformPixel(t, sx, sy, w, h)).toEqual(reference(t, sx, sy, w, h));
        }
      }
    }
  });

  it('blits a turned sprite', () => {
    const src = newImage(2, 1);
    src.data.set([255, 0, 0, 255, 0, 0, 255, 255]);
    const dst = newImage(1, 2);
    blitSprite(dst, { image: src, frames: [{ x: 0, y: 0, w: 2, h: 1 }] }, 0, 0, 0, 6);
    expect(Array.from(dst.data)).toEqual([255, 0, 0, 255, 0, 0, 255, 255]);
  });
});

describe('rig', () => {
  it('knows the families of the character sprites', () => {
    expect(familyOf(25)).toBe(Family.HEAD);
    expect(familyOf(90)).toBe(Family.HEAD);
    expect(familyOf(77)).toBe(Family.FACE);
    expect(familyOf(130)).toBe(Family.TORSO);
    expect(familyOf(70)).toBe(-1);
    expect(rotationIndex(28)).toBe(3);
    expect(rotationIndex(89)).toBe(2);
    expect(CHARACTER_SPRITES).toContain(136);
    // A limb in its slot; one drawn by a middle slot keeps its sprite's side.
    expect(partSide(17, 17)).toBe(Side.NEAR);
    expect(partSide(5, 0)).toBe(Side.FAR);
    expect(partSide(53, 7)).toBe(Side.NEAR);
    expect(partSide(2, 13)).toBe(Side.FAR);
    expect(partSide(25, 13)).toBe(Side.MID);
  });

  it.skipIf(!hasContent())('covers every sprite of the character object', () => {
    const obj = loadScenes().scenes[0]!.objects[0]!;
    for (const p of obj.primitives) {
      for (const v of p.value) {
        if (v === -1) continue;
        expect(familyOf(v >> 3), `sprite ${v >> 3}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it.skipIf(!hasContent())(
    'tells the turned keyframes by the head, the torso and the chest',
    () => {
      const obj = loadScenes().scenes[0]!.objects[0]!;
      const mirror = bodyMirror(obj);
      const turned = Array.from(mirror).filter((m) => m === 1).length;
      expect(turned).toBeGreaterThan(20);
      expect(turned).toBeLessThan(80);
      // The run cycle is drawn upright.
      for (let f = 0; f < 8; f++) expect(mirror[f]).toBe(0);
    },
  );

  it.skipIf(!hasContent())('puts the anchors on the body', () => {
    const { scenes, frames } = loadScenes();
    const obj = scenes[0]!.objects[0]!;
    const sizes = {
      width: (id: number) => frames[id]?.w ?? 0,
      height: (id: number) => frames[id]?.h ?? 0,
    };
    const out: DrawCommand[] = [];
    const anchors = emptyAnchors();
    for (const flip of [false, true]) {
      for (let f = 0; f < obj.frames; f += 7) {
        const n = composePose(obj, sizes, f, f, 0, flip, undefined, out);
        poseAnchors(out, n, obj, sizes, flip, anchors);
        const b = anchors.box;
        for (const p of [anchors.head, anchors.chest, anchors.hips, anchors.footNear]) {
          expect(p.x, `frame ${f}`).toBeGreaterThanOrEqual(b.x - 1);
          expect(p.x, `frame ${f}`).toBeLessThanOrEqual(b.x + b.w + 1);
          expect(p.y, `frame ${f}`).toBeGreaterThanOrEqual(b.y - 1);
          expect(p.y, `frame ${f}`).toBeLessThanOrEqual(b.y + b.h + 1);
        }
      }
    }
    // Standing upright (the run cycle), the head is above the feet.
    const n = composePose(obj, sizes, 0, 0, 0, false, undefined, out);
    poseAnchors(out, n, obj, sizes, false, anchors);
    expect(anchors.head.y).toBeLessThan(anchors.footNear.y - 30);
  });
});
