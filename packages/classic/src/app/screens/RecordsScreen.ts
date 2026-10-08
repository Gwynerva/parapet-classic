/**
 * Records: the local bests of a level, one row per mode that has records. Left/right (or a
 * tap on the header) change the level; a record opens its actions (watch, race it as a
 * ghost, share it as a challenge link or a file). "Open replay" races a replay file; files
 * can also be dropped onto the window and links pasted with Ctrl+V.
 */
import {
  isRankedMode,
  LEVEL_COUNT,
  modeForMissionType,
  rankingSort,
  type RunMode,
} from '@parapet/sim';
import { formatTime, Theme, type GameContext } from '../Context.ts';
import type { Screen, UiGesture, UiKey, UiPointer, UiWheel } from '@parapet/runtime/app/Screen.ts';
import { Menu, type MenuItem } from '@parapet/runtime/ui/Menu.ts';
import { Button } from '@parapet/runtime/ui/Button.ts';
import { fitWidth, rowHeight, type Rect } from '@parapet/runtime/ui/layout.ts';
import { ScreenFrame } from '../ui/ScreenFrame.ts';
import { loadRecord, type RecordEntry } from '@parapet/runtime/storage/profile.ts';
import { pickReplayFile } from '../ghosts.ts';
import { RecordActionsScreen } from './RecordActionsScreen.ts';

export class RecordsScreen implements Screen {
  readonly chrome = { fullscreenButton: true };
  private levelId = 0;
  private readonly menu: Menu;
  private readonly frame: ScreenFrame;
  /** `<` and `>` around the level number. */
  private readonly prev = new Button();
  private readonly next = new Button();
  private levelY = 0;
  private hintRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly ctx: GameContext;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.frame = new ScreenFrame(ctx);
    this.menu = new Menu(ctx.fonts.text, ctx.fonts.small);
  }

  enter(): void {
    this.rebuild();
  }

  /** Modes of the current level that keep records, in the original's mission order. */
  private modes(): RunMode[] {
    const level = this.ctx.content.missions.levels[this.levelId];
    const out: RunMode[] = [];
    for (const type of level?.missionTypes ?? []) {
      const mode = modeForMissionType(type);
      if (mode && isRankedMode(mode)) out.push(mode);
    }
    return out;
  }

  private rebuild(): void {
    const { i18n } = this.ctx;
    const items: MenuItem[] = this.modes().map((mode) => {
      const record = loadRecord(this.levelId, mode);
      return {
        label: i18n.t(`mode.${mode}`),
        value: record ? this.valueOf(record, mode) : '-',
        disabled: !record,
        onSelect: () => {
          if (record) {
            this.ctx.screens.push(new RecordActionsScreen(this.ctx, this.levelId, mode, record));
          }
        },
      };
    });
    items.push({
      label: i18n.t('replayFile.open'),
      gesture: true,
      onSelect: () => pickReplayFile(this.ctx),
    });
    const cursor = this.menu.cursor;
    this.menu.setItems(items);
    this.menu.setCursor(Math.min(cursor, items.length - 1));
    this.onResize();
  }

  private valueOf(record: RecordEntry, mode: RunMode): string {
    if (rankingSort(mode, this.levelId) === 'score') return String(record.score);
    return record.finished ? formatTime(record.time) : '-';
  }

  private changeLevel(delta: number): void {
    this.levelId = (this.levelId + delta + LEVEL_COUNT) % LEVEL_COUNT;
    this.menu.setCursor(0);
    this.rebuild();
  }

  onResize(): void {
    const { viewport, fonts } = this.ctx;
    this.frame.layout();
    const body = this.frame.body;
    const col = fitWidth(body, 400);
    // The level switcher, the list, and the drop hint (mouse screens) as one block.
    const switcherH = rowHeight(22, viewport.isCoarsePointer);
    const hintH = viewport.isCoarsePointer ? 0 : 2 * fonts.small.lineHeight + 8;
    const row = rowHeight(24, viewport.isCoarsePointer);
    this.menu.layout.x = col.x;
    this.menu.layout.width = col.w;
    this.menu.layout.rowHeight = row;
    this.menu.fit(body.h - switcherH - 8 - hintH);
    const block = switcherH + 8 + this.menu.height + hintH;
    const top = body.y + Math.floor(Math.max(0, body.h - block) * 0.4);
    const arrowW = Math.max(switcherH, 28);
    const label = Math.min(col.w - 2 * arrowW - 8, 240);
    const cx = col.x + (col.w >> 1);
    this.prev.rect = { x: cx - (label >> 1) - arrowW, y: top, w: arrowW, h: switcherH };
    this.next.rect = { x: cx + (label >> 1), y: top, w: arrowW, h: switcherH };
    this.levelY = top + ((switcherH - fonts.text.lineHeight) >> 1);
    this.menu.layout.y = top + switcherH + 8;
    this.hintRect = { x: col.x, y: this.menu.layout.y + this.menu.height + 4, w: col.w, h: hintH };
  }

  update(): void {}

  onKey(key: UiKey): void {
    switch (key.action) {
      case 'back':
        this.ctx.screens.pop();
        return;
      case 'left':
      case 'prev':
        this.changeLevel(-1);
        return;
      case 'right':
      case 'next':
        this.changeLevel(1);
        return;
      default:
        this.menu.onKey(key);
    }
  }

  onPointer(p: UiPointer): void {
    if (this.frame.onPointer(p)) return;
    if (this.prev.onPointer(p, () => this.changeLevel(-1))) return;
    if (this.next.onPointer(p, () => this.changeLevel(1))) return;
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
    this.frame.draw(c, i18n.t('records.title'));
    const cx = this.menu.layout.x + (this.menu.layout.width >> 1);
    this.prev.draw(c, fonts.text, '<', { color: Theme.accent });
    this.next.draw(c, fonts.text, '>', { color: Theme.accent });
    const name = `${this.levelId + 1}. ${i18n.t(`level.names.${this.levelId}`)}`;
    const room = this.next.rect.x - (this.prev.rect.x + this.prev.rect.w) - 8;
    fonts.text.draw(c, fonts.text.fit(name, room), cx, this.levelY, {
      align: 'center',
      color: Theme.text,
    });
    this.menu.draw(c);
    if (this.hintRect.h > 0) {
      const lines = fonts.small.wrap(i18n.t('replayFile.dropHint'), this.hintRect.w).slice(0, 2);
      fonts.small.draw(c, lines.join('\n'), cx, this.hintRect.y + 4, {
        align: 'center',
        color: Theme.muted,
      });
    }
  }
}
