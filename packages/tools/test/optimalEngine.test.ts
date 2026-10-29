import { describe, expect, it } from 'vitest';
import { Engine, PRESSES, writeState, STATE_INTS, type Successor } from '../src/optimal/engine.ts';
import { levelContent } from '../src/tas/content.ts';
import { newWorld } from '../src/tas/timeline.ts';
import type { ContestMode } from '../src/tas/model.ts';
import { rng } from '../src/tas/search.ts';

function randomPress(rand: () => number): number {
  return rand() < 0.75 ? 0 : PRESSES[1 + Math.floor(rand() * 15)]!;
}

const CASES: [number, ContestMode][] = [
  [0, 'flags'],
  [3, 'sprint'],
  [7, 'sprint'],
  [10, 'flags'],
];

describe('optimal engine', () => {
  it.each(CASES)(
    'a state row carries everything the future depends on (level %i %s)',
    (id, mode) => {
      const content = levelContent(id);
      const rand = rng(id * 31 + mode.length);
      for (let trial = 0; trial < 6; trial++) {
        const world = newWorld(content, mode);
        const engine = new Engine(content, mode);
        let cur = new Int32Array(STATE_INTS);
        let next = new Int32Array(STATE_INTS);
        const truth = new Int32Array(STATE_INTS);
        engine.start(cur);
        // The world runs on with all of its state; the engine restarts from its row every step.
        for (let step = 0; step < 3000 && !world.finished; step++) {
          const bits = randomPress(rand);
          world.step(bits);
          const succ: Successor[] = [];
          engine.expand(cur, 0, next, 0, succ, [bits]);
          expect(succ[0]!.finished).toBe(world.finished);
          writeState(world.player, world.rules, truth, 0);
          engine.canon(truth, 0);
          expect(next).toEqual(truth);
          [cur, next] = [next, cur];
        }
      }
    },
    60_000,
  );

  it.each(CASES)(
    'expand matches all 16 presses simulated one by one (level %i %s)',
    (id, mode) => {
      const content = levelContent(id);
      const engine = new Engine(content, mode);
      const rand = rng(id * 7 + 1);
      const row = new Int32Array(STATE_INTS);
      engine.start(row);
      const out = new Int32Array(STATE_INTS * 16);
      const one = new Int32Array(STATE_INTS);
      const succ: Successor[] = [];
      for (let step = 0; step < 1500; step++) {
        const n = engine.expand(row, 0, out, 0, succ);
        const rows = new Set<string>();
        for (let k = 0; k < n; k++) {
          rows.add(out.subarray(k * STATE_INTS, (k + 1) * STATE_INTS).join(','));
        }
        // Groups may still land on one row; the sets of rows must agree.
        const singles = new Set<string>();
        for (const bits of PRESSES) {
          engine.expand(row, 0, one, 0, [], [bits]);
          singles.add(one.join(','));
        }
        expect(rows).toEqual(singles);
        // Walk on along a random successor.
        const pick = Math.floor(rand() * n);
        row.set(out.subarray(pick * STATE_INTS, (pick + 1) * STATE_INTS));
        if (succ[pick]!.finished) engine.start(row);
      }
    },
    60_000,
  );
});
