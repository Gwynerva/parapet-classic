/**
 * Mission select of one level (reference/notes/08 §9): the level's missions in the original
 * order with their icons and local records, the two contests with the level's boss (open once
 * every mission of the level is complete), our free run, and under a line the rival toggle for
 * the sprint and the switch for racing the ghost of one's own record; the description of the
 * highlighted row scrolls under the list like the original ticker. A contest's row is in the
 * boss's colours, its tile shows the boss: a hologram until its record there is beaten, then as
 * it is. A row's tile is part of the row (pressing it starts the run). Coming here after the
 * level's last mission, the level's news shows over the list (`LevelCompleteScreen`), the
 * cursor already on the boss it opened.
 */
import { modeForMissionType, type RunMode } from '@parapet/sim';
import { formatResult, formatTime, Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer, UiWheel } from '@parapet/runtime/app/Screen.ts';
import { Menu, type MenuItem } from '@parapet/runtime/ui/Menu.ts';
import { fitWidth, rowHeight, type Rect } from '@parapet/runtime/ui/layout.ts';
import type { SceneRenderer, SpriteSwap } from '@parapet/runtime/render/SceneRenderer.ts';
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
  type Boss,
  bossCharacterFor,
  bossName,
  bossOfLevel,
  bossTint,
  CONTEST_KINDS,
  contestCharacter,
  contestRecord,
  isDrawn,
} from '../bosses.ts';
import type { EchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import {
  drawCard,
  drawFreeRunIcon,
  drawMissionIcon,
  drawModeGlyph,
  ICON_TILE,
  icons,
  modeGlyphSize,
} from '../ui/icons.ts';
import { drawPortrait } from '../ui/portrait.ts';
import { ScreenFrame } from '../ui/ScreenFrame.ts';
import { LevelCompleteScreen, takeLevelNews } from './LevelCompleteScreen.ts';
import { PlayScreen } from './PlayScreen.ts';

/** Room a row keeps on its left for its tile. */
const TILE_INDENT = ICON_TILE + 8;
/** Inside of a boss's tile. */
const BOSS_TILE_FILL = '#0c1014';

/** A boss as its contest's tile shows it. */
interface BossPortrait {
  scene: SceneRenderer;
  swap: SpriteSwap;
  color: EchoColor;
}

/** What a row's tile shows. */
type Tile =
  | { kind: 'mission'; missionType: number }
  | { kind: 'contest'; contest: ContestKind; portrait: BossPortrait }
  | { kind: 'free' };

interface Row {
  mode: RunMode | null;
  /** The tile left of the label; settings have none. */
  tile: Tile | null;
  done: boolean;
  /** Dictionary key of the ticker text for rows without a mode. */
  desc?: string;
  /** The description itself, when it needs more than a key. */
  text?: string;
  /** A contest not open yet (the level's missions come first). */
  locked?: boolean;
}

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
  private tickerRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(ctx: GameContext, levelId: number) {
    this.ctx = ctx;
    this.levelId = levelId;
    this.frame = new ScreenFrame(ctx);
    this.menu = new Menu(ctx.fonts.text);
  }

  enter(): void {
    this.progress = loadProgress();
    this.contests = loadContestProgress();
    this.rebuild();
    this.ctx.music.menu();
    const news = takeLevelNews(this.levelId);
    if (news) {
      // The boss the level opened is what the news is about.
      const contest = this.rows.findIndex((row) => row.tile?.kind === 'contest');
      if (contest >= 0) this.menu.setCursor(contest);
      this.ctx.screens.push(new LevelCompleteScreen(this.ctx, news));
    }
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
        tile: { kind: 'mission', missionType: type },
        done: isMissionCompleted(this.progress, this.levelId, slot),
      });
      items.push({
        label: i18n.t(`mode.${mode}`),
        value: this.recordLabel(mode),
        indent: TILE_INDENT,
        onSelect: () => this.start(mode),
      });
    });
    const open = this.contestsOpen;
    const boss = bossOfLevel(this.levelId);
    const name = bossName(i18n, boss);
    const locked = i18n.t('contest.locked', { boss: name });
    for (const kind of CONTEST_KINDS) {
      const record = contestRecord(this.levelId, kind);
      if (!record || !boss) continue;
      const beaten = isContestBeaten(this.contests, this.levelId, kind);
      // The second record gives a boss the player already has something more (a surprise).
      const more = !beaten && bossCharacterFor(this.levelId, this.contests) !== null;
      const desc = i18n.t(`boss.${boss.id}.desc`);
      this.rows.push({
        mode: null,
        tile: { kind: 'contest', contest: kind, portrait: this.portrait(boss, kind, beaten) },
        done: beaten,
        text: open
          ? i18n.t(more ? 'contest.descMore' : 'contest.desc', { desc, boss: name })
          : locked,
        locked: !open,
      });
      items.push({
        label: i18n.t('contest.title', { boss: name, mode: i18n.t(`mode.${kind}`) }),
        value: open ? formatTime(record.timeMs) : '',
        muted: !open,
        indent: TILE_INDENT,
        tint: bossTint(boss.color),
        onSelect: open ? () => this.startContest(kind) : () => platform.toast.show(locked),
      });
    }
    this.rows.push({ mode: 'free', tile: { kind: 'free' }, done: false });
    items.push({
      label: i18n.t('mode.free'),
      indent: TILE_INDENT,
      onSelect: () => this.start('free'),
    });
    // The settings, under a line, from the left edge.
    const settings = items.length;
    if (level.missionTypes.includes(0)) {
      this.rows.push({ mode: null, tile: null, done: false });
      items.push({
        label: i18n.t('mission.withRival'),
        value: this.withRival ? i18n.t('options.on') : i18n.t('options.off'),
        onAdjust: () => {
          this.withRival = !this.withRival;
          this.rebuild();
        },
      });
    }
    this.rows.push({ mode: null, tile: null, done: false, desc: 'mission.bestGhost.desc' });
    items.push({
      label: i18n.t('mission.bestGhost'),
      value: this.ctx.options.bestGhost ? i18n.t('options.on') : i18n.t('options.off'),
      onAdjust: () => {
        Object.assign(this.ctx.options, saveOptions({ bestGhost: !this.ctx.options.bestGhost }));
        this.rebuild();
      },
    });
    items[settings]!.divider = true;
    const cursor = this.menu.cursor;
    this.menu.setItems(items);
    this.menu.setCursor(Math.min(cursor, items.length - 1));
    this.onResize();
  }

  /**
   * The boss on a contest's tile: as it is once that record is beaten, a hologram in its colour
   * until then (like its glimpses), a silhouette while it is still in the workshop.
   */
  private portrait(boss: Boss, kind: ContestKind, beaten: boolean): BossPortrait {
    const { render } = this.ctx;
    const character = contestCharacter(this.levelId, kind);
    const swap = render.skins.swapFor(character);
    if (!isDrawn(boss)) {
      return { scene: render.echo.scene(boss.color, false), swap, color: boss.color };
    }
    const source = render.skins.sceneFor(character);
    return {
      scene: beaten ? source : render.echo.scene(boss.color, true, source),
      swap,
      color: boss.color,
    };
  }

  private recordLabel(mode: RunMode): string {
    const record = loadRecord(this.levelId, mode);
    return record ? formatResult(mode, this.levelId, record) : '-';
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
    const row = Math.max(rowHeight(24, viewport.isCoarsePointer), ICON_TILE + 4);
    this.menu.layout.x = col.x;
    this.menu.layout.width = col.w;
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
    this.rows.forEach((row, i) => {
      const r = this.menu.rowRect(i);
      if (!row.tile || !r) return;
      const x = r.x + 2;
      const y = r.y + ((r.h - ICON_TILE) >> 1);
      switch (row.tile.kind) {
        case 'mission':
          drawMissionIcon(c, render.sheet, row.tile.missionType, row.done, x, y);
          break;
        case 'free':
          drawFreeRunIcon(c, x, y);
          break;
        case 'contest':
          this.drawBossTile(c, row.tile.contest, row.tile.portrait, row.locked ?? false, x, y);
          break;
      }
    });
    this.ticker.draw(c, fonts.small, this.tickerRect, Theme.muted);
  }

  /** A contest's tile: the boss on a dark card in its colour, the mode in a corner. */
  private drawBossTile(
    c: CanvasRenderingContext2D,
    contest: ContestKind,
    portrait: BossPortrait,
    locked: boolean,
    x: number,
    y: number,
  ): void {
    drawCard(c, x, y, ICON_TILE, ICON_TILE, portrait.color.css, BOSS_TILE_FILL);
    drawPortrait(c, this.ctx, portrait.scene, { x, y, w: ICON_TILE, h: ICON_TILE }, portrait.swap);
    const glyph = modeGlyphSize(contest);
    const gx = x + ICON_TILE - glyph.width - 2;
    drawModeGlyph(c, contest, gx, y + ICON_TILE - glyph.height - 2, portrait.color.light);
    if (!locked) return;
    c.fillStyle = 'rgba(16, 20, 24, 0.7)';
    c.fillRect(x, y, ICON_TILE, ICON_TILE);
    const s = icons.size('lock');
    icons.draw(
      c,
      'lock',
      'plain',
      x + ((ICON_TILE - s.width) >> 1),
      y + ((ICON_TILE - s.height) >> 1),
    );
  }
}
