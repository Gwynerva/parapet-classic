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
