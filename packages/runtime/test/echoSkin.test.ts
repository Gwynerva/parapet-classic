import { describe, expect, it } from 'vitest';
import {
  ECHO_GREY,
  ECHO_PALETTE,
  echoColor,
  recolorEcho,
  type EchoRamp,
} from '../src/render/EchoSkin.ts';

const RAMP: EchoRamp = {
  shadow: [10, 0, 0],
  body: [100, 0, 0],
  highlight: [200, 0, 0],
  rim: [250, 250, 250],
};

/** A 5×5 image: transparent border, a 3×3 opaque block with a dark, a mid and a light pixel. */
function block(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(5 * 5 * 4);
  const set = (x: number, y: number, v: number): void => {
    const i = (y * 5 + x) * 4;
    px[i] = v;
    px[i + 1] = v;
    px[i + 2] = v;
    px[i + 3] = 255;
  };
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) set(x, y, 128);
  set(2, 2, 20);
  return px;
}

function rgbaAt(px: Uint8ClampedArray, x: number, y: number, width = 5): number[] {
  const i = (y * width + x) * 4;
  return [px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!];
}

describe('recolorEcho', () => {
  it('turns the edge into the rim and the inside into ramp tones by brightness', () => {
    const out = recolorEcho(block(), 5, 5, RAMP, true);
    expect(rgbaAt(out, 1, 1)).toEqual([250, 250, 250, 255]);
    expect(rgbaAt(out, 3, 2)).toEqual([250, 250, 250, 255]);
    // The centre is the only pixel without a transparent neighbour: dark → shadow.
    expect(rgbaAt(out, 2, 2)).toEqual([10, 0, 0, 255]);
  });

  it('fills the inside with the body tone when flat', () => {
    const out = recolorEcho(block(), 5, 5, RAMP, false);
    expect(rgbaAt(out, 2, 2)).toEqual([100, 0, 0, 255]);
  });

  it('keeps transparent pixels transparent', () => {
    const out = recolorEcho(block(), 5, 5, RAMP, true);
    expect(rgbaAt(out, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(rgbaAt(out, 4, 2)).toEqual([0, 0, 0, 0]);
  });

  it('treats frame borders as edges and skips pixels outside every frame', () => {
    const out = recolorEcho(block(), 5, 5, RAMP, true, [{ x: 2, y: 1, w: 2, h: 3 }]);
    // (2, 2) is now on the frame's left border.
    expect(rgbaAt(out, 2, 2)).toEqual([250, 250, 250, 255]);
    expect(rgbaAt(out, 1, 2)).toEqual([0, 0, 0, 0]);
  });
});

describe('echoColor', () => {
  it('ignores case, surrounding spaces and Unicode forms', () => {
    const a = echoColor('Vasya');
    expect(echoColor(' vasya ')).toBe(a);
    expect(echoColor('VASYA')).toBe(a);
    expect(echoColor('Ｖａｓｙａ')).toBe(a);
  });

  it('never hands out the grey of the rivals and spreads names over the palette', () => {
    const used = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = echoColor(`runner${i}`);
      expect(c).not.toBe(ECHO_GREY);
      used.add(c.id);
    }
    expect(used.size).toBe(ECHO_PALETTE.length);
  });
});
