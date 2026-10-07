/**
 * Determinism and replay round trips: the same inputs must always produce the same state, and a
 * recorded log must reproduce the run it was recorded from. Inputs come from a seeded PRNG.
 */
import { describe, expect, it } from 'vitest';
import { World } from '../src/world.ts';
import { createRun, type RunMode } from '../src/run.ts';
import { expandRuns } from '../src/replay.ts';
import {
  hasContent,
  loadLevel,
  loadMissions,
  loadMoves,
  loadRival,
  loadTables,
} from './helpers/content.ts';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Random presses: one of UP/DOWN/LEFT/RIGHT every few steps, resolved by facing like the client does. */
function randomInputs(world: World, rnd: () => number, steps: number): number[] {
  const bits: number[] = [];
  let wait = 0;
  for (let i = 0; i < steps; i++) {
    let b = 0;
    if (wait === 0) {
      const k = Math.floor(rnd() * 4);
      const facing = world.player.facingRight;
      b = k === 0 ? 1 : k === 1 ? 2 : k === 2 ? 4 | (facing ? 16 : 32) : 8 | (facing ? 32 : 16);
      wait = 2 + Math.floor(rnd() * 12);
    } else {
      wait--;
    }
    bits.push(b);
    if (!world.step(b)) break;
  }
  return bits;
}

describe.skipIf(!hasContent())('determinism', () => {
  const moves = loadMoves();
  const tables = loadTables();
  const missions = loadMissions();

  const cases: { level: number; mode: RunMode; seed: number }[] = [
    { level: 0, mode: 'free', seed: 1 },
    { level: 3, mode: 'flags', seed: 7 },
    { level: 5, mode: 'score', seed: 11 },
    { level: 0, mode: 'sprint', seed: 23 },
    { level: 11, mode: 'free', seed: 99 },
  ];

  for (const c of cases) {
    it(`level ${c.level} ${c.mode} seed ${c.seed}: replay reproduces the run`, () => {
      const make = (): World =>
        createRun({
          mode: c.mode,
          level: loadLevel(c.level),
          mission: missions.levels[c.level]!,
          moves,
          tables,
          rival: c.mode === 'sprint' ? loadRival(c.level) : null,
        });
      const a = make();
      const inputs = randomInputs(a, lcg(c.seed), 1500);
      expect(a.stepCount).toBeGreaterThan(100);
      const hashA = a.hash();

      const log = a.recorder.finish();
      expect(expandRuns(log)).toEqual(inputs.slice(0, a.stepCount));

      const b = make();
      b.replay(log);
      expect(b.stepCount).toBe(a.stepCount);
      expect(b.hash()).toBe(hashA);
      expect(b.player.x).toBe(a.player.x);
      expect(b.player.score!.score).toBe(a.player.score!.score);
      expect(b.rules.result).toEqual(a.rules.result);
    });
  }

  it('every original rival recording reaches its finish cell', () => {
    for (let levelId = 0; levelId < 12; levelId++) {
      const recording = loadRival(levelId);
      const mission = missions.levels[levelId]!;
      const world = createRun({
        mode: 'sprint',
        level: loadLevel(levelId),
        mission,
        moves,
        tables,
        rival: recording,
      });
      const rival = world.runners[0]!;
      const finish = world.level.finish!;
      const totalSteps = recording.entries.reduce((sum, e) => sum + e.ticks, 0);
      const budget = mission.rivalStartDelay / 30 + totalSteps + 50;
      let reachedAt = -1;
      for (let i = 1; i <= budget; i++) {
        world.step(0);
        const cx = (rival.x + (rival.handsDx >> 1)) >> 10;
        const cy = (rival.y + (rival.handsDy >> 1)) >> 10;
        if (cx === finish.x && (cy === finish.y || cy === finish.y - 1)) {
          reachedAt = i;
          break;
        }
      }
      expect(reachedAt, `level ${levelId} rival never reached the finish`).toBeGreaterThan(0);
    }
  });
});
