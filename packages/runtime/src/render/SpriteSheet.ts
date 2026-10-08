/**
 * Sprite drawing from the atlas with the original's 8 transforms and Graphics anchors.
 *
 * The original generated transformed copies of each sprite at load time (`void_b(int)`, d.java
 * line 701) and drew them with `void_a(id, x, y, anchor, transform)` (line 827): the anchor
 * offsets are computed on the transformed size (width and height swap for the rotating codes).
 * Here the copies are replaced by a canvas transform; positions are truncated to integers and
 * image smoothing is disabled so the pixel art stays crisp.
 */
import type { AtlasFrame } from '../content/types.ts';

/** `javax.microedition.lcdui.Graphics` anchor bits. */
export const Anchor = {
  HCENTER: 1,
  VCENTER: 2,
  LEFT: 4,
  RIGHT: 8,
  TOP: 16,
  BOTTOM: 32,
} as const;

export const ANCHOR_TOP_LEFT = Anchor.TOP | Anchor.LEFT;
export const ANCHOR_CENTER = Anchor.HCENTER | Anchor.VCENTER;
export const ANCHOR_BOTTOM_LEFT = Anchor.BOTTOM | Anchor.LEFT;
export const ANCHOR_BOTTOM_CENTER = Anchor.BOTTOM | Anchor.HCENTER;

/** Sprite transform codes (`void_b(int)`, line 701). */
export const Transform = {
  NONE: 0,
  ROT90: 1,
  ROT180: 2,
  ROT270: 3,
  MIRROR: 4,
  FLIP: 5,
  TRANSPOSE: 6,
  ANTI_TRANSPOSE: 7,
} as const;

/**
 * Per transform code, the matrix `[a, b, c, d, kx, ky]` mapping an untransformed source pixel
 * (sx, sy) of a sprite to its place in the `w × h` destination box at (x, y):
 * `(a·sx + c·sy + x + kx·w, b·sx + d·sy + y + ky·h)`. See the pixel loops `a(boolean,boolean)`
 * and `b(boolean,boolean)` (lines 616 / 657) for the reference orientation of every code.
 */
export const TRANSFORM_MATRICES: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
  number,
])[] = [
  [1, 0, 0, 1, 0, 0],
  [0, 1, -1, 0, 1, 0],
  [-1, 0, 0, -1, 1, 1],
  [0, -1, 1, 0, 0, 1],
  [-1, 0, 0, 1, 1, 0],
  [1, 0, 0, -1, 0, 1],
  [0, 1, 1, 0, 0, 0],
  [0, -1, -1, 0, 1, 1],
];

/**
 * Where source pixel (sx, sy) of a sprite lands inside its `w × h` destination box (the drawn
 * size, already swapped for rotations) under `transform`.
 */
export function transformPixel(
  transform: number,
  sx: number,
  sy: number,
  w: number,
  h: number,
): [number, number] {
  const m = TRANSFORM_MATRICES[transform] ?? TRANSFORM_MATRICES[0]!;
  // The pixel's centre, mapped, floored.
  const cx = m[0] * (sx + 0.5) + m[2] * (sy + 0.5) + m[4] * w;
  const cy = m[1] * (sx + 0.5) + m[3] * (sy + 0.5) + m[5] * h;
  return [Math.floor(cx), Math.floor(cy)];
}

/** Codes that swap width and height (`(1 << t) & 0xCA`, line 3359). */
export function isRotated(transform: number): boolean {
  return ((1 << transform) & 0xca) !== 0;
}

/** Compose a transform with a horizontal mirror (line 3364). */
export function mirrorTransform(transform: number): number {
  return transform ^ (((transform - 1) & 2) === 0 ? 7 : 4);
}

/** Horizontal anchor offset (`int_b(int,int)`, line 1041). */
export function anchorOffsetX(anchor: number, width: number): number {
  if ((anchor & Anchor.HCENTER) !== 0) return width >> 1;
  if ((anchor & Anchor.RIGHT) !== 0) return width;
  return 0;
}

/** Vertical anchor offset (`int_c(int,int)`, line 1051). */
export function anchorOffsetY(anchor: number, height: number): number {
  if ((anchor & Anchor.VCENTER) !== 0) return height >> 1;
  if ((anchor & Anchor.BOTTOM) !== 0) return height;
  return 0;
}

export class SpriteSheet {
  readonly image: CanvasImageSource;
  /** The sheet's own frames, by sprite id. */
  readonly frames: readonly (AtlasFrame | undefined)[];
  /** Asked for the sprites this sheet does not have (a look's layer over the base atlas). */
  readonly fallback: SpriteSheet | null;

  constructor(
    image: CanvasImageSource,
    frames: readonly (AtlasFrame | undefined)[],
    fallback: SpriteSheet | null = null,
  ) {
    this.image = image;
    this.frames = frames;
    this.fallback = fallback;
  }

  frame(id: number): AtlasFrame | undefined {
    return this.frames[id] ?? this.fallback?.frame(id);
  }

  /** Untransformed width (`int_c(int)`, line 757); 0 for unknown ids. */
  width(id: number): number {
    return this.frame(id)?.w ?? 0;
  }

  /** Untransformed height (`int_b(int)`, line 752); 0 for unknown ids. */
  height(id: number): number {
    return this.frame(id)?.h ?? 0;
  }

  /** Width on screen after `transform`. */
  drawnWidth(id: number, transform: number): number {
    return isRotated(transform) ? this.height(id) : this.width(id);
  }

  /** Height on screen after `transform`. */
  drawnHeight(id: number, transform: number): number {
    return isRotated(transform) ? this.width(id) : this.height(id);
  }

  /**
   * Draw sprite `id` so that its anchor point lands on (x, y) (`void_a(int,int,int,int,int)`,
   * line 827). Positions are truncated to integers.
   */
  drawSprite(
    ctx: CanvasRenderingContext2D,
    id: number,
    x: number,
    y: number,
    transform = 0,
    anchor: number = ANCHOR_TOP_LEFT,
  ): void {
    const f = this.frames[id];
    if (!f) {
      this.fallback?.drawSprite(ctx, id, x, y, transform, anchor);
      return;
    }
    let w = f.w;
    let h = f.h;
    if (isRotated(transform)) {
      w = f.h;
      h = f.w;
    }
    x = (x | 0) - anchorOffsetX(anchor, w);
    y = (y | 0) - anchorOffsetY(anchor, h);
    if (ctx.imageSmoothingEnabled) ctx.imageSmoothingEnabled = false;
    if (transform === 0) {
      ctx.drawImage(this.image, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
      return;
    }
    ctx.save();
    const m = TRANSFORM_MATRICES[transform]!;
    ctx.transform(m[0], m[1], m[2], m[3], x + m[4] * w, y + m[5] * h);
    ctx.drawImage(this.image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    ctx.restore();
  }

  /**
   * Draw the `w × h` window of sprite `id` starting at source offset (srcX, srcY) with its
   * anchor on (x, y) (`a(8 ints)`, line 819). Used for the water rows of theme 3.
   */
  drawStrip(
    ctx: CanvasRenderingContext2D,
    id: number,
    x: number,
    y: number,
    anchor: number,
    w: number,
    h: number,
    srcX: number,
    srcY: number,
  ): void {
    const f = this.frames[id];
    if (!f) {
      this.fallback?.drawStrip(ctx, id, x, y, anchor, w, h, srcX, srcY);
      return;
    }
    x = (x | 0) - anchorOffsetX(anchor, w);
    y = (y | 0) - anchorOffsetY(anchor, h);
    const sw = Math.min(w, f.w - srcX);
    const sh = Math.min(h, f.h - srcY);
    if (sw <= 0 || sh <= 0) return;
    if (ctx.imageSmoothingEnabled) ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, f.x + srcX, f.y + srcY, sw, sh, x, y, sw, sh);
  }
}
