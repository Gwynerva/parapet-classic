/**
 * Scenes drawn into RGBA bytes: the painter `SceneRenderer.paintObject` draws with when the
 * target is not a canvas (the findings generator in Node, the Lab), so level art, nested props,
 * tiled sprites and the runner come out as the game draws them. A `SceneRenderer` for Node is
 * made with a sheet that only knows its frames' sizes (`sizedSheet`).
 */
import type { AtlasFrame } from '../content/types.ts';
import type { CharacterPose } from './CharacterRenderer.ts';
import { blendPixel, blitSprite, sheetFrame, type RgbaImage, type RgbaSheet } from './Raster.ts';
import {
  CHARACTER_OBJECT,
  type ScenePainter,
  type SceneRenderer,
  type SpriteSwap,
} from './SceneRenderer.ts';
import { anchorOffsetX, anchorOffsetY, isRotated, SpriteSheet } from './SpriteSheet.ts';
import { toScreen, UNITS_PER_PX, type CameraPos } from './View.ts';

/** A sprite sheet without pixels, for the sizes a `SceneRenderer` lays a scene out with. */
export function sizedSheet(frames: readonly (AtlasFrame | undefined)[]): SpriteSheet {
  return new SpriteSheet({} as CanvasImageSource, frames);
}

interface Clip {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A painter into `dst` with the sprites of `sheet`, every pixel at `alpha` of its opacity. */
export function rasterPainter(dst: RgbaImage, sheet: RgbaSheet, alpha = 1): ScenePainter {
  const clips: Clip[] = [{ x0: 0, y0: 0, x1: dst.width, y1: dst.height }];
  const clip = (): Clip => clips[clips.length - 1]!;
  return {
    sprite(id, x, y, transform, anchor) {
      const found = sheetFrame(sheet, id);
      if (!found) return;
      const w = isRotated(transform) ? found.frame.h : found.frame.w;
      const h = isRotated(transform) ? found.frame.w : found.frame.h;
      blitSprite(
        dst,
        sheet,
        id,
        (x | 0) - anchorOffsetX(anchor, w),
        (y | 0) - anchorOffsetY(anchor, h),
        transform,
        alpha,
        clip(),
      );
    },
    rect(x, y, w, h, rgb) {
      const c = clip();
      const a = Math.round(255 * alpha);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = rgb & 0xff;
      for (let yy = Math.max(y, c.y0); yy < Math.min(y + h, c.y1); yy++) {
        for (let xx = Math.max(x, c.x0); xx < Math.min(x + w, c.x1); xx++) {
          blendPixel(dst, xx, yy, r, g, b, a);
        }
      }
    },
    clip(x, y, w, h) {
      const c = clip();
      clips.push({
        x0: Math.max(c.x0, x),
        y0: Math.max(c.y0, y),
        x1: Math.min(c.x1, x + w),
        y1: Math.min(c.y1, y + h),
      });
    },
    unclip() {
      if (clips.length > 1) clips.pop();
    },
  };
}

/**
 * Paints a runner's pose with `painter` as `drawPose` places it on a canvas (the character
 * object's pivot on the pose's point, relative to the camera), culled to `width` × `height`.
 */
export function paintPose(
  painter: ScenePainter,
  scene: SceneRenderer,
  pose: CharacterPose,
  cam: CameraPos,
  swap: SpriteSwap,
  width: number,
  height: number,
): void {
  scene.withViewport(width, height, () =>
    scene.paintObject(
      painter,
      CHARACTER_OBJECT,
      pose.a,
      pose.b,
      pose.t,
      toScreen(pose.x, cam.x),
      toScreen(pose.y, cam.y),
      pose.flipX,
      swap,
    ),
  );
}

/** Draws a runner's pose into `dst` (see `paintPose`). */
export function rasterPose(
  dst: RgbaImage,
  sheet: RgbaSheet,
  scene: SceneRenderer,
  pose: CharacterPose,
  cam: CameraPos,
  swap: SpriteSwap,
  alpha = 1,
): void {
  paintPose(rasterPainter(dst, sheet, alpha), scene, pose, cam, swap, dst.width, dst.height);
}

/** A rectangle in screen pixels: `x0..x1`, `y0..y1`. */
export interface ScreenBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The screen rectangle a runner's pose covers (the boxes of its sprites), placed as `paintPose`
 * places it; null when it draws nothing.
 */
export function poseBounds(
  sheet: RgbaSheet,
  scene: SceneRenderer,
  pose: CharacterPose,
  cam: CameraPos,
  swap: SpriteSwap,
): ScreenBox | null {
  let box: ScreenBox | null = null;
  const add = (x0: number, y0: number, x1: number, y1: number): void => {
    if (!box) box = { x0, y0, x1, y1 };
    else {
      box.x0 = Math.min(box.x0, x0);
      box.y0 = Math.min(box.y0, y0);
      box.x1 = Math.max(box.x1, x1);
      box.y1 = Math.max(box.y1, y1);
    }
  };
  const painter: ScenePainter = {
    sprite(id, x, y, transform, anchor) {
      const found = sheetFrame(sheet, id);
      if (!found) return;
      const w = isRotated(transform) ? found.frame.h : found.frame.w;
      const h = isRotated(transform) ? found.frame.w : found.frame.h;
      const left = (x | 0) - anchorOffsetX(anchor, w);
      const top = (y | 0) - anchorOffsetY(anchor, h);
      add(left, top, left + w, top + h);
    },
    rect(x, y, w, h) {
      add(x, y, x + w, y + h);
    },
    clip() {},
    unclip() {},
  };
  // Drawn far from the culling box's edges (the camera moved by `o` pixels), then moved back.
  const o = 1 << 19;
  const far = { x: cam.x - o * UNITS_PER_PX, y: cam.y - o * UNITS_PER_PX };
  paintPose(painter, scene, pose, far, swap, 2 * o, 2 * o);
  const b = box as ScreenBox | null;
  return b && { x0: b.x0 - o, y0: b.y0 - o, x1: b.x1 - o, y1: b.y1 - o };
}
