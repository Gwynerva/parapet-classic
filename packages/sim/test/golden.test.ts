/**
 * Golden traces produced by the Java oracle (reference/oracle) must be reproduced bit for bit.
 * Each trace is one JSON object per step with the original field names.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { World } from '../src/world.ts';
import { modeForMissionType, timeLimitForMode } from '../src/run.ts';
import type { RunnerState } from '../src/runner/runner.ts';
import { loadRival, loadMissions, isGoldenTrace, readGolden } from './helpers/content.ts';
import { hasContent, loadLevel, loadMoves, loadTables } from './helpers/content.ts';

const goldenDir = join(dirname(fileURLToPath(import.meta.url)), 'golden');

interface TraceMeta {
  schema?: number;
  level: number;
  missionType: number;
  steps: number;
  playerIndex: number;
}

interface TraceProbe {
  hit: boolean;
  k: number;
  tile: number;
  x: number;
  y: number;
}

interface TraceStep {
  step: number;
  input: number;
  move: number;
  timer: number;
  k: number;
  l: number;
  g: number;
  h: number;
  q: number;
  r: number;
  u: number;
  v: number;
  t: number;
  O: number;
  P: number;
  Q: number;
  E: number;
  F: number;
  K: number;
  L: number;
  M: number;
  N: number;
  w: number;
  x: number;
  z: number;
  a: boolean;
  b: boolean;
  c: boolean;
  d: boolean;
  contact: number;
  probes: TraceProbe[];
  score: number;
  mult: number;
  meter: number;
  clock: number;
  ended: boolean;
  rivals?: TraceRival[];
}

interface TraceRival {
  input: number;
  move: number;
  timer: number;
  k: number;
  l: number;
  g: number;
  h: number;
  q: number;
  r: number;
  u: number;
  v: number;
  t: number;
  O: number;
  P: number;
  Q: number;
  E: number;
  F: number;
  K: number;
  L: number;
  M: number;
  N: number;
  w: number;
  x: number;
  z: number;
  a: boolean;
  b: boolean;
  c: boolean;
  d: boolean;
  contact: number;
  probes: TraceProbe[];
}

function loadTrace(file: string): { meta: TraceMeta; steps: TraceStep[] } {
  const lines = readGolden(join(goldenDir, file))
    .split('\n')
    .filter((l) => l.length > 0);
  const meta = (JSON.parse(lines[0]!) as { meta: TraceMeta }).meta;
  const steps = lines.slice(1).map((l) => JSON.parse(l) as TraceStep);
  return { meta, steps };
}

function runnerSnapshot(r: RunnerState): Omit<TraceRival, 'input'> {
  return {
    move: r.moveId,
    timer: r.moveTimer,
    k: r.x,
    l: r.y,
    g: r.handsDx,
    h: r.handsDy,
    q: r.vx,
    r: r.vy,
    u: r.prevVx,
    v: r.prevVy,
    t: r.tangentSpeed,
    O: r.jumpPowerA,
    P: r.jumpPowerB,
    Q: r.inputBuffer,
    E: r.phaseTime,
    F: r.phaseDuration,
    K: r.impulseX,
    L: r.impulseY,
    M: r.accX,
    N: r.accY,
    w: r.storedSpeed,
    x: r.snapType,
    z: r.impulseType,
    a: r.handsPinned,
    b: r.facingRight,
    c: r.handsAnchored,
    d: r.facingLocked,
    contact: r.contactProbe,
    probes: r.probes.map((p) => ({ hit: p.hit, k: p.surface, tile: p.tile, x: p.px, y: p.py })),
  };
}

function snapshot(world: World): Omit<TraceStep, 'step' | 'input' | 'ended' | 'rivals'> {
  const s = world.player.score!;
  return {
    ...runnerSnapshot(world.player),
    score: s.score,
    mult: s.multiplier,
    meter: s.meter,
    clock: world.clock,
  };
}

function diff(expectedObj: object, actualObj: object): string[] {
  const expected = expectedObj as Record<string, unknown>;
  const actual = actualObj as Record<string, unknown>;
  const out: string[] = [];
  for (const key of Object.keys(actual)) {
    const e = expected[key];
    const a = actual[key];
    if (key === 'probes') {
      for (let i = 0; i < 3; i++) {
        const ep = (expected.probes as TraceProbe[])[i]!;
        const ap = (actual.probes as TraceProbe[])[i]!;
        for (const pk of Object.keys(ap) as (keyof TraceProbe)[]) {
          if (ep[pk] !== ap[pk]) out.push(`probes[${i}].${pk}: expected ${ep[pk]}, got ${ap[pk]}`);
        }
      }
    } else if (e !== a) {
      out.push(`${key}: expected ${e}, got ${a}`);
    }
  }
  return out;
}

/** Time limit the original applies to a mission type: Score runs use z[4], Challenges the goal word. */
function timeLimitFor(levelId: number, missionType: number): number {
  const info = loadMissions().levels[levelId]!;
  const mode = modeForMissionType(missionType);
  return mode ? timeLimitForMode(info, mode) : -1;
}

describe.skipIf(!hasContent())('golden traces from the Java oracle', () => {
  const moves = loadMoves();
  const tables = loadTables();
  const missions = loadMissions();
  const files = readdirSync(goldenDir).filter(isGoldenTrace);

  for (const file of files) {
    it(file, () => {
      const { meta, steps } = loadTrace(file);
      const withRival = meta.missionType === 0 && (meta.schema ?? 1) >= 2;
      const world = new World({
        level: loadLevel(meta.level),
        moves,
        tables,
        rules: {
          missionType: meta.missionType,
          timeLimit: timeLimitFor(meta.level, meta.missionType),
        },
        levelId: meta.level,
        rivals: withRival
          ? [
              {
                recording: loadRival(meta.level),
                startDelay: missions.levels[meta.level]!.rivalStartDelay,
              },
            ]
          : [],
      });
      const first = steps[0]!;
      expect(first.step).toBe(0);
      const initial = diff(first, snapshot(world));
      if (first.rivals) {
        first.rivals.forEach((er, ri) => {
          for (const m of diff(er, runnerSnapshot(world.runners[ri]!)))
            initial.push(`rival[${ri}] ${m}`);
        });
      }
      expect(initial, 'initial state').toEqual([]);
      for (let i = 1; i < steps.length; i++) {
        const expected = steps[i]!;
        const running = world.step(expected.input);
        const mismatches = diff(expected, snapshot(world));
        if (expected.rivals) {
          expected.rivals.forEach((er, ri) => {
            const rr = world.runners[ri]!;
            for (const m of diff(er, runnerSnapshot(rr))) mismatches.push(`rival[${ri}] ${m}`);
          });
        }
        if (mismatches.length > 0) {
          throw new Error(`${file}: step ${expected.step} differs:\n  ${mismatches.join('\n  ')}`);
        }
        expect(!running, `ended at step ${expected.step}`).toBe(expected.ended);
      }
    });
  }
});
