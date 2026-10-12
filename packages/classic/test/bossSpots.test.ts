/**
 * Where a boss waits once its time is up, and its glimpses: by the player's next flag, never
 * over the flag, never where its glimpse ends up, floating beside a flag that hangs in the air;
 * and the glimpse's frames (fades, the pause between loops, no interpolation across a cut).
 */
import { describe, expect, it } from 'vitest';
import {
  Level,
  LEVEL_COUNT,
  missionTypeForMode,
  type LevelData,
  type PhysicsTables,
} from '@parapet/sim';
import type { GlimpseTrack } from '@parapet/runtime/content/glimpses.ts';
import tablesJson from '@content/playman/extracted/tables.json';
import { contestGlimpses } from '../src/app/bosses.ts';
import { glimpseFrame, GLIMPSE_GAP_STEPS } from '../src/app/ui/BossGlimpse.ts';
import {
  glimpseCells,
  levelGrid,
  MAX_STAND_TILES,
  nearestFlag,
  waitingSpot,
  type SpotGrid,
} from '../src/app/ui/bossSpots.ts';

/** A grid drawn as text: `#` a floor block, `.` air (outside: neither). */
function gridOf(rows: string[]): SpotGrid {
  const at = (x: number, y: number): string => rows[y]?.[x] ?? ' ';
  return { air: (x, y) => at(x, y) === '.', floor: (x, y) => at(x, y) === '#' };
}

const levelFiles = import.meta.glob('@content/playman/extracted/levels/*.json', {
  eager: true,
  import: 'default',
});

function loadLevel(levelId: number): LevelData {
  const found = Object.entries(levelFiles).find(([path]) => path.endsWith(`/${levelId}.json`));
  if (!found) throw new Error(`level ${levelId} is missing`);
  return found[1] as LevelData;
}

const cell = (spot: { x: number; y: number }) => ({ x: spot.x >> 10, y: (spot.y >> 10) - 1 });
const none = new Set<number>();

describe('where the boss waits', () => {
  it('goes to the nearest flag still up', () => {
    const flags = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    expect(nearestFlag(flags, 0b111, 9 << 10, 0)).toBe(1);
    expect(nearestFlag(flags, 0b101, 9 << 10, 0)).toBe(0);
    expect(nearestFlag(flags, 0b100, 0, 0)).toBe(2);
    expect(nearestFlag(flags, 0, 0, 0)).toBe(-1);
  });

  it('covers three rows of cells along a glimpse, from the feet or the hands', () => {
    const feet = glimpseCells([{ x: (4 << 10) + 512, y: 8 << 10, anchored: false }]);
    const hands = glimpseCells([{ x: (4 << 10) + 512, y: (8 << 10) + 100, anchored: true }]);
    expect(feet.size).toBe(3);
    expect(hands.size).toBe(3);
    expect([...feet]).not.toEqual([...hands]);
  });

  const ground = [
    '..............',
    '..............',
    '..............',
    '..............',
    '##############',
  ];

  it('stands on the floor by a flag, never over it, on the side it prefers', () => {
    for (const preferRight of [true, false]) {
      const spot = waitingSpot(gridOf(ground), {
        cx: 7,
        cy: 3,
        faceX: (7 << 10) + 512,
        preferRight,
        clip: none,
        after: none,
      });
      const c = cell(spot);
      expect(spot.floating).toBeUndefined();
      expect(c.y).toBe(3);
      expect(Math.abs(c.x - 7)).toBeGreaterThanOrEqual(2);
      expect(c.x > 7).toBe(preferRight);
      expect(spot.facingRight).toBe(c.x < 7);
    }
  });

  it('keeps off the cells its glimpse passes after the flag', () => {
    // The glimpse runs off to the right after the flag.
    const after = glimpseCells(
      [8, 9, 10, 11, 12].map((x) => ({ x: (x << 10) + 512, y: 4 << 10, anchored: false })),
    );
    const spot = waitingSpot(gridOf(ground), {
      cx: 7,
      cy: 3,
      faceX: (7 << 10) + 512,
      preferRight: true,
      clip: after,
      after,
    });
    expect(cell(spot).x).toBeLessThan(7);
  });

  it('floats beside a flag hanging high over the floor', () => {
    const rows = Array.from({ length: 12 }, () => '..............');
    rows.push('##############');
    const spot = waitingSpot(gridOf(rows), {
      cx: 7,
      cy: 4,
      faceX: (7 << 10) + 512,
      preferRight: false,
      clip: none,
      after: none,
    });
    expect(spot.floating).toBe(true);
    const c = cell(spot);
    expect(c.x).toBeLessThan(7);
    expect(c.y).toBeLessThanOrEqual(4);
  });

  it('stands on a ledge a few tiles above a flag rather than float', () => {
    const rows = ['..............', '..............', '......###.....', '..............'];
    rows.push('..............', '..............');
    const spot = waitingSpot(gridOf(rows), {
      cx: 9,
      cy: 4,
      faceX: (9 << 10) + 512,
      preferRight: false,
      clip: none,
      after: none,
    });
    expect(spot.floating).toBeUndefined();
    expect(cell(spot)).toEqual({ x: 7, y: 1 });
  });
});

describe('the bosses by the flags of the real levels', () => {
  it('wait clear of what their glimpses do after each flag, floating only where they must', () => {
    const tables = tablesJson as PhysicsTables;
    const floating: string[] = [];
    for (let levelId = 0; levelId < LEVEL_COUNT; levelId++) {
      const level = new Level(loadLevel(levelId), missionTypeForMode('flags'));
      const grid = levelGrid(level, tables);
      const tracks = contestGlimpses(levelId, 'flags');
      expect(tracks, `level ${levelId}`).not.toBeNull();
      level.checkpoints.forEach((cp, i) => {
        const track = tracks![i]!;
        const after = glimpseCells(track.poses.slice(track.at));
        const spot = waitingSpot(grid, {
          cx: cp.x,
          cy: cp.y,
          faceX: (cp.x << 10) + 512,
          preferRight: track.poses.at(-1)!.x < (cp.x << 10) + 512,
          clip: glimpseCells(track.poses),
          after,
        });
        const c = cell(spot);
        for (let bx = c.x - 1; bx <= c.x + 1; bx++) {
          for (let by = c.y - 2; by <= c.y; by++) {
            expect(after.has(bx * 65536 + by + 32768), `level ${levelId} flag ${i}`).toBe(false);
          }
        }
        if (spot.floating) floating.push(`${levelId}:${i}`);
        else expect(Math.hypot(c.x - cp.x, c.y - cp.y)).toBeLessThanOrEqual(MAX_STAND_TILES);
      });
    }
    // The last level's first two flags hang far above any floor.
    expect(floating).toContain('11:0');
    expect(floating).toContain('11:1');
    expect(floating.length).toBeLessThanOrEqual(10);
  });
});

describe('the glimpse loop', () => {
  const pose = (x: number, cut = false) => ({
    x,
    y: 0,
    a: 1,
    b: 2,
    t: 0,
    flipX: false,
    anchored: false,
    cut,
  });
  const track: GlimpseTrack = {
    poses: [pose(0, true), pose(100), pose(200), pose(5000, true), pose(5100)],
    at: 2,
  };

  it('fades in and out and rests between loops', () => {
    expect(glimpseFrame(track, -1, 0.5)).toBeNull();
    expect(glimpseFrame(track, track.poses.length, 0)).toBeNull();
    expect(glimpseFrame(track, 0, 0)!.opacity).toBe(0);
    expect(glimpseFrame(track, 2, 0)!.opacity).toBeGreaterThan(0);
    expect(glimpseFrame(track, 4, 0.99)!.opacity).toBeLessThan(0.2);
    expect(GLIMPSE_GAP_STEPS).toBeGreaterThan(0);
  });

  it('glides between steps but not across a cut', () => {
    expect(glimpseFrame(track, 2, 0.5)!.pose.x).toBe(150);
    expect(glimpseFrame(track, 3, 0.5)!.pose.x).toBe(5000);
    expect(glimpseFrame(track, 4, 0.5)!.pose.x).toBe(5050);
  });
});

describe('the bosses glimpses in the game', () => {
  it('are there for every level and mode, five flags each', () => {
    for (let levelId = 0; levelId < LEVEL_COUNT; levelId++) {
      for (const kind of ['flags', 'sprint'] as const) {
        const tracks = contestGlimpses(levelId, kind);
        expect(tracks, `${levelId} ${kind}`).not.toBeNull();
        expect(tracks!.length).toBe(5);
        for (const t of tracks!) expect(t?.poses.length).toBeGreaterThan(t!.at);
      }
    }
  });
});
