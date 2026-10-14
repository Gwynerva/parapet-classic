/**
 * The camera: it aims ahead of the runner by its speed (up to half the screen), but not when a
 * wall faces the runner within 4 tiles; a spring eases it there, and a leash of a quarter of the
 * screen holds it near the runner, so it never gets more than 60 pixels ahead: at running speed
 * the look-ahead asks for 98.
 */
import { UNITS_PER_PX } from '@parapet/runtime/render/View.ts';
import {
  cameraRun,
  LEASH_X,
  LOOK_MAX,
  offsetChart,
  offsets,
  viewScene,
} from '../experiments/camera.ts';
import type { Facts, Finding } from '../finding.ts';
import type { Lab } from '../lab.ts';
import { STEP_MS } from '../scene.ts';

/** The level whose rival run the camera follows. */
const LEVEL = 1;
/** Steps of the view animation. */
const VIEW_STEPS = 210;
/** The run speed on flat ground. */
const RUN_SPEED = 3400;

interface CameraFacts extends Facts {
  /** Look-ahead at most, and at running speed (px). */
  lookMax: number;
  lookAtRun: number;
  /** The leash (px) and the farthest the camera's middle got ahead (px). */
  leash: number;
  farthest: number;
  /** Share of the run (percent) with the camera held by the leash, and with no look-ahead. */
  leashed: number;
  zeroed: number;
  runSeconds: number;
}

export const theCamera: Finding<CameraFacts> = {
  slug: '10-the-camera',
  title: 'The camera',
  claim:
    'The camera aims ahead of the runner by its speed, not when a wall is near, and a leash holds it back: at running speed it wants 98 pixels ahead and gets 60.',

  facts(lab: Lab): CameraFacts {
    const run = cameraRun(lab, LEVEL);
    const data = offsets(run);
    const moving = data.filter((d) => run.track.after(d.step).vx !== 0);
    const share = (n: number): number => Math.round((n / moving.length) * 100);
    return {
      lookMax: LOOK_MAX / UNITS_PER_PX,
      lookAtRun: Math.trunc((RUN_SPEED * 3840) / 4143 / UNITS_PER_PX),
      leash: LEASH_X / UNITS_PER_PX,
      farthest: Math.max(...data.map((d) => Math.abs(d.offset))) / UNITS_PER_PX,
      leashed: share(moving.filter((d) => Math.abs(d.offset) >= LEASH_X).length),
      zeroed: share(moving.filter((d) => d.zeroed).length),
      runSeconds: Math.round((data.length * STEP_MS) / 1000),
    };
  },

  measured(f: CameraFacts): [string, string][] {
    return [
      ['Look-ahead at most, and at running speed (3400)', `${f.lookMax} px, ${f.lookAtRun} px`],
      ['The leash, and the farthest the camera got ahead', `${f.leash} px, ${f.farthest} px`],
      [`Of the rival’s ${f.runSeconds} s on the move: held by the leash`, `${f.leashed} %`],
      ['No look-ahead for a wall ahead', `${f.zeroed} %`],
    ];
  },

  checks(f: CameraFacts): string[] {
    const out: string[] = [];
    if (f.farthest > f.leash) out.push('the camera got further ahead than the leash');
    if (!(f.lookAtRun > f.leash)) out.push('the look-ahead at running speed is within the leash');
    if (f.zeroed === 0) out.push('no wall ever cancels the look-ahead');
    return out;
  },

  clips(lab: Lab) {
    const run = cameraRun(lab, LEVEL);
    // The stretch with the most switches of the look-ahead off and on.
    const data = offsets(run);
    let best = run.track.start;
    let most = -1;
    for (let i = 0; i + VIEW_STEPS < data.length; i += 10) {
      let n = 0;
      for (let j = i + 1; j < i + VIEW_STEPS; j++) if (data[j]!.zeroed !== data[j - 1]!.zeroed) n++;
      if (n > most) {
        most = n;
        best = data[i]!.step;
      }
    }
    const scene = viewScene(lab, run, best, best + VIEW_STEPS);
    return [
      {
        name: 'view',
        alt: 'The original’s 240 × 320 screen following the rival through a stretch of North Hill. A cross marks where the camera aims, ahead of the runner by its speed (green when a wall near ahead cancels that); the dot is the middle of the screen, which the white leash box keeps near the runner. On top, the whole level and the screen’s place on it.',
        scene,
        gifScale: 1,
        script: [
          { from: scene.from, to: scene.to },
          { at: scene.to, holdMs: 800 },
        ],
      },
    ];
  },

  charts(lab: Lab) {
    return [
      {
        name: 'offset',
        alt: 'Over the whole rival run of North Hill: how far ahead of the runner the camera aims (up to 98 pixels at running speed) and how far ahead it is (never more than the 60-pixel leash), with the moments a wall ahead cancels the look-ahead marked under the plot.',
        svg: offsetChart(lab, cameraRun(lab, LEVEL), STEP_MS),
      },
    ];
  },
};
