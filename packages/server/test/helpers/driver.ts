/**
 * Produces finished runs with the real simulation for end-to-end tests, and turns a finished
 * `World` into the `RunSubmission` a client would send.
 *
 * Plain random presses (the approach of packages/sim/test/determinism.test.ts) rarely finish a
 * level, so `findFinishedRun` falls back to a seeded guided search: random extensions of the
 * best prefix so far, judged by flags collected / checkpoints taken and the distance to the
 * next target. Everything is seeded, so the run found is the same on every test run.
 */
import { createRun, RULESET_ID, SIM_VERSION, type RunMode, type World } from '@parapet/sim';
import { PROTOCOL_VERSION, type Identity, type RunSubmission } from '@parapet/protocol';
import { contentHashFor, loadRunData } from '../../src/content.ts';

export type Rng = () => number;

export function lcg(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function makeWorld(levelId: number, mode: RunMode, withRival = false): World {
  const data = loadRunData(levelId, withRival);
  return createRun({
    mode,
    level: data.level,
    mission: data.mission,
    moves: data.moves,
    tables: data.tables,
    rival: data.rival,
  });
}

/** UP, DOWN, LEFT or RIGHT, resolved to FORWARD/BACK by facing like the client does. */
function pressBits(kind: number, facingRight: boolean): number {
  switch (kind) {
    case 0:
      return 1;
    case 1:
      return 2;
    case 2:
      return 4 | (facingRight ? 16 : 32);
    default:
      return 8 | (facingRight ? 32 : 16);
  }
}

/** Random presses every few steps until the run ends or `maxSteps` were taken. */
export function recordRandomRun(
  levelId: number,
  mode: RunMode,
  seed: number,
  maxSteps: number,
): World {
  const world = makeWorld(levelId, mode);
  const rnd = lcg(seed);
  let wait = 0;
  for (let i = 0; i < maxSteps; i++) {
    let b = 0;
    if (wait === 0) {
      b = pressBits(Math.floor(rnd() * 4), world.player.facingRight);
      wait = 2 + Math.floor(rnd() * 12);
    } else {
      wait--;
    }
    if (!world.step(b)) break;
  }
  return world;
}

interface Point {
  x: number;
  y: number;
}

/** Where the player should head next: the nearest flag, the next checkpoint or the finish. */
function target(world: World, mode: RunMode): Point | null {
  const rules = world.rules;
  const p = world.player;
  if (mode === 'flags') {
    let best: Point | null = null;
    let bestDist = Infinity;
    world.level.checkpoints.forEach((cp, i) => {
      if ((rules.remainingMask & (1 << i)) === 0) return;
      const d = Math.abs(p.x - (cp.x * 1024 + 512)) + Math.abs(p.y - (cp.y * 1024 + 1024));
      if (d < bestDist) {
        bestDist = d;
        best = cp;
      }
    });
    return best;
  }
  if (mode === 'sprint') {
    return world.level.checkpoints[rules.nextCheckpoint] ?? world.level.finish;
  }
  return world.level.finish;
}

/** Higher is better; a finished run beats everything. */
function progress(world: World, mode: RunMode): number {
  if (world.rules.result?.finished) return Number.MAX_SAFE_INTEGER;
  const t = target(world, mode);
  const p = world.player;
  const collected =
    mode === 'flags'
      ? 5 - world.rules.flagsLeft
      : mode === 'sprint'
        ? world.rules.nextCheckpoint
        : 0;
  const dist = t ? Math.abs(p.x - (t.x * 1024 + 512)) + 2 * Math.abs(p.y - (t.y * 1024 + 1024)) : 0;
  const ended = world.rules.result ? 5_000_000 : 0;
  return collected * 10_000_000 - dist - ended;
}

interface PolicyState {
  wait: number;
  bits: number;
}

/** Biased random presses: mostly towards the target, often UP (jumps, wall runs, pull-ups). */
function policyStep(world: World, mode: RunMode, rnd: Rng, state: PolicyState): number {
  if (state.wait > 0) {
    state.wait--;
    return state.bits;
  }
  const t = target(world, mode);
  const p = world.player;
  const targetLeft = t ? t.x * 1024 + 512 < p.x : !p.facingRight;
  const r = rnd();
  let b: number;
  if (r < 0.45) b = pressBits(targetLeft ? 3 : 2, p.facingRight);
  else if (r < 0.7) b = 1;
  else if (r < 0.8) b = 2;
  else if (r < 0.88) b = pressBits(targetLeft ? 2 : 3, p.facingRight);
  else b = 0;
  state.wait = 1 + Math.floor(rnd() * 12);
  state.bits = b;
  return b;
}

interface Candidate {
  bits: number[];
  score: number;
  world: World;
}

function simulate(
  levelId: number,
  mode: RunMode,
  prefix: readonly number[],
  rnd: Rng,
  extension: number,
): Candidate {
  const world = makeWorld(levelId, mode);
  const bits: number[] = [];
  for (const b of prefix) {
    bits.push(b);
    if (!world.step(b)) return { bits, score: progress(world, mode), world };
  }
  const state: PolicyState = { wait: 0, bits: 0 };
  for (let i = 0; i < extension; i++) {
    const b = policyStep(world, mode, rnd, state);
    bits.push(b);
    if (!world.step(b)) break;
  }
  return { bits, score: progress(world, mode), world };
}

/** Guided search for a finished run; returns null when `maxIterations` did not find one. */
export function searchFinishedRun(
  levelId: number,
  mode: RunMode,
  seed: number,
  maxIterations = 2000,
): World | null {
  const rnd = lcg(seed);
  let best = simulate(levelId, mode, [], rnd, 300);
  for (let i = 0; i < maxIterations && !best.world.rules.result?.finished; i++) {
    const cut = Math.floor(rnd() * Math.min(best.bits.length, 600));
    const prefix = best.bits.slice(0, best.bits.length - cut);
    const candidate = simulate(levelId, mode, prefix, rnd, 100 + Math.floor(rnd() * 500));
    if (
      candidate.score > best.score ||
      (candidate.score === best.score && candidate.bits.length < best.bits.length)
    ) {
      best = candidate;
    }
  }
  return best.world.rules.result?.finished ? best.world : null;
}

/** A finished run of the level: random seeds first, then the guided search. Throws if none. */
export function findFinishedRun(levelId: number, mode: RunMode): World {
  for (let seed = 1; seed <= 5; seed++) {
    const world = recordRandomRun(levelId, mode, seed, 20000);
    if (world.rules.result?.finished) return world;
  }
  for (let seed = 1; seed <= 5; seed++) {
    const world = searchFinishedRun(levelId, mode, seed);
    if (world) return world;
  }
  throw new Error(`no finished run found for level ${levelId} ${mode}`);
}

export interface SubmissionMeta {
  levelId: number;
  mode: RunMode;
  withRival?: boolean;
  playerName?: string;
  character?: number;
  identity?: Identity;
}

/** What a client sends after a run ended: the input log and the outcome it observed. */
export function buildSubmission(world: World, meta: SubmissionMeta): RunSubmission {
  const result = world.rules.result;
  return {
    protocolVersion: PROTOCOL_VERSION,
    simVersion: SIM_VERSION,
    rulesetId: RULESET_ID,
    contentHash: contentHashFor(meta.levelId),
    ...(meta.identity ? { identity: meta.identity } : {}),
    levelId: meta.levelId,
    mode: meta.mode,
    withRival: meta.withRival ?? false,
    playerName: meta.playerName ?? 'Tester',
    character: meta.character ?? 0,
    input: world.recorder.finish(),
    claimed: {
      finished: result?.finished ?? false,
      timeUp: result?.timeUp ?? false,
      time: result?.time ?? world.clock,
      score: world.player.score?.score ?? 0,
      steps: world.stepCount,
      hash: world.hash(),
    },
  };
}
