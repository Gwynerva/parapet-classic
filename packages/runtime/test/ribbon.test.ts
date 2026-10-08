/**
 * Cloth (`render/fx/Ribbon.ts`) stays calm: behind and below a runner, without whipping when the
 * anchor bobs and jumps from step to step.
 */
import { describe, expect, it } from 'vitest';
import { Ribbon } from '../src/render/fx/Ribbon.ts';

const UNITS = 32;
const STEP_MS = 30;

function cape(): Ribbon {
  const texture = Array.from({ length: 24 }, () => 'aaaaaaa');
  return new Ribbon({ anchor: 'neck', texture, segments: 6, stiffness: 0.2 }, () => '#000000');
}

/** Runs `steps` simulation steps at `speed` px/s, the anchor bobbing, three frames a step. */
function run(r: Ribbon, steps: number, speed: number, from = 0): { x: number; y: number } {
  let x = from;
  let y = 0;
  for (let s = 0; s < steps; s++) {
    x += (speed * UNITS * STEP_MS) / 1000;
    y = (s % 4 < 2 ? -2 : 2) * UNITS;
    r.follow(x, y, true);
    for (let f = 0; f < 3; f++) r.update(STEP_MS / 3);
  }
  return { x, y };
}

describe('cloth', () => {
  it('trails behind and below a runner', () => {
    const r = cape();
    const root = run(r, 120, 300);
    const pts = r.points();
    for (const p of pts.slice(1)) {
      // Facing right: behind is to the left; never far above the root.
      expect(p.x).toBeLessThanOrEqual(root.x + 2 * UNITS);
      expect(p.y).toBeGreaterThan(root.y - 8 * UNITS);
    }
  });

  it('does not whip when the anchor jumps', () => {
    const r = cape();
    let { x } = run(r, 60, 200);
    // A sudden jump of the anchor (a keyframe change), then the run goes on.
    x += 10 * UNITS;
    r.follow(x, -6 * UNITS, true);
    let fastest = 0;
    let before = r.points();
    for (let f = 0; f < 40; f++) {
      r.update(10);
      const now = r.points();
      // The first frames carry the jump itself; after that the cloth must settle, not swing.
      if (f < 8) {
        before = now;
        continue;
      }
      // Relative to the root: how much the cloth itself swings.
      for (let i = 1; i < now.length; i++) {
        const mx = now[i]!.x - now[0]!.x - (before[i]!.x - before[0]!.x);
        const my = now[i]!.y - now[0]!.y - (before[i]!.y - before[0]!.y);
        fastest = Math.max(fastest, Math.hypot(mx, my) / UNITS);
      }
      before = now;
    }
    // Under two pixels per 10 ms frame once the jump has passed.
    expect(fastest).toBeLessThan(2);
  });

  it('swings little while running with a bobbing anchor', () => {
    const r = cape();
    run(r, 60, 300);
    let x = (60 * 300 * UNITS * STEP_MS) / 1000;
    let fastest = 0;
    let before = r.points();
    for (let s = 0; s < 60; s++) {
      x += (300 * UNITS * STEP_MS) / 1000;
      r.follow(x, (s % 4 < 2 ? -2 : 2) * UNITS, true);
      for (let f = 0; f < 3; f++) {
        r.update(STEP_MS / 3);
        const now = r.points();
        const tip = now.length - 1;
        const mx = now[tip]!.x - now[0]!.x - (before[tip]!.x - before[0]!.x);
        const my = now[tip]!.y - now[0]!.y - (before[tip]!.y - before[0]!.y);
        fastest = Math.max(fastest, Math.hypot(mx, my) / UNITS);
        before = now;
      }
    }
    expect(fastest).toBeLessThan(2);
  });

  it('stays alive: a running cape streams back and waves, a bag swings at the hip', () => {
    const range = (r: Ribbon, speed: number): { dx: number; spread: number } => {
      let x = 0;
      let lo = Infinity;
      let hi = -Infinity;
      let sum = 0;
      let n = 0;
      for (let s = 0; s < 120; s++) {
        x += (speed * UNITS * STEP_MS) / 1000;
        r.follow(x + (s % 6 < 3 ? -1.5 : 1.5) * UNITS, (s % 4 < 2 ? -2 : 2) * UNITS, true);
        for (let f = 0; f < 3; f++) {
          r.update(STEP_MS / 3);
          if (s < 60) continue;
          const p = r.points();
          const dx = (p[p.length - 1]!.x - p[0]!.x) / UNITS;
          lo = Math.min(lo, dx);
          hi = Math.max(hi, dx);
          sum += dx;
          n++;
        }
      }
      return { dx: sum / n, spread: hi - lo };
    };
    const running = range(cape(), 250);
    // Well behind the shoulders, and moving.
    expect(running.dx).toBeLessThan(-15);
    expect(running.spread).toBeGreaterThan(2);
    const bag = new Ribbon(
      {
        anchor: 'back',
        texture: Array.from({ length: 18 }, () => 'aaa'),
        segments: 1,
        stiffness: 0.6,
      },
      () => '#000000',
    );
    expect(range(bag, 250).spread).toBeGreaterThan(3);
  });

  it('hangs down when the runner stands', () => {
    const r = cape();
    run(r, 30, 200);
    for (let f = 0; f < 300; f++) {
      if (f % 3 === 0) r.follow((30 * 200 * UNITS * STEP_MS) / 1000, 0, true);
      r.update(STEP_MS / 3);
    }
    const pts = r.points();
    const tip = pts[pts.length - 1]!;
    const root = pts[0]!;
    // Mostly below the root, a little behind.
    expect(tip.y - root.y).toBeGreaterThan(Math.abs(tip.x - root.x));
  });
});
