/**
 * Composite scene interpreter: draws the objects of the k-files (character, props, level art).
 * Port of `b(int,int,int,int,int,int,int,int)` (d.java line 3218) and `a(6 ints)` (line 3211).
 *
 * `drawObject` tweens between two keyframes: x, y, w, h and the colour are interpolated, the
 * sprite id is always the one of frame A (when t > 0.5 the original swaps the frames and uses
 * 1 - t, so the id comes from the nearer frame). Mirroring is `x' = -x - width + objectWidth`
 * with each sprite transform composed with a horizontal mirror (line 3364).
 */
import { idiv } from '@parapet/sim';
import type { SceneFile, SceneObject } from '../content/types.ts';
import {
  ANCHOR_CENTER,
  ANCHOR_TOP_LEFT,
  anchorOffsetX,
  anchorOffsetY,
  isRotated,
  mirrorTransform,
  type SpriteSheet,
} from './SpriteSheet.ts';

/** Anchor value meaning "place the object's pivot on (x, y)" (the original passes 1024). */
export const PIVOT_ANCHOR = 1024;

/** Id of the character object (the single object of `k0`). */
export const CHARACTER_OBJECT = 0;

/** Keyframe tween fraction scale: `t` runs 0..TWEEN_ONE. */
export const TWEEN_ONE = 65536;

/**
 * Body-part replacement for primitives flagged `swapParts`: receives the sprite id and the
 * transform of the keyframe and returns the sprite id to draw, or -1 to hide the part.
 * The transform is kept (`a(int,int[])`, line 5931).
 */
export type SpriteSwap = (spriteId: number, transform: number) => number;

/** Composite primitive types (bits 8..13 of the header). */
const RECT = 0;
const SPRITE = 1;
const NESTED = 2;
const TILED = 3;

/** Blend two RGB565 colours by t/65536 and expand to 24-bit RGB exactly like line 3313. */
export function mixRgb565(a: number, b: number, t: number): number {
  const u = TWEEN_ONE - t;
  const r = ((((a & 0xf800) * u + (b & 0xf800) * t) >>> 13) * 33) & 0xff0000;
  const g = ((((a & 0x7e0) * u + (b & 0x7e0) * t) >>> 17) * 65) & 0xff00;
  const bl = ((((a & 0x1f) * u + (b & 0x1f) * t) * 33) >>> 18) & 0xff;
  return r | g | bl;
}

/** RGB565 → 24-bit RGB (frame A only). */
export function rgb565ToRgb(c: number): number {
  return mixRgb565(c, c, 0);
}

/** 24-bit RGB → CSS colour. */
export function cssColour(rgb: number): string {
  return '#' + (rgb & 0xffffff).toString(16).padStart(6, '0');
}

export class SceneRenderer {
  readonly sheet: SpriteSheet;
  private readonly objects = new Map<number, SceneObject>();
  private readonly colours = new Map<number, string>();
  /** Culling rectangle (logical pixels of the current target), see `setViewport`. */
  viewWidth = Infinity;
  viewHeight = Infinity;

  constructor(sheet: SpriteSheet, scenes: Iterable<SceneFile>) {
    this.sheet = sheet;
    for (const scene of scenes) {
      for (const object of scene.objects) {
        this.objects.set(object.id, object);
      }
    }
  }

  getObject(id: number): SceneObject | undefined {
    return this.objects.get(id);
  }

  /** Size of the drawing target in logical pixels; objects fully outside are skipped. */
  setViewport(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
  }

  /** `a(6 ints)`: draw a single frame with no tween. */
  drawFrame(
    ctx: CanvasRenderingContext2D,
    objectId: number,
    frame: number,
    x: number,
    y: number,
    anchor: number = PIVOT_ANCHOR,
    flipX = false,
    swap?: SpriteSwap,
  ): void {
    this.drawObject(ctx, objectId, frame, frame, 0, x, y, flipX, swap, anchor);
  }

  /**
   * Draw `objectId` tweened from keyframe `frameA` to `frameB` by `t` (0..65536).
   * (x, y) is the screen position of the anchor: the pivot by default (`PIVOT_ANCHOR`), or a
   * Graphics anchor applied to the object box. `flipX` mirrors the object around its box;
   * `swap` replaces the sprites of `swapParts` primitives (skins, ghosts).
   */
  drawObject(
    ctx: CanvasRenderingContext2D,
    objectId: number,
    frameA: number,
    frameB: number,
    t: number,
    x: number,
    y: number,
    flipX = false,
    swap?: SpriteSwap,
    anchor: number = PIVOT_ANCHOR,
  ): void {
    const obj = this.objects.get(objectId);
    if (!obj) return;
    if (t > 32767) {
      const s = frameA;
      frameA = frameB;
      frameB = s;
      t = TWEEN_ONE - t;
    }
    frameA = clampFrame(frameA, obj.frames);
    frameB = clampFrame(frameB, obj.frames);

    let ox = x | 0;
    let oy = y | 0;
    if (anchor !== PIVOT_ANCHOR) {
      ox -= anchorOffsetX(anchor, obj.width);
      oy -= anchorOffsetY(anchor, obj.height);
    } else {
      ox -= flipX ? obj.width - obj.pivotX : obj.pivotX;
      oy -= obj.pivotY;
    }
    if (
      ox >= this.viewWidth ||
      oy >= this.viewHeight ||
      ox + obj.width <= 0 ||
      oy + obj.height <= 0
    ) {
      return;
    }

    const sheet = this.sheet;
    for (const p of obj.primitives) {
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
      let px = ax + (((bx - ax) * t + 32768) >> 16);
      const py = ay + (((by - ay) * t + 32768) >> 16);
      const pv = av + (((bv - av) * t + 32768) >> 16);
      const pw = aw + (((bw - aw) * t + 32768) >> 16);
      const ph = ah + (((bh - ah) * t + 32768) >> 16);

      // Sprite ids come from frame A; the skin swap sees the keyframe's id and transform.
      let spriteValue = av;
      if (p.type === SPRITE && p.swapParts && swap && spriteValue !== -1) {
        const id = swap(spriteValue >> 3, spriteValue & 7);
        spriteValue = id < 0 ? -1 : (id << 3) | (spriteValue & 7);
      }

      if (flipX) {
        switch (p.type) {
          case SPRITE: {
            if (spriteValue === -1) continue;
            const id = spriteValue >> 3;
            const tr = spriteValue & 7;
            const drawn = isRotated(tr) ? sheet.height(id) : sheet.width(id);
            px = -px - (drawn & 1);
            spriteValue = (id << 3) | mirrorTransform(tr);
            break;
          }
          case RECT:
            px = -px - pw;
            break;
          case NESTED:
            px = -px - (this.objects.get(pv)?.width ?? 0);
            break;
          case TILED:
            // The original has no case for tiled primitives (never mirrored in the data);
            // treated like a rectangle.
            px = -px - pw;
            break;
          default:
            break;
        }
        px += obj.width;
      }
      px += ox;
      const sy = py + oy;

      switch (p.type) {
        case SPRITE:
          if (spriteValue === -1) continue;
          sheet.drawSprite(ctx, spriteValue >> 3, px, sy, spriteValue & 7, ANCHOR_CENTER);
          break;
        case RECT:
          ctx.fillStyle = this.colour(av, bv, t);
          ctx.fillRect(px, sy, pw, ph);
          break;
        case NESTED:
          // `a(id, 0, x, y, 20, 0)`: frame 0, top-left anchor, never mirrored.
          this.drawObject(ctx, pv, 0, 0, 0, px, sy, false, undefined, ANCHOR_TOP_LEFT);
          break;
        case TILED:
          this.drawTiled(ctx, pv >> 3, pv & 7, px, sy, pw, ph);
          break;
        default:
          break;
      }
    }
  }

  /**
   * Rasterise one frame of an object into an offscreen canvas whose (0, 0) is the object's
   * local origin (the top-left of its box); blit it at `(x - pivotX, y - pivotY)` to place
   * the pivot on (x, y). Used to cache level art.
   */
  renderObjectToCanvas(objectId: number, frame: number): HTMLCanvasElement {
    const obj = this.objects.get(objectId);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, obj?.width ?? 1);
    canvas.height = Math.max(1, obj?.height ?? 1);
    if (!obj) return canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.imageSmoothingEnabled = false;
    const savedW = this.viewWidth;
    const savedH = this.viewHeight;
    this.viewWidth = obj.width;
    this.viewHeight = obj.height;
    this.drawObject(ctx, objectId, frame, frame, 0, 0, 0, false, undefined, ANCHOR_TOP_LEFT);
    this.viewWidth = savedW;
    this.viewHeight = savedH;
    return canvas;
  }

  /** Tiled sprite across a rectangle, clipped to it and to the viewport (line 3400). */
  private drawTiled(
    ctx: CanvasRenderingContext2D,
    id: number,
    transform: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    // The original steps by the untransformed size (only mirrored tiles exist in the data).
    const tw = this.sheet.width(id);
    const th = this.sheet.height(id);
    if (tw <= 0 || th <= 0 || w <= 0 || h <= 0) return;
    let x1 = x + w;
    let y1 = y + h;
    let sx = x;
    let sy = y;
    if (sx < 0) sx -= idiv(sx, tw) * tw;
    if (sy < 0) sy -= idiv(sy, th) * th;
    if (x1 > this.viewWidth) x1 = this.viewWidth;
    if (y1 > this.viewHeight) y1 = this.viewHeight;
    if (sx >= x1 || sy >= y1) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (let yy = sy; yy < y1; yy += th) {
      for (let xx = sx; xx < x1; xx += tw) {
        this.sheet.drawSprite(ctx, id, xx, yy, transform, ANCHOR_TOP_LEFT);
      }
    }
    ctx.restore();
  }

  private colour(a: number, b: number, t: number): string {
    const rgb = mixRgb565(a, b, t);
    let css = this.colours.get(rgb);
    if (css === undefined) {
      if (this.colours.size > 4096) this.colours.clear();
      css = cssColour(rgb);
      this.colours.set(rgb, css);
    }
    return css;
  }
}

function clampFrame(frame: number, count: number): number {
  if (frame < 0) return 0;
  if (frame >= count) return count - 1;
  return frame;
}
