/**
 * The camera port must reproduce the original camera on the original 240×320 viewport:
 * position, target and spring velocity after every player step. Traces of schema 4 carry
 * those fields; older traces are skipped.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { World } from '@parapet/sim';
import { Camera } from '../src/render/Camera.ts';
import {
  GOLDEN_DIR,
  hasContent,
  isGoldenTrace,
  readGolden,
  loadLevel,
  loadMissions,
  loadMoves,
  loadRival,
  loadTables,
} from './helpers/content.ts';

interface TraceCam {
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
}

interface TraceStep {
  step: number;
  input: number | null;
  ended: boolean;
  cam?: TraceCam;
}

interface TraceMeta {
  schema?: number;
  level: number;
  missionType: number;
}

function camSnapshot(c: Camera): TraceCam {
  return { x: c.x, y: c.y, tx: c.targetX, ty: c.targetY, vx: c.velX, vy: c.velY };
}

function diff(expected: TraceCam, actual: TraceCam): string[] {
  const out: string[] = [];
  for (const key of Object.keys(actual) as (keyof TraceCam)[]) {
    if (expected[key] !== actual[key])
      out.push(`${key}: expected ${expected[key]}, got ${actual[key]}`);
  }
  return out;
}

describe.skipIf(!hasContent())('camera against the oracle traces', () => {
  const moves = loadMoves();
  const tables = loadTables();
  const missions = loadMissions();
  const files = readdirSync(GOLDEN_DIR).filter(isGoldenTrace);

  for (const file of files) {
    it(file, () => {
      const lines = readGolden(join(GOLDEN_DIR, file))
        .split('\n')
        .filter((l) => l.length > 0);
      const meta = (JSON.parse(lines[0]!) as { meta: TraceMeta }).meta;
      if ((meta.schema ?? 1) < 4) return;
      const steps = lines.slice(1).map((l) => JSON.parse(l) as TraceStep);
      const world = new World({
        level: loadLevel(meta.level),
        moves,
        tables,
        rules: { missionType: meta.missionType },
        levelId: meta.level,
        rivals:
          meta.missionType === 0
            ? [
                {
                  recording: loadRival(meta.level),
                  startDelay: missions.levels[meta.level]!.rivalStartDelay,
                },
              ]
            : [],
      });
      const camera = new Camera(240, 320);
      camera.reset(world.player, world.level);
      const first = steps[0]!;
      if (first.cam) {
        // Before the first step the original's target may point at the briefing coach or the
        // sprint flyover; only the position and the spring are comparable.
        const c = camSnapshot(camera);
        const initial = diff({ ...first.cam, tx: c.tx, ty: c.ty }, c);
        if (initial.length > 0)
          throw new Error(`${file}: initial camera differs:\n  ${initial.join('\n  ')}`);
      }
      for (let i = 1; i < steps.length; i++) {
        const expected = steps[i]!;
        world.step(expected.input ?? 0);
        // The original updates the camera after the player's step unless the run just ended.
        if (!expected.ended) camera.update(world.player, world.level);
        if (!expected.cam) continue;
        const problems = diff(expected.cam, camSnapshot(camera));
        if (problems.length > 0) {
          throw new Error(
            `${file}: step ${expected.step} camera differs:\n  ${problems.join('\n  ')}`,
          );
        }
      }
      expect(steps.length).toBeGreaterThan(1);
    });
  }
});
