/**
 * A scene on one of the little levels of grey blocks: runners played from their records (the
 * same run with other presses, side by side in one place), what the experiment draws over
 * them, and a timeline of the presses underneath.
 */
import type { ArrowKey } from '@parapet/sim';
import type { DemoLevel } from '@parapet/runtime/moves/demoLevel.ts';
import { drawPlaceholderTiles } from '@parapet/runtime/render/PlaceholderTiles.ts';
import { skinSwap } from '@parapet/runtime/render/Rig.ts';
import { poseBounds } from '@parapet/runtime/render/SceneRaster.ts';
import { UNITS_PER_PX } from '@parapet/runtime/render/View.ts';
import { drawKey, drawRunner, drawTimeline, type RunnerLook, type TimelineRow } from './draw.ts';
import { Frame } from './frame.ts';
import type { Lab } from './lab.ts';
import { RGB, rgb } from './palette.ts';
import type { Track } from './record.ts';
import type { Scene } from './scene.ts';

export interface Actor extends RunnerLook {
  track: Track;
  /** A label over the runner's head at moment `t` (its state…), in its colour. */
  tag?: (t: number) => string | null;
  /** A key lit over the runner's head at moment `t` (a press waiting in the buffer…). */
  lamp?: (t: number) => ArrowKey | null;
  /** The colour of the tag and the lamp (default: the hologram's, else white). */
  ink?: string;
}

/** World units to the scene's pixels. */
export interface ToPixels {
  x: (u: number) => number;
  y: (u: number) => number;
}

export interface DemoSceneOptions {
  level: DemoLevel;
  /** The view's top-left corner in level pixels, and its size. */
  view: { x: number; y: number; width: number; height: number };
  actors: readonly Actor[];
  /** The steps the scene covers. */
  from: number;
  to: number;
  timeline?: { rows: readonly TimelineRow[]; from: number; to: number };
  /** Drawn over the level, under the runners. */
  underlay?: (frame: Frame, t: number, px: ToPixels) => void;
  /** Drawn over the runners. */
  overlay?: (frame: Frame, t: number, px: ToPixels) => void;
}

/** Steps per second of the game's clock (a step is 30 ms of it). */
export const STEPS_PER_SECOND = 1000 / 30;

export function demoScene(lab: Lab, opts: DemoSceneOptions): Scene {
  const { view } = opts;
  const timelineH = opts.timeline ? opts.timeline.rows.length * 14 + 12 : 0;
  const cam = { x: view.x * UNITS_PER_PX, y: view.y * UNITS_PER_PX };
  const px: ToPixels = {
    x: (u) => (u - cam.x) / UNITS_PER_PX,
    y: (u) => (u - cam.y) / UNITS_PER_PX,
  };
  const scene = new Frame(view.width, view.height);
  return {
    width: view.width,
    height: view.height + timelineH,
    from: opts.from,
    to: opts.to,
    draw(frame: Frame, t: number) {
      frame.clear(RGB.card);
      scene.clear(RGB.card);
      drawPlaceholderTiles(scene.tiles(), opts.level, view.x, view.y, view.width, view.height);
      opts.underlay?.(scene, t, px);
      for (const a of opts.actors) drawRunner(scene, lab, a.track.pose(t), cam, a);
      opts.overlay?.(scene, t, px);
      for (const [i, a] of opts.actors.entries()) {
        const pose = a.track.pose(t);
        const box = poseBounds(lab.atlas, lab.scene, pose, cam, skinSwap(a.character ?? 0));
        if (!box) continue;
        const ink = a.ink ?? a.color;
        const c = ink ? rgb(ink) : RGB.text;
        const x = Math.round((box.x0 + box.x1) / 2);
        let y = box.y0 - 4 - 12 * i;
        const lamp = a.lamp?.(t);
        if (lamp) {
          drawKey(scene, x - 5, y - 11, lamp, c);
          y -= 14;
        }
        const tag = a.tag?.(t);
        if (tag) scene.text(lab.fonts.small, tag, x, y - 12, c, { align: 'center', outline: true });
      }
      frame.blit(scene.img, 0, 0, view.width, view.height, 0, 0);
      if (opts.timeline) {
        const tl = opts.timeline;
        drawTimeline(
          frame,
          { x: 8, y: view.height + 6, w: view.width - 16 },
          tl.from,
          tl.to,
          tl.rows,
          t,
          STEPS_PER_SECOND,
        );
      }
    },
  };
}
