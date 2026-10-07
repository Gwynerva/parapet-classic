/**
 * The Moves menu (`al()` / `an()`, d.java lines 5967-6060): one of the twenty moves at a
 * time with its demo animation (keyframes cycling every 128 ms of real time with a linear
 * tween), its name, the counter and the description. Left/right change the move.
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
import { inset, safeRect, stack, type Rect, fitWidth } from '@parapet/runtime/ui/layout.ts';
import { skinSwap } from '@parapet/runtime/render/CharacterRenderer.ts';
import { CHARACTER_OBJECT } from '@parapet/runtime/render/SceneRenderer.ts';
import { ANCHOR_TOP_LEFT } from '@parapet/runtime/render/SpriteSheet.ts';

/** Our dictionary keys in the order of the original's demos (strings 36-55 / 56-75). */
export const MOVE_KEYS = [
  'run',
  'jump',
  'landing',
  'ladder',
  'slide',
  'wallJump',
  'wallRun',
  'ledge',
  'roll',
  'frontFlip',
  'backFlip',
  'tigerJump',
  'wallFlip',
  'monkeyVault',
  'dash',
  'monkeyFlip',
  'spiderJump',
  'poleSlide',
  'poleJump',
  'poleSpin',
] as const;

const FRAME_MS = 128;
/** Height of the demo box at full size. */
const DEMO_HEIGHT = 150;

export class MovesScreen implements Screen {
  private readonly ctx: GameContext;
  private index = 0;
  private demoRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private textRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.onResize();
  }

  onResize(): void {
    const { viewport, fonts } = this.ctx;
    const safe = inset(safeRect(viewport), 8, 0);
    const header = fonts.display.lineHeight + 16;
    const [, body] = stack(safe, [header, -1], 4);
    const column = fitWidth(body ?? safe, 420);
    const demoH = Math.min(DEMO_HEIGHT, Math.max(96, column.h >> 1));
    const [demo, text] = stack(column, [demoH, -1], 6);
    this.demoRect = demo ?? column;
    this.textRect = text ?? column;
  }

  private move(delta: number): void {
    const n = this.ctx.content.anims.demos.length;
    this.index = (this.index + delta + n) % n;
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
      case 'confirm':
        this.move(1);
        return;
      default:
        return;
    }
  }

  onPointer(p: UiPointer): void {
    if (p.type !== 'down') return;
    if (hitBackButton(this.ctx.viewport, p.x, p.y)) {
      this.ctx.screens.pop();
      return;
    }
    const d = this.demoRect;
    const inDemo = p.x >= d.x && p.x < d.x + d.w && p.y >= d.y && p.y < d.y + d.h;
    this.move(inDemo && p.x < d.x + d.w / 2 ? -1 : 1);
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n, render, content, player } = this.ctx;
    clear(c, viewport.width, viewport.height);
    drawBackButton(c, fonts.text, viewport, headingCenterY(fonts.display, viewport.safeArea.top));
    const safe = safeRect(viewport);
    heading(c, fonts.display, i18n.t('menu.moves'), safe.x + (safe.w >> 1), safe.y + 8);
    const demo = content.anims.demos[this.index];
    const key = MOVE_KEYS[this.index] ?? 'run';

    // Demo: keyframes of the clip cycling with real time, centred by the keyframe bounds.
    const d = this.demoRect;
    panel(c, d.x, d.y, d.w, d.h);
    if (demo) {
      const now = performance.now();
      const count = Math.max(1, demo.frameCount);
      const frame = Math.floor(now / FRAME_MS) % count;
      const next = (frame + 1) % count;
      const t = Math.floor(((now % FRAME_MS) / FRAME_MS) * 65536);
      const a = render.clips[demo.clipOffset + 1 + frame] ?? 0;
      const b = render.clips[demo.clipOffset + 1 + next] ?? a;
      const bounds = content.anims.keyframeBounds[a] ?? [0, 0, 64, 64];
      const [minX, minY, maxX, maxY] = bounds;
      const ox = d.x + (d.w >> 1) - Math.round(((minX ?? 0) + (maxX ?? 0)) / 2);
      const oy = d.y + (d.h >> 1) - Math.round(((minY ?? 0) + (maxY ?? 0)) / 2);
      c.save();
      c.beginPath();
      c.rect(d.x, d.y, d.w, d.h);
      c.clip();
      render.scene.drawObject(
        c,
        CHARACTER_OBJECT,
        a,
        b,
        t,
        ox,
        oy,
        false,
        skinSwap(player.character),
        ANCHOR_TOP_LEFT,
      );
      c.restore();
    }
    fonts.small.draw(c, '<', d.x + 6, d.y + (d.h >> 1), { color: Theme.accent });
    fonts.small.draw(c, '>', d.x + d.w - 6, d.y + (d.h >> 1), {
      align: 'right',
      color: Theme.accent,
    });

    // Name, counter and description.
    const r = this.textRect;
    panel(c, r.x, r.y, r.w, r.h);
    fonts.text.draw(c, i18n.t(`moves.${key}`), r.x + 8, r.y + 6, { color: Theme.accent });
    fonts.small.draw(
      c,
      i18n.t('moves.counter', { n: this.index + 1, total: MOVE_KEYS.length }),
      r.x + r.w - 8,
      r.y + 8,
      { align: 'right', color: Theme.muted, tabular: true },
    );
    const textY = r.y + 6 + fonts.text.lineHeight + 6;
    const maxLines = Math.max(1, Math.floor((r.y + r.h - textY - 4) / fonts.small.lineHeight));
    const lines = fonts.small.wrap(i18n.t(`moves.${key}.desc`), r.w - 16).slice(0, maxLines);
    fonts.small.draw(c, lines.join('\n'), r.x + 8, textY, { color: Theme.text });
  }
}
