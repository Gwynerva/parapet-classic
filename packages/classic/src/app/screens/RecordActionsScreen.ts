/**
 * What can be done with a local record: watch it, race it as a ghost, or send it out as a
 * challenge link or a replay file.
 */
import { rankingSort, type RunMode } from '@parapet/sim';
import { formatTime, Theme, type GameContext } from '../Context.ts';
import type { Screen, UiGesture, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import { Menu, type MenuItem } from '@parapet/runtime/ui/Menu.ts';
import { heading, panel } from '@parapet/runtime/ui/draw.ts';
import { fitWidth, inset, rowHeight, safeRect } from '@parapet/runtime/ui/layout.ts';
import type { RecordEntry } from '@parapet/runtime/storage/profile.ts';
import {
  bestGhost,
  copyChallengeLink,
  raceSetup,
  recordReplay,
  saveReplayFile,
  watchSetup,
} from '../ghosts.ts';
import { PlayScreen } from './PlayScreen.ts';

const STATUS_MS = 4000;

export class RecordActionsScreen implements Screen {
  readonly translucent = true;
  private readonly ctx: GameContext;
  private readonly menu: Menu;
  private readonly title: string;
  private readonly subtitle: string;
  private status = '';
  private statusUntil = 0;

  constructor(ctx: GameContext, levelId: number, mode: RunMode, entry: RecordEntry) {
    this.ctx = ctx;
    this.menu = new Menu(ctx.fonts.text, ctx.fonts.small);
    const { i18n, screens } = ctx;
    const value =
      rankingSort(mode, levelId) === 'score' ? String(entry.score) : formatTime(entry.time);
    this.title = `${i18n.t(`mode.${mode}`)}: ${value}`;
    this.subtitle = i18n.t(`level.names.${levelId}`);
    const replay = recordReplay(ctx, levelId, mode, entry);
    const result = { time: entry.time, score: entry.score };
    const play = (start: () => PlayScreen | null): void => {
      const screen = start();
      if (!screen) return;
      screens.pop();
      screens.push(screen);
    };
    const items: MenuItem[] = [
      {
        label: i18n.t('records.watch'),
        disabled: !replay,
        onSelect: () => play(() => (replay ? new PlayScreen(ctx, watchSetup(replay)) : null)),
      },
      {
        label: i18n.t('ghost.raceBest'),
        disabled: !replay,
        onSelect: () =>
          play(() => {
            const ghost = bestGhost(ctx, levelId, mode);
            return ghost ? new PlayScreen(ctx, raceSetup(ctx, ghost)) : null;
          }),
      },
      {
        label: i18n.t('share.copyLink'),
        disabled: !replay,
        gesture: true,
        onSelect: () => {
          if (replay) copyChallengeLink(ctx, replay, () => this.setStatus(i18n.t('share.copied')));
        },
      },
      {
        label: i18n.t('replayFile.save'),
        disabled: !replay,
        gesture: true,
        onSelect: () => {
          if (!replay) return;
          saveReplayFile(replay, result);
          this.setStatus(i18n.t('replayFile.saved'));
        },
      },
      { label: i18n.t('menu.back'), onSelect: () => screens.pop() },
    ];
    this.menu.setItems(items);
    this.menu.maxVisible = items.length;
    this.onResize();
  }

  private setStatus(text: string): void {
    this.status = text;
    this.statusUntil = performance.now() + STATUS_MS;
  }

  onResize(): void {
    const { viewport } = this.ctx;
    const safe = safeRect(viewport);
    const col = fitWidth(inset(safe, 8, 0), 260);
    const row = rowHeight(24, viewport.isCoarsePointer);
    this.menu.layout.x = col.x;
    this.menu.layout.width = col.w;
    this.menu.layout.rowHeight = row;
    this.menu.layout.y = safe.y + ((safe.h - this.menu.items.length * row) >> 1) + 16;
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

  onGesture(g: UiGesture): boolean {
    return this.menu.onGesture(g);
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts } = this.ctx;
    c.fillStyle = Theme.overlay;
    c.fillRect(0, 0, viewport.width, viewport.height);
    const { x, y, width, rowHeight: row } = this.menu.layout;
    const headerH = fonts.display.lineHeight + fonts.small.lineHeight + 14;
    const statusH = fonts.small.lineHeight + 6;
    panel(
      c,
      x - 8,
      y - headerH - 8,
      width + 16,
      headerH + this.menu.items.length * row + statusH + 16,
    );
    const cx = x + (width >> 1);
    heading(c, fonts.display, this.title, cx, y - headerH);
    fonts.small.draw(c, this.subtitle, cx, y - fonts.small.lineHeight - 6, {
      align: 'center',
      color: Theme.muted,
    });
    this.menu.draw(c);
    if (this.status && performance.now() < this.statusUntil) {
      fonts.small.draw(c, this.status, cx, y + this.menu.items.length * row + 4, {
        align: 'center',
        color: Theme.success,
      });
    }
  }
}
