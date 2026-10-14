/**
 * The look-ahead ray of the air states (`boolean_a(e,int,int)`, d.java line 9069; the port's
 * `lookaheadRay`): from the runner's feet along its velocity, 400 time units ahead. Condition 68
 * holds while it reaches a wall that goes on up; UP then arms the wall run (state 30), which
 * starts when the runner touches the wall. The ray is cast on a copy of the runner after every
 * step, so watching it changes nothing.
 */
import { evalCondition, lookaheadRay, type World } from '@parapet/sim';
import type { Frame } from '../frame.ts';
import { RGB, rgb, SERIES } from '../palette.ts';
import type { ToPixels } from '../demoScene.ts';
import type { Track } from '../record.ts';

/** How far ahead the ray looks, in time units of the runner's velocity. */
export const RAY_TIME = 400;

export interface RayStep {
  /** From the feet (the hands when they hold on) to where the velocity takes them. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Where the ray met a tile, if it did. */
  hit: { x: number; y: number } | null;
  /** Condition 68: the wall the ray meets goes on up. */
  sees: boolean;
}

/** The player's ray after every step, by step (for `record`'s `observe`). */
export function rayWatch(): { rays: Map<number, RayStep>; observe: (world: World) => void } {
  const rays = new Map<number, RayStep>();
  const observe = (world: World): void => {
    const ctx = { level: world.level, tables: world.tables };
    const r = world.player.clone();
    const dy = ((r.vy * RAY_TIME) / 1024) | 0;
    const hit = lookaheadRay(r, ctx, dy, RAY_TIME);
    const ox = r.handsAnchored ? r.handsDx : 0;
    const oy = r.handsAnchored ? r.handsDy : 0;
    rays.set(world.stepCount - 1, {
      x0: r.x + ox,
      y0: r.y + oy,
      x1: r.x + ox + (((r.vx * RAY_TIME) / 1024) | 0),
      y1: r.y + oy + dy,
      hit: hit ? { x: r.lookahead.px, y: r.lookahead.py } : null,
      sees: evalCondition(world.player.clone(), ctx, 68),
    });
  };
  return { rays, observe };
}

/** The steps the ray sees the wall, as stretches `[first, last]`. */
export function seeingSpans(rays: ReadonlyMap<number, RayStep>): [number, number][] {
  const out: [number, number][] = [];
  for (const [step, ray] of [...rays].sort((a, b) => a[0] - b[0])) {
    if (!ray.sees) continue;
    const last = out.at(-1);
    if (last && last[1] === step - 1) last[1] = step;
    else out.push([step, step]);
  }
  return out;
}

/** The air states the ray is drawn in: the jump, the fall, the armed wall run. */
const AIR = new Set([18, 12, 30]);

/**
 * Draws the ray at moment `t` while the runner is in the air: gliding from step to step, grey
 * while it sees no wall, in the "sees" colour when condition 68 holds.
 */
export function drawRay(
  frame: Frame,
  t: number,
  px: ToPixels,
  track: Track,
  rays: ReadonlyMap<number, RayStep>,
): void {
  const s = Math.floor(t);
  const now = rays.get(s);
  const before = rays.get(s - 1) ?? now;
  if (!now || !before || !AIR.has(track.after(s).moveId)) return;
  const f = t - s;
  const mix = (a: number, b: number): number => a + (b - a) * f;
  const x0 = px.x(mix(before.x0, now.x0));
  const y0 = px.y(mix(before.y0, now.y0));
  const x1 = px.x(mix(before.x1, now.x1));
  const y1 = px.y(mix(before.y1, now.y1));
  if (now.sees && now.hit) {
    // Solid up to the wall it sees, faint beyond.
    const c = rgb(SERIES[2]);
    const hx = px.x(now.hit.x);
    const hy = px.y(now.hit.y);
    frame.line(x0, y0, hx, hy, c);
    frame.line(hx, hy, x1, y1, c, { dash: 2, alpha: 0.4 });
    frame.ring(hx, hy, 4, c);
  } else {
    frame.line(x0, y0, x1, y1, RGB.muted, { dash: 3 });
    frame.disc(x1, y1, 1.5, RGB.muted);
  }
}
