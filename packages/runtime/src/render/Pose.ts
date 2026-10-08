/**
 * Composite scene objects as lists of draw commands: the tween, the skin swap and the mirroring
 * of `b(int,int,int,int,int,int,int,int)` (d.java line 3218), without a canvas. The game draws
 * the commands (`SceneRenderer.drawObject`), the tools rasterise them (`Raster.ts`), effects
 * read the body's points from them, so all three agree to the pixel.
 *
 * The sprite id always comes from frame A (when t > 0.5 the original swaps the frames and uses
 * 1 - t, so the id comes from the nearer frame). Mirroring is `x' = -x - width + objectWidth`
 * with each sprite transform composed with a horizontal mirror (line 3364).
 *
 * A swap may hang attachments on a part (a cape, a sword on the back): extra sprites centred
 * on the part's point and turned like it, drawn behind everything, just under or over the part,
 * over the legs (after the near leg, before the head and the near arm: a skirt), or in front of
 * everything.
 */
import type { SceneObject } from '../content/types.ts';
import { bodyMirror, Family, familyOf, type PoseAnchors } from './Rig.ts';
import { isRotated, mirrorTransform } from './SpriteSheet.ts';

/** Keyframe tween fraction scale: `t` runs 0..TWEEN_ONE. */
export const TWEEN_ONE = 65536;

/** Composite primitive types (bits 8..13 of the header) and command kinds. */
export const CMD_RECT = 0;
export const CMD_SPRITE = 1;
export const CMD_NESTED = 2;
export const CMD_TILED = 3;

/** Where an attachment is drawn relative to its part and the rest of the body. */
export const AttachLayer = { BACK: 0, UNDER: 1, OVER: 2, FRONT: 3, HIPS: 4 } as const;

/**
 * The character's last near-leg slot (`Rig.ts`, `SLOT_SIDE`): attachments of the `HIPS` layer
 * come right after it, over both legs and under the head and the near arm.
 */
const NEAR_LEG_LAST_SLOT = 12;

/** How a part is seen this frame: the object's facing and the body's own mirroring. */
export interface PartContext {
  /** The whole object is drawn mirrored (facing left). */
  flipX: boolean;
  /** The body ends up mirrored on screen: `flipX` against the keyframe's own turn. */
  bodyFlip: boolean;
}

/**
 * Attachments of a part: pushes pairs (layer, sprite id) onto `out` and returns how many pairs
 * it pushed.
 */
export type AttachLookup = (
  spriteId: number,
  transform: number,
  primitive: number,
  part: PartContext,
  out: number[],
) => number;

/**
 * Replaces the sprite of a primitive flagged `swapParts`: receives the keyframe's sprite id and
 * transform, the primitive's index in the object (for the character: which slot, `Rig.ts`) and
 * how the part is seen, and returns the sprite id to draw, or -1 to hide the part. The
 * transform is kept (`a(int,int[])`, line 5931).
 */
export interface SpriteSwap {
  (spriteId: number, transform: number, primitive: number, part?: PartContext): number;
  /** Extra sprites hung on the parts. */
  attach?: AttachLookup;
}

/** Sizes of the sprites a swap may return (and of nested objects, for mirroring them). */
export interface SpriteSizes {
  width(id: number): number;
  height(id: number): number;
  objectWidth?(id: number): number;
}

/** One thing to draw, in the object's box (add the box's screen position). */
export interface DrawCommand {
  kind: number;
  /** Sprite to draw (sprites, tiles); nested object id (nested). */
  id: number;
  /** The keyframe's sprite before the swap (-1 for attachments and non-sprites). */
  source: number;
  transform: number;
  /** Sprites: the centre point; rects and tiles: the top-left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rect colour, 24-bit RGB. */
  rgb: number;
  /** Primitive index, -1 for nothing. */
  slot: number;
  /** An attachment rather than the part itself. */
  attachment: boolean;
}

/** Blend two RGB565 colours by t/65536 and expand to 24-bit RGB exactly like line 3313. */
export function mixRgb565(a: number, b: number, t: number): number {
  const u = TWEEN_ONE - t;
  const r = ((((a & 0xf800) * u + (b & 0xf800) * t) >>> 13) * 33) & 0xff0000;
  const g = ((((a & 0x7e0) * u + (b & 0x7e0) * t) >>> 17) * 65) & 0xff00;
  const bl = ((((a & 0x1f) * u + (b & 0x1f) * t) * 33) >>> 18) & 0xff;
  return r | g | bl;
}

function clampFrame(frame: number, count: number): number {
  if (frame < 0) return 0;
  if (frame >= count) return count - 1;
  return frame;
}

function command(out: DrawCommand[], n: number): DrawCommand {
  let c = out[n];
  if (!c) {
    c = {
      kind: 0,
      id: 0,
      source: -1,
      transform: 0,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      rgb: 0,
      slot: -1,
      attachment: false,
    };
    out[n] = c;
  }
  return c;
}

/** Scratch of one composition: per primitive its resolved values, and the attachments. */
interface Resolved {
  type: number;
  rawX: number;
  y: number;
  /** `(id << 3) | transform` after the swap, -1 hidden; nested id; colour pair for rects. */
  value: number;
  source: number;
  w: number;
  h: number;
  rgb: number;
  attachFrom: number;
  attachCount: number;
}

const scratch: Resolved[] = [];
const attachScratch: number[] = [];

/** The tween of keyframes (a, b) by t as the original applies it: the nearer frame first. */
export function orderFrames(
  obj: SceneObject,
  frameA: number,
  frameB: number,
  t: number,
): [number, number, number] {
  if (t > 32767) {
    const s = frameA;
    frameA = frameB;
    frameB = s;
    t = TWEEN_ONE - t;
  }
  return [clampFrame(frameA, obj.frames), clampFrame(frameB, obj.frames), t];
}

/**
 * Commands drawing `obj` tweened from keyframe `frameA` to `frameB` by `t` (0..65536),
 * mirrored around its box when `flipX`, written into `out` (reused); returns their count.
 * Nested objects come out as one `CMD_NESTED` command each (the caller recurses).
 */
export function composePose(
  obj: SceneObject,
  sizes: SpriteSizes,
  frameA: number,
  frameB: number,
  t: number,
  flipX: boolean,
  swap: SpriteSwap | undefined,
  out: DrawCommand[],
): number {
  [frameA, frameB, t] = orderFrames(obj, frameA, frameB, t);
  const part: PartContext | undefined = swap
    ? { flipX, bodyFlip: flipX !== (bodyMirror(obj)[frameA] === 1) }
    : undefined;
  const attach = swap?.attach;
  attachScratch.length = 0;

  const prims = obj.primitives;
  for (let pi = 0; pi < prims.length; pi++) {
    const p = prims[pi]!;
    let r = scratch[pi];
    if (!r) {
      r = {
        type: 0,
        rawX: 0,
        y: 0,
        value: 0,
        source: -1,
        w: 0,
        h: 0,
        rgb: 0,
        attachFrom: 0,
        attachCount: 0,
      };
      scratch[pi] = r;
    }
    r.type = p.hidden ? -1 : p.type;
    r.attachCount = 0;
    if (p.hidden) continue;
    const ax = p.x[frameA] ?? 0;
    const ay = p.y[frameA] ?? 0;
    const av = p.value[frameA] ?? 0;
    const aw = p.w[frameA] ?? 0;
    const ah = p.h[frameA] ?? 0;
    const bx = p.x[frameB] ?? 0;
    const by = p.y[frameB] ?? 0;
    const bv = p.value[frameB] ?? 0;
    const bw = p.w[frameB] ?? 0;
    const bh = p.h[frameB] ?? 0;

    // `i[n] += (delta * t + 32768) >> 16` for every parameter (line 3330).
    r.rawX = ax + (((bx - ax) * t + 32768) >> 16);
    r.y = ay + (((by - ay) * t + 32768) >> 16);
    const pv = av + (((bv - av) * t + 32768) >> 16);
    r.w = aw + (((bw - aw) * t + 32768) >> 16);
    r.h = ah + (((bh - ah) * t + 32768) >> 16);
    r.source = -1;

    switch (p.type) {
      case CMD_SPRITE: {
        // Sprite ids come from frame A; the skin swap sees the keyframe's id and transform.
        let value = av;
        if (value !== -1) r.source = value >> 3;
        if (p.swapParts && swap && value !== -1) {
          const id = swap(value >> 3, value & 7, pi, part);
          if (attach) {
            r.attachFrom = attachScratch.length;
            r.attachCount = attach(value >> 3, value & 7, pi, part!, attachScratch);
          }
          value = id < 0 ? -1 : (id << 3) | (value & 7);
        }
        r.value = value;
        break;
      }
      case CMD_RECT:
        r.rgb = mixRgb565(av, bv, t);
        break;
      case CMD_NESTED:
        r.value = pv;
        break;
      case CMD_TILED:
        r.value = av;
        break;
      default:
        r.type = -1;
        break;
    }
  }

  let n = 0;
  if (attach) {
    for (let pi = 0; pi < prims.length; pi++) {
      n = emitAttachments(out, n, pi, AttachLayer.BACK, obj, sizes, flipX, frameA);
    }
  }
  let hipsDone = !attach;
  const hips = (): void => {
    for (let pj = 0; pj < prims.length; pj++) {
      n = emitAttachments(out, n, pj, AttachLayer.HIPS, obj, sizes, flipX, frameA);
    }
    hipsDone = true;
  };
  for (let pi = 0; pi < prims.length; pi++) {
    if (!hipsDone && pi > NEAR_LEG_LAST_SLOT) hips();
    const r = scratch[pi]!;
    if (r.type < 0) continue;
    if (r.attachCount > 0) {
      n = emitAttachments(out, n, pi, AttachLayer.UNDER, obj, sizes, flipX, frameA);
    }
    let x = r.rawX;
    let value = r.value;
    if (flipX) {
      switch (r.type) {
        case CMD_SPRITE: {
          if (value === -1) break;
          const id = value >> 3;
          const tr = value & 7;
          const drawn = isRotated(tr) ? sizes.height(id) : sizes.width(id);
          x = -x - (drawn & 1);
          value = (id << 3) | mirrorTransform(tr);
          break;
        }
        case CMD_RECT:
        case CMD_TILED:
          // The original has no case for tiled primitives (never mirrored in the data);
          // treated like a rectangle.
          x = -x - r.w;
          break;
        case CMD_NESTED:
          x = -x - (sizes.objectWidth?.(value) ?? 0);
          break;
        default:
          break;
      }
      x += obj.width;
    }
    if (!(r.type === CMD_SPRITE && value === -1)) {
      const c = command(out, n++);
      c.kind = r.type;
      c.source = r.source;
      c.slot = pi;
      c.attachment = false;
      c.x = x;
      c.y = r.y;
      c.w = r.w;
      c.h = r.h;
      c.rgb = r.rgb;
      if (r.type === CMD_SPRITE || r.type === CMD_TILED) {
        c.id = value >> 3;
        c.transform = value & 7;
      } else {
        c.id = value;
        c.transform = 0;
      }
    }
    if (r.attachCount > 0) {
      n = emitAttachments(out, n, pi, AttachLayer.OVER, obj, sizes, flipX, frameA);
    }
  }
  if (!hipsDone) hips();
  if (attach) {
    for (let pi = 0; pi < prims.length; pi++) {
      n = emitAttachments(out, n, pi, AttachLayer.FRONT, obj, sizes, flipX, frameA);
    }
  }
  return n;
}

/** Writes primitive `pi`'s attachments of `layer` as commands from index `n`; returns the end. */
function emitAttachments(
  out: DrawCommand[],
  n: number,
  pi: number,
  layer: number,
  obj: SceneObject,
  sizes: SpriteSizes,
  flipX: boolean,
  frameA: number,
): number {
  const r = scratch[pi]!;
  for (let k = 0; k < r.attachCount; k++) {
    const at = r.attachFrom + k * 2;
    if (attachScratch[at] !== layer) continue;
    const id = attachScratch[at + 1]!;
    // The part's transform (kept even when the part itself is hidden).
    const tr = (obj.primitives[pi]!.value[frameA] ?? 0) & 7;
    const c = command(out, n++);
    c.kind = CMD_SPRITE;
    c.id = id;
    c.source = -1;
    c.slot = pi;
    c.attachment = true;
    c.y = r.y;
    c.w = 0;
    c.h = 0;
    c.rgb = 0;
    if (flipX) {
      const drawn = isRotated(tr) ? sizes.height(id) : sizes.width(id);
      c.x = -r.rawX - (drawn & 1) + obj.width;
      c.transform = mirrorTransform(tr);
    } else {
      c.x = r.rawX;
      c.transform = tr;
    }
  }
  return n;
}

/**
 * The body's points in a composed pose (pixels in the object's box): the centres of the head,
 * chest and torso sprites, the neck between head and chest, the hands and shoes of each side.
 * Missing parts keep sensible defaults around the pivot.
 */
export function poseAnchors(
  cmds: readonly DrawCommand[],
  count: number,
  obj: SceneObject,
  sizes: SpriteSizes,
  flipX: boolean,
  out: PoseAnchors,
): PoseAnchors {
  const px = flipX ? obj.width - obj.pivotX : obj.pivotX;
  const py = obj.pivotY;
  const set = (p: { x: number; y: number }, x: number, y: number): void => {
    p.x = x;
    p.y = y;
  };
  set(out.head, px, py - 46);
  set(out.chest, px, py - 30);
  set(out.hips, px, py - 18);
  set(out.handNear, px, py - 22);
  set(out.handFar, px, py - 22);
  set(out.footNear, px, py);
  set(out.footFar, px, py);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let handsNear = 0;
  let handsFar = 0;
  for (let i = 0; i < count; i++) {
    const c = cmds[i]!;
    if (c.kind !== CMD_SPRITE || c.attachment) continue;
    const w = isRotated(c.transform) ? sizes.height(c.id) : sizes.width(c.id);
    const h = isRotated(c.transform) ? sizes.width(c.id) : sizes.height(c.id);
    const x0 = c.x - (w >> 1);
    const y0 = c.y - (h >> 1);
    if (x0 < minX) minX = x0;
    if (y0 < minY) minY = y0;
    if (x0 + w > maxX) maxX = x0 + w;
    if (y0 + h > maxY) maxY = y0 + h;
    const fam = familyOf(c.source);
    const near = c.slot >= 9 && c.slot !== 13 && c.slot !== 14 && c.slot !== 15;
    switch (fam) {
      case Family.HEAD:
        set(out.head, c.x, c.y);
        break;
      case Family.CHEST:
        set(out.chest, c.x, c.y);
        break;
      case Family.TORSO:
        set(out.hips, c.x, c.y);
        break;
      case Family.HAND:
        if (near) {
          set(out.handNear, c.x, c.y);
          handsNear++;
        } else {
          set(out.handFar, c.x, c.y);
          handsFar++;
        }
        break;
      case Family.SHOE:
        if (near) set(out.footNear, c.x, c.y);
        else set(out.footFar, c.x, c.y);
        break;
      default:
        break;
    }
  }
  if (handsNear === 0 && handsFar > 0) set(out.handNear, out.handFar.x, out.handFar.y);
  if (handsFar === 0 && handsNear > 0) set(out.handFar, out.handNear.x, out.handNear.y);
  set(
    out.neck,
    Math.round((out.head.x + out.chest.x) / 2),
    Math.round((out.head.y + out.chest.y) / 2),
  );
  if (minX === Infinity) {
    out.box.x = px - 8;
    out.box.y = py - 50;
    out.box.w = 16;
    out.box.h = 50;
  } else {
    out.box.x = minX;
    out.box.y = minY;
    out.box.w = maxX - minX;
    out.box.h = maxY - minY;
  }
  return out;
}
