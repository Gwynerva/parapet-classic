import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32 } from '../src/crc32.ts';
import { packAtlas } from '../src/packAtlas.ts';
import { encodePng, readPngSize } from '../src/png.ts';

describe('png encoder', () => {
  it('writes a valid RGBA image with filter 0 rows', () => {
    const rgba = Uint8Array.of(255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 10, 20, 30, 40);
    const png = encodePng(2, 2, rgba);
    expect(readPngSize(png)).toEqual({ width: 2, height: 2 });
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    // walk the chunks and verify every CRC
    let p = 8;
    const types: string[] = [];
    while (p < png.length) {
      const length = view.getUint32(p);
      const type = String.fromCharCode(...png.subarray(p + 4, p + 8));
      expect(view.getUint32(p + 8 + length)).toBe(crc32(png.subarray(p + 4, p + 8 + length)));
      if (type === 'IDAT') {
        const raw = inflateSync(png.subarray(p + 8, p + 8 + length));
        expect([...raw]).toEqual([0, ...rgba.subarray(0, 8), 0, ...rgba.subarray(8, 16)]);
      }
      types.push(type);
      p += 12 + length;
    }
    expect(types).toEqual(['IHDR', 'IDAT', 'IEND']);
  });

  it('rejects mismatched buffers', () => {
    expect(() => encodePng(2, 2, new Uint8Array(3))).toThrow(/expected 16/);
    expect(() => encodePng(0, 2, new Uint8Array(0))).toThrow(/invalid size/);
  });
});

describe('atlas packer', () => {
  it('places every frame inside the atlas with at least 1 px between frames', () => {
    const items = [];
    for (let id = 0; id < 50; id++)
      items.push({ id, w: 5 + ((id * 7) % 40), h: 3 + ((id * 5) % 30) });
    const layout = packAtlas(items, 1);
    const frames = Object.values(layout.frames);
    expect(frames.length).toBe(items.length);
    for (const a of frames) {
      expect(a.x).toBeGreaterThanOrEqual(1);
      expect(a.y).toBeGreaterThanOrEqual(1);
      expect(a.x + a.w).toBeLessThan(layout.width);
      expect(a.y + a.h).toBeLessThan(layout.height);
      for (const b of frames) {
        if (a === b) continue;
        const separated =
          a.x + a.w + 1 <= b.x ||
          b.x + b.w + 1 <= a.x ||
          a.y + a.h + 1 <= b.y ||
          b.y + b.h + 1 <= a.y;
        expect(separated).toBe(true);
      }
    }
    items.forEach((item) => {
      const frame = layout.frames[item.id];
      expect(frame?.w).toBe(item.w);
      expect(frame?.h).toBe(item.h);
    });
  });
});
