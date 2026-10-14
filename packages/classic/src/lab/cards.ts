/**
 * The Lab's experiments: for each, its controls and how it builds a scene and an outcome from
 * their values. The scenes are the findings' own (`@parapet/lab`), so the page and the pictures
 * of `reference/findings` show the same thing.
 */
import { JUMP_STEP as WALL_JUMP } from '@parapet/lab/experiments/wallRun.ts';
import { cameraRun, viewScene } from '@parapet/lab/experiments/camera.ts';
import { octagonScene } from '@parapet/lab/experiments/fixedPoint.ts';
import { dropTry, landingLane } from '@parapet/lab/experiments/landing.ts';
import { pace, raceScene } from '@parapet/lab/experiments/pace.ts';
import { VAULT_JUMP, vaultLane, vaultTry } from '@parapet/lab/experiments/vault.ts';
import { puppetScene } from '@parapet/lab/experiments/vectorRunner.ts';
import {
  outcomeOf,
  wallRunMoves,
  wallRunScene,
  wallRunTry,
} from '@parapet/lab/experiments/wallRun.ts';
import { press } from '@parapet/lab/demo.ts';
import type { Lab } from '@parapet/lab/lab.ts';
import { SERIES } from '@parapet/lab/palette.ts';
import { STEP_MS, type Scene } from '@parapet/lab/scene.ts';
import type { CardId } from './text.ts';

export type ParamSpec =
  | {
      id: string;
      kind: 'range';
      min: number;
      max: number;
      value: number;
      show?: (v: number) => number;
    }
  | { id: string; kind: 'toggle'; value: boolean }
  | {
      id: string;
      kind: 'choice';
      value: number;
      options: readonly { value: number; label: string }[];
    };

export type Values = Record<string, number | boolean>;

export interface Built {
  scene: Scene;
  /** The outcome's key in the card's texts, and what fills its holes. */
  result: string;
  args?: Record<string, string | number>;
}

export interface CardDef {
  id: CardId;
  /** The findings page that tells the whole story. */
  page: string;
  params: (labels: Record<string, string>, lab: Lab) => ParamSpec[];
  build(lab: Lab, values: Values): Built;
}

const RATES = [4, 6, 10, 15, 20, 30, 60, 120, 144, 240];

export const CARDS: readonly CardDef[] = [
  {
    id: 'vault',
    page: '01-keys-are-pressed-never-held',
    params: () => [
      { id: 'press', kind: 'range', min: 1, max: 29, value: 11 },
      { id: 'again', kind: 'toggle', value: false },
    ],
    build(lab, v) {
      const second = press(VAULT_JUMP + (v['press'] as number), 'up');
      let t = vaultTry(lab, [second]);
      if (v['again'] && t.landing > second.step)
        t = vaultTry(lab, [second, press(t.landing, 'up')]);
      const outcome = t.vault >= 0 ? 'vault' : t.jumps.length > 1 ? 'jump' : 'lost';
      return {
        scene: vaultLane(lab, t, SERIES[0]),
        result: outcome,
        args: { w: t.vault - second.step },
      };
    },
  },
  {
    id: 'wallRun',
    page: '03-one-press-two-kicks',
    params: () => [
      { id: 'press', kind: 'range', min: 1, max: 39, value: 14 },
      { id: 'lookahead', kind: 'toggle', value: true },
      { id: 'keep33', kind: 'toggle', value: true },
      { id: 'keep30', kind: 'toggle', value: false },
    ],
    build(lab, v) {
      const rules = {
        lookahead: v['lookahead'] as boolean,
        keep33: v['keep33'] as boolean,
        keep30: v['keep30'] as boolean,
      };
      const t = wallRunTry(lab, WALL_JUMP + (v['press'] as number), wallRunMoves(lab, rules));
      return {
        scene: wallRunScene(lab, t, { ray: rules.lookahead, ink: SERIES[0], from: 112, to: 200 }),
        result: outcomeOf(t),
      };
    },
  },
  {
    id: 'landing',
    page: '05-landing-keeps-horizontal-speed',
    params: () => [
      { id: 'height', kind: 'range', min: 1, max: 16, value: 4 },
      { id: 'down', kind: 'toggle', value: false },
    ],
    build(lab, v) {
      const d = dropTry(lab, v['height'] as number, v['down'] as boolean);
      return {
        scene: landingLane(lab, d, SERIES[0], d.fall - 8, d.touchdown + 26),
        result: d.grade,
      };
    },
  },
  {
    id: 'pace',
    page: '07-slow-phones-slow-down',
    params: () => [
      {
        id: 'fps',
        kind: 'range',
        min: 0,
        max: RATES.length - 1,
        value: RATES.indexOf(10),
        show: (i) => RATES[i]!,
      },
    ],
    build(lab, v) {
      const fps = RATES[v['fps'] as number]!;
      // Below it for comparison, a common screen's rate (a slow phone's when that is chosen).
      const other = fps === 60 ? 10 : 60;
      return {
        scene: raceScene(lab, [fps, other], 6),
        result: 'pace',
        args: { p: Math.round(pace(1000 / fps) * 1000) / 10, c: other },
      };
    },
  },
  {
    id: 'runner',
    page: '08-one-vector-runner',
    params: (labels) => [
      {
        id: 'spread',
        kind: 'range',
        min: 10,
        max: 22,
        value: 16,
        show: (n) => n / 10,
      },
      {
        id: 'look',
        kind: 'choice',
        value: 0,
        options: [
          ...Array.from({ length: 10 }, (_, c) => ({ value: c, label: String(c + 1) })),
          { value: -1, label: labels['dots'] ?? 'dots' },
        ],
      },
      { id: 'tween', kind: 'toggle', value: true },
    ],
    build(lab, v) {
      const look = v['look'] as number;
      return {
        scene: puppetScene(lab, {
          spread: (v['spread'] as number) / 10,
          look: look < 0 ? 'dots' : look,
          tween: v['tween'] as boolean,
        }),
        result: 'runner',
      };
    },
  },
  {
    id: 'circle',
    page: '06-fixed-point-maths',
    params: () => [],
    build: (lab) => ({ scene: octagonScene(lab), result: 'circle' }),
  },
  {
    id: 'camera',
    page: '10-the-camera',
    params: (_, lab) => [
      {
        id: 'level',
        kind: 'choice',
        value: 1,
        options: lab.src.levels.map((_, l) => ({
          value: l,
          label: `${l + 1}. ${lab.levelName(l)}`,
        })),
      },
      { id: 'workings', kind: 'toggle', value: true },
    ],
    build(lab, v) {
      const run = cameraRun(lab, v['level'] as number);
      return {
        scene: viewScene(lab, run, run.track.start, run.end, v['workings'] as boolean),
        result: 'camera',
        args: { s: Math.round(((run.end - run.track.start) * STEP_MS) / 1000) },
      };
    },
  },
];
