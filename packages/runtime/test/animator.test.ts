/**
 * The animator must reproduce the original's per-step animation state (class `g`) and the draw
 * parameters computed by `aj()`. Golden traces of schema 3 carry those fields for the player and
 * the rivals; older traces are skipped.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MoveTable, STEP, World, type RunnerState } from '@parapet/sim';
import { Animator, buildClipTable } from '../src/anim/Animator.ts';
import {
  GOLDEN_DIR,
  hasContent,
  isGoldenTrace,
  readGolden,
  loadAnims,
  loadLevel,
  loadMissions,
  loadMoves,
  loadRival,
  loadTables,
} from './helpers/content.ts';

interface TraceAnim {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  g: number;
  h: number;
  i: number;
  j: number;
  k: number;
  l: number;
  ba: boolean;
  bb: boolean;
  bc: boolean;
}

interface TraceDraw {
  x: number;
  y: number;
  flip: boolean;
  blend: boolean;
  s: number;
  s2: number;
  t: number;
}

interface TraceEntity {
  input: number | null;
  anim?: TraceAnim;
  draw?: TraceDraw;
}

interface TraceStep extends TraceEntity {
  step: number;
  ended: boolean;
  rivals?: TraceEntity[];
}

interface TraceMeta {
  schema?: number;
  level: number;
  missionType: number;
}

function animSnapshot(a: Animator): TraceAnim {
  return {
    a: a.clipLength,
    b: a.frame,
    c: a.clipStart,
    d: a.mode,
    e: a.prevClipLength,
    f: a.prevFrame,
    g: a.prevClipStart,
    h: a.anchorX,
    i: a.anchorY,
    j: a.tween,
    k: a.time,
    l: a.duration,
    ba: a.notFacingAtSet,
    bb: a.prevHandsAnchored,
    bc: a.handsAnchored,
  };
}

function drawSnapshot(a: Animator, r: RunnerState): TraceDraw {
  const p = a.drawParams(r);
  return {
    x: p.x,
    y: p.y,
    flip: !p.flipX,
    blend: a.blending,
    s: a.previousKeyframe(),
    s2: a.currentKeyframe(),
    t: a.blending ? a.tween << 8 : -1,
  };
}

function diff(expected: object, actual: object): string[] {
  const e = expected as Record<string, unknown>;
  const a = actual as Record<string, unknown>;
  const out: string[] = [];
  for (const key of Object.keys(a)) {
    if (e[key] !== a[key]) out.push(`${key}: expected ${e[key]}, got ${a[key]}`);
  }
  return out;
}

describe.skipIf(!hasContent())('animator against the oracle traces', () => {
  const moves = loadMoves();
  const tables = loadTables();
  const anims = loadAnims();
  const missions = loadMissions();
  const clips = buildClipTable(anims.clips);
  const table = new MoveTable(moves);
  const files = readdirSync(GOLDEN_DIR).filter(isGoldenTrace);

  for (const file of files) {
    it(file, () => {
      const lines = readGolden(join(GOLDEN_DIR, file))
        .split('\n')
        .filter((l) => l.length > 0);
      const meta = (JSON.parse(lines[0]!) as { meta: TraceMeta }).meta;
      if ((meta.schema ?? 1) < 3) return;
      const steps = lines.slice(1).map((l) => JSON.parse(l) as TraceStep);
      const withRival = meta.missionType === 0;
      const world = new World({
        level: loadLevel(meta.level),
        moves,
        tables,
        rules: { missionType: meta.missionType },
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
      const animators = new Map<RunnerState, Animator>();
      for (const r of world.runners) {
        const a = new Animator(clips, 1);
        a.setIdle(r);
        animators.set(r, a);
      }
      for (let i = 1; i < steps.length; i++) {
        const expected = steps[i]!;
        const steppedRivals = new Set<RunnerState>();
        world.step(expected.input ?? 0);
        for (const ev of world.events) {
          if (ev.type !== 'move') continue;
          animators.get(ev.runner)!.setMove(table.get(ev.to), ev.timer, ev.entry);
        }
        // Rivals advance their animation only on the steps they were stepped.
        expected.rivals?.forEach((er, ri) => {
          if (er.input !== null) steppedRivals.add(world.runners[ri]!);
        });
        for (const [r, a] of animators) {
          if (r !== world.player && !steppedRivals.has(r)) continue;
          // The original skips the player's animation update on the step that ends the run.
          if (r === world.player && expected.ended) continue;
          a.update(STEP, r, world.clock);
        }
        const check = (label: string, entity: TraceEntity, r: RunnerState): void => {
          if (!entity.anim || !entity.draw) return;
          const a = animators.get(r)!;
          const problems = [
            ...diff(entity.anim, animSnapshot(a)).map((m) => `anim.${m}`),
            ...diff(entity.draw, drawSnapshot(a, r)).map((m) => `draw.${m}`),
          ];
          if (problems.length > 0) {
            throw new Error(
              `${file}: step ${expected.step} ${label} differs:\n  ${problems.join('\n  ')}`,
            );
          }
        };
        check('player', expected, world.player);
        expected.rivals?.forEach((er, ri) => {
          if (er.input !== null) check(`rival[${ri}]`, er, world.runners[ri]!);
        });
      }
      expect(steps.length).toBeGreaterThan(1);
    });
  }
});
