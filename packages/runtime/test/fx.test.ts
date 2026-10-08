/**
 * Effects as data (`render/fx`): an effects file is checked, compiled for a colour, its
 * particles stay within the pool, the same seed scatters them the same way, and the triggers
 * follow the moves of the real move demos.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fxProblems, type FxFile, type FxTrigger } from '../src/render/fx/FxData.ts';
import { compileFx } from '../src/render/fx/FxSheet.ts';
import { FxSystem } from '../src/render/fx/FxSystem.ts';
import { MotionTracker, triggerBit } from '../src/render/fx/Motion.ts';
import { traceDemo, type MoveDemoData } from '../src/moves/MoveDemo.ts';
import { hasContent, loadMoves, loadTables } from './helpers/content.ts';

const FX: FxFile = {
  palette: { a: 'accent', w: '#ffffff', d: 'accent.dark' },
  sprites: { bat1: ['a.a', 'www', '.d.'], bat2: ['...', 'awa', '.d.'] },
  emitters: {
    bats: {
      while: ['run'],
      every: 6,
      anchor: 'neck',
      speed: [20, 40],
      angle: [10, 40],
      life: [400, 700],
      flutter: { amp: 2, freq: 3 },
      face: true,
      sprite: { frames: ['bat1', 'bat2'], fps: 8 },
      max: 12,
    },
    sparks: {
      enter: ['land', 'flip'],
      burst: [6, 8],
      anchor: 'feet',
      speed: [30, 80],
      angle: [0, 180],
      gravity: 200,
      life: 300,
      rect: { size: [1, 2], colors: ['accent', 'w'] },
    },
  },
  variants: {
    flags: { emitters: ['bats'] },
    sprint: { emitters: ['sparks'], afterimage: { preset: 'rush' } },
  },
  presence: { vanish: ['bats', 'sparks'] },
};

describe('effects data', () => {
  it('checks an effects file', () => {
    expect(fxProblems(FX)).toEqual([]);
    const bad: FxFile = {
      palette: { a: 'nope' },
      sprites: { s: ['ab', 'a'] },
      emitters: { e: { while: ['jog' as FxTrigger], life: [3, 1], sprite: { frames: ['x'] } } },
      variants: { flags: { emitters: ['missing'] } },
    };
    const text = fxProblems(bad).join('\n');
    expect(text).toMatch(/palette "a": nope/);
    expect(text).toMatch(/row 1: 1 wide/);
    expect(text).toMatch(/trigger "jog"/);
    expect(text).toMatch(/sprite "x" does not exist/);
    expect(text).toMatch(/life is not a number/);
    expect(text).toMatch(/emitter "missing" does not exist/);
  });

  it('compiles sprites and colours for an accent', () => {
    const fx = compileFx(FX, '#ff0000');
    expect(compileFx(FX, '#ff0000')).toBe(fx);
    expect(fx.frames).toHaveLength(2);
    const f = fx.frames[0]!;
    expect(
      Array.from(fx.data.subarray((f.y * fx.width + f.x) * 4, (f.y * fx.width + f.x) * 4 + 4)),
    ).toEqual([255, 0, 0, 255]);
    expect(fx.color('accent.dark')).toBe('#8c0000');
    expect(fx.emitters.get('bats')!.frames).toEqual([0, 1]);
    expect(fx.emitters.get('sparks')!.colors).toEqual(['#ff0000', '#ffffff']);
    expect(compileFx(FX, '#00ff00')).not.toBe(fx);
  });

  it('keeps particles within the pool and the emitter maximum', () => {
    const fx = compileFx(FX, '#ff0000');
    const pool = new FxSystem(16);
    let seed = 1;
    const rand = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const at = { x: 0, y: 0, facingRight: true, vx: 0, vy: 0 };
    for (let i = 0; i < 40; i++) pool.spawn(fx, fx.emitters.get('bats')!, at, rand);
    expect(pool.count(fx.emitters.get('bats')!)).toBe(12);
    for (let i = 0; i < 40; i++) pool.spawn(fx, fx.emitters.get('sparks')!, at, rand);
    expect(pool.alive).toBe(16);
    pool.update(100);
    pool.update(100);
    pool.update(100);
    pool.update(100);
    expect(pool.count(fx.emitters.get('sparks')!)).toBe(0);
    pool.update(1000);
    expect(pool.alive).toBe(0);
  });
});

const DEMOS = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../content/moves/demos.json', import.meta.url)), 'utf8'),
) as { demos: MoveDemoData[] };

/** Which trigger each move demo must start. */
const DEMO_TRIGGERS: Record<string, FxTrigger> = {
  run: 'run',
  jump: 'jump',
  landing: 'land',
  ladder: 'ladder',
  slide: 'slide',
  wallJump: 'wall',
  wallRun: 'wall',
  ledge: 'hang',
  roll: 'roll',
  frontFlip: 'flip',
  backFlip: 'flip',
  tigerJump: 'vault',
  wallFlip: 'flip',
  monkeyVault: 'vault',
  dash: 'dash',
  monkeyFlip: 'flip',
  spiderJump: 'flip',
  poleSlide: 'slide',
  poleJump: 'pole',
  poleSpin: 'flip',
};

describe.skipIf(!hasContent())('effect triggers', () => {
  const content = { moves: loadMoves(), tables: loadTables() };
  for (const demo of DEMOS.demos) {
    const wanted = DEMO_TRIGGERS[demo.move];
    it(`the ${demo.move} demo starts "${wanted}"`, () => {
      const trace = traceDemo(demo, content);
      const tracker = new MotionTracker();
      let entered = 0;
      let fast = false;
      trace.states.forEach((move, i) => {
        const m = tracker.step(move, trace.x[i]! * 1024, trace.y[i]! * 1024);
        entered |= m.entered;
        if ((m.active & triggerBit('fast')) !== 0) fast = true;
      });
      expect(
        entered & triggerBit(wanted!),
        `states ${[...new Set(trace.states)].join(',')}`,
      ).not.toBe(0);
      if (demo.move === 'dash') expect(fast).toBe(true);
    });
  }
});
