/**
 * The full-game timer, for speedruns from a fresh game to the credits: the game clock of every
 * attempt added up (restarts and failures included), so it stands still in the menus,
 * briefings, pauses and results and ticks only while a run is played. The total lives in the
 * profile (`FullGameRun`) and survives reloads; the attempt on screen adds its clock every
 * half second, so a reload cannot drop a failed attempt's time. A split is taken when a level
 * turns complete; the split of the last level stops the run, which may become the best, and the
 * credits show it. A timer zeroed halfway through a game splits only the levels left, and never
 * finishes.
 *
 * Shown (Options) over every screen, with the gap to the best at the last split: at the top
 * centre during a run (the bottom belongs to the touch buttons), between the pressed keys
 * flying out to its left and the gap to its right; in the bottom-right corner of the menus
 * (whose top centre holds their headings). It counts while hidden too.
 */
import {
  addFullGameTime,
  finishFullGame,
  isLevelComplete,
  loadFullGameBest,
  loadFullGameRun,
  splitFullGame,
  type Progress,
} from '@parapet/runtime/storage/profile.ts';
import { outlined } from '@parapet/runtime/ui/draw.ts';
import { formatTime, Theme, type GameContext } from './Context.ts';
import { formatGap } from './ui/GhostOverlay.ts';
import { PressPopups } from './ui/PressChevrons.ts';

/** The attempt adds its clock to the run at least this often (game ms). */
const BANK_EVERY_MS = 500;
const MARGIN = 5;

/**
 * The clock of the attempt on screen not yet added to the run, whether it is ticking, and
 * whether a run is on screen at all (a watched replay too).
 */
const live = { ms: 0, ticking: false, onRun: false };

/** One attempt's game clock, added to the full-game run as it goes. */
export class FullGameAttempt {
  private counted = 0;
  private readonly counts: boolean;

  /** `counts`: the player's own run (a watched replay is not). */
  constructor(counts: boolean) {
    this.counts = counts;
  }

  /** Every frame: the attempt's clock, and whether it is being played (not paused or over). */
  frame(clock: number, playing: boolean): void {
    live.onRun = true;
    if (!this.counts) {
      // A replay watched leaves the total standing.
      live.ms = 0;
      live.ticking = false;
      return;
    }
    if (clock - this.counted >= BANK_EVERY_MS) this.bank(clock);
    live.ms = clock - this.counted;
    live.ticking = playing;
  }

  /** Adds the clock played since the last call to the run (at the finish, a restart, leaving). */
  bank(clock: number): void {
    if (!this.counts) return;
    if (clock > this.counted) addFullGameTime(clock - this.counted);
    this.counted = clock;
    live.ms = 0;
    live.ticking = false;
  }

  /** The run gave the screen to a menu (or closed): its clock is added, the timer moves. */
  leave(clock: number): void {
    this.bank(clock);
    live.onRun = false;
  }
}

/** A mission of `levelId` was done for the first time: the split, if that completed the level. */
export function splitIfLevelDone(ctx: GameContext, levelId: number, progress: Progress): void {
  const levels = ctx.content.missions.levels;
  if (!isLevelComplete(progress, levels, levelId)) return;
  // The last level's split ends the run: nothing played after it counts.
  if (splitFullGame(levelId).splits.length >= levels.length) finishFullGame();
}

/** The finished run's time and the best (it, when it is a new one); null while it runs. */
export function finishedFullGame(): { timeMs: number; bestMs: number; newBest: boolean } | null {
  const time = loadFullGameRun().finishedMs;
  if (time === null) return null;
  const bestMs = loadFullGameBest()?.totalMs ?? time;
  return { timeMs: time, bestMs, newBest: bestMs >= time };
}

/** The gap to the best at the run's last split, or null without a best or a split. */
function lastSplitGap(): { text: string; ahead: boolean } | null {
  const run = loadFullGameRun();
  const last = run.splits[run.splits.length - 1];
  const best = last ? loadFullGameBest()?.splits.find((s) => s.levelId === last.levelId) : null;
  if (!last || !best) return null;
  const gap = last.totalMs - best.totalMs;
  return { text: formatGap(gap, 1), ahead: gap <= 0 };
}

/** The keys pressed in the player's runs, popping out beside the timer (Options). */
export const runPresses = new PressPopups();
/** How far a press's chevron flies (out of the timer, or down without it), logical px. */
const PRESS_FLIGHT = 26;

/**
 * Over every screen: in a run, the timer at the top centre with the pressed keys flying out to
 * its left and the gap at the last split to its right; in the menus, the timer and the gap in
 * the bottom-right corner. The keys show as the option says, the timer while it is shown.
 */
export function drawSpeedrunOverlay(ctx: GameContext, c: CanvasRenderingContext2D): void {
  const { viewport, fonts, options } = ctx;
  const showTimer = options.fullGameTimer;
  if (!showTimer && !(live.onRun && options.inputDisplay)) return;
  const run = loadFullGameRun();
  const finished = run.finishedMs !== null;
  const text = showTimer ? formatTime(run.finishedMs ?? run.totalMs + live.ms) : '';
  const color = finished ? Theme.success : live.ticking ? Theme.text : Theme.muted;
  const gap = showTimer ? lastSplitGap() : null;
  const gapColor = gap?.ahead ? Theme.success : Theme.danger;
  if (live.onRun) {
    const x =
      viewport.safeArea.left +
      ((viewport.width - viewport.safeArea.left - viewport.safeArea.right) >> 1);
    const y = MARGIN + viewport.safeArea.top;
    const half = showTimer ? fonts.text.measure(text) >> 1 : 0;
    const middle = y + (fonts.text.lineHeight >> 1);
    if (showTimer) {
      outlined(c, fonts.text, text, x, y, { align: 'center', color, tabular: true });
    }
    if (gap) {
      const gy = middle - (fonts.small.lineHeight >> 1);
      outlined(c, fonts.small, gap.text, x + half + 6, gy, { color: gapColor, tabular: true });
    }
    // Out of the timer's left side, or down from the top centre while the timer is hidden.
    if (options.inputDisplay) {
      if (showTimer) runPresses.draw(c, x - half - 8, middle, -PRESS_FLIGHT, 0);
      else runPresses.draw(c, x, middle, 0, PRESS_FLIGHT);
    }
    return;
  }
  const right = viewport.width - MARGIN - viewport.safeArea.right;
  const y = viewport.height - MARGIN - viewport.safeArea.bottom - fonts.text.lineHeight;
  outlined(c, fonts.text, text, right, y, { align: 'right', color, tabular: true });
  if (gap) {
    outlined(c, fonts.small, gap.text, right, y - fonts.small.lineHeight - 1, {
      align: 'right',
      color: gapColor,
      tabular: true,
    });
  }
}
