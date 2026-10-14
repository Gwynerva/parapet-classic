/**
 * The same low block taken four ways on the Moves menu's little level (`monkeyVault`): no key
 * (the runner steps over it by itself), a jump, a jump and a monkey vault, a tiger jump. Each
 * way's earliest press that gets over cleanly, found by trying every step, and when the runner
 * then reaches a line past the block.
 */
import type { DemoKey, DemoPress } from '@parapet/runtime/moves/MoveDemo.ts';
import { parseDemoLevel } from '@parapet/runtime/moves/demoLevel.ts';
import { FAIL_STATES } from '@parapet/runtime/moves/MoveDemo.ts';
import { MoveId } from '@parapet/sim';
import { demoWorld, press } from '../demo.ts';
import { arrowOf } from '../draw.ts';
import { demoScene } from '../demoScene.ts';
import type { Lab } from '../lab.ts';
import { RGB, rgb } from '../palette.ts';
import { record, type Track } from '../record.ts';
import { gridScene, STEP_MS, type Scene } from '../scene.ts';

/** The line the runners race to (world units), and the last step tried. */
export const FINISH_X = 20 * 1024;
const END_STEP = 240;

export interface Way {
  name: string;
  /** The move that shows the way was taken (none: no key at all). */
  move: number | null;
  presses: DemoPress[];
  track: Track;
  /** The step the runner crosses the line. */
  arrival: number;
}

function attempt(
  lab: Lab,
  presses: DemoPress[],
): { track: Track; arrival: number; failed: boolean; moves: number[] } {
  const demo = lab.demo('monkeyVault');
  const { world, input } = demoWorld(lab, demo, { presses });
  const track = record(world, lab.clips, { steps: END_STEP - world.stepCount, input }).tracks[0]!;
  let arrival = -1;
  for (let s = track.start; s < track.start + track.steps.length - 1; s++) {
    if (track.after(s).x >= FINISH_X) {
      arrival = s;
      break;
    }
  }
  const moves = track.entries().map((e) => e.id);
  return { track, arrival, failed: moves.some((m) => FAIL_STATES.includes(m)), moves };
}

/** The fastest clean way over the block with `keys` pressed (each tried on every step). */
function fastest(
  lab: Lab,
  name: string,
  move: number | null,
  keys: DemoKey[],
  gap: number[],
): Way | null {
  let best: Way | null = null;
  const tryIt = (presses: DemoPress[]): void => {
    const a = attempt(lab, presses);
    if (a.arrival < 0 || a.failed || (move !== null && !a.moves.includes(move))) return;
    if (!best || a.arrival < best.arrival)
      best = { name, move, presses, track: a.track, arrival: a.arrival };
  };
  if (keys.length === 0) tryIt([]);
  for (let s = 95; s <= 135 && keys.length > 0; s++) {
    if (keys.length === 1) tryIt([press(s, keys[0]!)]);
    else for (const g of gap) tryIt([press(s, keys[0]!), press(s + g, keys[1]!)]);
  }
  return best;
}

const cached = new WeakMap<Lab, Way[]>();

/** The four ways, fastest first. */
export function ways(lab: Lab): Way[] {
  const known = cached.get(lab);
  if (known) return known;
  const gaps = Array.from({ length: 23 }, (_, i) => i + 1);
  const out = [
    fastest(lab, 'tiger jump', MoveId.TIGER_JUMP, ['fwd'], []),
    fastest(lab, 'jump', MoveId.JUMP, ['up'], []),
    fastest(lab, 'monkey vault', MoveId.MONKEY_VAULT, ['up', 'up'], gaps),
    fastest(lab, 'no key', null, [], []),
  ].filter((w): w is Way => w !== null);
  out.sort((a, b) => a.arrival - b.arrival);
  cached.set(lab, out);
  return out;
}

/** The ways as lanes, a line at the finish and each runner's time behind the fastest. */
export function raceScene(lab: Lab, all: readonly Way[], colors: readonly string[]): Scene {
  const demo = lab.demo('monkeyVault');
  const level = parseDemoLevel(demo.rows);
  const from = 96;
  const to = Math.max(...all.map((w) => w.arrival)) + 12;
  const first = Math.min(...all.map((w) => w.arrival));
  const lanes = all.map((w, i) =>
    demoScene(lab, {
      level,
      view: { x: 280, y: 104, width: 392, height: 96 },
      actors: [{ track: w.track, ink: colors[i] }],
      from,
      to,
      timeline: {
        from,
        to,
        rows: [
          {
            color: colors[i]!,
            presses: w.presses.map((p) => ({ step: p.step, key: arrowOf(p.key, true) })),
            marks: [w.arrival],
          },
        ],
      },
      underlay: (frame, _t, px) => frame.fill(px.x(FINISH_X), 0, 1, frame.height, RGB.muted),
      overlay: (frame, t) => {
        if (t < w.arrival) return;
        const text = `+${(((w.arrival - first) * STEP_MS) / 1000).toFixed(2)} s`;
        frame.text(lab.fonts.small, text, frame.width - 6, 4, rgb(colors[i]!), {
          align: 'right',
          outline: true,
        });
      },
    }),
  );
  return gridScene(lanes, 1, 3);
}
