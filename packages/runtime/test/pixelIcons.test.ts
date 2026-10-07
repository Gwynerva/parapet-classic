import { describe, expect, it } from 'vitest';
import { iconSize, PixelIcons } from '../src/ui/PixelIcons.ts';

describe('PixelIcons', () => {
  it('measures icons and rejects ragged rows', () => {
    expect(iconSize(['..#', '#..'])).toEqual({ width: 3, height: 2 });
    expect(() => iconSize(['..#', '#'])).toThrow(/row 1/);
    expect(() => new PixelIcons({ a: { rows: ['..', '.'] } }, { p: {} })).toThrow();
  });

  it('scales the drawn size and tolerates environments without a document', () => {
    const set = new PixelIcons({ a: { rows: ['.#', '#.'] } }, { p: { '#': '#fff' } }, 3);
    expect(set.size('a')).toEqual({ width: 6, height: 6 });
    const calls: unknown[] = [];
    const ctx = {
      drawImage: (...args: unknown[]) => calls.push(args),
    } as unknown as CanvasRenderingContext2D;
    set.draw(ctx, 'a', 'p', 0, 0);
    expect(calls).toHaveLength(0); // no DOM in tests: nothing to rasterise, nothing drawn
  });
});
