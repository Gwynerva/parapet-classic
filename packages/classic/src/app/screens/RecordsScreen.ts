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
import type { Screen, UiGesture, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import { Menu, type MenuItem } from '@parapet/runtime/ui/Menu.ts';
import {
  clear,
  heading,
  drawBackButton,
  hitBackButton,
  headingCenterY,
} from '@parapet/runtime/ui/draw.ts';
import {
  fitWidth,
  inset,
  rowHeight,
  safeRect,
  stack,
  type Rect,
} from '@parapet/runtime/ui/layout.ts';
import { loadRecord, type RecordEntry } from '@parapet/runtime/storage/profile.ts';
import { pickReplayFile } from '../ghosts.ts';
import { RecordActionsScreen } from './RecordActionsScreen.ts';

export class RecordsScreen implements Screen {
  private levelId = 0;
  private readonly menu: Menu;
  private headerBottom = 0;
  private hintRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly ctx: GameContext;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
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
    this.menu.cursor = Math.min(cursor, items.length - 1);
    if (this.menu.items[this.menu.cursor]?.disabled) this.menu.move(1);
    this.onResize();
  }

  private valueOf(record: RecordEntry, mode: RunMode): string {
    if (rankingSort(mode, this.levelId) === 'score') return String(record.score);
    return record.finished ? formatTime(record.time) : '-';
  }

  private changeLevel(delta: number): void {
    this.levelId = (this.levelId + delta + LEVEL_COUNT) % LEVEL_COUNT;
    this.menu.cursor = 0;
    this.rebuild();
  }

  onResize(): void {
    const { viewport, fonts } = this.ctx;
    const safe = inset(safeRect(viewport), 8, 0);
    const header = fonts.display.lineHeight + fonts.small.lineHeight + 20;
    const hint = viewport.isCoarsePointer ? 0 : 2 * fonts.small.lineHeight + 8;
    const [, body, footer] = stack(safe, [header, -1, hint], 4);
    const area = body ?? safe;
    this.headerBottom = safe.y + header;
    const col = fitWidth(area, 400);
    const row = rowHeight(24, viewport.isCoarsePointer);
    this.menu.layout.x = col.x;
    this.menu.layout.width = col.w;
    this.menu.layout.rowHeight = row;
    this.menu.layout.y = col.y;
    this.menu.maxVisible = Math.max(3, Math.floor(area.h / row));
    this.hintRect = footer ?? { x: safe.x, y: safe.y + safe.h, w: safe.w, h: 0 };
  }

  update(): void {}

  onKey(key: UiKey): void {
    switch (key.action) {
      case 'back':
        this.ctx.screens.pop();
        return;
      case 'left':
        this.changeLevel(-1);
        return;
      case 'right':
        this.changeLevel(1);
        return;
      default:
        this.menu.onKey(key);
    }
  }

  onPointer(p: UiPointer): void {
    if (p.type === 'down' && hitBackButton(this.ctx.viewport, p.x, p.y)) {
      this.ctx.screens.pop();
      return;
    }
    if (p.type === 'down' && p.y < this.headerBottom) {
      this.changeLevel(p.x < this.ctx.viewport.width / 2 ? -1 : 1);
      return;
    }
    this.menu.onPointer(p);
  }

  onGesture(g: UiGesture): boolean {
    return this.menu.onGesture(g);
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n } = this.ctx;
    clear(c, viewport.width, viewport.height);
    drawBackButton(c, fonts.text, viewport, headingCenterY(fonts.display, viewport.safeArea.top));
    const safe = safeRect(viewport);
    const cx = safe.x + (safe.w >> 1);
    heading(
      c,
      fonts.display,
      `${i18n.t('records.title')}: ${i18n.t(`level.names.${this.levelId}`)}`,
      cx,
      safe.y + 8,
    );
    fonts.small.draw(
      c,
      `< ${this.levelId + 1} / ${LEVEL_COUNT} >`,
      cx,
      this.headerBottom - fonts.small.lineHeight - 4,
      { align: 'center', color: Theme.muted, tabular: true },
    );
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
