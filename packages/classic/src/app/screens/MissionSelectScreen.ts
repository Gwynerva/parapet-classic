/**
 * Mission select of one level (reference/notes/08 §9): the level's missions in the original
 * order with their icons and local records, the two contests with the level's boss (open once
 * every mission of the level is complete), our free run, the rival toggle for the sprint and the
 * switch for racing the ghost of one's own record; the description of the highlighted row
 * scrolls under the list like the original ticker.
 */
import { modeForMissionType, rankingSort, type RunMode } from '@parapet/sim';
import { formatTime, Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer, UiWheel } from '@parapet/runtime/app/Screen.ts';
import { Menu, type MenuItem } from '@parapet/runtime/ui/Menu.ts';
import { fitWidth, rowHeight, type Rect } from '@parapet/runtime/ui/layout.ts';
import { Ticker } from '@parapet/runtime/ui/widgets.ts';
import {
  completedMissions,
  isContestBeaten,
  isMissionCompleted,
  loadContestProgress,
  loadProgress,
  loadRecord,
  saveOptions,
  type ContestKind,
  type ContestProgress,
  type Progress,
} from '@parapet/runtime/storage/profile.ts';
import { contestSetup, missionSetup } from '../ghosts.ts';
import {
  bossCharacterFor,
  bossOfLevel,
  CONTEST_KINDS,
  contestRecord,
  WORKSHOP_COLOR,
} from '../bosses.ts';
import type { EchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import { drawMissionIcon, ICON_TILE, icons } from '../ui/icons.ts';
import { ScreenFrame } from '../ui/ScreenFrame.ts';
import { PlayScreen } from './PlayScreen.ts';

const ICON_SIZE = ICON_TILE;

interface Row {
  mode: RunMode | null;
  /** Mission type of the icon, or -1 for rows without one. */
  missionType: number;
  done: boolean;
  /** Dictionary key of the ticker text for rows without a mode. */
  desc?: string;
  /** The description itself, when it needs more than a key. */
  text?: string;
  /** The row starts a contest with the boss. */
  contest?: boolean;
  /** A contest not open yet (the level's missions come first). */
  locked?: boolean;
}

/** Mission type of each contest's icon (the original's sprint and flag hunt icons). */
const CONTEST_ICON: Record<ContestKind, number> = { flags: 1, sprint: 0 };

export class MissionSelectScreen implements Screen {
  readonly chrome = { fullscreenButton: true };
  private readonly ctx: GameContext;
  private readonly levelId: number;
  private readonly frame: ScreenFrame;
  private readonly menu: Menu;
  private readonly ticker = new Ticker();
  private rows: Row[] = [];
  private withRival = true;
  private progress: Progress = { completed: [], prizeSeen: false };
  private contests: ContestProgress = { beaten: { flags: 0, sprint: 0 } };
  /** The colour of the level's boss (the badge on its contests). */
  private bossColor: EchoColor = WORKSHOP_COLOR;
  private tickerRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(ctx: GameContext, levelId: number) {
    this.ctx = ctx;
    this.levelId = levelId;
    this.frame = new ScreenFrame(ctx);
    this.menu = new Menu(ctx.fonts.text, ctx.fonts.small);
  }

  enter(): void {
    this.progress = loadProgress();
    this.contests = loadContestProgress();
    this.rebuild();
    this.ctx.music.menu();
  }

  /** Every mission of the level is complete: the boss takes challenges here. */
  private get contestsOpen(): boolean {
    const level = this.ctx.content.missions.levels[this.levelId]!;
    return completedMissions(this.progress, this.levelId) >= level.missionCount;
  }

  private rebuild(): void {
    const { i18n, content, platform } = this.ctx;
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
    const open = this.contestsOpen;
    const boss = bossOfLevel(this.levelId);
    const bossName = boss ? i18n.t(`boss.${boss.id}.name`) : '';
    const locked = i18n.t('contest.locked', { boss: bossName });
    for (const kind of CONTEST_KINDS) {
      const record = contestRecord(this.levelId, kind);
      if (!record || !boss) continue;
      const beaten = isContestBeaten(this.contests, this.levelId, kind);
      // Flag hunt gives a boss the player already has something more (a surprise).
      const more = !beaten && bossCharacterFor(this.levelId, this.contests) !== null;
      const desc = i18n.t(`boss.${boss.id}.desc`);
      this.rows.push({
        mode: null,
        missionType: CONTEST_ICON[kind],
        done: beaten,
        text: open
          ? i18n.t(more ? 'contest.descMore' : 'contest.desc', { desc, boss: bossName })
          : locked,
        contest: true,
        locked: !open,
      });
      items.push({
        label: i18n.t('contest.title', { boss: bossName, mode: i18n.t(`mode.${kind}`) }),
        value: open ? formatTime(record.timeMs) : '',
        muted: !open,
        onSelect: open ? () => this.startContest(kind) : () => platform.toast.show(locked),
      });
    }
    this.bossColor = boss?.color ?? WORKSHOP_COLOR;
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
    this.menu.setCursor(Math.min(cursor, items.length - 1));
    this.onResize();
  }

  private recordLabel(mode: RunMode): string {
    const record = loadRecord(this.levelId, mode);
    if (!record || !record.finished) return '-';
    return rankingSort(mode, this.levelId) === 'score'
      ? String(record.score)
      : formatTime(record.time);
  }

  private startContest(kind: ContestKind): void {
    const setup = contestSetup(this.ctx, this.levelId, kind);
    if (setup) this.ctx.screens.push(new PlayScreen(this.ctx, setup));
  }

  private start(mode: RunMode): void {
    this.ctx.screens.push(
      new PlayScreen(this.ctx, missionSetup(this.ctx, this.levelId, mode, this.withRival)),
    );
  }

  onResize(): void {
    const { viewport, fonts } = this.ctx;
    this.frame.layout();
    const body = this.frame.body;
    const col = fitWidth(body, 420);
    const tickerH = fonts.small.lineHeight + 8;
    const row = Math.max(rowHeight(24, viewport.isCoarsePointer), ICON_SIZE + 4);
    this.menu.layout.x = col.x + ICON_SIZE + 8;
    this.menu.layout.width = col.w - ICON_SIZE - 8;
    this.menu.layout.rowHeight = row;
    this.menu.fit(body.h - tickerH);
    // The list and its ticker sit together a little above the middle.
    const block = this.menu.height + tickerH;
    this.menu.layout.y = body.y + Math.floor(Math.max(0, body.h - block) * 0.4);
    this.tickerRect = {
      x: col.x,
      y: this.menu.layout.y + this.menu.height + 6,
      w: col.w,
      h: fonts.small.lineHeight,
    };
  }

  update(dt: number): void {
    const row = this.rows[this.menu.cursor];
    const key = row?.mode ? `mode.desc.${row.mode}` : row?.desc;
    this.ticker.setText(row?.text ?? (key ? this.ctx.i18n.t(key) : ''));
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
    if (this.frame.onPointer(p)) return;
    this.menu.onPointer(p);
  }

  onWheel(w: UiWheel): void {
    this.menu.onWheel(w);
  }

  render(c: CanvasRenderingContext2D): void {
    const { fonts, i18n, render } = this.ctx;
    this.frame.draw(c, i18n.t(`level.names.${this.levelId}`));
    this.menu.draw(c);
    const { x, y, rowHeight: row } = this.menu.layout;
    const first = this.menu.firstVisible;
    this.rows.forEach((r, i) => {
      if (r.missionType < 0 || i < first || i >= first + this.menu.maxVisible) return;
      const iy = y + (i - first) * row + ((row - ICON_SIZE) >> 1);
      const ix = x - ICON_SIZE - 6;
      drawMissionIcon(c, render.sheet, r.missionType, r.done, ix, iy);
      if (r.locked) {
        c.fillStyle = 'rgba(16, 20, 24, 0.7)';
        c.fillRect(ix, iy, ICON_SIZE, ICON_SIZE);
        const s = icons.size('lock');
        icons.draw(
          c,
          'lock',
          'plain',
          ix + ((ICON_SIZE - s.width) >> 1),
          iy + ((ICON_SIZE - s.height) >> 1),
        );
      } else if (r.contest) {
        drawContestBadge(c, ix + ICON_SIZE - 7, iy + 1, this.bossColor);
      }
    });
    this.ticker.draw(c, fonts.small, this.tickerRect, Theme.muted);
  }
}

/** A small diamond in the boss's colour on the icon of its contests. */
function drawContestBadge(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: EchoColor,
): void {
  c.fillStyle = '#000000';
  c.fillRect(x + 1, y - 1, 3, 1);
  c.fillRect(x, y, 5, 3);
  c.fillRect(x + 1, y + 3, 3, 1);
  c.fillRect(x + 2, y + 4, 1, 1);
  c.fillStyle = color.css;
  c.fillRect(x + 2, y, 1, 3);
  c.fillRect(x + 1, y + 1, 3, 1);
  c.fillStyle = color.light;
  c.fillRect(x + 2, y, 1, 1);
}
