/**
 * Armed, not timed: in the air the runner looks ahead along its velocity (a ray 400 time units
 * long). While the ray sees a wall, UP arms the wall run (state 30), and the wall run starts when
 * the runner touches the wall: on the same step for every press of the window. Without the ray
 * only a press after the contact would count; the window would be less than half as long.
 */
import { MoveId } from '@parapet/sim';
import { parseDemoLevel } from '@parapet/runtime/moves/demoLevel.ts';
import { demoScene } from '../demoScene.ts';
import { drawRay, RAY_TIME, seeingSpans } from '../experiments/lookahead.ts';
import { onlyBand } from '../experiments/sweep.ts';
import {
  JUMP_STEP,
  outcomeBands,
  SWEEP_FROM,
  SWEEP_TO,
  wallRunScene,
  wallRunSweep,
  wallRunTry,
  wallStateTag,
  type Variant,
  type WallRunTry,
} from '../experiments/wallRun.ts';
import { startChart } from '../experiments/wallRunChart.ts';
import type { Facts, Finding } from '../finding.ts';
import type { Lab } from '../lab.ts';
import { INK, SERIES } from '../palette.ts';
import { gridScene, type Scene } from '../scene.ts';

/** The press the ray animation makes, in the middle of the window. */
const ARMING_PRESS = 136;

interface ArmedFacts extends Facts {
  jumpStep: number;
  /** `[first, last]` steps the ray sees the wall before the contact. */
  seeing: readonly number[];
  /** `[first, last]` presses that arm the wall run. */
  armed: readonly number[];
  /** The steps those wall runs start on (one: the contact). */
  armedStarts: readonly number[];
  /**
   * `[first, last]` armed presses made before the jump's tuck (half way through state 18 the feet
   * are pulled up 160 units), and how much lower those runners meet the wall.
   */
  untucked: readonly number[];
  untuckedDrop: number;
  contactStep: number;
  /** How far the ray reaches at the jump's speed, in world units (a tile is 1024). */
  reach: number;
  /** Presses that give a wall run, with the ray and without it. */
  wallRunPresses: number;
  contactOnlyPresses: number;
  contactOnlyArmed: number;
}

const wallRuns = (tries: readonly WallRunTry[]): number =>
  tries.filter((t) => t.kicks.length > 0).length;

/** The states shown over the runner: armed, and running up the wall. */
const ARMING: ReadonlySet<number> = new Set([MoveId.WALL_RUN_ARMED, MoveId.WALL_RUN]);

export const armedNotTimed: Finding<ArmedFacts> = {
  slug: '02-armed-not-timed',
  title: 'Armed, not timed',
  claim:
    'In the air the runner looks ahead: UP pressed while it sees a wall arms the wall run, which starts on contact, the same step for every press.',

  facts(lab: Lab): ArmedFacts {
    const tries = wallRunSweep(lab);
    const plain = wallRunTry(lab, null);
    const seeing = seeingSpans(plain.rays).filter(([a]) => a > JUMP_STEP)[0] ?? [];
    const armed = onlyBand(outcomeBands(tries), 'one');
    const armedTries = tries.filter((t) => t.armed >= 0);
    const contact = tries.find((t) => t.kicks.length > 0 && t.armed < 0)?.kicks[0] ?? -1;
    const contactOnly = wallRunSweep(lab, 'contactOnly');
    const feetAt = (t: WallRunTry): number => t.rec.tracks[0]!.after(t.kicks[0]! - 1).y;
    const tucked = feetAt(armedTries.at(-1)!);
    const untucked = armedTries.filter((t) => feetAt(t) !== tucked);
    return {
      jumpStep: JUMP_STEP,
      seeing: [...seeing],
      armed,
      armedStarts: [...new Set(armedTries.map((t) => t.kicks[0] ?? -1))],
      untucked: untucked.length > 0 ? [untucked[0]!.press!, untucked.at(-1)!.press!] : [],
      untuckedDrop: untucked.length > 0 ? feetAt(untucked[0]!) - tucked : 0,
      contactStep: contact,
      reach: ((plain.rec.tracks[0]!.after(JUMP_STEP).vx * RAY_TIME) / 1024) | 0,
      wallRunPresses: wallRuns(tries),
      contactOnlyPresses: wallRuns(contactOnly),
      contactOnlyArmed: contactOnly.filter((t) => t.armed >= 0).length,
    };
  },

  measured(f: ArmedFacts): [string, string][] {
    const after = (r: readonly number[]): string =>
      r.length === 2 ? `${r[0]! - f.jumpStep} to ${r[1]! - f.jumpStep} steps after the jump` : '—';
    return [
      ['The ray sees the wall', after(f.seeing)],
      ['Second UP that arms the wall run (state 30)', after(f.armed)],
      [
        'Step every armed wall run starts on',
        `${f.armedStarts.map((s) => s - f.jumpStep).join(', ')} steps after the jump`,
      ],
      ['Step the runner touches the wall', `${f.contactStep - f.jumpStep} steps after the jump`],
      [
        'Armed before the jump tucks its legs: meets the wall lower by',
        `${f.untuckedDrop} units (presses ${after(f.untucked)})`,
      ],
      [
        'Reach of the ray at the jump’s speed',
        `${f.reach} units (${(f.reach / 1024).toFixed(2)} tiles)`,
      ],
      ['Presses (of 39) that give a wall run', String(f.wallRunPresses)],
      ['The same if only touching the wall counted', String(f.contactOnlyPresses)],
    ];
  },

  checks(f: ArmedFacts): string[] {
    const out: string[] = [];
    if (f.seeing.length !== 2) out.push('the ray never sees the wall');
    if (f.armed.join() !== f.seeing.join()) {
      out.push(
        `the presses that arm (${f.armed.join('–')}) are not the steps the ray sees the wall (${f.seeing.join('–')})`,
      );
    }
    if (f.armedStarts.length !== 1 || f.armedStarts[0] !== f.contactStep) {
      out.push('the armed wall runs do not all start on the contact');
    }
    if (f.contactOnlyArmed !== 0) out.push('without the ray a press still arms the wall run');
    if (f.contactOnlyPresses * 2 > f.wallRunPresses) {
      out.push('without the ray the window is not less than half as long');
    }
    return out;
  },

  clips(lab: Lab, f: ArmedFacts) {
    const level = parseDemoLevel(lab.demo('wallRun').rows);
    const blue = SERIES[0];
    const ray = wallRunScene(lab, wallRunTry(lab, ARMING_PRESS), {
      ray: true,
      ink: blue,
      from: 112,
      to: 176,
      tags: ARMING,
    });
    const lane = (press: number, variant: Variant, ink: string): Scene => {
      const t = wallRunTry(lab, press, variant);
      const track = t.rec.tracks[0]!;
      return demoScene(lab, {
        level,
        view: { x: 312, y: 40, width: 192, height: 160 },
        actors: [{ track, tag: wallStateTag(t, ARMING), ink }],
        from: 116,
        to: 172,
        overlay:
          variant === 'original'
            ? (frame, at, px) => drawRay(frame, at, px, track, t.rays)
            : undefined,
        timeline: {
          from: 116,
          to: 172,
          rows: [
            {
              color: ink,
              presses: [
                { step: JUMP_STEP, key: 'up' },
                { step: press, key: 'up' },
              ],
              spans: track.spans((s) => s.moveId === MoveId.WALL_RUN_ARMED),
              marks: t.kicks,
            },
          ],
        },
      });
    };
    const [first, last] = f.armed as [number, number];
    const middle = Math.round((first + last) / 2);
    return [
      {
        name: 'ray',
        alt: 'A runner jumps at a wall; a line from its feet along its velocity is the look-ahead ray. It turns green when it sees the wall; UP pressed then arms the wall run (30), which starts when the runner touches the wall (33).',
        scene: ray,
        script: [
          { from: 112, to: 128 },
          { from: 128, to: 148, speed: 0.25 },
          { from: 148, to: 176 },
          { at: 176, holdMs: 1200 },
        ],
      },
      {
        name: 'armed',
        alt: 'Four runners jump at the wall. Three press UP while the ray sees it, early, midway and late: each arms the wall run, and all three start it on the same step, on contact. The fourth runs a copy of the game where only touching the wall counts: the same press does nothing.',
        scene: gridScene(
          [
            lane(first, 'original', blue),
            lane(middle, 'original', blue),
            lane(last, 'original', blue),
            lane(middle, 'contactOnly', INK.muted),
          ],
          2,
          4,
        ),
        script: [
          { from: 116, to: 128 },
          { from: 128, to: 148, speed: 0.25 },
          { from: 148, to: 172 },
          { at: 172, holdMs: 1200 },
        ],
      },
    ];
  },

  charts(lab: Lab, f: ArmedFacts) {
    return [
      {
        name: 'start',
        alt: 'The step the wall run starts on, by the step of the second UP: a flat line for the presses the ray arms (they all start on contact) and a diagonal for presses after the contact; without the ray only the diagonal is left.',
        svg: startChart(
          'When the wall run starts, by when UP is pressed',
          `The runner jumps at the wall (UP); a second UP ${SWEEP_FROM - JUMP_STEP} to ${SWEEP_TO - JUMP_STEP} steps later`,
          [
            { label: 'The original: the ray arms the wall run', tries: wallRunSweep(lab) },
            {
              label: 'If only touching the wall counted (condition 73 for 68)',
              tries: wallRunSweep(lab, 'contactOnly'),
            },
          ],
          f.seeing,
          f.contactStep,
        ),
      },
    ];
  },
};
