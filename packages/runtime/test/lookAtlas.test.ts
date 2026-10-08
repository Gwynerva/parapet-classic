/**
 * The editable atlas of a look (`render/LookAtlas.ts`) and the reading-order packer: an atlas
 * exported and read back unchanged changes nothing, an edited cell becomes a picture centred on
 * the part's point with the original's parity, mirrored cells are turned back, and the layout
 * never overlaps.
 */
import { describe, expect, it } from 'vitest';
import type { AtlasFrame } from '../src/content/types.ts';
import { resolveSingle, type LookData } from '../src/render/Look.ts';
import { applyImport, atlasLayout, exportAtlas, importAtlas } from '../src/render/LookAtlas.ts';
import { packRows } from '../src/render/pack.ts';
import type { RgbaImage, RgbaSheet } from '../src/render/Raster.ts';

/** Sprite 1 (a forearm): 3 × 2, sprite 25 (the head): 2 × 2; both grey. */
function atlas(): RgbaSheet {
  const w = 5;
  const data = new Uint8ClampedArray(w * 2 * 4);
  for (let i = 0; i < w * 2; i++) data.set([90, 90, 90, 255], i * 4);
  const frames: (AtlasFrame | undefined)[] = [];
  frames[1] = { x: 0, y: 0, w: 3, h: 2 };
  frames[25] = { x: 3, y: 0, w: 2, h: 2 };
  return { image: { width: w, height: 2, data }, frames };
}

const LOOK: LookData = { id: 'test', base: 0, palette: { a: '#ffffff' }, parts: {} };

function setPixel(img: RgbaImage, x: number, y: number, rgba: readonly number[]): void {
  img.data.set(rgba, (y * img.width + x) * 4);
}

describe('look atlas', () => {
  it('packs in reading order without overlaps', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      key: String(i),
      w: 3 + (i % 7),
      h: 2 + (i % 5),
      breakBefore: i === 12,
    }));
    const a = packRows(items, 40, 2);
    const b = packRows(items, 40, 2);
    expect([...a.cells]).toEqual([...b.cells]);
    const rects = [...a.cells.values()];
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]!;
      expect(r.x + r.w).toBeLessThanOrEqual(a.width);
      expect(r.y + r.h).toBeLessThanOrEqual(a.height);
      for (let j = i + 1; j < rects.length; j++) {
        const q = rects[j]!;
        const apart =
          r.x + r.w + 2 <= q.x ||
          q.x + q.w + 2 <= r.x ||
          r.y + r.h + 2 <= q.y ||
          q.y + q.h + 2 <= r.y;
        expect(apart, `${i} and ${j}`).toBe(true);
        // Reading order: a later item is never above and to the left of an earlier one's row.
        expect(q.y > r.y || (q.y === r.y && q.x > r.x)).toBe(true);
      }
    }
    expect(a.cells.get('12')!.x).toBe(2);
  });

  it('reads an untouched atlas back as nothing changed', () => {
    const base = atlas();
    const look = resolveSingle(LOOK)!;
    const layout = atlasLayout(base, look, { add: ['25:left'] });
    expect(layout.cells.map((c) => c.key)).toContain('25:flip');
    const img = exportAtlas(base, look, layout);
    expect(importAtlas(base, look, layout, img).pictures.size).toBe(0);
  });

  it('grows a picture around the part point, keeping its parity', () => {
    const base = atlas();
    const look = resolveSingle(LOOK)!;
    const layout = atlasLayout(base, look, { margin: 4 });
    const img = exportAtlas(base, look, layout);
    const cell = layout.cells.find((c) => c.key === '1')!;
    // Paint one white pixel two to the right of the 3 px wide forearm.
    setPixel(img, cell.x + 4 + 3 + 1, cell.y + 4, [255, 255, 255, 255]);
    const result = importAtlas(base, look, layout, img);
    const rows = result.pictures.get('1')!;
    expect(rows).toHaveLength(2);
    // 3 wide grew to an odd width centred on the same point: 7 (two more on each side).
    expect(Array.from(rows[0]!)).toHaveLength(7);
    expect(Array.from(rows[0]!).at(-1)).not.toBe('.');
    expect(Array.from(rows[0]!)[0]).toBe('.');
    const next = applyImport(LOOK, result);
    expect(Object.keys(next.parts!)).toEqual(['1']);
    expect(Object.values(next.palette!)).toContain('#5a5a5a');
  });

  it('turns mirrored cells back and folds left and right', () => {
    const base = atlas();
    const look = resolveSingle(LOOK)!;
    const layout = atlasLayout(base, look, { margin: 2, add: ['25:left'] });
    const img = exportAtlas(base, look, layout);
    const cell = layout.cells.find((c) => c.key === '25:flip')!;
    expect(cell.mirrored).toBe(true);
    // Paint the head's top-left pixel (as seen) white: stored, it is the top-right one.
    setPixel(img, cell.x + 2, cell.y + 2, [255, 255, 255, 255]);
    const result = importAtlas(base, look, layout, img);
    const rows = result.pictures.get('25:flip')!;
    expect(rows[0]).toBe('xa'.replace('x', rows[0]![0]!));
    expect(rows[0]![1]).toBe('a');
    const next = applyImport(LOOK, result);
    expect(Object.keys(next.parts!)).toEqual(['25:left']);
  });
});
