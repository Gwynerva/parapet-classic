/**
 * End-of-run screen (the original's state 7, d.java line 5349): the outcome judged by
 * `evaluateMission`, the goal line, time and score, the local record with name entry, the
 * unlock bookkeeping, and retry / next mission / main menu. After a ghost race it also tells
 * who won and by how much; every ranked run can go out as a challenge link or a replay file.
 */
import {
  cleanReplayName,
  compareRuns,
  evaluateMission,
  isRankedMode,
  LEVEL_COUNT,
  MAX_REPLAY_NAME_LENGTH,
  missionSlot,
  rankingSort,
  type MissionOutcome,
  type Replay,
  type RunMode,
} from '@parapet/sim';
import { formatTime, Theme, type GameContext } from '../Context.ts';
import type { Screen, UiGesture, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import { Menu, type MenuItem } from '@parapet/runtime/ui/Menu.ts';
import { panel } from '@parapet/runtime/ui/draw.ts';
import { fitWidth, inset, rowHeight, safeRect, type Rect } from '@parapet/runtime/ui/layout.ts';
import { MessageBox } from '@parapet/runtime/ui/MessageBox.ts';
import { TextInputOverlay } from '@parapet/runtime/ui/TextInputOverlay.ts';
import {
  completeMission,
  isBetterRecord,
  isLevelUnlocked,
  loadProgress,
  loadRecord,
  savePlayer,
  saveRecord,
  type RecordEntry,
} from '@parapet/runtime/storage/profile.ts';
import { copyChallengeLink, missionSetup, saveReplayFile, watchSetup } from '../ghosts.ts';
import { formatGap } from '../ui/GhostOverlay.ts';
import { PlayScreen } from './PlayScreen.ts';
import { TitleScreen } from './TitleScreen.ts';
import { PrizeScreen } from './PrizeScreen.ts';

const NAME_PATTERN = /[\p{L}\p{N} _.-]/u;
/** How long a status line ("link copied") stays, in ms. */
const STATUS_MS = 4000;

type RaceVerdict = 'won' | 'lost' | 'draw';

export class ResultsScreen implements Screen {
  readonly translucent = true;
  private readonly ctx: GameContext;
  private readonly play: PlayScreen;
  private readonly menu: Menu;
  private readonly outcome: MissionOutcome;
  private readonly time: number;
  private readonly score: number;
  private readonly finished: boolean;
  private readonly race: RaceVerdict | null;
  private newRecord = false;
  private status = '';
  private statusUntil = 0;
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
    this.finished = result?.finished ?? false;
    this.outcome = evaluateMission(
      mission,
      play.setup.mode,
      result,
      this.score,
      world.player.moveBits,
    );
    this.race = this.judgeRace();
    this.updateProgress();
    this.storeRecord();
    this.lines = this.describe();
    this.buildMenu();
  }

  private get sort(): 'time' | 'score' {
    return rankingSort(this.play.setup.mode, this.play.setup.levelId);
  }

  /** Who won the ghost race, by the rules the mode is ranked on. */
  private judgeRace(): RaceVerdict | null {
    const ghost = this.play.setup.ghost;
    if (!ghost) return null;
    const mine = { finished: this.finished, time: this.time, score: this.score };
    const order = compareRuns(this.sort, mine, ghost.outcome);
    return order < 0 ? 'won' : order > 0 ? 'lost' : 'draw';
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
    out.push(...this.describeRace());
    return out;
  }

  /** The ghost race in two lines: what the ghost did, and the verdict with the margin. */
  private describeRace(): string[] {
    const ghost = this.play.setup.ghost;
    if (!ghost || !this.race) return [];
    const { i18n } = this.ctx;
    const theirs = ghost.outcome;
    const byScore = this.sort === 'score';
    const value = byScore ? String(theirs.score) : formatTime(theirs.time);
    const comparable = byScore || (this.finished && theirs.finished);
    const margin = !comparable
      ? ''
      : byScore
        ? `${this.score - theirs.score > 0 ? '+' : ''}${this.score - theirs.score}`
        : formatGap(this.time - theirs.time, 2);
    if (ghost.kind === 'best') {
      return [
        i18n.t('ghost.result.best', { value }),
        i18n.t(`ghost.verdict.best.${this.race}`, { margin }),
      ];
    }
    const name = ghost.replay.playerName || i18n.t('player.name');
    return [
      i18n.t('ghost.result.challenger', { name, value }),
      i18n.t(`ghost.verdict.challenger.${this.race}`, { name, margin }),
    ];
  }

  /**
   * `n(ci, cj)` on success: mission bits, the "level unlocked" check and the prize. A race
   * from a shared link may be on a level the player has not opened yet; it counts only once
   * the level is open.
   */
  private updateProgress(): void {
    const { setup } = this.play;
    // Watching a recorded run (someone else's, or one's own) is not playing it.
    if (!this.outcome.won || setup.script) return;
    const missions = this.ctx.content.missions.levels;
    const level = missions[setup.levelId]!;
    if (!isLevelUnlocked(loadProgress(), level.unlockThreshold)) return;
    const slot = missionSlot(level, setup.mode);
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
    if (!isRankedMode(setup.mode) || !this.outcome.won || setup.script) return;
    const replay = session.buildReplay();
    const entry: RecordEntry = {
      time: this.time,
      score: this.score,
      finished: true,
      timeUp: false,
      input: session.world.recorder.finish(),
      playerName: setup.playerName,
      character: setup.character,
      withRival: setup.withRival,
      simVersion: replay?.simVersion ?? '',
      date: new Date().toISOString(),
    };
    const previous = loadRecord(setup.levelId, setup.mode);
    if (isBetterRecord(setup.mode, entry, previous, setup.levelId)) {
      saveRecord(setup.levelId, setup.mode, entry);
      this.newRecord = true;
    }
  }

  /** This run as a replay, under the name the player has now (it may just have been typed). */
  private replay(): Replay | null {
    const replay = this.play.session.buildReplay();
    if (!replay || !isRankedMode(replay.mode)) return null;
    return { ...replay, playerName: cleanReplayName(this.ctx.player.name) };
  }

  private setStatus(text: string): void {
    this.status = text;
    this.statusUntil = performance.now() + STATUS_MS;
  }

  /** Called from a gesture: the browser allows the clipboard only there. */
  private copyLink(): void {
    this.closeNameInput(true);
    const replay = this.replay();
    if (!replay) return;
    copyChallengeLink(this.ctx, replay, () => this.setStatus(this.ctx.i18n.t('share.copied')));
  }

  /** Called from a gesture: downloads start only there on some browsers. */
  private saveFile(): void {
    this.closeNameInput(true);
    const replay = this.replay();
    if (!replay) return;
    saveReplayFile(replay, { time: this.time, score: this.score });
    this.setStatus(this.ctx.i18n.t('replayFile.saved'));
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
      if (isLevelUnlocked(progress, nextLevel.unlockThreshold)) {
        const mode = modeOf(nextLevel.missionTypes[0] ?? 0);
        if (mode) return { levelId: next, mode };
      }
    }
    return null;
  }

  private buildMenu(): void {
    const { i18n, screens } = this.ctx;
    const { setup } = this.play;
    const items: MenuItem[] = [
      {
        label: setup.ghost ? i18n.t('ghost.again') : i18n.t('results.retry'),
        onSelect: () => this.leave(() => this.play.restart()),
      },
    ];
    const next = this.nextMission();
    if (next && setup.ghost?.kind !== 'challenger') {
      items.push({
        label: i18n.t('results.nextMission'),
        onSelect: () =>
          this.leave(() => {
            screens.pop();
            screens.push(
              new PlayScreen(
                this.ctx,
                missionSetup(this.ctx, next.levelId, next.mode, setup.withRival),
              ),
            );
          }),
      });
    }
    if (this.prizeUnlocked) {
      items.push({
        label: i18n.t('level.prize'),
        onSelect: () => this.leave(() => screens.clear(new PrizeScreen(this.ctx))),
      });
    }
    if (isRankedMode(setup.mode) && !setup.script && this.play.session.buildReplay()) {
      items.push(
        { label: i18n.t('share.copyLink'), gesture: true, onSelect: () => this.copyLink() },
        { label: i18n.t('replayFile.save'), gesture: true, onSelect: () => this.saveFile() },
      );
    }
    const ghost = setup.ghost;
    if (ghost && ghost.kind === 'challenger') {
      items.push({
        label: i18n.t('ghost.watch'),
        onSelect: () =>
          this.leave(() => {
            screens.pop();
            screens.push(new PlayScreen(this.ctx, watchSetup(ghost.replay)));
          }),
      });
    }
    items.push({
      label: i18n.t('menu.mainMenu'),
      onSelect: () => this.leave(() => screens.clear(new TitleScreen(this.ctx))),
    });
    this.menu.setItems(items);
    this.menu.maxVisible = items.length;
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
      maxLength: MAX_REPLAY_NAME_LENGTH,
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

  onGesture(g: UiGesture): boolean {
    if (this.nameInput?.isOpen && g.kind === 'key') return false;
    return this.menu.onGesture(g);
  }

  private title(): { text: string; color: string } {
    const { i18n } = this.ctx;
    if (this.race === 'won' && this.play.setup.ghost?.kind === 'challenger') {
      return { text: i18n.t('ghost.title.won'), color: Theme.accent };
    }
    if (this.outcome.won) {
      return {
        text: this.newRecord ? i18n.t('results.newRecord') : i18n.t('results.done'),
        color: Theme.accent,
      };
    }
    return {
      text: this.outcome.reason === 'timeUp' ? i18n.t('results.timeUp') : i18n.t('results.failed'),
      color: Theme.danger,
    };
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n } = this.ctx;
    c.fillStyle = Theme.overlay;
    c.fillRect(0, 0, viewport.width, viewport.height);
    const { x, y, width, rowHeight: row } = this.menu.layout;
    const headerH = this.headerHeight();
    const top = y - headerH;
    panel(c, x - 8, top, width + 16, headerH + this.menu.items.length * row + 16);
    const title = this.title();
    const cx = x + (width >> 1);
    fonts.display.draw(c, title.text, cx + 1, top + 9, { align: 'center', color: '#000000' });
    fonts.display.draw(c, title.text, cx, top + 8, { align: 'center', color: title.color });
    let ly = top + 8 + fonts.display.lineHeight + 6;
    for (const line of this.lines) {
      fonts.small.draw(c, line, cx, ly, { align: 'center', color: Theme.text, tabular: true });
      ly += fonts.small.lineHeight + 2;
    }
    // Blink the status for the first two seconds like the results icon of the original.
    const now = performance.now();
    const blink = now - this.shownAt < 2000 && ((now >> 8) & 1) === 1;
    if (this.status && now < this.statusUntil && !blink) {
      fonts.small.draw(c, this.status, cx, ly + 4, { align: 'center', color: Theme.success });
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
