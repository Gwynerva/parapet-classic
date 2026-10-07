/**
 * Character select (`ar()`, d.java line 6370): the name-tag graffiti of Playman or Blaise
 * with a short description, left/right to change, confirm to go on to the levels. The other
 * skins (the rivals) follow after the two originals.
 */
import { Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import {
  clear,
  heading,
  panel,
  drawBackButton,
  hitBackButton,
  headingCenterY,
} from '@parapet/runtime/ui/draw.ts';
import { centered, inset, safeRect, type Rect } from '@parapet/runtime/ui/layout.ts';
import { skinSwap } from '@parapet/runtime/render/CharacterRenderer.ts';
import { CHARACTER_OBJECT } from '@parapet/runtime/render/SceneRenderer.ts';
import { ANCHOR_TOP_LEFT } from '@parapet/runtime/render/SpriteSheet.ts';
import { IDLE_CLIP_OFFSET } from '@parapet/runtime/anim/Animator.ts';
import { savePlayer } from '@parapet/runtime/storage/profile.ts';
import { TAG_BLAISE, TAG_PLAYMAN } from '../ui/sprites.ts';
import { LevelSelectScreen } from './LevelSelectScreen.ts';

export class CharacterSelectScreen implements Screen {
  private readonly ctx: GameContext;
  private index = 0;
  private card: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.index = Math.max(
      0,
      ctx.skins.findIndex((s) => s.character === ctx.player.character),
    );
    this.onResize();
  }

  onResize(): void {
    const safe = inset(safeRect(this.ctx.viewport), 8, 0);
    this.card = centered(safe, Math.min(320, safe.w), Math.min(220, safe.h - 60));
  }

  private move(delta: number): void {
    const n = this.ctx.skins.length;
    this.index = (this.index + delta + n) % n;
    const skin = this.ctx.skins[this.index]!;
    this.ctx.player.character = skin.character;
    savePlayer(this.ctx.player);
  }

  update(): void {}

  onKey(key: UiKey): void {
    switch (key.action) {
      case 'back':
        this.ctx.screens.pop();
        return;
      case 'left':
      case 'up':
        this.move(-1);
        return;
      case 'right':
      case 'down':
        this.move(1);
        return;
      case 'confirm':
        this.ctx.screens.push(new LevelSelectScreen(this.ctx));
        return;
      default:
        return;
    }
  }

  onPointer(p: UiPointer): void {
    if (p.type !== 'down') return;
    const { width } = this.ctx.viewport;
    if (hitBackButton(this.ctx.viewport, p.x, p.y)) {
      this.ctx.screens.pop();
      return;
    }
    if (p.x < this.card.x) this.move(-1);
    else if (p.x >= this.card.x + this.card.w) this.move(1);
    else if (p.x < width / 3) this.move(-1);
    else if (p.x > (width * 2) / 3) this.move(1);
    else this.onKey({ action: 'confirm' });
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n, render, skins } = this.ctx;
    clear(c, viewport.width, viewport.height);
    drawBackButton(c, fonts.text, viewport, headingCenterY(fonts.display, viewport.safeArea.top));
    const safe = safeRect(viewport);
    heading(c, fonts.display, i18n.t('player.character'), safe.x + (safe.w >> 1), safe.y + 8);
    const skin = skins[this.index]!;
    const r = this.card;
    panel(c, r.x, r.y, r.w, r.h);
    const cx = r.x + (r.w >> 1);
    // Name tag: the graffiti for the two originals, the name in the display font for rivals.
    const tag = skin.character === 0 ? TAG_BLAISE : skin.character === 1 ? TAG_PLAYMAN : -1;
    if (tag >= 0) {
      const w = render.sheet.width(tag);
      render.sheet.drawSprite(c, tag, cx - (w >> 1), r.y + 8, 0, ANCHOR_TOP_LEFT);
    } else {
      fonts.display.draw(c, skin.name, cx, r.y + 14, { align: 'center', color: Theme.accent });
    }
    // The character standing in the idle pose, feet at the lower third of the card.
    const idle = render.clips[IDLE_CLIP_OFFSET + 1] ?? 0;
    render.scene.drawFrame(
      c,
      CHARACTER_OBJECT,
      idle,
      cx,
      r.y + 128,
      undefined,
      false,
      skinSwap(skin.character),
    );
    fonts.small.draw(c, '<', r.x + 8, r.y + 60, { color: Theme.accent });
    fonts.small.draw(c, '>', r.x + r.w - 8, r.y + 60, { align: 'right', color: Theme.accent });
    const descKey =
      skin.character === 0
        ? 'player.blaise.desc'
        : skin.character === 1
          ? 'player.playman.desc'
          : '';
    const desc = descKey ? i18n.t(descKey) : i18n.t('level.rival', { name: skin.name });
    const lines = fonts.small.wrap(desc, r.w - 24).slice(0, 4);
    fonts.small.draw(c, lines.join('\n'), cx, r.y + 140, { align: 'center', color: Theme.text });
  }
}
