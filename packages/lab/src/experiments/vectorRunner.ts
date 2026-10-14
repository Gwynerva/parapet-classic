/**
 * The runner as the original builds it: no sprite sheet of whole poses, but one object of the
 * scene files (`k0`) with 19 parts, each a small sprite placed, turned and mirrored anew in every
 * one of 463 keyframes; the game tweens between keyframes, and a skin is a swap of parts.
 */
import type { SceneObject } from '@parapet/runtime/content/types.ts';
import type { CharacterPose } from '@parapet/runtime/render/CharacterRenderer.ts';
import { blitSprite, sheetFrame } from '@parapet/runtime/render/Raster.ts';
import { skinSwap } from '@parapet/runtime/render/Rig.ts';
import { paintPose, rasterPainter } from '@parapet/runtime/render/SceneRaster.ts';
import {
  CHARACTER_OBJECT,
  type ScenePainter,
  type SpriteSwap,
} from '@parapet/runtime/render/SceneRenderer.ts';
import { UNITS_PER_PX } from '@parapet/runtime/render/View.ts';
import { asciiWorld } from '../demo.ts';
import { drawRunner } from '../draw.ts';
import { Frame } from '../frame.ts';
import type { Lab } from '../lab.ts';
import { RGB, rgb, SERIES } from '../palette.ts';
import { record, type Track } from '../record.ts';
import type { Scene } from '../scene.ts';

/** The ghost of an earlier hot-seat player: every part an 8 × 8 dot, the ponytail hidden. */
export const DOT_SPRITE = 80;
export const dotSwap: SpriteSwap = (id) => (id >= 13 && id <= 16 ? -1 : DOT_SPRITE);

export function characterObject(lab: Lab): SceneObject {
  const obj = lab.scene.getObject(CHARACTER_OBJECT);
  if (!obj) throw new Error('no character object');
  return obj;
}

/** The sprites each part shows over all keyframes. */
export function partSprites(obj: SceneObject): number[][] {
  return obj.primitives.map((p) =>
    [...new Set(p.value.filter((v) => v >= 0).map((v) => v >> 3))].sort((a, b) => a - b),
  );
}

/** A run on flat ground: the run cycle, from its record. */
export function runCycle(lab: Lab, steps: number): Track {
  const rows = ['.'.repeat(80), '.S' + '.'.repeat(78), '='.repeat(80), 'x'.repeat(80)];
  return record(asciiWorld(lab, rows), lab.clips, { steps }).tracks[0]!;
}

/** A pose placed at the middle bottom of a `w` × `h` cell, whatever its world position. */
function centred(
  pose: CharacterPose,
  w: number,
  h: number,
): { pose: CharacterPose; cam: { x: number; y: number } } {
  return {
    pose,
    cam: { x: pose.x - (w / 2) * UNITS_PER_PX, y: pose.y - (h - 10) * UNITS_PER_PX },
  };
}

/** Every part's sprites, a row per part: the runner's whole wardrobe. */
export function partsSheet(lab: Lab): Frame {
  const sprites = partSprites(characterObject(lab));
  const cell = 36;
  const label = 22;
  const cols = 2;
  const perCol = Math.ceil(sprites.length / cols);
  const widest = Math.max(...sprites.map((s) => s.length));
  const colW = label + widest * cell + 12;
  const frame = new Frame(cols * colW + 8, perCol * cell + 8);
  frame.clear(RGB.card);
  sprites.forEach((ids, part) => {
    const x0 = 8 + Math.floor(part / perCol) * colW;
    const y0 = 4 + (part % perCol) * cell;
    frame.fill(x0, y0 + cell - 2, colW - 12, 1, RGB.line);
    frame.text(lab.fonts.small, String(part + 1), x0 + label - 6, y0 + cell / 2 - 6, RGB.muted, {
      align: 'right',
    });
    ids.forEach((id, i) => {
      const found = sheetFrame(lab.atlas, id);
      if (!found) return;
      const { w, h } = found.frame;
      const cx = x0 + label + i * cell + cell / 2;
      const cy = y0 + cell / 2 - 1;
      blitSprite(frame.img, lab.atlas, id, Math.round(cx - w / 2), Math.round(cy - h / 2), 0);
    });
  });
  return frame;
}

/**
 * The run cycle with the parts pulled away from the body and back, so the 19 pieces show: each
 * sprite moved out from the pose's middle by `spread` (1 = where the game puts it).
 */
export function explodedScene(lab: Lab): Scene {
  return puppetScene(lab, {});
}

export interface PuppetOptions {
  /** How far the parts are pulled apart (1: together); none: apart and back over the scene. */
  spread?: number;
  /** The look: a character of the original, or the hot-seat ghost's dots. */
  look?: number | 'dots';
  /** Tween between keyframes as the game does (default), or show the keyframes alone. */
  tween?: boolean;
}

/** The run cycle drawn with the puppet's knobs: its parts spread, its look, its tween. */
export function puppetScene(lab: Lab, opts: PuppetOptions): Scene {
  const track = runCycle(lab, 160);
  const swap = opts.look === 'dots' ? dotSwap : skinSwap(opts.look ?? 0);
  const w = 220;
  const h = 220;
  const from = 40;
  const to = 40 + 120;
  // The feet 40 pixels under the middle of the frame, the parts spread from the middle.
  const feetY = h / 2 + 40;
  return {
    width: w,
    height: h,
    from,
    to,
    draw(frame: Frame, t: number) {
      frame.clear(RGB.card);
      const phase = (t - from) / (to - from);
      const spread =
        opts.spread ??
        1 + 1.1 * Math.sin(Math.PI * Math.min(1, Math.max(0, phase * 1.25 - 0.1))) ** 2;
      const glide = track.pose(t);
      const pose = opts.tween === false ? { ...glide, a: glide.b, t: 0 } : glide;
      const cam = { x: pose.x - (w / 2) * UNITS_PER_PX, y: pose.y - feetY * UNITS_PER_PX };
      const inner = rasterPainter(frame.img, lab.atlas);
      const painter: ScenePainter = {
        ...inner,
        sprite(id, x, y, transform, anchor) {
          const sx = w / 2 + (x - w / 2) * spread;
          const sy = h / 2 + (y - h / 2) * spread;
          inner.sprite(id, sx, sy, transform, anchor);
        },
      };
      paintPose(painter, lab.scene, pose, cam, swap, w, h);
    },
  };
}

/** The ten characters and the hot-seat ghost, running in step. */
export function skinsScene(lab: Lab): Scene {
  const track = runCycle(lab, 80);
  const cw = 64;
  const ch = 76;
  const cols = 6;
  const looks: SpriteSwap[] = [...Array.from({ length: 10 }, (_, c) => skinSwap(c)), dotSwap];
  const rows = Math.ceil(looks.length / cols);
  return {
    width: cols * cw,
    height: rows * ch,
    from: 30,
    to: 30 + 46,
    draw(frame: Frame, t: number) {
      frame.clear(RGB.card);
      const cell = new Frame(cw, ch);
      looks.forEach((swap, i) => {
        cell.clear(RGB.card);
        const { pose, cam } = centred(track.pose(t), cw, ch);
        paintPose(rasterPainter(cell.img, lab.atlas), lab.scene, pose, cam, swap, cw, ch);
        frame.blit(cell.img, 0, 0, cw, ch, (i % cols) * cw, Math.floor(i / cols) * ch);
        const label = i < 10 ? String(i) : '';
        frame.text(
          lab.fonts.small,
          label,
          (i % cols) * cw + 4,
          Math.floor(i / cols) * ch + 2,
          RGB.muted,
        );
      });
    },
  };
}

/** The same run drawn with the tween (the game) and with the keyframes alone, slowed down. */
export function tweenScene(lab: Lab): Scene {
  const track = runCycle(lab, 100);
  const w = 120;
  const h = 110;
  return {
    width: 2 * w + 4,
    height: h,
    from: 40,
    to: 40 + 26,
    draw(frame: Frame, t: number) {
      frame.clear(RGB.line);
      const pose = track.pose(t);
      const halves: [CharacterPose, string][] = [
        [{ ...pose, a: pose.b, t: 0 }, SERIES[1]],
        [pose, SERIES[0]],
      ];
      halves.forEach(([p, color], i) => {
        const cell = new Frame(w, h);
        cell.clear(RGB.card);
        const c = centred(p, w, h);
        drawRunner(cell, lab, c.pose, c.cam);
        cell.text(lab.fonts.small, `${p.a}`, 4, 2, rgb(color), { tabular: true });
        if (p.a !== p.b)
          cell.text(lab.fonts.small, `${p.b}`, w - 4, 2, rgb(color), {
            align: 'right',
            tabular: true,
          });
        frame.blit(cell.img, 0, 0, w, h, i * (w + 4), 0);
      });
    },
  };
}
