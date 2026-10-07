/**
 * Mission select of one level (reference/notes/08 §9): the level's missions in the original
 * order with their icons and local records, our free run, the rival toggle for the sprint and
 * the switch for racing the ghost of one's own record; the description of the highlighted
 * mode scrolls along the bottom like the original ticker.
 */
import { modeForMissionType, rankingSort, type RunMode } from '@parapet/sim';
import { formatTime, Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
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
import { Ticker } from '@parapet/runtime/ui/widgets.ts';
import {
  isMissionCompleted,
  loadProgress,
  loadRecord,
  saveOptions,
  type Progress,
} from '@parapet/runtime/storage/profile.ts';
import { missionSetup } from '../ghosts.ts';
import { drawMissionIcon, ICON_TILE } from '../ui/icons.ts';
import { PlayScreen } from './PlayScreen.ts';

const ICON_SIZE = ICON_TILE;

interface Row {
  mode: RunMode | null;
  /** Mission type of the icon, or -1 for rows without one. */
  missionType: number;
  done: boolean;
  /** Dictionary key of the ticker text for rows without a mode. */
  desc?: string;
}

export class MissionSelectScreen implements Screen {
  private readonly ctx: GameContext;
  private readonly levelId: number;
  private readonly menu: Menu;
  private readonly ticker = new Ticker();
  private rows: Row[] = [];
  private withRival = true;
  private progress: Progress = { completed: [], prizeSeen: false };
  private tickerRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(ctx: GameContext, levelId: number) {
    this.ctx = ctx;
    this.levelId = levelId;
    this.menu = new Menu(ctx.fonts.text, ctx.fonts.small);
  }

  enter(): void {
    this.progress = loadProgress();
    this.rebuild();
    this.ctx.music.menu();
  }

  private rebuild(): void {
    const { i18n, content } = this.ctx;
    const level = content.missions.levels[this.levelId]!;
    const items: MenuItem[] = [];
    this.rows = [];
    level.missionTypes.forEach((type, slot) => {
      const mode = modeForMissionType(type);
      if (!mode) return;
      this.rows.push({
        mode,
        missionType: type,
        done: isMissionCompleted(this.progress, this.levelId, slot),
      });
      items.push({
        label: i18n.t(`mode.${mode}`),
        value: this.recordLabel(mode),
        onSelect: () => this.start(mode),
      });
    });
    this.rows.push({ mode: 'free', missionType: -1, done: false });
    items.push({ label: i18n.t('mode.free'), onSelect: () => this.start('free') });
    if (level.missionTypes.includes(0)) {
      this.rows.push({ mode: null, missionType: -1, done: false });
      items.push({
        label: i18n.t('mission.withRival'),
        value: this.withRival ? i18n.t('options.on') : i18n.t('options.off'),
        onAdjust: () => {
          this.withRival = !this.withRival;
          this.rebuild();
        },
      });
    }
    this.rows.push({ mode: null, missionType: -1, done: false, desc: 'mission.bestGhost.desc' });
    items.push({
      label: i18n.t('mission.bestGhost'),
      value: this.ctx.options.bestGhost ? i18n.t('options.on') : i18n.t('options.off'),
      onAdjust: () => {
        this.ctx.options = saveOptions({ bestGhost: !this.ctx.options.bestGhost });
        this.rebuild();
      },
    });
    const cursor = this.menu.cursor;
    this.menu.setItems(items);
    this.menu.cursor = Math.min(cursor, items.length - 1);
    this.onResize();
  }

  private recordLabel(mode: RunMode): string {
    const record = loadRecord(this.levelId, mode);
    if (!record || !record.finished) return '-';
    return rankingSort(mode, this.levelId) === 'score'
      ? String(record.score)
      : formatTime(record.time);
  }

  private start(mode: RunMode): void {
    this.ctx.screens.push(
      new PlayScreen(this.ctx, missionSetup(this.ctx, this.levelId, mode, this.withRival)),
    );
  }

  onResize(): void {
    const { viewport, fonts } = this.ctx;
    const safe = inset(safeRect(viewport), 8, 0);
    const header = fonts.display.lineHeight + 16;
    const [, body, ticker] = stack(safe, [header, -1, fonts.small.lineHeight + 8], 4);
    const area = body ?? safe;
    const col = fitWidth(area, 400);
    const row = Math.max(rowHeight(24, viewport.isCoarsePointer), ICON_SIZE + 4);
    this.menu.layout.x = col.x + ICON_SIZE + 8;
    this.menu.layout.width = col.w - ICON_SIZE - 8;
    this.menu.layout.rowHeight = row;
    this.menu.layout.y = col.y;
    this.menu.maxVisible = Math.max(3, Math.floor(area.h / row));
    this.tickerRect = ticker ?? { x: safe.x, y: safe.y + safe.h - 20, w: safe.w, h: 16 };
  }

  update(dt: number): void {
    const row = this.rows[this.menu.cursor];
    const key = row?.mode ? `mode.desc.${row.mode}` : row?.desc;
    this.ticker.setText(key ? this.ctx.i18n.t(key) : '');
    this.ticker.advance(dt);
  }

  onKey(key: UiKey): void {
    if (key.action === 'back') {
      this.ctx.screens.pop();
      return;
    }
    this.menu.onKey(key);
  }

  onPointer(p: UiPointer): void {
    if (p.type === 'down' && hitBackButton(this.ctx.viewport, p.x, p.y)) {
      this.ctx.screens.pop();
      return;
    }
    this.menu.onPointer(p);
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n, render } = this.ctx;
    clear(c, viewport.width, viewport.height);
    drawBackButton(c, fonts.text, viewport, headingCenterY(fonts.display, viewport.safeArea.top));
    const safe = safeRect(viewport);
    heading(
      c,
      fonts.display,
      i18n.t(`level.names.${this.levelId}`),
      safe.x + (safe.w >> 1),
      safe.y + 8,
    );
    this.menu.draw(c);
    const { x, y, rowHeight: row } = this.menu.layout;
    const first = this.menu.firstVisible;
    this.rows.forEach((r, i) => {
      if (r.missionType < 0 || i < first || i >= first + this.menu.maxVisible) return;
      const iy = y + (i - first) * row + ((row - ICON_SIZE) >> 1);
      drawMissionIcon(c, render.sheet, r.missionType, r.done, x - ICON_SIZE - 6, iy);
    });
    this.ticker.draw(c, fonts.small, this.tickerRect, Theme.muted);
  }
}
