/**
 * The shared renderers of the game (one atlas, one scene interpreter, one level renderer, the
 * echoes' and the looks' atlases), made once from the content. The development pages make
 * theirs the same way.
 */
import { buildSineTable, MoveTable } from '@parapet/sim';
import { buildClipTable } from '@parapet/runtime/anim/Animator.ts';
import type { GameContent } from '@parapet/runtime/content/types.ts';
import { EchoSheets } from '@parapet/runtime/render/EchoSkin.ts';
import { LevelRenderer } from '@parapet/runtime/render/LevelRenderer.ts';
import { SceneRenderer } from '@parapet/runtime/render/SceneRenderer.ts';
import { SkinLibrary } from '@parapet/runtime/render/SkinLibrary.ts';
import { SpriteSheet } from '@parapet/runtime/render/SpriteSheet.ts';
import { registerBosses } from './bosses.ts';
import type { Renderers } from './Context.ts';

export function createRenderers(content: GameContent): Renderers {
  const sheet = new SpriteSheet(content.atlas.image, content.atlas.frames);
  const scene = new SceneRenderer(sheet, content.scenes.values());
  // The parallax water and the flag bounce use the game's sine table (`short_arr_a(10, true)`).
  const sine = buildSineTable(10, true);
  const skins = new SkinLibrary(scene);
  registerBosses(skins);
  return {
    sheet,
    scene,
    level: new LevelRenderer(content, sheet, scene, sine),
    echo: new EchoSheets(scene),
    skins,
    moves: new MoveTable(content.moves),
    clips: buildClipTable(content.anims.clips),
    sine,
  };
}
