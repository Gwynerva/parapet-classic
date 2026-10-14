/**
 * One press, two kicks: pressed on contact, one UP gives the wall run two kicks and the runner
 * climbs onto the roof, because the wall run (state 33) keeps the press buffer. Pressed a little
 * earlier, the same UP arms the wall run in the air (state 30), which clears the buffer: one
 * kick, and the runner falls.
 */
import { MoveId } from '@parapet/sim';
import { parseDemoLevel } from '@parapet/runtime/moves/demoLevel.ts';
import { demoScene } from '../demoScene.ts';
import { seriesColor } from '../draw.ts';
import { onlyBand } from '../experiments/sweep.ts';
import {
  JUMP_STEP,
  outcomeBands,
  SWEEP_FROM,
  SWEEP_TO,
  wallRunSweep,
  wallRunTry,
  type Variant,
  type WallRunTry,
} from '../experiments/wallRun.ts';
import { sweepChart } from '../experiments/wallRunChart.ts';
import type { Facts, Finding } from '../finding.ts';
import type { Lab } from '../lab.ts';

/** The two presses the animation compares: armed in the air, and on contact. */
const EARLY = 135;
const ON_CONTACT = 146;

interface KickFacts extends Facts {
  jumpStep: number;
  /** The outcomes of the second press over the sweep, in order, and where each one ends. */
  outcomes: string;
  bandEnds: readonly number[];
  /** `[first, last]` presses arming the wall run in the air (one kick), and climbing on contact. */
  armed: readonly number[];
  climb: readonly number[];
  /** The armed presses all start the wall run on this step. */
  armedRunStep: number;
  /** The vertical speed each kick of a climb gives (units per 1024 time units; up is negative). */
  kickSpeeds: readonly number[];
  /** With 33 clearing the buffer, the most kicks any press gives. */
  noKeep33MostKicks: number;
  /** With 30 keeping it, the fewest kicks an armed press gives, and whether all climb. */
  keep30ArmedKicks: number;
  keep30ArmedClimb: boolean;
}

function kickSpeeds(t: WallRunTry): number[] {
  return t.rec.tracks[0]!.steps.filter((s) =>
    s.entered.some((id) => id === MoveId.WALL_RUN || id === 36 || id === 37),
  ).map((s) => s.vy);
}

/** The runner's state over its head while it is on or near the wall. */
function stateTag(t: WallRunTry): (at: number) => string | null {
  const shown = new Set([30, 33, 34, 36, 37]);
  return (at) => {
    const id = t.rec.tracks[0]!.after(at).moveId;
    return shown.has(id) ? String(id) : null;
  };
}

export const onePressTwoKicks: Finding<KickFacts> = {
  slug: '03-one-press-two-kicks',
  title: 'One press, two kicks',
  claim:
    'Pressed on contact, one UP kicks off the wall twice and climbs; pressed a moment earlier, once, and falls.',

  facts(lab: Lab): KickFacts {
    const tries = wallRunSweep(lab);
    const b = outcomeBands(tries);
    const armed = onlyBand(b, 'one');
    const keep30 = wallRunSweep(lab, 'keep30').filter((t) => t.armed >= 0);
    return {
      jumpStep: JUMP_STEP,
      outcomes: b.map(([, , o]) => o).join(' '),
      bandEnds: b.map(([, last]) => last),
      armed,
      climb: onlyBand(b, 'twoClimb'),
      armedRunStep: tries.find((t) => t.armed >= 0)?.kicks[0] ?? -1,
      kickSpeeds: kickSpeeds(wallRunTry(lab, ON_CONTACT)),
      noKeep33MostKicks: Math.max(...wallRunSweep(lab, 'noKeep33').map((t) => t.kicks.length)),
      keep30ArmedKicks: Math.min(...keep30.map((t) => t.kicks.length)),
      keep30ArmedClimb: keep30.every((t) => t.climbed),
    };
  },

  measured(f: KickFacts): [string, string][] {
    const after = (r: readonly number[]): string =>
      r.length === 2 ? `${r[0]! - f.jumpStep} to ${r[1]! - f.jumpStep} steps after the jump` : '—';
    return [
      ['Second UP arming the wall run in the air: one kick, a fall', after(f.armed)],
      ['Second UP on contact: two kicks, a climb onto the roof', after(f.climb)],
      [
        'Step every armed wall run starts on',
        `${f.armedRunStep - f.jumpStep} steps after the jump`,
      ],
      ['Vertical speed of the two kicks (units per 1024 time units)', f.kickSpeeds.join(', ')],
      ['Most kicks if the wall run (33) cleared the buffer', String(f.noKeep33MostKicks)],
      [
        'Kicks of an armed wall run if 30 kept the buffer',
        `${f.keep30ArmedKicks}${f.keep30ArmedClimb ? ', and it climbs' : ''}`,
      ],
    ];
  },

  checks(f: KickFacts): string[] {
    const out: string[] = [];
    if (!/^none one twoClimb (twoFall )?none$/.test(f.outcomes)) {
      out.push(`the second press gives ${f.outcomes}, not none, one, two and a climb, none`);
    }
    if (f.armed.length !== 2 || f.armed[1]! - f.armed[0]! < 9)
      out.push('no armed band of 10 steps');
    if (f.climb.length !== 2) out.push('no band of presses that climb');
    if (f.noKeep33MostKicks !== 1) out.push('without the kept buffer a press still kicks twice');
    if (f.keep30ArmedKicks !== 2 || !f.keep30ArmedClimb) {
      out.push('an armed wall run that keeps the buffer does not kick twice and climb');
    }
    return out;
  },

  clips(lab: Lab) {
    const early = wallRunTry(lab, EARLY);
    const contact = wallRunTry(lab, ON_CONTACT);
    const demo = lab.demo('wallRun');
    const blue = seriesColor(0);
    const orange = seriesColor(1);
    const scene = demoScene(lab, {
      level: parseDemoLevel(demo.rows),
      view: { x: 216, y: -24, width: 320, height: 224 },
      actors: [
        { track: early.rec.tracks[0]!, color: blue, tag: stateTag(early) },
        { track: contact.rec.tracks[0]!, color: orange, tag: stateTag(contact) },
      ],
      from: 100,
      to: 200,
      timeline: {
        from: 110,
        to: 200,
        rows: [
          {
            color: blue,
            presses: [
              { step: JUMP_STEP, key: 'up' },
              { step: EARLY, key: 'up' },
            ],
            marks: early.kicks,
          },
          {
            color: orange,
            presses: [
              { step: JUMP_STEP, key: 'up' },
              { step: ON_CONTACT, key: 'up' },
            ],
            marks: contact.kicks,
          },
        ],
      },
    });
    return [
      {
        name: 'kicks',
        alt: 'Two runners jump at a wall. Blue presses UP early and kicks off the wall once, then falls; orange presses on contact, kicks twice and climbs onto the roof.',
        scene,
        script: [
          { from: 108, to: 140 },
          { from: 140, to: 168, speed: 0.25 },
          { from: 168, to: 200 },
          { at: 200, holdMs: 1500 },
        ],
      },
    ];
  },

  charts(lab: Lab) {
    const rows: { label: string; variant: Variant }[] = [
      { label: 'The original', variant: 'original' },
      { label: 'If the wall run did not keep the press', variant: 'noKeep33' },
      { label: 'If the armed state kept it', variant: 'keep30' },
    ];
    return [
      {
        name: 'sweep',
        alt: 'For every step of the second UP: nothing (too early or too late), one kick and a fall (armed in the air), or two kicks and a climb (on contact); and the same with each buffer rule changed.',
        svg: sweepChart(
          'What the second UP gives, by when it is pressed',
          `The runner jumps at the wall (UP); a second UP ${SWEEP_FROM - JUMP_STEP} to ${SWEEP_TO - JUMP_STEP} steps later`,
          rows.map((r) => ({ label: r.label, tries: wallRunSweep(lab, r.variant) })),
        ),
      },
    ];
  },
};
