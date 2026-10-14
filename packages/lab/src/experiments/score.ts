/**
 * The score of a run with fails. On a fail the original adds up a penalty (the chain's pending
 * points times the multiplier, `aF`, d.java line 7480) and never subtracts it; the meter drops
 * by 2048 and the pending trick is lost. The run: a level's rival presses, pressed by the player
 * from the player's own start (a tile away from the rival's), so it goes off the developers'
 * script and fails here and there.
 */
import { createRun, type RunMode } from '@parapet/sim';
import { Frame } from '../frame.ts';
import type { Lab } from '../lab.ts';
import { INK, RGB, rgb, SERIES } from '../palette.ts';
import type { Scene } from '../scene.ts';
import { Svg } from '../svg.ts';
import { followRun, type CameraRun } from './camera.ts';

export interface ScoreStep {
  score: number;
  meter: number;
  multiplier: number;
  /** The score with every penalty so far subtracted. */
  withPenalty: number;
}

export interface ScoreRun {
  run: CameraRun;
  /** `scores[i]` after world step `run.track.start + i - 1`. */
  scores: ScoreStep[];
  fails: { step: number; penalty: number }[];
}

const cache = new WeakMap<Lab, Map<string, ScoreRun>>();

/** The rival's presses of `levelId` pressed by the player in a run of `mode`. */
export function scoreRun(lab: Lab, levelId: number, mode: RunMode): ScoreRun {
  const key = `${levelId}/${mode}`;
  let byKey = cache.get(lab);
  if (!byKey) {
    byKey = new Map();
    cache.set(lab, byKey);
  }
  const known = byKey.get(key);
  if (known) return known;
  const content = lab.run(levelId);
  const bits: number[] = [];
  for (const e of content.rival!.entries) for (let i = 0; i < e.ticks; i++) bits.push(e.input);
  const world = createRun({ mode, ...content, rival: null });
  const player = world.player;
  const score = player.score!;
  let penalties = 0;
  const snap = (): ScoreStep => ({
    score: score.score,
    meter: score.meter,
    multiplier: score.multiplier,
    withPenalty: score.score + penalties,
  });
  const scores = [snap()];
  const fails: { step: number; penalty: number }[] = [];
  const run = followRun(lab, world, levelId, player, {
    steps: bits.length + 60,
    input: (w) => bits[w.stepCount] ?? 0,
    observe: (w) => {
      for (const e of w.events) {
        if (e.type !== 'fail' || e.runner !== player) continue;
        penalties += score.penalty;
        fails.push({ step: w.stepCount - 1, penalty: score.penalty });
      }
      scores.push(snap());
    },
  });
  const out = { run, scores, fails };
  byKey.set(key, out);
  return out;
}

export function scoreAfter(s: ScoreRun, step: number): ScoreStep {
  const i = Math.max(0, Math.min(s.scores.length - 1, Math.floor(step) - s.run.track.start + 1));
  return s.scores[i]!;
}

/** The score over the run, the score the penalties would have left, and the multiplier. */
export function scoreChart(s: ScoreRun, stepMs: number, title: string, note: string): string {
  const n = s.scores.length;
  const x0 = 70;
  const plotW = 600;
  const top = 76;
  const plotH = 200;
  const stripTop = top + plotH + 46;
  const stripH = 50;
  const width = x0 + plotW + 70;
  const height = stripTop + stripH + 70;
  const svg = new Svg(width, height, title, note);
  const max = Math.max(...s.scores.map((x) => x.score));
  const min = Math.min(0, ...s.scores.map((x) => x.withPenalty));
  const xOf = (i: number): number => x0 + (i / (n - 1)) * plotW;
  const yOf = (v: number): number => top + plotH - ((v - min) / (max - min)) * plotH;
  const stepOf = (step: number): number => step - s.run.track.start + 1;
  const tick = Math.pow(10, Math.floor(Math.log10(max / 2)));
  for (let v = Math.ceil(min / tick) * tick; v <= max; v += tick) {
    svg.line(x0, yOf(v), x0 + plotW, yOf(v), v === 0 ? INK.muted : INK.line);
    svg.text(x0 - 6, yOf(v) + 4, String(v), { size: 11, fill: INK.muted, anchor: 'end' });
  }
  const line = (pick: (x: ScoreStep) => number): [number, number][] =>
    s.scores.map((x, i) => [xOf(i), yOf(pick(x))] as [number, number]);
  svg.polyline(
    line((x) => x.withPenalty),
    SERIES[6],
    { width: 1.5, dash: '5 3' },
  );
  svg.polyline(
    line((x) => x.score),
    SERIES[0],
    { width: 2 },
  );
  for (const f of s.fails) {
    const x = xOf(stepOf(f.step));
    svg.line(x, top, x, top + plotH, INK.muted, { dash: '2 3' });
    if (f.penalty < 0) {
      svg.text(x + 3, top + 10, String(f.penalty), { size: 11, fill: SERIES[6] });
    }
  }
  // The multiplier, under the plot: ×1 to ×10.
  svg.text(x0 - 6, stripTop + 10, '×10', { size: 11, fill: INK.muted, anchor: 'end' });
  svg.text(x0 - 6, stripTop + stripH, '×1', { size: 11, fill: INK.muted, anchor: 'end' });
  const yMul = (m: number): number => stripTop + stripH - ((m - 1) / 9) * (stripH - 6);
  svg.polyline(
    s.scores.map((x, i) => [xOf(i), yMul(x.multiplier)] as [number, number]),
    SERIES[3],
    {
      width: 1.5,
    },
  );
  const seconds = ((n - 1) * stepMs) / 1000;
  for (let sec = 0; sec <= seconds; sec += 10) {
    svg.text(x0 + ((sec * 1000) / stepMs / (n - 1)) * plotW, stripTop + stripH + 16, `${sec} s`, {
      size: 11,
      fill: INK.muted,
      anchor: 'middle',
    });
  }
  const ly = height - 24;
  svg.line(20, ly - 4, 34, ly - 4, SERIES[0], { width: 2 });
  svg.text(40, ly, 'the score', { size: 12, fill: INK.text });
  svg.line(120, ly - 4, 134, ly - 4, SERIES[6], { width: 1.5, dash: '5 3' });
  svg.text(140, ly, 'if the penalties were subtracted', { size: 12, fill: INK.text });
  svg.line(350, ly - 4, 364, ly - 4, SERIES[3], { width: 1.5 });
  svg.text(370, ly, 'multiplier', { size: 12, fill: INK.text });
  svg.line(460, ly - 8, 460, ly, INK.muted, { dash: '2 3' });
  svg.text(468, ly, 'a fail, and its penalty', { size: 12, fill: INK.text });
  return svg.toString();
}

/**
 * A strip over the view: the score, the score with the penalties, the multiplier and the meter;
 * a fail's penalty floats up next to the score and fades without touching it.
 */
export function hudScene(lab: Lab, s: ScoreRun, from: number, to: number, width: number): Scene {
  const height = 34;
  return {
    width,
    height,
    from,
    to,
    draw(frame: Frame, t: number) {
      frame.clear(RGB.card);
      const now = scoreAfter(s, Math.floor(t));
      frame.text(lab.fonts.text, String(now.score), 6, 2, RGB.text, { tabular: true });
      frame.text(lab.fonts.small, String(now.withPenalty), 6, 20, rgb(SERIES[6]), {
        tabular: true,
      });
      frame.text(lab.fonts.text, `×${now.multiplier}`, width - 6, 2, rgb(SERIES[3]), {
        align: 'right',
      });
      // The meter: five segments of 1024.
      for (let i = 0; i < 5; i++) {
        const x = width - 92 + i * 17;
        frame.box(x, 22, 15, 8, RGB.muted);
        const fill = Math.max(0, Math.min(1, (now.meter - i * 1024) / 1024));
        if (fill > 0) frame.fill(x + 1, 23, 13 * fill, 6, rgb(SERIES[3]));
      }
      for (const f of s.fails) {
        const age = t - f.step;
        if (f.penalty >= 0 || age < 0 || age > 45) continue;
        const a = 1 - age / 45;
        frame.text(lab.fonts.text, String(f.penalty), 70, 2 - age / 6, rgb(SERIES[6]), {
          alpha: a,
        });
      }
    },
  };
}
