/**
 * The culling size of a scene renderer is shared with every renderer made from it, so the
 * recoloured copies (looks, echoes) follow a resize of the base scene.
 */
import { describe, expect, it } from 'vitest';
import { SceneRenderer } from '../src/render/SceneRenderer.ts';
import { SpriteSheet } from '../src/render/SpriteSheet.ts';

function sheet(): SpriteSheet {
  return new SpriteSheet({} as CanvasImageSource, []);
}

describe('scene renderer viewport', () => {
  it('reaches the copies made with withSheet, both ways and down the chain', () => {
    const base = new SceneRenderer(sheet(), []);
    base.setViewport(292, 633);
    const look = base.withSheet(sheet());
    const echo = look.withSheet(sheet());
    expect([echo.viewWidth, echo.viewHeight]).toEqual([292, 633]);
    base.setViewport(844, 390);
    expect([look.viewWidth, look.viewHeight]).toEqual([844, 390]);
    expect([echo.viewWidth, echo.viewHeight]).toEqual([844, 390]);
    echo.setViewport(120, 80);
    expect([base.viewWidth, base.viewHeight]).toEqual([120, 80]);
  });
});
