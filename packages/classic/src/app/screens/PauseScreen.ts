import { Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer, UiWheel } from '@parapet/runtime/app/Screen.ts';
import { Menu } from '@parapet/runtime/ui/Menu.ts';
import { heading, panel } from '@parapet/runtime/ui/draw.ts';
import { rowHeight, type Rect } from '@parapet/runtime/ui/layout.ts';
import { dialogLayout } from '../layouts.ts';
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
    const { viewport, fonts } = this.ctx;
    const row = rowHeight(24, viewport.isCoarsePointer);
    const d = dialogLayout(viewport, {
      width: 220,
      header: fonts.display.lineHeight + 10,
      footer: 0,
      rows: this.menu.items.length,
      rowHeight: row,
    });
    this.panelRect = d.panel;
    Object.assign(this.menu.layout, {
      x: d.menu.x,
      y: d.menu.y,
      width: d.menu.w,
      rowHeight: row,
      align: 'center',
    });
    this.menu.fit(d.menu.h);
  }

  private panelRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

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

  onWheel(w: UiWheel): void {
    this.menu.onWheel(w);
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n } = this.ctx;
    c.fillStyle = Theme.overlay;
    c.fillRect(0, 0, viewport.width, viewport.height);
    const r = this.panelRect;
    panel(c, r.x, r.y, r.w, r.h);
    heading(c, fonts.display, i18n.t('menu.pause'), r.x + (r.w >> 1), r.y + 6);
    this.menu.draw(c);
  }
}
