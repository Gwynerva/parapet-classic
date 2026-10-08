/**
 * `World.saveState` / `restoreState`: a world put back into a saved state must run exactly as
 * it did from that moment (same events, same hash, same input log), whatever ran in between.
 */
import { describe, expect, it } from 'vitest';
import { createRun, type RunMode } from '../src/run.ts';
import type { World, WorldEvent } from '../src/world.ts';
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

function pressesFor(rnd: () => number, steps: number): number[] {
  const keys: number[] = [];
  let wait = 0;
  for (let i = 0; i < steps; i++) {
    if (wait === 0) {
      keys.push(1 + Math.floor(rnd() * 4));
      wait = 2 + Math.floor(rnd() * 12);
    } else {
      keys.push(0);
      wait--;
    }
  }
  return keys;
}

/** Press bits of key 1..4 (up, down, right, left) for the facing, like the client resolves them. */
function bitsOf(world: World, key: number): number {
  const facing = world.player.facingRight;
  switch (key) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 4 | (facing ? 16 : 32);
    case 4:
      return 8 | (facing ? 32 : 16);
    default:
      return 0;
  }
}

/** Runs `keys` from the world's current state; returns per-step hashes and event summaries. */
function run(world: World, keys: readonly number[]): string[] {
  const trace: string[] = [];
  for (const key of keys) {
    const going = world.step(bitsOf(world, key));
    const events = world.events.map((e: WorldEvent) => e.type).join(',');
    trace.push(`${world.clock}:${world.hash()}:${events}`);
    if (!going) break;
  }
  return trace;
}

describe.skipIf(!hasContent())('World.saveState', () => {
  const moves = loadMoves();
  const tables = loadTables();
  const missions = loadMissions();
  const make = (level: number, mode: RunMode): World =>
    createRun({
      mode,
      level: loadLevel(level),
      mission: missions.levels[level]!,
      moves,
      tables,
      rival: null,
    });

  const cases: { level: number; mode: RunMode; seed: number }[] = [
    { level: 0, mode: 'flags', seed: 3 },
    { level: 4, mode: 'sprint', seed: 5 },
    { level: 9, mode: 'flags', seed: 8 },
    { level: 11, mode: 'sprint', seed: 13 },
  ];

  for (const c of cases) {
    it(`level ${c.level} ${c.mode}: restoring replays the same continuation`, () => {
      const rnd = lcg(c.seed);
      const prefix = pressesFor(rnd, 400);
      const suffix = pressesFor(rnd, 900);
      const detour = pressesFor(rnd, 700);

      const world = make(c.level, c.mode);
      run(world, prefix);
      const saved = world.saveState();
      const expected = run(world, suffix);
      const expectedLog = world.recorder.finish();
      expect(expected.length).toBeGreaterThan(100);

      // Wander off somewhere else, then come back.
      world.restoreState(saved);
      run(world, detour);
      world.restoreState(saved);
      expect(run(world, suffix)).toEqual(expected);
      expect(world.recorder.finish()).toEqual(expectedLog);

      // A state saved without the input log continues identically; only the log restarts.
      const light = make(c.level, c.mode);
      run(light, prefix);
      const lightState = light.saveState(false);
      run(light, detour);
      light.restoreState(lightState);
      expect(run(light, suffix)).toEqual(expected);
    });
  }

  it('worlds with rivals cannot be saved', () => {
    const world = createRun({
      mode: 'sprint',
      level: loadLevel(0),
      mission: missions.levels[0]!,
      moves,
      tables,
      rival: loadRival(0),
    });
    expect(() => world.saveState()).toThrow();
  });
});
