/**
 * Slow phones slow down: each frame advances the game by the frame's time × 900/1024, cut to a
 * whole number of units and capped at 150. On a phone slower than 5.9 frames a second the cap
 * holds and the game runs in slow motion instead of skipping; and the cut makes every frame
 * rate a little slow, more so the faster the screen.
 */
import {
  CAP_MS,
  frameUnits,
  pace,
  paceChart,
  parapetStepsIn,
  raceScene,
  stepsIn,
} from '../experiments/pace.ts';
import type { Facts, Finding } from '../finding.ts';
import type { Lab } from '../lab.ts';
import { STEP_MS } from '../scene.ts';

const RACE_FPS = [60, 10, 4];
const RACE_SECONDS = 6;

interface PaceFacts extends Facts {
  stepMs: number;
  /** Units a frame adds at 60 frames a second, and the pace that gives. */
  units60: number;
  pace60: number;
  pace144: number;
  pace240: number;
  /** Frames longer than this are capped. */
  capMs: number;
  units250: number;
  pace250: number;
  /** Steps in 10 s of frames of 250 ms, against the original's own pace. */
  steps10s250: number;
  steps10sOwn: number;
  /** Frames shorter than this add nothing: the game stands still. */
  standStillMs: number;
  /** Steps in 10 s at 60 and at 240 frames a second: the original's, and Parapet's. */
  steps10s60: number;
  steps10s240: number;
  parapet10s60: number;
  parapet10s240: number;
}

const percent = (p: number): string => `${(p * 100).toFixed(1)} %`;

export const slowPhonesSlowDown: Finding<PaceFacts> = {
  slug: '07-slow-phones-slow-down',
  title: 'Slow phones slow down',
  claim:
    'Game time per frame is capped, so a slow phone plays in slow motion rather than skipping; and it is cut to whole units, so every screen runs a little slow, a fast one more.',

  facts(): PaceFacts {
    let standStill = 0;
    while (frameUnits(standStill + 0.01) === 0) standStill += 0.01;
    return {
      stepMs: Number(STEP_MS.toFixed(2)),
      units60: frameUnits(1000 / 60),
      pace60: Number(pace(1000 / 60).toFixed(4)),
      pace144: Number(pace(1000 / 144).toFixed(4)),
      pace240: Number(pace(1000 / 240).toFixed(4)),
      capMs: Number(CAP_MS.toFixed(2)),
      units250: frameUnits(250),
      pace250: Number(pace(250).toFixed(4)),
      steps10s250: stepsIn(250, 10000),
      steps10sOwn: Math.floor(10000 / STEP_MS),
      standStillMs: Number((standStill + 0.01).toFixed(2)),
      steps10s60: stepsIn(1000 / 60, 10000),
      steps10s240: stepsIn(1000 / 240, 10000),
      parapet10s60: parapetStepsIn(1000 / 60, 10000),
      parapet10s240: parapetStepsIn(1000 / 240, 10000),
    };
  },

  measured(f: PaceFacts): [string, string][] {
    return [
      ['A step of 30 units lasts', `${f.stepMs} ms (${(1000 / f.stepMs).toFixed(1)} a second)`],
      ['Units a frame adds at 60 frames a second', `${f.units60} (pace ${percent(f.pace60)})`],
      ['Pace at 144 and at 240 frames a second', `${percent(f.pace144)}, ${percent(f.pace240)}`],
      ['Frames longer than this add only 150 units', `${f.capMs} ms`],
      ['A phone at 4 frames a second', `${f.units250} units a frame (pace ${percent(f.pace250)})`],
      ['Steps in 10 s at 4 frames a second, at the own pace', `${f.steps10s250}, ${f.steps10sOwn}`],
      ['Frames shorter than this add nothing', `${f.standStillMs} ms`],
      [
        'Steps in 10 s at 60 and at 240 frames a second: the original, Parapet',
        `${f.steps10s60} and ${f.steps10s240}; ${f.parapet10s60} and ${f.parapet10s240}`,
      ],
    ];
  },

  checks(f: PaceFacts): string[] {
    const out: string[] = [];
    if (f.units60 !== 14) out.push(`${f.units60} units at 60 frames a second, not 14`);
    if (f.units250 !== 150) out.push('a 250 ms frame is not capped at 150');
    if (!(f.pace240 < f.pace60 && f.pace60 < 1)) out.push('fast screens are not slower');
    if (f.steps10s250 !== 200) out.push(`${f.steps10s250} steps in 10 s at 250 ms, not 200`);
    if (f.parapet10s60 !== f.steps10sOwn || f.parapet10s240 !== f.steps10sOwn) {
      out.push('Parapet does not keep the own pace at 60 and 240 frames a second');
    }
    return out;
  },

  clips(lab: Lab) {
    const scene = raceScene(lab, RACE_FPS, RACE_SECONDS);
    return [
      {
        name: 'race',
        alt: 'The same run shown at 60, 10 and 4 frames a second for 6 seconds of real time. At 10 the runner jumps from frame to frame but keeps up; at 4 the game has run fewer steps and the runner falls behind.',
        scene,
        script: [
          { from: 0, to: scene.to },
          { at: scene.to, holdMs: 1500 },
        ],
      },
    ];
  },

  charts() {
    return [
      {
        name: 'pace',
        alt: `The game's pace against the time a frame takes: just under 100 % with a saw-tooth from the cut to whole units (60 frames a second: ${percent(pace(1000 / 60))}; 240: ${percent(pace(1000 / 240))}), then falling once frames take longer than ${CAP_MS.toFixed(1)} ms.`,
        svg: paceChart(),
      },
    ];
  },
};
