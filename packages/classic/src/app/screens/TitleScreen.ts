import type { GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import { Menu, type MenuItem } from '@parapet/runtime/ui/Menu.ts';
import { clear, heading } from '@parapet/runtime/ui/draw.ts';
import { fitWidth, inset, rowHeight, safeRect } from '@parapet/runtime/ui/layout.ts';
import { Theme } from '../Context.ts';
import { completedCount, loadProgress } from '@parapet/runtime/storage/profile.ts';
import { CharacterSelectScreen } from './CharacterSelectScreen.ts';
import { OptionsScreen } from './OptionsScreen.ts';
import { RecordsScreen } from './RecordsScreen.ts';
import { AboutScreen } from './AboutScreen.ts';
import { MovesScreen } from './MovesScreen.ts';
import { PrizeScreen } from './PrizeScreen.ts';

export class TitleScreen implements Screen {
  private readonly menu: Menu;
  private blink = 0;

  private readonly ctx: GameContext;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.menu = new Menu(ctx.fonts.text, ctx.fonts.small);
    this.rebuild();
  }

  private rebuild(): void {
    const { i18n, screens, content } = this.ctx;
    const items: MenuItem[] = [
      {
        label: i18n.t('menu.start'),
        onSelect: () => screens.push(new CharacterSelectScreen(this.ctx)),
      },
      { label: i18n.t('menu.moves'), onSelect: () => screens.push(new MovesScreen(this.ctx)) },
      { label: i18n.t('menu.records'), onSelect: () => screens.push(new RecordsScreen(this.ctx)) },
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
    const cursor = this.menu.cursor;
    this.menu.setItems(items);
    this.menu.cursor = Math.min(cursor, items.length - 1);
    this.onResize();
  }

  enter(): void {
    this.rebuild();
    this.ctx.music.menu();
  }

  onResize(): void {
    const { viewport } = this.ctx;
    const safe = safeRect(viewport);
    const col = fitWidth(inset(safe, 8, 0), 260);
    this.menu.layout.x = col.x;
    this.menu.layout.width = col.w;
    this.menu.layout.rowHeight = rowHeight(24, viewport.isCoarsePointer);
    this.menu.layout.y = Math.max(safe.y + 96, safe.y + (safe.h >> 1) - 24);
  }

  update(dt: number): void {
    this.blink += dt;
  }

  onKey(key: UiKey): void {
    this.menu.onKey(key);
  }

  onPointer(p: UiPointer): void {
    this.menu.onPointer(p);
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n } = this.ctx;
    clear(c, viewport.width, viewport.height);
    const cx = viewport.width >> 1;
    const titleY = Math.max(24, this.menu.layout.y - 64);
    heading(c, fonts.title, i18n.t('app.title'), cx, titleY);
    fonts.small.draw(c, i18n.t('app.subtitle'), cx, titleY + fonts.title.lineHeight + 2, {
      align: 'center',
      color: Theme.muted,
    });
    this.menu.draw(c);
  }
}
