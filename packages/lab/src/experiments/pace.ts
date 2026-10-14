/**
 * The original's clock fed constant frame times: each frame adds `ms · 900 >> 10` time units, at
 * most 150, and a step is 30 units (`originalFrameUnits`). The cut to whole units and the cap
 * make its pace depend on the frame time. Parapet's clock (`FixedStepClock`) keeps the cap and
 * carries the cut fraction to the next frame instead.
 */
import { asciiWorld } from '../demo.ts';
import {
  FixedStepClock,
  MAX_FRAME_UNITS,
  originalFrameUnits,
  TIME_SCALE_NUM,
  TIME_SCALE_SHIFT,
} from '@parapet/runtime/app/GameLoop.ts';
import { STEP } from '@parapet/sim';
import { drawPlaceholderTiles } from '@parapet/runtime/render/PlaceholderTiles.ts';
import { parseDemoLevel } from '@parapet/runtime/moves/demoLevel.ts';
import { UNITS_PER_PX } from '@parapet/runtime/render/View.ts';
import { drawRunner } from '../draw.ts';
import { Frame } from '../frame.ts';
import type { Lab } from '../lab.ts';
import { INK, RGB, rgb, SERIES } from '../palette.ts';
import { record, type Track } from '../record.ts';
import { STEP_MS, type Scene } from '../scene.ts';
import { Svg } from '../svg.ts';

/** Time units a frame of `ms` adds in the original. */
export const frameUnits = originalFrameUnits;

/** Steps the original runs in `realMs` of frames of `frameMs` each. */
export function stepsIn(frameMs: number, realMs: number): number {
  let units = 0;
  for (let t = frameMs; t <= realMs + 1e-9; t += frameMs) units += frameUnits(frameMs);
  return Math.floor(units / STEP);
}

/** Steps Parapet's clock runs in `realMs` of frames of `frameMs` each. */
export function parapetStepsIn(frameMs: number, realMs: number): number {
  const clock = new FixedStepClock();
  let steps = 0;
  for (let t = frameMs; t <= realMs + 1e-9; t += frameMs)
    steps += clock.advance(frameMs, { step: () => true });
  return steps;
}

/** The game's pace at frames of `ms`, against the original's own (900/1024 of real time). */
export function pace(ms: number): number {
  return frameUnits(ms) / ((ms * TIME_SCALE_NUM) / (1 << TIME_SCALE_SHIFT));
}

/** The frame time from which the cap holds (150 units a frame). */
export const CAP_MS = (MAX_FRAME_UNITS * (1 << TIME_SCALE_SHIFT)) / TIME_SCALE_NUM;

/** Common frame rates, for the chart. */
export const RATES = [240, 144, 120, 60, 30, 20, 10, 6, 4];

export function paceChart(): string {
  const x0 = 70;
  const plotW = 560;
  const top = 76;
  const plotH = 220;
  const width = x0 + plotW + 30;
  const height = top + plotH + 76;
  const svg = new Svg(
    width,
    height,
    'How fast the game runs, by the time a frame takes',
    'Game time per frame is ms · 900 >> 10 (at most 150); 100 % is the original’s own pace, a step every 34.1 ms',
  );
  const lo = Math.log(1);
  const hi = Math.log(400);
  const xOf = (ms: number): number => x0 + ((Math.log(ms) - lo) / (hi - lo)) * plotW;
  const yOf = (p: number): number => top + plotH - p * plotH;
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    svg.line(x0, yOf(p), x0 + plotW, yOf(p), p === 1 ? INK.muted : INK.line);
    svg.text(x0 - 6, yOf(p) + 4, `${p * 100} %`, { size: 11, fill: INK.muted, anchor: 'end' });
  }
  for (const ms of [1, 2, 5, 10, 20, 50, 100, 200, 400]) {
    svg.line(xOf(ms), top + plotH, xOf(ms), top + plotH + 4, INK.muted);
    svg.text(xOf(ms), top + plotH + 16, `${ms}`, { size: 11, fill: INK.muted, anchor: 'middle' });
  }
  svg.text(x0 + plotW / 2, top + plotH + 32, 'milliseconds a frame takes (log scale)', {
    size: 11,
    fill: INK.muted,
    anchor: 'middle',
  });
  const pts: [number, number][] = [];
  for (let i = 0; i <= 4000; i++) {
    const ms = Math.exp(lo + ((hi - lo) * i) / 4000);
    pts.push([xOf(ms), yOf(pace(ms))]);
  }
  svg.polyline(pts, SERIES[0], { width: 1.5 });
  svg.line(xOf(CAP_MS), top, xOf(CAP_MS), top + plotH, INK.muted, { dash: '3 3' });
  svg.text(xOf(CAP_MS) + 4, top + 12, `cap: ${CAP_MS.toFixed(1)} ms`, {
    size: 11,
    fill: INK.muted,
  });
  for (const fps of RATES) {
    const ms = 1000 / fps;
    const p = pace(ms);
    svg.circle(xOf(ms), yOf(p), 4, INK.text, {
      tip: `${fps} frames a second: ${(p * 100).toFixed(1)} %`,
    });
    svg.text(xOf(ms), yOf(p) + (fps === 60 || fps === 240 ? 18 : -9), `${fps}`, {
      size: 11,
      fill: INK.text,
      anchor: 'middle',
    });
  }
  svg.circle(26, height - 22, 4, INK.text);
  svg.text(36, height - 18, 'frames a second of common screens and phones', {
    size: 12,
    fill: INK.text,
  });
  return svg.toString();
}

/**
 * The same run shown by frame loops at different frame rates, against the wall clock: each lane
 * draws the runner where its clock has got to, only when a frame of it is due, and counts its
 * steps. `t` is real time, in steps of the original's own pace (34.1 ms).
 */
export function raceScene(lab: Lab, rates: readonly number[], seconds: number): Scene {
  const rows = ['.'.repeat(60), '.S' + '.'.repeat(58), '='.repeat(60), 'x'.repeat(60)];
  const level = parseDemoLevel(rows);
  const world = asciiWorld(lab, rows);
  const steps = Math.ceil((seconds * 1000) / STEP_MS) + 4;
  const track: Track = record(world, lab.clips, { steps }).tracks[0]!;
  const laneW = 320;
  const laneH = 58;
  const gap = 4;
  const head = 18;
  const lane = new Frame(laneW, laneH);
  return {
    width: laneW,
    height: head + rates.length * (laneH + gap) - gap,
    from: 0,
    to: (seconds * 1000) / STEP_MS,
    draw(frame: Frame, t: number) {
      frame.clear(RGB.line);
      frame.fill(0, 0, laneW, head, RGB.card);
      const realMs = t * STEP_MS;
      frame.text(lab.fonts.text, `${(realMs / 1000).toFixed(1)} s`, laneW / 2, 2, RGB.text, {
        align: 'center',
        tabular: true,
      });
      const stepAt = (fps: number): number => {
        const frameMs = 1000 / fps;
        const frames = Math.floor(realMs / frameMs + 1e-9);
        return (frames * frameUnits(frameMs)) / STEP;
      };
      // The camera follows the first lane's runner.
      const lead = track.pose(stepAt(rates[0]!));
      const camX = lead.x - 230 * UNITS_PER_PX;
      const camY = (2 * 32 + 8 - laneH) * UNITS_PER_PX;
      rates.forEach((fps, i) => {
        const at = stepAt(fps);
        lane.clear(RGB.card);
        drawPlaceholderTiles(
          lane.tiles(),
          level,
          camX / UNITS_PER_PX,
          camY / UNITS_PER_PX,
          laneW,
          laneH,
        );
        drawRunner(lane, lab, track.pose(at), { x: camX, y: camY });
        const c = rgb(SERIES[i % SERIES.length]!);
        frame.blit(lane.img, 0, 0, laneW, laneH, 0, head + i * (laneH + gap));
        const y = head + i * (laneH + gap) + 4;
        frame.text(lab.fonts.small, `${fps} fps`, 6, y, c, { outline: true });
        frame.text(lab.fonts.small, `${Math.floor(at)}`, laneW - 6, y, c, {
          align: 'right',
          outline: true,
          tabular: true,
        });
      });
    },
  };
}
