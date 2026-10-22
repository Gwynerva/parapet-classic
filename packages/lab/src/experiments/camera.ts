/**
 * The original's camera on a real run: the developers' rival recording of a level, followed by
 * the port of the camera (`Camera`, checked against the original on its 240 × 320 screen). Per
 * step: where the camera aims (the runner, ahead by its speed, not ahead when a wall is near),
 * where its spring has got to, and the leash that holds it near the runner.
 */
import { createRun, MoveId, type RunnerState, type World } from '@parapet/sim';
import { Camera } from '@parapet/runtime/render/Camera.ts';
import type { CharacterPose } from '@parapet/runtime/render/CharacterRenderer.ts';
import { UNITS_PER_PX } from '@parapet/runtime/render/View.ts';
import { drawRunner } from '../draw.ts';
import { Frame } from '../frame.ts';
import type { Lab } from '../lab.ts';
import { INK, RGB, rgb, SERIES } from '../palette.ts';
import { record, type Track } from '../record.ts';
import type { Scene } from '../scene.ts';
import { Svg } from '../svg.ts';

/** The original's screen, in pixels. */
export const SCREEN_W = 240;
export const SCREEN_H = 320;
const HALF_W = (SCREEN_W / 2) * UNITS_PER_PX;
/** The look-ahead at most, and the leash (a quarter of the screen each way). */
export const LOOK_MAX = HALF_W;
export const LEASH_X = (SCREEN_W / 4) * UNITS_PER_PX;
export const LEASH_Y = (SCREEN_H / 4) * UNITS_PER_PX;

export interface CameraStep {
  /** The camera's top-left corner and its target, in units. */
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  /** The look-ahead the speed asks for, and the one the camera took (0 near a wall). */
  lookWanted: number;
  look: number;
}

export interface CameraRun {
  levelId: number;
  /** The look the runner is drawn in (0 Blaise; a rival its own). */
  character: number;
  track: Track;
  /** `camera[i]` after world step `track.start + i - 1` (like the track's steps). */
  camera: CameraStep[];
  /** The step the rival stopped (its recording ran out), or the last step. */
  end: number;
}

const runs = new WeakMap<Lab, Map<number, CameraRun>>();

/**
 * Runs `world` for at most `steps` with the camera following `runner` (and `input` pressed for
 * the player), until `done` says the runner has finished; `observe` sees every step.
 */
export function followRun(
  lab: Lab,
  world: World,
  levelId: number,
  runner: RunnerState,
  opts: {
    steps: number;
    character?: number;
    input?: (world: World) => number;
    done?: (runner: RunnerState) => boolean;
    observe?: (world: World) => void;
  },
): CameraRun {
  const cam = new Camera(SCREEN_W, SCREEN_H);
  // The original's camera, not the game's smoothed one.
  cam.original = true;
  cam.reset(runner, world.level);
  const snap = (): CameraStep => {
    const wanted = Math.max(-LOOK_MAX, Math.min(LOOK_MAX, Math.trunc((runner.vx * 3840) / 4143)));
    return {
      x: cam.x,
      y: cam.y,
      targetX: cam.targetX,
      targetY: cam.targetY,
      lookWanted: wanted,
      look: cam.targetX - (runner.renderX - HALF_W),
    };
  };
  const camera = [snap()];
  let end = -1;
  const rec = record(world, lab.clips, {
    steps: opts.steps,
    input: opts.input,
    runners: () => [runner],
    observe: (w) => {
      cam.update(runner, w.level);
      camera.push(snap());
      if (end < 0 && opts.done?.(runner)) end = w.stepCount - 1;
      opts.observe?.(w);
    },
  });
  return {
    levelId,
    character: opts.character ?? 0,
    track: rec.tracks[0]!,
    camera,
    end: end < 0 ? world.stepCount - 1 : end,
  };
}

/** The rival's run of a level, with the camera following it (run once per lab and level). */
export function cameraRun(lab: Lab, levelId: number): CameraRun {
  let byLevel = runs.get(lab);
  if (!byLevel) {
    byLevel = new Map();
    runs.set(lab, byLevel);
  }
  let out = byLevel.get(levelId);
  if (!out) {
    const world = createRun({ mode: 'sprint', ...lab.run(levelId) });
    out = followRun(lab, world, levelId, world.runners[0]!, {
      steps: 2400,
      character: lab.src.missions.levels[levelId]!.rivalCharacter,
      done: (r) => r.moveId === MoveId.STOP,
    });
    byLevel.set(levelId, out);
  }
  return out;
}

/** The camera after world step `step`. */
export function cameraAfter(run: CameraRun, step: number): CameraStep {
  const i = Math.max(0, Math.min(run.camera.length - 1, Math.floor(step) - run.track.start + 1));
  return run.camera[i]!;
}

/** The horizontal offset of the camera's middle from the runner (units), after each step. */
export function offsets(
  run: CameraRun,
): { step: number; offset: number; aim: number; zeroed: boolean }[] {
  const out = [];
  for (let s = run.track.start; s <= run.end; s++) {
    const c = cameraAfter(run, s);
    const r = run.track.after(s);
    out.push({
      step: s,
      offset: c.x + HALF_W - r.x,
      aim: c.targetX + HALF_W - r.x,
      zeroed: c.lookWanted !== 0 && c.look === 0,
    });
  }
  return out;
}

/** The camera's offset from the runner over a whole run, against its aim and its leash. */
export function offsetChart(lab: Lab, run: CameraRun, stepMs: number): string {
  const data = offsets(run);
  const x0 = 70;
  const plotW = 620;
  const top = 76;
  const plotH = 220;
  const width = x0 + plotW + 30;
  const height = top + plotH + 100;
  const svg = new Svg(
    width,
    height,
    `Where the camera looks: ${lab.levelName(run.levelId)}`,
    'The developers’ rival run; how far ahead of the runner the middle of the 240-pixel screen is, step by step',
  );
  const px = (u: number): number => u / UNITS_PER_PX;
  const yMax = 130;
  const xOf = (i: number): number => x0 + (i / (data.length - 1)) * plotW;
  const yOf = (p: number): number => top + plotH / 2 - (p / yMax) * (plotH / 2);
  for (const p of [-120, -60, 0, 60, 120]) {
    svg.line(x0, yOf(p), x0 + plotW, yOf(p), p === 0 ? INK.muted : INK.line, {
      dash: Math.abs(p) === 60 ? '4 3' : undefined,
    });
    svg.text(x0 - 6, yOf(p) + 4, `${p > 0 ? '+' : ''}${p} px`, {
      size: 11,
      fill: INK.muted,
      anchor: 'end',
    });
  }
  svg.text(x0 + plotW - 4, yOf(60) - 5, 'leash', { size: 11, fill: INK.muted, anchor: 'end' });
  svg.polyline(
    data.map((d, i) => [xOf(i), yOf(px(d.aim))] as [number, number]),
    SERIES[1],
    { width: 1 },
  );
  svg.polyline(
    data.map((d, i) => [xOf(i), yOf(px(d.offset))] as [number, number]),
    SERIES[0],
    { width: 1.5 },
  );
  // Where a wall ahead cancels the look-ahead: ticks under the plot.
  data.forEach((d, i) => {
    if (d.zeroed) svg.line(xOf(i), top + plotH + 4, xOf(i), top + plotH + 12, SERIES[2]);
  });
  const seconds = ((data.length - 1) * stepMs) / 1000;
  for (let s = 0; s <= seconds; s += 10) {
    const x = x0 + ((s * 1000) / stepMs / (data.length - 1)) * plotW;
    svg.text(x, top + plotH + 28, `${s} s`, { size: 11, fill: INK.muted, anchor: 'middle' });
  }
  const ly = height - 40;
  svg.line(20, ly - 4, 34, ly - 4, SERIES[1], { width: 1 });
  svg.text(40, ly, 'where it aims: the runner, ahead by its speed', { size: 12, fill: INK.text });
  svg.line(20, ly + 16, 34, ly + 16, SERIES[0], { width: 2 });
  svg.text(40, ly + 20, 'where it is', { size: 12, fill: INK.text });
  svg.line(360, ly - 8, 360, ly, SERIES[2]);
  svg.text(368, ly, 'a wall within 4 tiles ahead: no look-ahead', { size: 12, fill: INK.text });
  return svg.toString();
}

/** Over the screen: the leash (where the screen's middle may be), the aim, the middle. */
function drawWorkings(
  view: Frame,
  pose: CharacterPose,
  c: CameraStep,
  camX: number,
  camY: number,
): void {
  const toX = (u: number): number => (u - camX) / UNITS_PER_PX;
  const toY = (u: number): number => (u - camY) / UNITS_PER_PX;
  const dropY = (SCREEN_H * UNITS_PER_PX) / 20;
  const lx = toX(pose.x) - LEASH_X / UNITS_PER_PX;
  const ly = toY(pose.y - dropY) - LEASH_Y / UNITS_PER_PX;
  view.box(lx, ly, (2 * LEASH_X) / UNITS_PER_PX, (2 * LEASH_Y) / UNITS_PER_PX, RGB.white, 0.7);
  const aimX = toX(c.targetX + HALF_W);
  const aimY = toY(c.targetY) + SCREEN_H / 2;
  const ink = c.lookWanted !== 0 && c.look === 0 ? rgb(SERIES[2]) : rgb(SERIES[1]);
  view.line(toX(pose.x), aimY, aimX, aimY, ink, { width: 1 });
  view.fill(aimX - 4, aimY, 9, 1, ink);
  view.fill(aimX, aimY - 4, 1, 9, ink);
  view.disc(SCREEN_W / 2, SCREEN_H / 2, 2.5, rgb(SERIES[0]));
}

/**
 * The original's 240 × 320 screen following the rival from `from` to `to`, with the camera's
 * workings drawn over it unless asked not to, and the whole level above it.
 */
export function viewScene(
  lab: Lab,
  run: CameraRun,
  from: number,
  to: number,
  workings = true,
): Scene {
  const art = lab.levelArt(run.levelId);
  const character = run.character;
  const level = lab.src.levels[run.levelId]!;
  // The level's solid tiles, small: a pixel or two a tile.
  const k = (SCREEN_W - 8) / (level.width * 32);
  const minimap = new Frame(SCREEN_W - 8, Math.ceil(level.height * 32 * k));
  minimap.clear(RGB.card);
  for (let ty = 0; ty < level.height; ty++) {
    for (let tx = 0; tx < level.width; tx++) {
      if ((level.tiles[ty * level.width + tx] ?? 0) === 0) continue;
      minimap.fill(tx * 32 * k, ty * 32 * k, Math.max(1, 32 * k), Math.max(1, 32 * k), RGB.muted);
    }
  }
  const minimapH = minimap.height + 8;
  return {
    width: SCREEN_W,
    height: SCREEN_H + minimapH,
    from,
    to,
    draw(frame: Frame, t: number) {
      frame.clear(RGB.card);
      const s = Math.floor(t);
      const f = t - s;
      const a = cameraAfter(run, s - 1);
      const b = cameraAfter(run, s);
      const camX = a.x + (b.x - a.x) * f;
      const camY = a.y + (b.y - a.y) * f;
      const view = new Frame(SCREEN_W, SCREEN_H);
      view.clear([96, 128, 168]);
      view.blit(
        art.image,
        Math.round(camX / UNITS_PER_PX) + art.pivotX,
        Math.round(camY / UNITS_PER_PX) + art.pivotY,
        SCREEN_W,
        SCREEN_H,
        0,
        0,
      );
      const pose = run.track.pose(t);
      drawRunner(view, lab, pose, { x: camX, y: camY }, { character });
      const r = run.track.after(s);
      if (workings) drawWorkings(view, pose, b, camX, camY);
      frame.blit(view.img, 0, 0, SCREEN_W, SCREEN_H, 0, minimapH);
      // Where on the level: its solid tiles, and the screen's window over them.
      frame.blit(minimap.img, 0, 0, minimap.width, minimap.height, 4, 4);
      frame.box(
        4 + (camX / UNITS_PER_PX) * k,
        4 + (camY / UNITS_PER_PX) * k,
        SCREEN_W * k,
        SCREEN_H * k,
        RGB.white,
      );
      frame.fill(3 + (r.x / UNITS_PER_PX) * k, 2 + (r.y / UNITS_PER_PX) * k, 3, 3, rgb(SERIES[1]));
    },
  };
}
