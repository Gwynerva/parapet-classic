import { describe, expect, it } from 'vitest';
import { FixedStepClock } from '@parapet/runtime/app/GameLoop.ts';
import { conditionWord } from '../src/experiments/table.ts';
import { bands, onlyBand, sweep } from '../src/experiments/sweep.ts';
import { Frame } from '../src/frame.ts';
import { RGB } from '../src/palette.ts';
import { frameTimes, gridScene, scriptMs, STEP_MS, type Scene } from '../src/scene.ts';
import { Svg } from '../src/svg.ts';

describe('the clips’ timeline', () => {
  it('a step lasts what the game’s clock makes of it', () => {
    const clock = new FixedStepClock();
    let steps = 0;
    for (let i = 0; i < 100; i++) steps += clock.advance(STEP_MS, { step: () => true });
    expect(steps).toBe(100);
    expect(STEP_MS).toBeCloseTo(34.133, 3);
  });

  it('plays a stretch at the original’s pace, slowed down and held', () => {
    const times = frameTimes(
      [
        { from: 0, to: 30 },
        { from: 30, to: 40, speed: 0.25 },
        { at: 40, holdMs: 1000 },
      ],
      25,
    );
    const ms = scriptMs([
      { from: 0, to: 30 },
      { from: 30, to: 40, speed: 0.25 },
      { at: 40, holdMs: 1000 },
    ]);
    expect(times.length).toBe(Math.round(ms / 40));
    for (let i = 1; i < times.length; i++) expect(times[i]!).toBeGreaterThanOrEqual(times[i - 1]!);
    expect(times.at(-1)).toBe(40);
    expect(times.filter((t) => t === 40)).toHaveLength(25);
  });
});

describe('scenes side by side', () => {
  const scene = (width: number, height: number, c: [number, number, number]): Scene => ({
    width,
    height,
    from: 0,
    to: 10,
    draw: (frame) => frame.clear(c),
  });

  it('take the widest of each column and the tallest of each row', () => {
    const grid = gridScene(
      [scene(10, 4, [1, 1, 1]), scene(6, 8, [2, 2, 2]), scene(12, 3, [3, 3, 3])],
      2,
      2,
    );
    expect([grid.width, grid.height]).toEqual([12 + 2 + 6, 8 + 2 + 3]);
    const f = new Frame(grid.width, grid.height);
    grid.draw(f, 0);
    const at = (x: number, y: number): number => f.img.data[(y * f.width + x) * 4]!;
    expect([at(0, 0), at(14, 0), at(0, 10), at(11, 0)]).toEqual([1, 2, 3, RGB.line[0]]);
  });
});

describe('sweeps', () => {
  it('group the steps that give the same thing', () => {
    const values = sweep(10, 17, (s) => [s, s < 12 ? 'a' : s < 15 ? 'b' : 'a'] as const);
    const b = bands(values);
    expect(b).toEqual([
      [10, 11, 'a'],
      [12, 14, 'b'],
      [15, 17, 'a'],
    ]);
    expect(onlyBand(b, 'b')).toEqual([12, 14]);
    expect(onlyBand(b, 'a')).toEqual([]);
  });

  it('pack a transition’s conditions one per byte, as the original stores them', () => {
    expect(conditionWord({ conditions: [8, 73, 53], target: 34 })).toBe(0x354908);
    expect(conditionWord({ conditions: [], target: 2 })).toBe(0);
  });
});

describe('charts', () => {
  it('are one well-formed SVG with its texts escaped', () => {
    const svg = new Svg(100, 50, 'A & B', 'x < y')
      .text(10, 10, '"quoted" <tag>')
      .rect(0, 0, 10, 10, '#fff', { tip: 'a & b' })
      .toString();
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/);
    const open = [...svg.matchAll(/<(\w+)\b[^>]*>/g)]
      .filter((m) => !m[0].endsWith('/>'))
      .map((m) => m[1]);
    const close = [...svg.matchAll(/<\/(\w+)>/g)].map((m) => m[1]);
    expect(open.sort()).toEqual(close.sort());
  });

  it('leave out the points in the middle of a straight stretch', () => {
    const svg = new Svg(10, 10, 't')
      .polyline(
        [
          [0, 0],
          [1, 0],
          [2, 0],
          [2, 1],
          [2, 2],
          [3, 3],
        ],
        '#000',
      )
      .toString();
    expect(svg).toContain('points="0,0 2,0 2,2 3,3"');
  });
});
