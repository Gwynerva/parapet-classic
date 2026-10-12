/**
 * The box shown when the last mission of a level is done, in whatever order they were played:
 * the level is complete, who opens with it (a rival, once every level they race on is
 * complete), the next level, and the boss who now takes challenges there. It offers the ways
 * on: this mission again, the boss, the next level; Back closes it and leaves the screen below.
 */
import { LEVEL_COUNT } from '@parapet/sim';
import { Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer, UiWheel } from '@parapet/runtime/app/Screen.ts';
import { Menu, type MenuItem } from '@parapet/runtime/ui/Menu.ts';
import { panel } from '@parapet/runtime/ui/draw.ts';
import { rowHeight, type Rect } from '@parapet/runtime/ui/layout.ts';
import {
  isContestBeaten,
  isLevelComplete,
  loadContestProgress,
  type ContestKind,
  type Progress,
} from '@parapet/runtime/storage/profile.ts';
import type { GameContent } from '../../assets/content.ts';
import { bossOfLevel, CONTEST_KINDS, contestRecord } from '../bosses.ts';
import { isCharacterOpen } from '../characters.ts';
import { contestSetup } from '../ghosts.ts';
import { dialogLayout } from '../layouts.ts';
import { LevelSelectScreen } from './LevelSelectScreen.ts';
import { MissionSelectScreen } from './MissionSelectScreen.ts';
import { PlayScreen } from './PlayScreen.ts';
import { TitleScreen } from './TitleScreen.ts';

/** The original's ten characters (the bosses open by their own rule). */
const ORIGINAL_CHARACTERS = 10;

/** A level that a mission has just completed, and the characters that opened with it. */
export interface LevelCompletion {
  levelId: number;
  opened: number[];
}

/** What completing a mission did to its level: null unless it was the level's last one. */
export function levelCompletion(
  content: Pick<GameContent, 'missions'>,
  levelId: number,
  before: Progress,
  after: Progress,
): LevelCompletion | null {
  const levels = content.missions.levels;
  if (isLevelComplete(before, levels, levelId) || !isLevelComplete(after, levels, levelId)) {
    return null;
  }
  const opened: number[] = [];
  for (let c = 0; c < ORIGINAL_CHARACTERS; c++) {
    if (!isCharacterOpen(content, before, c) && isCharacterOpen(content, after, c)) opened.push(c);
  }
  return { levelId, opened };
}

export interface LevelCompleteOptions extends LevelCompletion {
  /** Plays the mission just won again (this box is closed by then). */
  repeat: () => void;
  /** Closes the run's screens, back to where the run was started from. */
  leaveRun: () => void;
}

export class LevelCompleteScreen implements Screen {
  readonly translucent = true;
  private readonly ctx: GameContext;
  private readonly opts: LevelCompleteOptions;
  private readonly menu: Menu;
  private readonly lines: string[];
  private wrapped: string[] = [];
  private panelRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(ctx: GameContext, opts: LevelCompleteOptions) {
    this.ctx = ctx;
    this.opts = opts;
    this.menu = new Menu(ctx.fonts.text, ctx.fonts.small);
    const { i18n } = ctx;
    const levelName = (id: number): string => i18n.t(`level.names.${id}`);
    const boss = bossOfLevel(opts.levelId);
    const bossName = boss ? i18n.t(`boss.${boss.id}.name`) : '';
    const kind = this.contestKind();
    const next = opts.levelId + 1 < LEVEL_COUNT ? opts.levelId + 1 : -1;

    this.lines = [i18n.t('level.complete.done', { name: levelName(opts.levelId) })];
    for (const c of opts.opened) {
      const name = ctx.skins.find((s) => s.character === c)?.name;
      if (name) this.lines.push(i18n.t('level.complete.character', { name }));
    }
    if (next >= 0) this.lines.push(i18n.t('level.unlockedName', { name: levelName(next) }));
    if (kind && bossName) this.lines.push(i18n.t('level.complete.boss', { boss: bossName }));

    const items: MenuItem[] = [
      { label: i18n.t('level.complete.repeat'), onSelect: () => this.close(opts.repeat) },
    ];
    if (kind && bossName) {
      items.push({
        label: i18n.t('level.complete.fight', { boss: bossName }),
        onSelect: () => this.fight(kind),
      });
    }
    if (next >= 0) {
      items.push({
        label: i18n.t('level.complete.next', { name: levelName(next) }),
        onSelect: () => this.goTo(next),
      });
    }
    this.menu.setItems(items);
    this.onResize();
  }

  /** The contest the boss offers: the first not won yet (in the mission menu's order). */
  private contestKind(): ContestKind | null {
    const levelId = this.opts.levelId;
    const kinds = CONTEST_KINDS.filter((kind) => contestRecord(levelId, kind) !== null);
    const progress = loadContestProgress();
    return kinds.find((kind) => !isContestBeaten(progress, levelId, kind)) ?? kinds[0] ?? null;
  }

  private close(then: () => void): void {
    this.ctx.screens.pop();
    then();
  }

  private fight(kind: ContestKind): void {
    const setup = contestSetup(this.ctx, this.opts.levelId, kind);
    if (!setup) return;
    this.close(() => {
      this.opts.leaveRun();
      this.ctx.screens.push(new PlayScreen(this.ctx, setup));
    });
  }

  /** The next level's missions, with the level map under them for the way back. */
  private goTo(levelId: number): void {
    const { ctx } = this;
    ctx.screens.clear(new TitleScreen(ctx));
    ctx.screens.push(new LevelSelectScreen(ctx, levelId));
    ctx.screens.push(new MissionSelectScreen(ctx, levelId));
  }

  private get headerHeight(): number {
    const { fonts } = this.ctx;
    return fonts.display.lineHeight + 12 + this.wrapped.length * (fonts.small.lineHeight + 2) + 6;
  }

  onResize(): void {
    const { viewport, fonts } = this.ctx;
    const row = rowHeight(24, viewport.isCoarsePointer);
    const width = 260;
    // Wrapped to the width the panel gets on this screen (it narrows on a small one).
    const probe = dialogLayout(viewport, {
      width,
      header: 0,
      footer: 0,
      rows: 1,
      rowHeight: row,
    });
    this.wrapped = this.lines.flatMap((line) => fonts.small.wrap(line, probe.menu.w - 8));
    const d = dialogLayout(viewport, {
      width,
      header: this.headerHeight,
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
    const cx = r.x + (r.w >> 1);
    const title = i18n.t('level.complete.title');
    fonts.display.draw(c, title, cx + 1, r.y + 9, { align: 'center', color: '#000000' });
    fonts.display.draw(c, title, cx, r.y + 8, { align: 'center', color: Theme.success });
    let ly = r.y + 8 + fonts.display.lineHeight + 6;
    for (const line of this.wrapped) {
      fonts.small.draw(c, line, cx, ly, { align: 'center', color: Theme.text });
      ly += fonts.small.lineHeight + 2;
    }
    this.menu.draw(c);
  }
}
