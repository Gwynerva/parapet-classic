/**
 * What the findings draw over the game's pictures: runners in the game's own look or as
 * holograms in a series colour (the look of the game's ghosts), the keys pressed, and a
 * timeline of steps under a scene.
 */
import { recolorEcho, makeEchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import type { CharacterPose } from '@parapet/runtime/render/CharacterRenderer.ts';
import type { ArrowKey } from '@parapet/sim';
import type { Rgb } from '@parapet/runtime/render/color.ts';
import { compositeLayer, newImage, type RgbaSheet } from '@parapet/runtime/render/Raster.ts';
import { rasterPose } from '@parapet/runtime/render/SceneRaster.ts';
import { skinSwap } from '@parapet/runtime/render/Rig.ts';
import type { CameraPos } from '@parapet/runtime/render/View.ts';
import type { DemoKey } from '@parapet/runtime/moves/MoveDemo.ts';
import type { Frame } from './frame.ts';
import type { Lab } from './lab.ts';
import { RGB, rgb, SERIES } from './palette.ts';

const holograms = new WeakMap<Lab, Map<string, RgbaSheet>>();

/** The atlas recoloured as the game's ghosts are, in `hex` (made once per colour). */
export function hologramSheet(lab: Lab, hex: string): RgbaSheet {
  let byColour = holograms.get(lab);
  if (!byColour) {
    byColour = new Map();
    holograms.set(lab, byColour);
  }
  let sheet = byColour.get(hex);
  if (!sheet) {
    const { image, frames } = lab.atlas;
    const data = recolorEcho(
      new Uint8ClampedArray(image.data),
      image.width,
      image.height,
      makeEchoColor(hex, hex).ramp,
      true,
      frames,
    );
    sheet = { image: { width: image.width, height: image.height, data }, frames };
    byColour.set(hex, sheet);
  }
  return sheet;
}

export interface RunnerLook {
  /** A series colour: the runner as a hologram in it; none: Blaise as the game draws the character. */
  color?: string;
  /** See-through, drawn whole first so the limbs do not show through one another. */
  alpha?: number;
  /** Character (skin) of the original, 0 Blaise. */
  character?: number;
}

/** A runner's pose, `cam` being the frame's top-left corner in world units. */
export function drawRunner(
  frame: Frame,
  lab: Lab,
  pose: CharacterPose,
  cam: CameraPos,
  look: RunnerLook = {},
): void {
  const sheet = look.color ? hologramSheet(lab, look.color) : lab.atlas;
  const swap = skinSwap(look.character ?? 0);
  const alpha = look.alpha ?? 1;
  if (alpha >= 1) {
    rasterPose(frame.img, sheet, lab.scene, pose, cam, swap);
    return;
  }
  const layer = newImage(frame.width, frame.height);
  rasterPose(layer, sheet, lab.scene, pose, cam, swap);
  compositeLayer(frame.img, layer, alpha);
}

/** 7 × 7 arrows: the four keys. */
const KEY_ART: Record<ArrowKey, readonly string[]> = {
  up: ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..', '..###..'],
  down: ['..###..', '..###..', '..###..', '#######', '.#####.', '..###..', '...#...'],
  left: ['...#...', '..##...', '.######', '#######', '.######', '..##...', '...#...'],
  right: ['...#...', '...##..', '######.', '#######', '######.', '...##..', '...#...'],
};

/** A key as a little keycap with its arrow, its top-left at (x, y): 11 × 11 pixels. */
export function drawKey(
  frame: Frame,
  x: number,
  y: number,
  key: ArrowKey,
  c: Rgb = RGB.text,
): void {
  frame.fill(x, y, 11, 11, RGB.black, 0.7);
  frame.box(x, y, 11, 11, c);
  const art = KEY_ART[key];
  art.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++)
      if (row[rx] === '#') frame.dot(x + 2 + rx, y + 2 + ry, c);
  });
}

/** The arrow of a demo's key for a runner facing `facingRight`. */
export function arrowOf(key: DemoKey, facingRight: boolean): ArrowKey {
  if (key === 'up' || key === 'down') return key;
  return (key === 'fwd') === facingRight ? 'right' : 'left';
}

export interface TimelineRow {
  /** Steps (absolute) with a key pressed, and the key. */
  presses: readonly { step: number; key: ArrowKey }[];
  /** Steps with a marker (a kick, a fail…): a small triangle. */
  marks?: readonly number[];
  /** Stretches of steps `[first, last]` lit along the row (a press waiting in the buffer…). */
  spans?: readonly (readonly [number, number])[];
  color: string;
}

/**
 * A timeline under a scene: rows of presses and marks over the steps `from..to`, ticks every
 * second of the original's time, and the moment `t` as a playhead.
 */
export function drawTimeline(
  frame: Frame,
  box: { x: number; y: number; w: number },
  from: number,
  to: number,
  rows: readonly TimelineRow[],
  t: number,
  stepsPerSecond: number,
): number {
  const xOf = (step: number): number => box.x + ((step - from) / (to - from)) * box.w;
  const rowH = 14;
  const h = rows.length * rowH + 4;
  frame.fill(box.x, box.y, box.w, h, RGB.black, 0.35);
  for (let s = from; s <= to; s += stepsPerSecond) frame.fill(xOf(s), box.y, 1, h, RGB.line);
  rows.forEach((row, i) => {
    const y = box.y + 2 + i * rowH;
    const c = rgb(row.color);
    frame.fill(box.x, y + rowH / 2, box.w, 1, c, 0.35);
    for (const [a, b] of row.spans ?? []) {
      const x0 = xOf(Math.max(from, a));
      frame.fill(x0, y + rowH / 2 - 2, xOf(Math.min(to, b + 1)) - x0, 5, c, 0.8);
    }
    for (const p of row.presses) {
      if (p.step < from || p.step > to) continue;
      drawKey(frame, Math.round(xOf(p.step)) - 5, y + 1, p.key, c);
    }
    for (const m of row.marks ?? []) {
      if (m < from || m > to) continue;
      const mx = Math.round(xOf(m));
      for (let k = 0; k < 4; k++) frame.fill(mx - k, y + rowH - 3 - k, 2 * k + 1, 1, c);
    }
  });
  const px = Math.round(xOf(Math.max(from, Math.min(to, t))));
  frame.fill(px, box.y - 2, 1, h + 4, RGB.text);
  return h;
}

/** The colours of a list of series, in order. */
export function seriesColor(i: number): string {
  return SERIES[i % SERIES.length]!;
}
