/**
 * Head-and-shoulders portraits in small tiles (the character grid, the bosses' rows of the
 * mission menu): the first frame of the run demo with the head a little above the middle of the
 * tile, clipped to its inside.
 */
import { HEAD_SPRITE } from '@parapet/runtime/render/Rig.ts';
import {
  CHARACTER_OBJECT,
  type SceneRenderer,
  type SpriteSwap,
} from '@parapet/runtime/render/SceneRenderer.ts';
import type { Rect } from '@parapet/runtime/ui/layout.ts';
import type { GameContext } from '../Context.ts';

/** The run demo of the Moves menu (demo 0): its first frame shows the heads. */
const RUN_DEMO = 0;

/** Draws a character's head and shoulders from `scene` inside the 1 px border of `r`. */
export function drawPortrait(
  c: CanvasRenderingContext2D,
  ctx: GameContext,
  scene: SceneRenderer,
  r: Rect,
  swap?: SpriteSwap,
): void {
  const { render, content } = ctx;
  const idle = render.clips[(content.anims.demos[RUN_DEMO]?.clipOffset ?? 0) + 1] ?? 0;
  const feet = headAt(ctx, idle, r.x + (r.w >> 1), r.y + (r.h >> 1) - 2);
  c.save();
  c.beginPath();
  c.rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  c.clip();
  scene.drawFrame(c, CHARACTER_OBJECT, idle, feet.x, feet.y, undefined, false, swap);
  c.restore();
}

/**
 * Where to put the feet of a keyframe so its head lands on (x, y): the head sprite's point in
 * the keyframe (it is drawn centred there), measured from the pivot.
 */
function headAt(ctx: GameContext, frame: number, x: number, y: number): { x: number; y: number } {
  const obj = ctx.render.scene.getObject(CHARACTER_OBJECT);
  if (obj) {
    for (const p of obj.primitives) {
      const id = (p.value[frame] ?? -1) >> 3;
      if (id >= HEAD_SPRITE && id < HEAD_SPRITE + 5) {
        return { x: x + obj.pivotX - (p.x[frame] ?? 0), y: y + obj.pivotY - (p.y[frame] ?? 0) };
      }
    }
  }
  return { x, y: y + 60 };
}
