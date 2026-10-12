/**
 * The camera port must reproduce the original camera on the original 240×320 viewport:
 * position, target and spring velocity after every player step. Traces of schema 4 carry
 * those fields; older traces are skipped.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { World } from '@parapet/sim';
import { Camera, cameraMaxY } from '../src/render/Camera.ts';
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

describe('camera aimed at a point', () => {
  const level = { width: 200, height: 60 } as World['level'];

  it('holds the point at the same screen fractions after a resize', () => {
    const camera = new Camera(292, 633);
    const x = 80 << 10;
    const y = 40 << 10;
    camera.aimAtPoint(x, y, 0.2, 0.58, level);
    camera.setViewport(844, 390);
    camera.refocus(level);
    expect(camera.x).toBe(x - Math.round((844 << 5) * 0.2));
    expect(camera.y).toBe(y - Math.round((390 << 5) * 0.58));
    expect(camera.prevX).toBe(camera.x);
  });

  it('forgets the point once it follows the runner again', () => {
    const camera = new Camera(240, 320);
    camera.aimAtPoint(80 << 10, 40 << 10, 0.5, 0.5, level);
    camera.moveTo(1000, 1000, level);
    camera.setViewport(320, 240);
    camera.refocus(level);
    expect([camera.x, camera.y]).toEqual([1000, 1000]);
  });
});

describe('camera keeping the runner above the touch buttons', () => {
  const levelOf = (width: number, height: number) =>
    ({ width, height, tileAt: () => 0 }) as unknown as World['level'];
  const runner = (x: number, y: number) => ({ x, y, renderX: x, renderY: y, vx: 0, vy: 0 });

  /** Where the feet and the level's bottom edge settle, in px from the top of the view. */
  function settle(view: [number, number], frame: number, level: World['level'], feetY: number) {
    const camera = new Camera(view[0], view[1]);
    camera.setFrame(frame);
    const player = runner(40 << 10, feetY);
    camera.reset(player, level);
    for (let i = 0; i < 400; i++) camera.update(player, level);
    return { feet: (feetY - camera.y) >> 5, bottom: ((level.height << 10) - camera.y) >> 5 };
  }

  for (const [name, view, frame, height] of [
    ['a phone held upright', [292, 633], 539, 17],
    ['a phone on its side', [844, 390], 262, 20],
  ] as const) {
    it(`stands a runner on the bottom floor just above the buttons on ${name}`, () => {
      const level = levelOf(100, height);
      const low = settle([view[0], view[1]], frame, level, (height - 1) << 10);
      // The level's bottom edge stops at the top of the buttons' place, the runner a tile above.
      expect(low.bottom).toBe(frame);
      expect(low.feet).toBe(frame - 32);
      // Higher up, the original's framing within the frame: well above the buttons.
      const high = settle([view[0], view[1]], frame, level, 3 << 10);
      expect(high.feet).toBeLessThan(frame * 0.6);
    });
  }

  it('frames in the whole view unless told otherwise', () => {
    const camera = new Camera(292, 633);
    expect(camera.frameH).toBe(camera.viewH);
    camera.setFrame(539);
    expect(camera.frameH).toBe(539 << 5);
    camera.setViewport(292, 400);
    expect(camera.frameH).toBe(400 << 5);
    camera.setFrame(null);
    expect(camera.frameH).toBe(camera.viewH);
    expect(cameraMaxY(17 << 10, 539 << 5)).toBe((17 << 10) - (539 << 5));
  });
});
