/**
 * Looks drawn as text pixel art (`render/Look.ts`) and their layers over the base atlas
 * (`render/LookSheet.ts`): keys and aliases, inheritance, which picture a part gets for its side
 * and mirroring, attachments and their pivots, cloth, an outfit's own effect.
 */
import { describe, expect, it } from 'vitest';
import type { AtlasFrame } from '../src/content/types.ts';
import {
  expandPartKey,
  lookDataProblems,
  lookProblems,
  parseColor,
  pivotOf,
  resolveLook,
  resolveSingle,
  ribbonChain,
  ribbonProblems,
  type LookData,
} from '../src/render/Look.ts';
import {
  buildLookLayer,
  FALLTHROUGH,
  LAYER_ID_BASE,
  lookSwap,
  slotIndex,
} from '../src/render/LookSheet.ts';
import { AttachLayer, composePose, type DrawCommand } from '../src/render/Pose.ts';
import type { RgbaSheet } from '../src/render/Raster.ts';
import { Side } from '../src/render/Rig.ts';
import { anchorOffsetX, anchorOffsetY, Anchor } from '../src/render/SpriteSheet.ts';
import type { SceneObject } from '../src/content/types.ts';

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];
const GREY = [9, 9, 9, 255];

/**
 * A small atlas: sprite 1 (a forearm, drawn on both sides) is a 2 × 2 square of red, green /
 * grey, clear; sprite 25 (the head) a 2 × 2 grey square.
 */
function atlas(): RgbaSheet {
  const px = [RED, GREEN, GREY, GREY, GREY, [0, 0, 0, 0], GREY, GREY];
  const frames: (AtlasFrame | undefined)[] = [];
  frames[1] = { x: 0, y: 0, w: 2, h: 2 };
  frames[25] = { x: 2, y: 0, w: 2, h: 2 };
  return { image: { width: 4, height: 2, data: Uint8ClampedArray.from(px.flat()) }, frames };
}

function look(patch: Partial<LookData>): LookData {
  return {
    id: 'test',
    base: 0,
    accent: '#ff00aa',
    palette: { a: '#ffffff', b: '#00000080' },
    ...patch,
  };
}

function layerOf(data: LookData) {
  const problems: string[] = [];
  const resolved = resolveSingle(data, problems)!;
  expect(problems).toEqual([]);
  return buildLookLayer(atlas(), resolved);
}

function pixelOf(layer: ReturnType<typeof layerOf>, id: number, x: number, y: number): number[] {
  const f = layer.frames[id]!;
  const o = ((f.y + y) * layer.width + f.x + x) * 4;
  return Array.from(layer.data.subarray(o, o + 4));
}

describe('looks', () => {
  it('parses colours with and without alpha', () => {
    expect(parseColor('#f00')).toEqual([255, 0, 0, 255]);
    expect(parseColor('#00ff0080')).toEqual([0, 255, 0, 128]);
    expect(parseColor('red')).toBeNull();
  });

  it('finds what is wrong with a look', () => {
    const ok = look({});
    expect(lookDataProblems(ok)).toEqual([]);
    expect(lookProblems(resolveSingle(ok)!)).toEqual([]);
    const bad = look({
      id: 'Bad Id',
      base: 12,
      parts: { '200': ['aa'], '1': ['ab', 'a'], '25:near': ['a'] },
      overlays: { '2': ['zz'] },
      recolor: [{ sprites: [150], map: { '#fff': 'nope' } }],
    });
    const problems = lookDataProblems(bad);
    const resolved = resolveSingle(bad, problems)!;
    problems.push(...lookProblems(resolved));
    const text = problems.join('\n');
    expect(text).toMatch(/kebab-case/);
    expect(text).toMatch(/base 12/);
    expect(text).toMatch(/200: not a body part/);
    expect(text).toMatch(/25:near: only arms and legs/);
    expect(text).toMatch(/row 1: 1 wide, not 2/);
    expect(text).toMatch(/overlay 2 row 0: "z" not in palette/);
    expect(text).toMatch(/sprite 150 is not a body part/);
  });

  it('expands left and right into sides and mirrorings', () => {
    expect(expandPartKey('17:right')).toEqual([
      { id: 17, side: 'near', flip: false },
      { id: 17, side: 'far', flip: true },
    ]);
    expect(expandPartKey('17:left')).toEqual([
      { id: 17, side: 'near', flip: true },
      { id: 17, side: 'far', flip: false },
    ]);
    expect(expandPartKey('25:left')).toEqual([{ id: 25, flip: true }]);
    expect(expandPartKey('25:right')).toEqual([{ id: 25, flip: false }]);
    expect(expandPartKey('1:near:flip')).toEqual([{ id: 1, side: 'near', flip: true }]);
    expect(expandPartKey('1:left:flip')).toMatch(/goes alone/);
    expect(expandPartKey('1:up')).toMatch(/unknown qualifier/);
  });

  it('builds a look on another one', () => {
    const all = new Map<string, LookData>([
      [
        'kit',
        {
          id: 'kit',
          abstract: true,
          base: 0,
          accent: '#112233',
          palette: { a: '#ffffff', c: '#00ff00' },
          parts: { '1': ['aa', 'aa'], '25': ['cc', 'cc'] },
          recolor: [{ sprites: [1], map: { '#ff0000': '#00ff00' } }],
        },
      ],
      [
        'outfit',
        {
          id: 'outfit',
          extends: 'kit',
          palette: { a: '#000000' },
          parts: { '25': null, '1:left': ['a', 'a'] },
          recolor: [{ sprites: [1], map: { '#00ff00': '#0000ff' } }],
        },
      ],
      ['loop', { id: 'loop', extends: 'loop' }],
    ]);
    const r = resolveLook('outfit', all)!;
    expect(r.accent).toBe('#112233');
    expect(r.palette).toEqual({ a: '#000000', c: '#00ff00' });
    expect(Object.keys(r.parts).sort()).toEqual(['1', '1:far:noflip', '1:near:flip']);
    expect(r.recolor.map((x) => Object.values(x.map)[0])).toEqual(['#00ff00', '#0000ff']);
    const problems: string[] = [];
    expect(resolveLook('loop', all, problems)).toBeNull();
    expect(problems.join()).toMatch(/extends itself/);
    expect(resolveLook('nope', all, [])).toBeNull();
  });

  it('puts only the changed pictures in the layer', () => {
    const layer = layerOf(
      look({
        recolor: [{ sprites: [1], map: { '#ff0000': '#123456' } }],
        overlays: { '1': ['.a', ' .'] },
      }),
    );
    // One picture: sprite 1 recoloured and painted over; the head is not in the layer.
    expect(layer.frames.filter(Boolean)).toHaveLength(1);
    const id = layer.parts[slotIndex(1, Side.NEAR, false)]!;
    expect(id).toBe(LAYER_ID_BASE);
    expect(pixelOf(layer, id, 0, 0)).toEqual([0x12, 0x34, 0x56, 255]);
    expect(pixelOf(layer, id, 1, 0)).toEqual([255, 255, 255, 255]);
    expect(pixelOf(layer, id, 0, 1)).toEqual([0, 0, 0, 0]);
    expect(layer.parts[slotIndex(25, Side.MID, false)]).toBe(FALLTHROUGH);
  });

  it('picks the most specific picture for the side and the mirroring', () => {
    const layer = layerOf(
      look({
        parts: { '1:near': ['aaa', 'aaa', 'aaa'], '1:far:flip': ['b'], '25:left': ['aa', 'aa'] },
      }),
    );
    const near = layer.parts[slotIndex(1, Side.NEAR, false)]!;
    expect(layer.parts[slotIndex(1, Side.NEAR, true)]).toBe(near);
    expect(layer.frames[near]).toMatchObject({ w: 3, h: 3 });
    const farFlip = layer.parts[slotIndex(1, Side.FAR, true)]!;
    expect(layer.frames[farFlip]).toMatchObject({ w: 1, h: 1 });
    expect(layer.parts[slotIndex(1, Side.FAR, false)]).toBe(FALLTHROUGH);
    expect(layer.parts[slotIndex(25, Side.MID, false)]).toBe(FALLTHROUGH);
    expect(layer.parts[slotIndex(25, Side.MID, true)]).not.toBe(FALLTHROUGH);

    // The swap: slot 18 is the near forearm, slot 1 the far one, slot 13 the head.
    const swap = lookSwap(layer);
    expect(swap(1, 0, 18, { flipX: false, bodyFlip: false })).toBe(near);
    expect(swap(1, 0, 1, { flipX: false, bodyFlip: false })).toBe(1);
    expect(swap(1, 0, 1, { flipX: true, bodyFlip: true })).toBe(farFlip);
    // The head shows its left side when the whole picture ends up mirrored.
    const left = layer.parts[slotIndex(25, Side.MID, true)]!;
    expect(swap(25, 0, 13, { flipX: true, bodyFlip: true })).toBe(left);
    expect(swap(25, 4, 13, { flipX: true, bodyFlip: false })).toBe(25);
    expect(swap(25, 4, 13, { flipX: false, bodyFlip: false })).toBe(left);
  });

  it('recolours one side of the body', () => {
    const layer = layerOf(
      look({ recolor: [{ sprites: [1], map: { '#ff0000': '#123456' }, on: 'left' }] }),
    );
    const left = layer.parts[slotIndex(1, Side.NEAR, true)]!;
    expect(layer.parts[slotIndex(1, Side.FAR, false)]).toBe(left);
    expect(pixelOf(layer, left, 0, 0)).toEqual([0x12, 0x34, 0x56, 255]);
    // The right limb keeps its colours.
    expect(layer.parts[slotIndex(1, Side.NEAR, false)]).toBe(FALLTHROUGH);
  });

  it('shares identical pictures', () => {
    const layer = layerOf(look({ parts: { '1:right': ['aa', 'aa'] } }));
    expect(layer.frames.filter(Boolean)).toHaveLength(1);
  });

  it('hangs attachments behind, under, over and in front', () => {
    const layer = layerOf(
      look({
        attachments: {
          cape: { layer: 'back', sprites: { '25': ['aaa'] } },
          bow: { layer: 'over', sprites: { '25': ['a'] } },
          badge: { layer: 'front', sprites: { '1:near': ['b'] } },
        },
      }),
    );
    // An object of two sprite slots: the head (slot 0) and a forearm (slot 1).
    const prim = (value: number) => ({
      type: 1,
      kind: 'sprite' as const,
      hidden: false,
      swapParts: true,
      paramCount: 3,
      x: [10],
      y: [10],
      value: [value],
      w: [],
      h: [],
    });
    const obj: SceneObject = {
      id: 0,
      index: 0,
      frames: 1,
      pivotX: 10,
      pivotY: 20,
      width: 20,
      height: 20,
      primitives: [prim(25 << 3), prim(1 << 3)],
    };
    const sizes = {
      width: (id: number) => layer.frames[id]?.w ?? 2,
      height: (id: number) => layer.frames[id]?.h ?? 2,
    };
    // Primitive 1 is a far slot in the character's table: the badge (near only) stays off.
    const out: DrawCommand[] = [];
    const n = composePose(obj, sizes, 0, 0, 0, false, lookSwap(layer), out);
    const kinds = out.slice(0, n).map((c) => (c.attachment ? `a${c.slot}` : `p${c.slot}`));
    expect(kinds).toEqual(['a0', 'p0', 'a0', 'p1']);
    expect(AttachLayer.BACK).toBe(0);
    // Mirrored, an attachment keeps its own width's parity.
    const m = composePose(obj, sizes, 0, 0, 0, true, lookSwap(layer), out);
    const cape = out.slice(0, m).find((c) => c.attachment)!;
    expect(cape.x).toBe(-10 - 1 + 20);
  });

  it("puts an attachment's pivot on the part's point, in the part's parity", () => {
    // A strap of 1 × 3 hanging from its top pixel: the head (2 × 2) is even both ways.
    const layer = layerOf(
      look({ attachments: { bag: { layer: 'over', sprites: { '25': ['+', 'a', 'a'] } } } }),
    );
    const id = layer.keys.get('bag@25')!;
    const f = layer.frames[id]!;
    expect([f.w, f.h]).toEqual([2, 6]);
    // The pivot is the centre pixel (1, 3): the strap below it, nothing above.
    const center = Anchor.HCENTER | Anchor.VCENTER;
    expect([anchorOffsetX(center, f.w), anchorOffsetY(center, f.h)]).toEqual([1, 3]);
    expect(pixelOf(layer, id, 1, 3)[3]).toBe(0);
    expect(pixelOf(layer, id, 1, 4)).toEqual([255, 255, 255, 255]);
    expect(pixelOf(layer, id, 1, 5)).toEqual([255, 255, 255, 255]);
    expect(pixelOf(layer, id, 1, 2)[3]).toBe(0);
    // Without a pivot a picture stays as drawn (centred).
    expect(pivotOf(['aa', 'aa'])).toBeNull();
    const two = resolveSingle(
      look({ attachments: { x: { layer: 'over', sprites: { '25': ['+a', '+a'] } } } }),
    )!;
    expect(lookProblems(two).some((s) => s.includes('more than one pivot'))).toBe(true);
  });

  it('turns a part drawn upright into its turned pictures, unless they are drawn', () => {
    // A forearm (1) drawn as a tall bar: 2, 3, 4 are it turned 22.5°, 45°, 67.5°.
    const bar = ['a', 'a', 'a', 'a', 'a'];
    const layer = layerOf(look({ parts: { '1': bar, '3': ['b'] } }));
    for (const id of [2, 4]) {
      const slot = layer.parts[slotIndex(id, Side.FAR, false)]!;
      expect(slot, `forearm ${id}`).toBeGreaterThanOrEqual(LAYER_ID_BASE);
    }
    const f4 = layer.frames[layer.parts[slotIndex(4, Side.FAR, false)]!]!;
    // Turned 67.5°, the bar lies almost flat: wider than tall.
    expect(f4.w).toBeGreaterThan(f4.h);
    // Drawn ones win.
    const f3 = layer.frames[layer.parts[slotIndex(3, Side.FAR, false)]!]!;
    expect([f3.w, f3.h]).toEqual([1, 1]);
  });

  it("puts a part's pivot on the original part's point", () => {
    // A head (2 × 2 in the atlas) drawn 3 × 1 with its pivot on the left pixel.
    const layer = layerOf(look({ parts: { '25': ['+aa'] } }));
    const f = layer.frames[layer.parts[slotIndex(25, Side.MID, false)]!]!;
    // Padded to the head's even width with the pivot as the centre pixel (3 of 6).
    expect([f.w, f.h]).toEqual([6, 2]);
  });

  it('checks cloth: a band needs colours, a texture shares its rows into segments', () => {
    expect(ribbonProblems({ anchor: 'neck', segments: 4, length: 3, width: 2 })).toContain(
      'no colours and no texture',
    );
    const cape = { anchor: 'neck' as const, texture: Array.from({ length: 24 }, () => 'aaa') };
    expect(ribbonProblems(cape)).toEqual([]);
    expect(ribbonChain(cape)).toEqual({ segments: 6, length: 4 });
    // One stiff segment: a pendulum (a bag on its strap).
    expect(ribbonProblems({ ...cape, segments: 1, stiffness: 1 })).toEqual([]);
    expect(ribbonProblems({ ...cape, stiffness: 2 })).toContain('stiffness is 0..1');
    const bad = resolveSingle(look({ ribbons: { c: { ...cape, texture: ['aza'] } } }))!;
    expect(lookProblems(bad).some((s) => s.includes('"z" not in palette'))).toBe(true);
  });

  it('lets an outfit wear its own effect, inherited and cleared like any field', () => {
    const all = new Map<string, LookData>([
      ['kit', look({ id: 'kit', abstract: true, effect: ['dark'] })],
      ['a', look({ id: 'a', extends: 'kit' })],
      ['b', look({ id: 'b', extends: 'kit', effect: null })],
    ]);
    expect(resolveLook('a', all)!.effect).toEqual(['dark']);
    expect(resolveLook('b', all)!.effect).toBeNull();
    expect(lookDataProblems(look({ effect: [''] }))).toContain(
      'effect must be a list of variant names',
    );
  });

  it('keeps a part centred when it grows by the same margin on every side', () => {
    // Parts are drawn centred (`ANCHOR_CENTER`): padding by p moves the anchor by exactly p.
    const center = Anchor.HCENTER | Anchor.VCENTER;
    for (const w of [5, 6, 11, 16]) {
      for (const p of [1, 3, 5, 8]) {
        expect(anchorOffsetX(center, w + 2 * p) - anchorOffsetX(center, w)).toBe(p);
        expect(anchorOffsetY(center, w + 2 * p) - anchorOffsetY(center, w)).toBe(p);
        // Mirroring shifts by the width's parity, which padding keeps.
        expect((w + 2 * p) & 1).toBe(w & 1);
      }
    }
  });
});
