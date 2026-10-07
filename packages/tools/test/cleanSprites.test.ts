import { describe, expect, it } from 'vitest';
import { cleanMenuIcon, ICON_TONES, MENU_ICON_IDS } from '../src/cleanSprites.ts';

function pixel(rgba: Uint8Array, i: number): number[] {
  return [rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!, rgba[i * 4 + 3]!];
}

describe('cleanMenuIcon', () => {
  it('snaps greys to the four tones and keeps transparency', () => {
    // 3x1: dark grey, light grey, transparent.
    const rgba = new Uint8Array([40, 40, 40, 255, 230, 225, 220, 255, 0, 0, 0, 10]);
    cleanMenuIcon(rgba, 3, 1);
    expect(pixel(rgba, 0)).toEqual([...ICON_TONES.outline, 255]);
    expect(pixel(rgba, 1)).toEqual([...ICON_TONES.paper, 255]);
    expect(pixel(rgba, 2)[3]).toBe(0);
  });

  it('maps saturated pixels to the ink colours', () => {
    const rgba = new Uint8Array([250, 80, 20, 255, 120, 30, 5, 255]);
    cleanMenuIcon(rgba, 2, 1);
    expect(pixel(rgba, 0)).toEqual([...ICON_TONES.ink, 255]);
    expect(pixel(rgba, 1)).toEqual([...ICON_TONES.inkShadow, 255]);
  });

  it('absorbs a light speckle surrounded by outline', () => {
    const rgba = new Uint8Array(9 * 4);
    for (let i = 0; i < 9; i++) rgba.set([30, 30, 30, 255], i * 4);
    rgba.set([200, 200, 200, 255], 4 * 4); // the centre
    cleanMenuIcon(rgba, 3, 3);
    expect(pixel(rgba, 4)).toEqual([...ICON_TONES.outline, 255]);
  });

  it('covers exactly the ten mission icons', () => {
    expect(MENU_ICON_IDS).toEqual([141, 142, 143, 144, 145, 146, 147, 148, 149, 150]);
  });
});
