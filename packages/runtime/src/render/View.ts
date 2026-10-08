/**
 * Small shared types of the renderers. Everything is expressed in logical pixels of the
 * viewport (the canvas the scene is drawn on) and world units (1024 per tile, 32 units per px).
 */

/** Size of the logical viewport in pixels. */
export interface ViewSize {
  width: number;
  height: number;
}

/** Camera top-left corner in world units (an integer position, already interpolated). */
export interface CameraPos {
  x: number;
  y: number;
}

/** World units → screen pixels relative to the camera (`(n - cam) * 32 >> 10`). */
export function toScreen(units: number, cam: number): number {
  return ((units - cam) * 32) >> 10;
}

/** Units per pixel shift: `px = units >> UNIT_SHIFT`. */
export const UNIT_SHIFT = 5;

/**
 * Screen pixels per logical pixel where `ctx` draws now (the viewport's scale, times any zoom of
 * the caller); 1 for contexts without a transform.
 */
export function screenPixels(ctx: CanvasRenderingContext2D): number {
  if (typeof ctx.getTransform !== 'function') return 1;
  const a = Math.abs(ctx.getTransform().a);
  return a > 0 ? a : 1;
}

/**
 * Splits a position in logical pixels into the whole pixel to draw at and the rest, rounded to
 * a screen pixel (`per` of them in a logical one): drawing at `whole` with the context moved by
 * `rest` puts the picture between logical pixels yet on whole screen pixels, crisp.
 */
export function splitPixel(v: number, per: number): { whole: number; rest: number } {
  const whole = Math.floor(v);
  return { whole, rest: Math.round((v - whole) * per) / per };
}

/** A camera on whole logical pixels and the move (in logical px) that makes up the rest. */
export interface PixelGrid {
  cam: CameraPos;
  dx: number;
  dy: number;
}

/**
 * The world seen from `cam` on a context with `per` screen pixels to a logical one: drawn with
 * the returned camera, whose position is whole pixels, everything keeps its pixels on the
 * level's grid, and moved by (dx, dy) the picture lands where the exact camera puts it, to a
 * screen pixel. A slow camera then glides instead of jumping a big pixel every few frames.
 */
export function worldGrid(cam: CameraPos, per: number): PixelGrid {
  const sx = Math.round((cam.x * per) / 32);
  const sy = Math.round((cam.y * per) / 32);
  const wx = Math.floor(sx / per);
  const wy = Math.floor(sy / per);
  return {
    cam: { x: wx * 32, y: wy * 32 },
    dx: -(sx - wx * per) / per,
    dy: -(sy - wy * per) / per,
  };
}

/**
 * The camera and move that draw something whose root is at `pos` (units) exactly where `cam`
 * sees it, to a screen pixel, with all its pixels whole relative to the root: a runner walking
 * slowly glides, its parts never shifting against one another.
 */
export function objectGrid(pos: CameraPos, cam: CameraPos, per: number): PixelGrid {
  const at = (p: number, c: number): { whole: number; rest: number } => {
    const exact = Math.round(((p - c) / 32) * per) / per;
    const whole = Math.floor(exact);
    return { whole, rest: exact - whole };
  };
  const x = at(pos.x, cam.x);
  const y = at(pos.y, cam.y);
  // toScreen(pos, camera) === whole: the root lands on the whole pixel, the move adds the rest.
  return { cam: { x: pos.x - x.whole * 32, y: pos.y - y.whole * 32 }, dx: x.rest, dy: y.rest };
}
