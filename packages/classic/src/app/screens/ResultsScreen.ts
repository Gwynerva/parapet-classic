/**
 * End-of-run screen (the original's state 7, d.java line 5349): the outcome judged by
 * `evaluateMission`, the goal line, time and score, the local record with name entry, the
 * unlock bookkeeping, and retry / next mission / main menu.
 */
import { evaluateMission, missionSlot, type MissionOutcome, type RunMode } from '@parapet/sim';
import { formatTime, Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import { Menu, type MenuItem } from '@parapet/runtime/ui/Menu.ts';
import { heading, panel } from '@parapet/runtime/ui/draw.ts';
import { fitWidth, inset, rowHeight, safeRect, type Rect } from '@parapet/runtime/ui/layout.ts';
import { MessageBox } from '@parapet/runtime/ui/MessageBox.ts';
import { TextInputOverlay } from '@parapet/runtime/ui/TextInputOverlay.ts';
import {
  completeMission,
  isBetterRecord,
  loadIdentity,
  loadProgress,
  loadRecord,
  savePlayer,
  saveRecord,
  type RecordEntry,
} from '@parapet/runtime/storage/profile.ts';
import { ApiError, submitRun } from '@parapet/runtime/net/api.ts';
import {
  defaultLeaderboardSort,
  isLeaderboardMode,
  LEVEL_COUNT,
  MAX_NAME_LENGTH,
} from '@parapet/protocol';
import { PlayScreen } from './PlayScreen.ts';
import { IdentityScreen } from './IdentityScreen.ts';
import { TitleScreen } from './TitleScreen.ts';
import { PrizeScreen } from './PrizeScreen.ts';

const NAME_PATTERN = /[\p{L}\p{N} _.-]/u;

export class ResultsScreen implements Screen {
  readonly translucent = true;
  private readonly ctx: GameContext;
  private readonly play: PlayScreen;
  private readonly menu: Menu;
  private readonly outcome: MissionOutcome;
  private readonly time: number;
  private readonly score: number;
  private newRecord = false;
  private netStatus = '';
  private publishing = false;
  private published = false;
  private nameInput: TextInputOverlay | null = null;
  private nameRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private unlockedLevel = -1;
  private prizeUnlocked = false;
  private shownAt = 0;
  private lines: string[] = [];

  constructor(ctx: GameContext, play: PlayScreen) {
    this.ctx = ctx;
    this.play = play;
    this.menu = new Menu(ctx.fonts.text, ctx.fonts.small);
    const world = play.session.world;
    const mission = ctx.content.missions.levels[play.setup.levelId]!;
    const result = world.rules.result;
    this.time = result?.time ?? world.clock;
    this.score = world.player.score?.score ?? 0;
    this.outcome = evaluateMission(
      mission,
      play.setup.mode,
      result,
      this.score,
      world.player.moveBits,
    );
    this.lines = this.describe();
    this.updateProgress();
    this.storeRecord();
    this.buildMenu();
  }

  private describe(): string[] {
    const { i18n } = this.ctx;
    const { setup } = this.play;
    const out: string[] = [];
    const target = this.outcome.target;
    if (target) {
      if (setup.mode === 'sprint')
        out.push(i18n.t('results.goal.rival', { value: formatTime(target.value) }));
      else if (target.kind === 'time')
        out.push(i18n.t('results.goal.time', { value: formatTime(target.value) }));
      else out.push(i18n.t('results.goal.score', { value: target.value }));
    }
    out.push(`${i18n.t('results.yourTime')} ${formatTime(this.time)}`);
    out.push(`${i18n.t('results.yourScore')} ${this.score}`);
    switch (this.outcome.reason) {
      case 'missingMoves':
        out.push(i18n.t(`results.missingMoves.${setup.levelId}`));
        break;
      case 'lowScore':
        out.push(i18n.t('results.notEnoughScore'));
        break;
      case 'tooSlow':
        out.push(i18n.t('results.tooSlow'));
        break;
      default:
        break;
    }
    return out;
  }

  /** `n(ci, cj)` on success: mission bits, the "level unlocked" check and the prize. */
  private updateProgress(): void {
    if (!this.outcome.won) return;
    const { setup } = this.play;
    const missions = this.ctx.content.missions.levels;
    const slot = missionSlot(missions[setup.levelId]!, setup.mode);
    if (slot < 0) return;
    const { firstTime, total, progress } = completeMission(setup.levelId, slot);
    if (!firstTime) return;
    const unlocked = missions.find((m) => m.id !== 0 && m.unlockThreshold === total);
    if (unlocked) this.unlockedLevel = unlocked.id;
    const all = missions.reduce((n, m) => n + m.missionCount, 0);
    if (total >= all && !progress.prizeSeen) this.prizeUnlocked = true;
  }

  private storeRecord(): void {
    const { setup, session } = this.play;
    if (!isLeaderboardMode(setup.mode) || !this.outcome.won) return;
    const entry: RecordEntry = {
      time: this.time,
      score: this.score,
      finished: true,
      timeUp: false,
      input: session.world.recorder.finish(),
      playerName: setup.playerName,
      character: setup.character,
      withRival: setup.withRival,
      simVersion: session.buildSubmission()?.simVersion ?? '',
      date: new Date().toISOString(),
    };
    const previous = loadRecord(setup.levelId, setup.mode);
    if (isBetterRecord(setup.mode, entry, previous, setup.levelId)) {
      saveRecord(setup.levelId, setup.mode, entry);
      this.newRecord = true;
    }
  }

  /** Publish the run under the device's public name (claim one first when there is none). */
  private publish(): void {
    const { setup, session } = this.play;
    const { i18n, screens } = this.ctx;
    if (!isLeaderboardMode(setup.mode) || !this.outcome.won || this.publishing) return;
    const identity = loadIdentity();
    if (!identity) {
      screens.push(
        new IdentityScreen(this.ctx, (claimed) => {
          if (claimed) this.publish();
        }),
      );
      return;
    }
    const submission = session.buildSubmission();
    if (!submission) return;
    submission.playerName = identity.name;
    submission.identity = { name: identity.name, token: identity.token };
    this.publishing = true;
    this.netStatus = i18n.t('net.publishing');
    submitRun(submission, { timeoutMs: 10000 })
      .then((res) => {
        const byScore = defaultLeaderboardSort(setup.mode, setup.levelId) === 'score';
        const rank = (byScore ? res.rank.byScore : res.rank.byTime) ?? 0;
        switch (res.outcome) {
          case 'stored':
            this.netStatus = i18n.t('results.published', { rank });
            this.published = true;
            break;
          case 'not-best':
            this.netStatus = i18n.t('net.notBest', { rank });
            this.published = true;
            break;
          case 'flagged':
            this.netStatus = i18n.t('net.flagged');
            this.published = true;
            break;
          default:
            this.netStatus = i18n.t('net.submitted');
            break;
        }
      })
      .catch((err: unknown) => {
        this.netStatus = this.describeError(err);
      })
      .finally(() => {
        this.publishing = false;
        this.buildMenu();
      });
  }

  private describeError(err: unknown): string {
    const { i18n } = this.ctx;
    if (!(err instanceof ApiError)) return i18n.t('net.error');
    switch (err.code) {
      case 'unauthorized':
        return i18n.t('net.unauthorized');
      case 'rate-limited':
        return i18n.t('net.rateLimited');
      case 'network':
      case 'timeout':
        return i18n.t('net.offline');
      default:
        return i18n.t('net.error');
    }
  }

  /** The mission to offer next: the next one of this level not yet done, else the next level. */
  private nextMission(): { levelId: number; mode: RunMode } | null {
    const { setup } = this.play;
    const missions = this.ctx.content.missions.levels;
    const progress = loadProgress();
    const level = missions[setup.levelId]!;
    const slot = missionSlot(level, setup.mode);
    for (let m = slot + 1; m < level.missionTypes.length; m++) {
      if (((progress.completed[setup.levelId] ?? 0) & (1 << m)) !== 0) continue;
      const type = level.missionTypes[m]!;
      const mode = modeOf(type);
      if (mode) return { levelId: setup.levelId, mode };
    }
    const next = setup.levelId + 1;
    if (next < LEVEL_COUNT) {
      const nextLevel = missions[next]!;
      if (
        nextLevel.unlockThreshold <=
        Object.values(progress.completed).length * 0 + totalOf(progress)
      ) {
        const mode = modeOf(nextLevel.missionTypes[0] ?? 0);
        if (mode) return { levelId: next, mode };
      }
    }
    return null;
  }

  private buildMenu(): void {
    const { i18n, screens } = this.ctx;
    const items: MenuItem[] = [
      {
        label: i18n.t('results.retry'),
        onSelect: () => this.leave(() => this.play.restart()),
      },
    ];
    const next = this.nextMission();
    if (next) {
      items.push({
        label: i18n.t('results.nextMission'),
        onSelect: () =>
          this.leave(() => {
            screens.pop();
            screens.push(new PlayScreen(this.ctx, { ...this.play.setup, ...next }));
          }),
      });
    }
    if (this.prizeUnlocked) {
      items.push({
        label: i18n.t('level.prize'),
        onSelect: () => this.leave(() => screens.clear(new PrizeScreen(this.ctx))),
      });
    }
    if (isLeaderboardMode(this.play.setup.mode) && this.outcome.won && !this.published) {
      items.push({ label: i18n.t('results.publish'), onSelect: () => this.publish() });
    }
    items.push({
      label: i18n.t('menu.mainMenu'),
      onSelect: () => this.leave(() => screens.clear(new TitleScreen(this.ctx))),
    });
    this.menu.setItems(items);
    this.onResize();
  }

  /** Close this screen, showing the "level unlocked" box first when one is due. */
  private leave(then: () => void): void {
    const { i18n, screens } = this.ctx;
    this.closeNameInput(true);
    screens.pop();
    if (this.unlockedLevel < 0) {
      then();
      return;
    }
    const levelId = this.unlockedLevel;
    this.unlockedLevel = -1;
    screens.push(
      new MessageBox(
        { viewport: this.ctx.viewport, fonts: this.ctx.fonts },
        {
          title: i18n.t('level.unlocked'),
          tone: 'success',
          pages: [i18n.t('level.unlockedName', { name: i18n.t(`level.names.${levelId}`) })],
          labels: { next: i18n.t('menu.next'), ok: i18n.t('menu.ok') },
          onClose: () => {
            screens.pop();
            then();
          },
        },
      ),
    );
  }

  enter(): void {
    this.shownAt = performance.now();
    if (this.newRecord && !this.nameInput) this.openNameInput();
  }

  exit(): void {
    this.closeNameInput(true);
  }

  private openNameInput(): void {
    const { player } = this.ctx;
    this.nameInput = new TextInputOverlay(this.ctx.viewport, {
      maxLength: MAX_NAME_LENGTH,
      allowed: NAME_PATTERN,
      initial: player.name,
      placeholder: this.ctx.i18n.t('player.name'),
      fontFamily: 'Terminus',
      onCommit: (value) => this.commitName(value),
      onCancel: () => {
        this.nameInput = null;
      },
    });
    this.nameInput.open(this.nameRect);
  }

  private commitName(value: string): void {
    const name = value.trim();
    this.nameInput = null;
    if (!name) return;
    const { setup } = this.play;
    this.ctx.player.name = name;
    savePlayer(this.ctx.player);
    const record = loadRecord(setup.levelId, setup.mode);
    if (record && record.date && this.newRecord) {
      record.playerName = name;
      saveRecord(setup.levelId, setup.mode, record);
    }
  }

  private closeNameInput(commit: boolean): void {
    const input = this.nameInput;
    if (!input) return;
    const value = input.value;
    input.close();
    this.nameInput = null;
    if (commit) this.commitName(value);
  }

  onResize(): void {
    const { viewport, fonts } = this.ctx;
    const safe = safeRect(viewport);
    const col = fitWidth(inset(safe, 8, 0), 300);
    const row = rowHeight(22, viewport.isCoarsePointer);
    const headerH = this.headerHeight();
    const menuH = this.menu.items.length * row;
    const total = headerH + menuH + 16;
    const top = Math.max(safe.y + 8, safe.y + ((safe.h - total) >> 1));
    this.menu.layout.x = col.x;
    this.menu.layout.width = col.w;
    this.menu.layout.rowHeight = row;
    this.menu.layout.y = top + headerH;
    this.nameRect = {
      x: col.x + 8,
      y: top + headerH - fonts.text.lineHeight - 10,
      w: col.w - 16,
      h: fonts.text.lineHeight + 6,
    };
    this.nameInput?.reposition(this.nameRect);
  }

  private headerHeight(): number {
    const { fonts } = this.ctx;
    const nameRow = this.newRecord ? fonts.text.lineHeight + 14 : 0;
    return (
      8 +
      fonts.display.lineHeight +
      6 +
      this.lines.length * (fonts.small.lineHeight + 2) +
      6 +
      fonts.small.lineHeight +
      4 +
      nameRow
    );
  }

  update(): void {}

  onKey(key: UiKey): void {
    if (this.nameInput?.isOpen) return;
    if (key.action === 'back') {
      this.leave(() => this.ctx.screens.clear(new TitleScreen(this.ctx)));
      return;
    }
    this.menu.onKey(key);
  }

  onPointer(p: UiPointer): void {
    this.menu.onPointer(p);
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n } = this.ctx;
    c.fillStyle = Theme.overlay;
    c.fillRect(0, 0, viewport.width, viewport.height);
    const { x, y, width, rowHeight: row } = this.menu.layout;
    const headerH = this.headerHeight();
    const top = y - headerH;
    panel(c, x - 8, top, width + 16, headerH + this.menu.items.length * row + 16);
    const title = this.outcome.won
      ? this.newRecord
        ? i18n.t('results.newRecord')
        : i18n.t('results.done')
      : this.outcome.reason === 'timeUp'
        ? i18n.t('results.timeUp')
        : i18n.t('results.failed');
    const cx = x + (width >> 1);
    const titleColor = this.outcome.won ? Theme.accent : Theme.danger;
    fonts.display.draw(c, title, cx + 1, top + 9, { align: 'center', color: '#000000' });
    fonts.display.draw(c, title, cx, top + 8, { align: 'center', color: titleColor });
    let ly = top + 8 + fonts.display.lineHeight + 6;
    for (const line of this.lines) {
      fonts.small.draw(c, line, cx, ly, { align: 'center', color: Theme.text, tabular: true });
      ly += fonts.small.lineHeight + 2;
    }
    // Blink the status for the first two seconds like the results icon of the original.
    const blink = performance.now() - this.shownAt < 2000 && ((performance.now() >> 8) & 1) === 1;
    if (this.netStatus && !blink) {
      fonts.small.draw(c, this.netStatus, cx, ly + 4, { align: 'center', color: Theme.muted });
    }
    if (this.newRecord) {
      fonts.small.draw(
        c,
        i18n.t('results.enterName'),
        x + 8,
        this.nameRect.y - fonts.small.lineHeight - 2,
        {
          color: Theme.success,
        },
      );
      if (!this.nameInput?.isOpen) {
        c.fillStyle = '#2a1815';
        c.fillRect(this.nameRect.x, this.nameRect.y, this.nameRect.w, this.nameRect.h);
        fonts.text.draw(
          c,
          this.ctx.player.name || i18n.t('player.name'),
          this.nameRect.x + 4,
          this.nameRect.y + 3,
          {
            color: Theme.text,
          },
        );
      }
    }
    this.menu.draw(c);
  }
}

function modeOf(type: number): RunMode | null {
  switch (type) {
    case 0:
      return 'sprint';
    case 1:
      return 'flags';
    case 2:
      return 'score';
    case 3:
      return 'challenge';
    case 4:
      return 'warmup1';
    case 5:
      return 'warmup2';
    default:
      return null;
  }
}

function totalOf(progress: { completed: number[] }): number {
  let n = 0;
  for (const bits of progress.completed) for (let b = bits; b !== 0; b >>>= 1) n += b & 1;
  return n;
}
