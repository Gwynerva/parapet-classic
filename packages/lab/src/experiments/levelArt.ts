/**
 * The levels' art as the original stores it: no bitmaps, but objects of the scene files made of
 * coloured rectangles, sprites, tiled sprites and nested objects (props shared through `k1`),
 * drawn anew every frame. Some objects have several frames; the tutorial's and the challenges'
 * art is tweened between two of them, so the warm-up arrows pulse.
 */
import type { SceneObject } from '@parapet/runtime/content/types.ts';
import {
  CMD_NESTED,
  CMD_RECT,
  CMD_SPRITE,
  CMD_TILED,
  type DrawCommand,
} from '@parapet/runtime/render/Pose.ts';
import { sheetFrame } from '@parapet/runtime/render/Raster.ts';
import { rasterPainter } from '@parapet/runtime/render/SceneRaster.ts';
import { isRotated, ANCHOR_TOP_LEFT } from '@parapet/runtime/render/SpriteSheet.ts';
import { Frame } from '../frame.ts';
import type { Lab } from '../lab.ts';
import { INK, RGB, rgb, SERIES } from '../palette.ts';
import type { Scene } from '../scene.ts';
import { Svg } from '../svg.ts';

export const KINDS = [
  { kind: CMD_RECT, name: 'rectangles', color: SERIES[0] },
  { kind: CMD_SPRITE, name: 'sprites', color: SERIES[1] },
  { kind: CMD_TILED, name: 'tiled sprites', color: SERIES[3] },
  { kind: CMD_NESTED, name: 'nested objects', color: SERIES[2] },
] as const;

export interface Box {
  kind: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** A nested object's id. */
  id: number;
}

export function artObject(lab: Lab, levelId: number): { id: number; obj: SceneObject } {
  const id = lab.src.missions.levels[levelId]!.backgroundSceneId;
  const obj = lab.scene.getObject(id);
  if (!obj) throw new Error(`level ${levelId} has no art`);
  return { id, obj };
}

/** The boxes of a frame of an object's top-level primitives, in its own pixels. */
export function primitiveBoxes(lab: Lab, objectId: number, frame: number): Box[] {
  const composed = lab.scene.compose(objectId, frame, frame, 0);
  if (!composed) return [];
  const out: Box[] = [];
  for (let i = 0; i < composed.count; i++) {
    const c: DrawCommand = composed.cmds[i]!;
    if (c.kind === CMD_SPRITE) {
      const f = sheetFrame(lab.atlas, c.id)?.frame;
      if (!f) continue;
      const w = isRotated(c.transform) ? f.h : f.w;
      const h = isRotated(c.transform) ? f.w : f.h;
      out.push({ kind: c.kind, x: c.x - (w >> 1), y: c.y - (h >> 1), w, h, id: c.id });
    } else if (c.kind === CMD_NESTED) {
      const nested = lab.scene.getObject(c.id);
      out.push({
        kind: c.kind,
        x: c.x,
        y: c.y,
        w: nested?.width ?? 0,
        h: nested?.height ?? 0,
        id: c.id,
      });
    } else {
      out.push({ kind: c.kind, x: c.x, y: c.y, w: c.w, h: c.h, id: c.id });
    }
  }
  return out;
}

/** Counts by kind of every level's art (its usual frame). */
export function kindCounts(lab: Lab): { level: number; counts: number[]; nestedFiles: number[] }[] {
  return lab.src.missions.levels.map((lv) => {
    const boxes = primitiveBoxes(lab, lv.backgroundSceneId, 0);
    return {
      level: lv.id,
      counts: KINDS.map((k) => boxes.filter((b) => b.kind === k.kind).length),
      nestedFiles: [...new Set(boxes.filter((b) => b.kind === CMD_NESTED).map((b) => b.id >> 11))],
    };
  });
}

/** The window of `w` × `h` of a level's art that holds the most primitives of every kind. */
export function busiestWindow(
  boxes: readonly Box[],
  width: number,
  height: number,
  w: number,
  h: number,
): { x: number; y: number } {
  let best = { x: 0, y: 0, score: -1 };
  for (let y = 0; y + h <= height; y += 16) {
    for (let x = 0; x + w <= width; x += 16) {
      const counts = KINDS.map(
        (k) =>
          boxes.filter(
            (b) =>
              b.kind === k.kind && b.x < x + w && b.x + b.w > x && b.y < y + h && b.y + b.h > y,
          ).length,
      );
      const score = Math.min(...counts) * 1000 + counts.reduce((a, b) => a + b, 0);
      if (score > best.score) best = { x, y, score };
    }
  }
  return best;
}

/** A crop of a level's art, then the same crop as an x-ray: every primitive outlined by kind. */
export function xrayPicture(lab: Lab, levelId: number, w: number, h: number): Frame {
  const { id, obj } = artObject(lab, levelId);
  const boxes = primitiveBoxes(lab, id, 0);
  const at = busiestWindow(boxes, obj.width, obj.height, w, h);
  const art = lab.levelArt(levelId).image;
  const gap = 6;
  const frame = new Frame(2 * w + gap, h);
  frame.clear(RGB.line);
  frame.blit(art, at.x, at.y, w, h, 0, 0);
  frame.blit(art, at.x, at.y, w, h, w + gap, 0);
  frame.fill(w + gap, 0, w, h, RGB.card, 0.82);
  for (const k of KINDS) {
    const c = rgb(k.color);
    for (const b of boxes) {
      if (b.kind !== k.kind) continue;
      const x = b.x - at.x;
      const y = b.y - at.y;
      if (x >= w || y >= h || x + b.w <= 0 || y + b.h <= 0) continue;
      // Clipped to the right half.
      const x0 = Math.max(0, x);
      const y0 = Math.max(0, y);
      const x1 = Math.min(w, x + b.w);
      const y1 = Math.min(h, y + b.h);
      frame.box(w + gap + x0, y0, x1 - x0, y1 - y0, c);
    }
  }
  return frame;
}

/** Stacked bars: each level's art by kind of primitive. */
export function kindsChart(
  rows: readonly { level: number; counts: number[] }[],
  name: (level: number) => string,
): string {
  const x0 = 130;
  const plotW = 460;
  const top = 70;
  const rowH = 22;
  const max = Math.max(...rows.map((r) => r.counts.reduce((a, b) => a + b, 0)));
  const width = x0 + plotW + 60;
  const height = top + rows.length * rowH + 60;
  const svg = new Svg(
    width,
    height,
    'What the levels are drawn with',
    'Primitives of each level’s art, by kind (its usual frame)',
  );
  const scale = plotW / max;
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    svg.text(x0 - 8, y + 14, name(r.level), { size: 12, fill: INK.text, anchor: 'end' });
    let x = x0;
    KINDS.forEach((k, j) => {
      const n = r.counts[j]!;
      if (n === 0) return;
      svg.rect(x, y + 3, Math.max(1, n * scale - 2), rowH - 6, k.color, {
        rx: 2,
        tip: `${name(r.level)}: ${n} ${k.name}`,
      });
      x += n * scale;
    });
    svg.text(x + 6, y + 14, String(r.counts.reduce((a, b) => a + b, 0)), {
      size: 11,
      fill: INK.muted,
    });
  });
  KINDS.forEach((k, j) => svg.key(x0 + j * 120, height - 20, k.color, k.name));
  return svg.toString();
}

/**
 * The crop of a level's art around the first thing that changes between frames `a` and `b`,
 * tweened between them by the pulse as the tutorial and the challenges do (`b(bZ, ca, cb,
 * |sin| << 6, …)`); a bar under it shows the pulse.
 */
export function pulseScene(
  lab: Lab,
  levelId: number,
  a: number,
  b: number,
  w: number,
  h: number,
  steps: number,
): Scene {
  const { id, obj } = artObject(lab, levelId);
  const one = new Frame(obj.width, obj.height);
  const two = new Frame(obj.width, obj.height);
  const paint = (f: Frame, frame: number): void =>
    lab.scene.withViewport(obj.width, obj.height, () =>
      lab.scene.paintObject(
        rasterPainter(f.img, lab.atlas),
        id,
        frame,
        frame,
        0,
        0,
        0,
        false,
        undefined,
        ANCHOR_TOP_LEFT,
      ),
    );
  paint(one, a);
  paint(two, b);
  // The leftmost thing that differs between the two frames, and its box.
  const differs = (x: number, y: number): boolean => {
    const i = (y * obj.width + x) * 4;
    return (
      one.img.data[i] !== two.img.data[i] ||
      one.img.data[i + 1] !== two.img.data[i + 1] ||
      one.img.data[i + 2] !== two.img.data[i + 2]
    );
  };
  let left = -1;
  for (let x = 0; x < obj.width && left < 0; x++) {
    for (let y = 0; y < obj.height; y++) {
      if (differs(x, y)) {
        left = x;
        break;
      }
    }
  }
  let minY = obj.height;
  let maxY = 0;
  let maxX = left;
  for (let x = Math.max(0, left); x < Math.min(obj.width, left + w / 2); x++) {
    for (let y = 0; y < obj.height; y++) {
      if (!differs(x, y)) continue;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      maxX = Math.max(maxX, x);
    }
  }
  const cx = Math.max(0, Math.min(obj.width - w, Math.round((left + maxX) / 2 - w / 2)));
  const cy = Math.max(0, Math.min(obj.height - h, Math.round((minY + maxY) / 2 - h / 2)));
  const crop = new Frame(w, h);
  const barH = 6;
  return {
    width: w,
    height: h + barH + 4,
    from: 0,
    to: steps,
    draw(frame: Frame, t: number) {
      frame.clear(RGB.card);
      // `|sin(clock >> 2)| << 6`: the game clock (30 units a step), a pulse every 1024 units.
      const clock = Math.round(t * 30);
      const pulse = Math.abs(lab.sine[(clock >> 2) & 0x1ff]!) << 6;
      crop.clear(RGB.card);
      lab.scene.withViewport(w, h, () =>
        lab.scene.paintObject(
          rasterPainter(crop.img, lab.atlas),
          id,
          a,
          b,
          pulse,
          -cx,
          -cy,
          false,
          undefined,
          ANCHOR_TOP_LEFT,
        ),
      );
      frame.blit(crop.img, 0, 0, w, h, 0, 0);
      frame.fill(4, h + 3, w - 8, barH - 2, RGB.line);
      frame.fill(4, h + 3, ((w - 8) * pulse) / 65536, barH - 2, rgb(SERIES[2]));
    },
  };
}
