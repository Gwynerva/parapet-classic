/**
 * The main menu: the title over a centred list, both centred as one block (side by side on
 * short landscape screens), over the running backdrop.
 */
import type { GameContext } from '../Context.ts';
import type { Screen, UiGesture, UiKey, UiPointer, UiWheel } from '@parapet/runtime/app/Screen.ts';
import { Menu, type MenuItem } from '@parapet/runtime/ui/Menu.ts';
import { heading } from '@parapet/runtime/ui/draw.ts';
import { rowHeight } from '@parapet/runtime/ui/layout.ts';
import { Theme } from '../Context.ts';
import { completedCount, loadProgress } from '@parapet/runtime/storage/profile.ts';
import { CharacterSelectScreen } from './CharacterSelectScreen.ts';
import { OptionsScreen } from './OptionsScreen.ts';
import { RecordsScreen } from './RecordsScreen.ts';
import { AboutScreen } from './AboutScreen.ts';
import { MovesScreen } from './MovesScreen.ts';
import { PrizeScreen } from './PrizeScreen.ts';
import { OpenReplayScreen } from './OpenReplayScreen.ts';
import { titleLayout } from '../layouts.ts';

export class TitleScreen implements Screen {
  readonly chrome = { fullscreenButton: true };
  private readonly menu: Menu;
  private readonly ctx: GameContext;
  private titleX = 0;
  private titleY = 0;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.menu = new Menu(ctx.fonts.text, ctx.fonts.small);
    this.rebuild();
  }

  private rebuild(): void {
    const { i18n, screens, content, platform } = this.ctx;
    const items: MenuItem[] = [
      {
        label: i18n.t('menu.start'),
        onSelect: () => screens.push(new CharacterSelectScreen(this.ctx)),
      },
      { label: i18n.t('menu.moves'), onSelect: () => screens.push(new MovesScreen(this.ctx)) },
      { label: i18n.t('menu.records'), onSelect: () => screens.push(new RecordsScreen(this.ctx)) },
      {
        label: i18n.t('replayFile.open'),
        onSelect: () => screens.push(new OpenReplayScreen(this.ctx)),
      },
      { label: i18n.t('menu.options'), onSelect: () => screens.push(new OptionsScreen(this.ctx)) },
      { label: i18n.t('menu.about'), onSelect: () => screens.push(new AboutScreen(this.ctx)) },
    ];
    // The prize appears once every mission of every level is complete (`boolean_i`).
    const total = content.missions.levels.reduce((n, m) => n + m.missionCount, 0);
    if (completedCount(loadProgress()) >= total) {
      items.push({
        label: i18n.t('level.prize'),
        onSelect: () => screens.clear(new PrizeScreen(this.ctx)),
      });
    }
    // Only the installed app may close its own window.
    if (platform.installed) {
      items.push({ label: i18n.t('menu.exit'), onSelect: () => platform.exit() });
    }
    const cursor = this.menu.cursor;
    this.menu.setItems(items);
    this.menu.setCursor(Math.min(cursor, items.length - 1));
    this.onResize();
  }

  enter(): void {
    this.rebuild();
    this.ctx.music.menu();
  }

  onResize(): void {
    const { viewport, fonts } = this.ctx;
    const layout = titleLayout(viewport, {
      titleHeight: fonts.title.lineHeight + 2 + fonts.small.lineHeight,
      titleWidth: Math.max(
        fonts.title.measure(this.ctx.i18n.t('app.title')),
        fonts.small.measure(this.ctx.i18n.t('app.subtitle')),
      ),
      rowHeight: rowHeight(24, viewport.isCoarsePointer),
      rows: this.menu.items.length,
    });
    this.titleX = layout.title.x + (layout.title.w >> 1);
    this.titleY = layout.title.y;
    Object.assign(this.menu.layout, {
      x: layout.menu.x,
      y: layout.menu.y,
      width: layout.menu.w,
      rowHeight: layout.rowHeight,
      align: 'center',
    });
    this.menu.fit(layout.menu.h);
  }

  update(): void {}

  onKey(key: UiKey): void {
    this.menu.onKey(key);
  }

  onPointer(p: UiPointer): void {
    this.menu.onPointer(p);
  }

  onWheel(w: UiWheel): void {
    this.menu.onWheel(w);
  }

  onGesture(g: UiGesture): boolean {
    return this.menu.onGesture(g);
  }

  render(c: CanvasRenderingContext2D): void {
    const { fonts, i18n } = this.ctx;
    this.ctx.backdrop.draw(c);
    heading(c, fonts.title, i18n.t('app.title'), this.titleX, this.titleY);
    fonts.small.draw(
      c,
      i18n.t('app.subtitle'),
      this.titleX,
      this.titleY + fonts.title.lineHeight + 2,
      { align: 'center', color: Theme.muted },
    );
    this.menu.draw(c);
  }
}
