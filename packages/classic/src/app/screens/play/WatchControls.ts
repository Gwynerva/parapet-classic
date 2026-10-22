/**
 * Watching a replay, like a video: a bar across the bottom of the screen with the whole run as
 * a timeline, every press marked on it where it happens (the four keys in their colours,
 * overlapping where presses crowd), the place reached so far, and the time. A press pops up
 * over the play head as it plays and fades away. A tap or a drag on the timeline goes to that
 * moment (the run is deterministic: going back re-runs it from the start); below it, the way
 * to the pause menu (a phone has no other while the touch buttons are away), the speed (¼× to
 * 4×), a pause and frame-by-frame steps.
 *
 * Keys: up and down change the speed, confirm (Space, Enter) pauses, right and left step one
 * frame forward or back (pausing first).
 */
import { STEP, type InputRun } from '@parapet/sim';
import type { UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import { Button } from '@parapet/runtime/ui/Button.ts';
import { framedBox, outlined } from '@parapet/runtime/ui/draw.ts';
import { contains, rowHeight } from '@parapet/runtime/ui/layout.ts';
import { formatTime, Theme, type GameContext } from '../../Context.ts';
import { chevron, PRESS_KEYS, PressPopups } from '../../ui/PressChevrons.ts';

const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
const NORMAL = SPEEDS.indexOf(1);
const MARGIN = 5;
const GAP = 3;
const TRACK_H = 17;
/** A press on the timeline: its chevron's half width, depth (logical px) and line (screen px). */
const MARK_W = 1.8;
const MARK_D = 1.6;
const MARK_LINE = 2;
const POPUP_RISE = 22;
const BAR_BACKGROUND = 'rgba(16, 20, 24, 0.82)';
/** The played part of the timeline: the accent, faint. */
const PLAYED = 'rgba(255, 176, 0, 0.28)';
const BANDS = 3;

type Control = 'menu' | 'slower' | 'faster' | 'pause' | 'step';
const ORDER: readonly Control[] = ['menu', 'slower', 'faster', 'pause', 'step'];
/** The buttons shrink to this on a narrow screen. */
const MIN_BUTTON = 14;

interface Press {
  /** The step the press is read on (0-based). */
  step: number;
  bits: number;
}

export interface WatchHost {
  /** Runs the replay to `step` (back means from the start again). */
  seek(step: number): void;
  /** Opens the pause menu (go on, start over, leave). */
  openMenu(): void;
}

export class WatchControls {
  private readonly ctx: GameContext;
  private readonly host: WatchHost;
  private speedIndex = NORMAL;
  paused = false;
  /** Frames asked for one by one and not run yet. */
  private steps = 0;
  private readonly presses: Press[] = [];
  /** Steps of the whole run. */
  private readonly total: number;
  private readonly buttons = new Map<Control, Button>(ORDER.map((c) => [c, new Button()]));
  private readonly popups = new PressPopups();
  private label = { x: 0, y: 0 };
  private timeX = 0;
  private timeY = 0;
  private track = { x: 0, y: 0, w: 1, h: TRACK_H };
  /** The step a drag on the timeline points at (null: no drag). */
  private dragStep: number | null = null;
  /** Where the drag wants the replay, run once a frame at most (`takeSeek`). */
  private pendingSeek: number | null = null;
  /** The top of the bar. */
  private top = 0;

  constructor(ctx: GameContext, input: readonly InputRun[], host: WatchHost) {
    this.ctx = ctx;
    this.host = host;
    let step = 0;
    for (const run of input) {
      if (run.bits !== 0) {
        for (let i = 0; i < run.ticks; i++) this.presses.push({ step: step + i, bits: run.bits });
      }
      step += run.ticks;
    }
    this.total = Math.max(1, step);
    this.place();
  }

  /** Real time runs this much faster through the replay. */
  get speed(): number {
    return SPEEDS[this.speedIndex] ?? 1;
  }

  /** The frames asked for since the last call (stepping happens only while paused). */
  takeSteps(): number {
    const n = this.steps;
    this.steps = 0;
    return n;
  }

  /** A step played with these bits: its keys pop up over the play head. */
  pressed(bits: number): void {
    this.popups.pressed(bits);
  }

  /** The replay jumped in time: the popups and the steps asked for belong to before. */
  jumped(): void {
    this.popups.clear();
    this.steps = 0;
  }

  /** The step the timeline was dragged to since the last call, or null. */
  takeSeek(): number | null {
    const step = this.pendingSeek;
    this.pendingSeek = null;
    return step;
  }

  place(): void {
    const { viewport, fonts } = this.ctx;
    const left = viewport.safeArea.left + MARGIN;
    const right = viewport.width - viewport.safeArea.right - MARGIN;
    // One row: - ×1 + || >| and the time in two lines at the right; the buttons shrink to fit.
    const labelW = fonts.text.measure('×0.25') + 2 * GAP;
    const timeW = fonts.small.measure('/ 00:00.00') + 2 * GAP;
    let size = rowHeight(20, viewport.isCoarsePointer);
    const rowW = (n: number): number => ORDER.length * (n + 4 + GAP) + labelW + timeW;
    while (size > MIN_BUTTON && rowW(size) > right - left) size -= 2;
    const rowH = Math.max(size, 2 * fonts.small.lineHeight + 2);
    const rowY = viewport.height - viewport.safeArea.bottom - MARGIN - rowH;
    const buttonY = rowY + ((rowH - size) >> 1);
    this.track = { x: left, y: rowY - GAP - TRACK_H, w: Math.max(1, right - left), h: TRACK_H };
    this.top = this.track.y - GAP;
    let x = left;
    for (const control of ORDER) {
      const button = this.buttons.get(control)!;
      button.rect = { x, y: buttonY, w: size + 4, h: size };
      button.slop = 2;
      x += size + 4 + GAP;
      // The speed between its two buttons.
      if (control === 'slower') {
        this.label = {
          x: x + (labelW >> 1) - GAP,
          y: rowY + ((rowH - fonts.text.lineHeight) >> 1),
        };
        x += labelW;
      }
    }
    this.timeX = right;
    this.timeY = rowY + ((rowH - 2 * fonts.small.lineHeight - 2) >> 1);
  }

  private run(control: Control): void {
    switch (control) {
      case 'menu':
        this.host.openMenu();
        break;
      case 'slower':
        this.speedIndex = Math.max(0, this.speedIndex - 1);
        break;
      case 'faster':
        this.speedIndex = Math.min(SPEEDS.length - 1, this.speedIndex + 1);
        break;
      case 'pause':
        this.paused = !this.paused;
        break;
      case 'step':
        if (this.paused) this.steps++;
        this.paused = true;
        break;
    }
  }

  /** Returns true when the key was a watching control; `step` is where the replay is. */
  onKey(key: UiKey, step: number): boolean {
    switch (key.action) {
      case 'up':
        this.run('faster');
        return true;
      case 'down':
        this.run('slower');
        return true;
      case 'confirm':
        this.run('pause');
        return true;
      case 'right':
        this.run('step');
        return true;
      case 'left':
        this.paused = true;
        if (step > 0) this.host.seek(step - 1);
        return true;
      default:
        return false;
    }
  }

  /** A drag on the timeline is under way: the replay waits for it. */
  get scrubbing(): boolean {
    return this.dragStep !== null;
  }

  private scrub(x: number): void {
    const step = this.stepAt(x);
    if (step === this.dragStep) return;
    this.dragStep = step;
    this.pendingSeek = step;
  }

  private stepAt(x: number): number {
    const t = (x - this.track.x) / this.track.w;
    return Math.round(Math.min(1, Math.max(0, t)) * this.total);
  }

  onPointer(p: UiPointer): boolean {
    const t = this.track;
    // A little more than the track takes a finger.
    const onTrack = contains({ x: t.x, y: t.y - 6, w: t.w, h: t.h + 10 }, p.x, p.y);
    // The game follows the drag frame by frame; the replay holds still under the finger.
    if (p.type === 'down' && onTrack) {
      this.scrub(p.x);
      return true;
    }
    if (this.dragStep !== null) {
      if (p.type === 'move' || p.type === 'up') this.scrub(p.x);
      if (p.type === 'up' || p.type === 'cancel') this.dragStep = null;
      return true;
    }
    for (const control of ORDER) {
      if (this.buttons.get(control)!.onPointer(p, () => this.run(control))) return true;
    }
    return false;
  }

  /** The bar; `step` is where the replay is. */
  draw(c: CanvasRenderingContext2D, step: number): void {
    const { fonts, viewport } = this.ctx;
    c.fillStyle = BAR_BACKGROUND;
    c.fillRect(0, this.top, viewport.width, viewport.height - this.top);
    // The timeline: the played part, the presses, the play head (or where a drag points).
    const t = this.track;
    const xOf = (s: number): number =>
      t.x + Math.round((Math.min(s, this.total) / this.total) * t.w);
    framedBox(c, t, Theme.panel, Theme.panelBorder);
    const head = xOf(this.dragStep ?? step);
    // The part played, faint: the presses on it stay in sight.
    c.fillStyle = PLAYED;
    c.fillRect(t.x + 1, t.y + 1, Math.max(0, xOf(step) - t.x - 1), t.h - 2);
    // Up at the top, left and right across the middle, down at the bottom.
    const band = Math.floor((t.h - 2) / BANDS);
    for (const press of this.presses) {
      const x = xOf(press.step);
      for (const key of PRESS_KEYS) {
        if (!(press.bits & key.bit)) continue;
        const y = t.y + 1 + key.band * band + band / 2;
        chevron(c, x, y, MARK_W, MARK_D, key.dir, key.color, MARK_LINE);
      }
    }
    c.fillStyle = Theme.text;
    c.fillRect(head - 1, t.y - 3, 2, t.h + 6);
    // The keys just pressed rise from the play head and fade.
    this.popups.draw(c, head, t.y - 6, 0, -POPUP_RISE);
    // The controls and the time.
    const labels: Record<Control, string> = {
      menu: '×',
      slower: '-',
      faster: '+',
      pause: this.paused ? '>' : '||',
      step: '>|',
    };
    for (const control of ORDER) {
      this.buttons.get(control)!.draw(c, fonts.text, labels[control], {
        color: control === 'pause' && this.paused ? Theme.accent : undefined,
      });
    }
    const speed = this.speed;
    outlined(c, fonts.text, `×${speed}`, this.label.x, this.label.y, {
      align: 'center',
      color: speed === 1 ? Theme.text : Theme.accent,
      tabular: true,
    });
    // The time reached over the run's whole time.
    const small = fonts.small;
    const look = { align: 'right', color: Theme.text, tabular: true } as const;
    outlined(c, small, formatTime((this.dragStep ?? step) * STEP), this.timeX, this.timeY, look);
    outlined(
      c,
      small,
      `/ ${formatTime(this.total * STEP)}`,
      this.timeX,
      this.timeY + small.lineHeight + 2,
      {
        ...look,
        color: Theme.muted,
      },
    );
  }
}
