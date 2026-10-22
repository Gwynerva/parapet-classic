/**
 * A level completed by the mission just won, in whatever order its missions were played. Its
 * news (`LevelNews`): a ribbon, who opens with it (a rival, once every level they race on is
 * complete), the next level, and the boss who now takes challenges there. The news waits for
 * the level's menu (`holdLevelNews`): the results of the run lead there with Next, a warm-up
 * goes back there, and whichever way the player comes next, the menu shows the news in this
 * box over its list, with the ways on it adds: the boss, the next level, or the menu itself.
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
  type ContestProgress,
  type Progress,
} from '@parapet/runtime/storage/profile.ts';
import type { GameContent } from '@parapet/runtime/content/types.ts';
import {
  type Boss,
  bossName,
  bossOfLevel,
  bossTint,
  CONTEST_KINDS,
  contestRecord,
} from '../bosses.ts';
import { isCharacterOpen, skinName } from '../characters.ts';
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

/** News of completed levels waiting for their menu (this session). */
const waiting = new Map<number, LevelCompletion>();

/** Keeps a level's news until its menu is next shown. */
export function holdLevelNews(completion: LevelCompletion): void {
  waiting.set(completion.levelId, completion);
}

/** Forgets the news waiting (the game was reset: the levels are not complete any more). */
export function forgetLevelNews(): void {
  waiting.clear();
}

/** The news waiting for level `levelId`'s menu, taken (it shows once), or null. */
export function takeLevelNews(levelId: number): LevelCompletion | null {
  const news = waiting.get(levelId) ?? null;
  waiting.delete(levelId);
  return news;
}

/** The contest a level's boss offers: the first not won yet (in the mission menu's order). */
export function offeredContest(levelId: number, progress: ContestProgress): ContestKind | null {
  const kinds = CONTEST_KINDS.filter((kind) => contestRecord(levelId, kind) !== null);
  return kinds.find((kind) => !isContestBeaten(progress, levelId, kind)) ?? kinds[0] ?? null;
}

/** A level's missions, with the level map under them for the way back. */
export function goToLevel(ctx: GameContext, levelId: number): void {
  ctx.screens.clear(new TitleScreen(ctx));
  ctx.screens.push(new LevelSelectScreen(ctx, levelId));
  ctx.screens.push(new MissionSelectScreen(ctx, levelId));
}

/** The ribbon's band, and how long its shine takes to cross it once the news is shown. */
const RIBBON_FILL = '#173222';
const SHINE_MS = 700;
const SHINE_DELAY_MS = 150;
/** The boss's line: a bar like the boss's quote on the results, padded inside. */
const BOSS_BAR_FILL = '#12171d';
const BOSS_BAR_PAD = 5;
/** A confirm this soon after the box shows still belonged to what came before (the coach). */
const CONFIRM_GUARD_MS = 400;

/**
 * The news of a completed level as a section of a panel: a ribbon saying so, the lines (the
 * level done, who opened, the next level), and the boss who now takes challenges, on a bar in
 * its colour.
 */
export class LevelNews {
  private readonly ctx: GameContext;
  readonly levelId: number;
  readonly boss: Boss | null;
  /** The contest the boss offers, or null without a boss. */
  readonly kind: ContestKind | null;
  /** The next level, or -1 after the last. */
  readonly next: number;
  private readonly lines: string[];
  private readonly bossLine: string | null;
  private wrapped: string[] = [];
  private bossWrapped: string[] = [];

  constructor(ctx: GameContext, completion: LevelCompletion) {
    this.ctx = ctx;
    const { i18n } = ctx;
    const levelId = completion.levelId;
    const levelName = (id: number): string => i18n.t(`level.names.${id}`);
    this.levelId = levelId;
    this.boss = bossOfLevel(levelId);
    this.kind = this.boss ? offeredContest(levelId, loadContestProgress()) : null;
    this.next = levelId + 1 < LEVEL_COUNT ? levelId + 1 : -1;
    this.lines = [i18n.t('level.complete.done', { name: levelName(levelId) })];
    for (const c of completion.opened) {
      const name = skinName(ctx.skins, c);
      if (name) this.lines.push(i18n.t('level.complete.character', { name }));
    }
    if (this.next >= 0)
      this.lines.push(i18n.t('level.unlockedName', { name: levelName(this.next) }));
    this.bossLine =
      this.kind && this.boss ? i18n.t('level.complete.boss', { boss: this.bossName }) : null;
  }

  private get bossName(): string {
    return bossName(this.ctx.i18n, this.boss);
  }

  /** Wraps the lines to a section `width` wide. */
  wrap(width: number): void {
    const small = this.ctx.fonts.small;
    this.wrapped = this.lines.flatMap((line) => small.wrap(line, width - 8));
    this.bossWrapped = this.bossLine ? small.wrap(this.bossLine, width - 8 - 2 * BOSS_BAR_PAD) : [];
  }

  private get ribbonHeight(): number {
    return this.ctx.fonts.display.lineHeight + 8;
  }

  /** Height at the width it was last wrapped to. */
  get height(): number {
    const line = this.ctx.fonts.small.lineHeight + 2;
    let h = this.ribbonHeight + 5 + this.wrapped.length * line;
    if (this.bossWrapped.length > 0) h += 3 + this.bossWrapped.length * line + 2 * BOSS_BAR_PAD - 2;
    return h;
  }

  /** Draws the section at (x, y), `w` wide; `ageMs` since it was shown runs the ribbon's shine. */
  draw(c: CanvasRenderingContext2D, x: number, y: number, w: number, ageMs: number): void {
    const { fonts } = this.ctx;
    const rh = this.ribbonHeight;
    c.fillStyle = RIBBON_FILL;
    c.fillRect(x, y, w, rh);
    c.fillStyle = Theme.success;
    c.fillRect(x, y, w, 1);
    c.fillRect(x, y + rh - 1, w, 1);
    // A shine crosses the ribbon once, leaning like a stride.
    const t = (ageMs - SHINE_DELAY_MS) / SHINE_MS;
    if (t > 0 && t < 1) {
      const sx = Math.round(x - rh + (w + rh) * t);
      c.save();
      c.beginPath();
      c.rect(x, y + 1, w, rh - 2);
      c.clip();
      c.fillStyle = 'rgba(255, 255, 255, 0.22)';
      for (let dy = 1; dy < rh - 1; dy++) c.fillRect(sx + ((rh - dy) >> 1), y + dy, 8, 1);
      c.restore();
    }
    const title = this.ctx.i18n.t('level.complete.title');
    const cx = x + (w >> 1);
    const ty = y + ((rh - fonts.display.lineHeight) >> 1);
    fonts.display.draw(c, title, cx + 1, ty + 1, { align: 'center', color: '#000000' });
    fonts.display.draw(c, title, cx, ty, { align: 'center', color: Theme.success });
    const line = fonts.small.lineHeight + 2;
    let ly = y + rh + 5;
    for (const text of this.wrapped) {
      fonts.small.draw(c, text, cx, ly, { align: 'center', color: Theme.text });
      ly += line;
    }
    if (!this.boss || this.bossWrapped.length === 0) return;
    const color = this.boss.color;
    const top = ly + 3;
    c.fillStyle = BOSS_BAR_FILL;
    c.fillRect(x, top, w, this.bossWrapped.length * line + 2 * BOSS_BAR_PAD - 2);
    c.fillStyle = color.css;
    c.fillRect(x, top, 2, this.bossWrapped.length * line + 2 * BOSS_BAR_PAD - 2);
    let by = top + BOSS_BAR_PAD;
    for (const text of this.bossWrapped) {
      fonts.small.draw(c, text, cx + 1, by, { align: 'center', color: color.light });
      by += line;
    }
  }

  /**
   * The ways on the news adds: challenge the boss (its row in its colours), on to the next
   * level. `leave` closes what shows the news, then goes on.
   */
  items(leave: (then: () => void) => void): MenuItem[] {
    const { ctx, boss, kind, next } = this;
    const { i18n } = ctx;
    const items: MenuItem[] = [];
    if (boss && kind) {
      items.push({
        label: i18n.t('level.complete.fight', { boss: this.bossName }),
        tint: bossTint(boss.color),
        onSelect: () => {
          const setup = contestSetup(ctx, this.levelId, kind);
          if (setup) leave(() => ctx.screens.push(new PlayScreen(ctx, setup)));
        },
      });
    }
    if (next >= 0) {
      items.push({
        label: i18n.t('level.complete.next', { name: i18n.t(`level.names.${next}`) }),
        onSelect: () => leave(() => goToLevel(ctx, next)),
      });
    }
    return items;
  }
}

export interface LevelCompleteOptions extends LevelCompletion {
  /** The box closed without going anywhere: back to the level's menu. */
  onClose?: () => void;
}

/** The news in a box over the level's menu: challenge the boss, on to the next level, or OK. */
export class LevelCompleteScreen implements Screen {
  readonly translucent = true;
  private readonly ctx: GameContext;
  private readonly opts: LevelCompleteOptions;
  private readonly menu: Menu;
  private readonly news: LevelNews;
  private panelRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private shownAt = 0;

  constructor(ctx: GameContext, opts: LevelCompleteOptions) {
    this.ctx = ctx;
    this.opts = opts;
    this.menu = new Menu(ctx.fonts.text);
    this.news = new LevelNews(ctx, opts);
    this.menu.setItems([
      ...this.news.items((then) => {
        ctx.screens.pop();
        then();
      }),
      { label: ctx.i18n.t('menu.ok'), onSelect: () => this.close() },
    ]);
    this.onResize();
  }

  private close(): void {
    this.ctx.screens.pop();
    this.opts.onClose?.();
  }

  enter(): void {
    this.shownAt = performance.now();
  }

  onResize(): void {
    const { viewport } = this.ctx;
    const row = rowHeight(24, viewport.isCoarsePointer);
    const width = 260;
    // Wrapped to the width the panel gets on this screen (it narrows on a small one).
    const probe = dialogLayout(viewport, { width, header: 0, footer: 0, rows: 1, rowHeight: row });
    this.news.wrap(probe.menu.w);
    const d = dialogLayout(viewport, {
      width,
      header: this.news.height + 8,
      footer: 0,
      rows: this.menu.items.length,
      rowHeight: row,
    });
    this.panelRect = d.panel;
    this.menu.place(d.menu, row);
  }

  update(): void {}

  onKey(key: UiKey): void {
    if (key.action === 'back' || key.action === 'pause') {
      this.close();
      return;
    }
    if (key.action === 'confirm' && performance.now() - this.shownAt < CONFIRM_GUARD_MS) return;
    this.menu.onKey(key);
  }

  onPointer(p: UiPointer): void {
    this.menu.onPointer(p);
  }

  onWheel(w: UiWheel): void {
    this.menu.onWheel(w);
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport } = this.ctx;
    c.fillStyle = Theme.overlay;
    c.fillRect(0, 0, viewport.width, viewport.height);
    const r = this.panelRect;
    panel(c, r.x, r.y, r.w, r.h);
    const { x, width } = this.menu.layout;
    this.news.draw(c, x, r.y + 8, width, performance.now() - this.shownAt);
    this.menu.draw(c);
  }
}
