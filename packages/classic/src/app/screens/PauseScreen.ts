import { Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import { Menu } from '@parapet/runtime/ui/Menu.ts';
import { heading, panel } from '@parapet/runtime/ui/draw.ts';
import { fitWidth, inset, rowHeight, safeRect } from '@parapet/runtime/ui/layout.ts';
import type { PlayScreen } from './PlayScreen.ts';
import { TitleScreen } from './TitleScreen.ts';

export class PauseScreen implements Screen {
  readonly translucent = true;
  private readonly ctx: GameContext;
  private readonly play: PlayScreen;
  private readonly menu: Menu;

  constructor(ctx: GameContext, play: PlayScreen) {
    this.ctx = ctx;
    this.play = play;
    this.menu = new Menu(ctx.fonts.text, ctx.fonts.small);
    const { i18n, screens } = ctx;
    this.menu.setItems([
      { label: i18n.t('menu.resume'), onSelect: () => screens.pop() },
      {
        label: i18n.t('menu.restart'),
        onSelect: () => {
          screens.pop();
          play.restart();
        },
      },
      { label: i18n.t('menu.mainMenu'), onSelect: () => screens.clear(new TitleScreen(ctx)) },
    ]);
    this.onResize();
  }

  enter(): void {
    this.play.session.paused = true;
    this.ctx.music.pause();
  }

  exit(): void {
    this.play.session.paused = false;
    this.ctx.music.resume();
    this.ctx.input.clear();
  }

  onResize(): void {
    const { viewport } = this.ctx;
    const safe = safeRect(viewport);
    const col = fitWidth(inset(safe, 8, 0), 220);
    const row = rowHeight(24, viewport.isCoarsePointer);
    this.menu.layout.x = col.x;
    this.menu.layout.width = col.w;
    this.menu.layout.rowHeight = row;
    this.menu.layout.y = safe.y + (safe.h >> 1) - row;
  }

  update(): void {}

  onKey(key: UiKey): void {
    if (key.action === 'back' || key.action === 'pause') {
      this.ctx.screens.pop();
      return;
    }
    this.menu.onKey(key);
  }

  onPointer(p: UiPointer): void {
    this.menu.onPointer(p);
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n } = this.ctx;
    c.fillStyle = Theme.overlay;
    c.fillRect(0, 0, viewport.width, viewport.height);
    const { x, y, width, rowHeight: row } = this.menu.layout;
    panel(c, x - 8, y - 40, width + 16, this.menu.items.length * row + 56);
    heading(c, fonts.display, i18n.t('menu.pause'), x + (width >> 1), y - 30);
    this.menu.draw(c);
  }
}
