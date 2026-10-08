/**
 * Composite scene interpreter: draws the objects of the k-files (character, props, level art).
 * Port of `b(int,int,int,int,int,int,int,int)` (d.java line 3218) and `a(6 ints)` (line 3211).
 *
 * The pose itself (tween, skin swap, mirroring) is composed by `composePose` (`Pose.ts`); this
 * class draws the commands on a canvas.
 */
import { idiv } from '@parapet/sim';
import type { SceneFile, SceneObject } from '../content/types.ts';
import {
  CMD_NESTED,
  CMD_RECT,
  CMD_SPRITE,
  CMD_TILED,
  composePose,
  mixRgb565,
  type DrawCommand,
  type SpriteSizes,
  type SpriteSwap,
} from './Pose.ts';
import {
  ANCHOR_CENTER,
  ANCHOR_TOP_LEFT,
  anchorOffsetX,
  anchorOffsetY,
  type SpriteSheet,
} from './SpriteSheet.ts';

export {
  mixRgb565,
  TWEEN_ONE,
  type AttachLookup,
  type PartContext,
  type SpriteSwap,
} from './Pose.ts';

/** Anchor value meaning "place the object's pivot on (x, y)" (the original passes 1024). */
export const PIVOT_ANCHOR = 1024;

/** Id of the character object (the single object of `k0`). */
export const CHARACTER_OBJECT = 0;

/** RGB565 → 24-bit RGB (frame A only). */
export function rgb565ToRgb(c: number): number {
  return mixRgb565(c, c, 0);
}

/** 24-bit RGB → CSS colour. */
export function cssColour(rgb: number): string {
  return '#' + (rgb & 0xffffff).toString(16).padStart(6, '0');
}

/** A composed pose: its object, its commands and how many of them there are. */
export interface ComposedPose {
  obj: SceneObject;
  cmds: readonly DrawCommand[];
  count: number;
}

export class SceneRenderer {
  readonly sheet: SpriteSheet;
  private readonly objects = new Map<number, SceneObject>();
  private readonly colours = new Map<number, string>();
  /** Command buffers, one per depth of nested objects. */
  private readonly buffers: DrawCommand[][] = [];
  private depth = 0;
  private readonly composed: DrawCommand[] = [];
  /** Sprite and object sizes for `composePose`. */
  readonly sizes: SpriteSizes;
  /** Culling rectangle (logical pixels of the current target), see `setViewport`. */
  viewWidth = Infinity;
  viewHeight = Infinity;

  constructor(sheet: SpriteSheet, scenes: Iterable<SceneFile>) {
    this.sheet = sheet;
    this.sizes = {
      width: (id) => sheet.width(id),
      height: (id) => sheet.height(id),
      objectWidth: (id) => this.objects.get(id)?.width ?? 0,
    };
    for (const scene of scenes) {
      for (const object of scene.objects) {
        this.objects.set(object.id, object);
      }
    }
  }

  /**
   * A renderer of the same scenes that draws its sprites from `sheet` (a recoloured copy of
   * the atlas with the same frames, such as the echo skins of the ghosts).
   */
  withSheet(sheet: SpriteSheet): SceneRenderer {
    const copy = new SceneRenderer(sheet, []);
    for (const [id, object] of this.objects) copy.objects.set(id, object);
    copy.viewWidth = this.viewWidth;
    copy.viewHeight = this.viewHeight;
    return copy;
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

    const depth = this.depth;
    let cmds = this.buffers[depth];
    if (!cmds) {
      cmds = [];
      this.buffers[depth] = cmds;
    }
    const count = composePose(obj, this.sizes, frameA, frameB, t, flipX, swap, cmds);
    const sheet = this.sheet;
    for (let i = 0; i < count; i++) {
      const c = cmds[i]!;
      const px = c.x + ox;
      const sy = c.y + oy;
      switch (c.kind) {
        case CMD_SPRITE:
          sheet.drawSprite(ctx, c.id, px, sy, c.transform, ANCHOR_CENTER);
          break;
        case CMD_RECT:
          ctx.fillStyle = this.colour(c.rgb);
          ctx.fillRect(px, sy, c.w, c.h);
          break;
        case CMD_NESTED:
          // `a(id, 0, x, y, 20, 0)`: frame 0, top-left anchor, never mirrored.
          this.depth = depth + 1;
          this.drawObject(ctx, c.id, 0, 0, 0, px, sy, false, undefined, ANCHOR_TOP_LEFT);
          this.depth = depth;
          break;
        case CMD_TILED:
          this.drawTiled(ctx, c.id, c.transform, px, sy, c.w, c.h);
          break;
        default:
          break;
      }
    }
  }

  /**
   * The commands of a pose in the object's box (the pivot at `(pivotX, pivotY)`, or mirrored at
   * `(width - pivotX, pivotY)`), without drawing: for effects anchored to the body and tools.
   * The result is reused by the next call.
   */
  compose(
    objectId: number,
    frameA: number,
    frameB: number,
    t: number,
    flipX = false,
    swap?: SpriteSwap,
  ): ComposedPose | null {
    const obj = this.objects.get(objectId);
    if (!obj) return null;
    const count = composePose(obj, this.sizes, frameA, frameB, t, flipX, swap, this.composed);
    return { obj, cmds: this.composed, count };
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

  private colour(rgb: number): string {
    let css = this.colours.get(rgb);
    if (css === undefined) {
      if (this.colours.size > 4096) this.colours.clear();
      css = cssColour(rgb);
      this.colours.set(rgb, css);
    }
    return css;
  }
}
