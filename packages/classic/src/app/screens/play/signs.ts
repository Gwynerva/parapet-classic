/** The pictures on the signs at the screen's edge (`drawEdgeSign`): heads, and the finish flag. */
import type { SceneRenderer, SpriteSwap } from '@parapet/runtime/render/SceneRenderer.ts';
import type { GameContext } from '../../Context.ts';
import type { EdgePicture } from '../../ui/GhostOverlay.ts';
import { drawFinishFlag } from '../../ui/icons.ts';
import { drawPortrait } from '../../ui/portrait.ts';

/** Side of a head on its sign. */
const SIGN_HEAD = 20;

/** A small finish flag, towards the finish while it is off screen. */
export const FINISH_SIGN: EdgePicture = { radius: 8, draw: drawFinishFlag };

/** A runner's head as a sign at the screen's edge. */
export function headSign(ctx: GameContext, scene: SceneRenderer, swap: SpriteSwap): EdgePicture {
  const r = SIGN_HEAD >> 1;
  const rect = (x: number, y: number) => ({ x: x - r, y: y - r, w: SIGN_HEAD, h: SIGN_HEAD });
  return { radius: r, draw: (c, x, y) => drawPortrait(c, ctx, scene, rect(x, y), swap) };
}
