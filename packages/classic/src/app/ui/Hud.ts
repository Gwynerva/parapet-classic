/**
 * In-game overlay: timer, score, flow meter, checkpoint dots / flags left and score popups.
 * Positions follow the original (timer top-left, score top-right, dots under the timer) but
 * respect the safe area of the device. Every text is outlined and digits are tabular: the sky
 * behind the overlay ranges from near white (theme 0) to night blue, and a timer must not
 * jitter as its digits change width.
 *
 * The timer follows `aW()` (d.java line 9862): elapsed time in a sprint, a countdown in flag
 * hunts, score runs and challenges (blinking in the last 10 s), nothing in the warm-ups.
 */
import { MissionType, type World } from '@parapet/sim';
import { formatTime, Theme, type Fonts } from '../Context.ts';
import type { Viewport } from '@parapet/runtime/render/Viewport.ts';
import type { I18n } from '@parapet/runtime/i18n/i18n.ts';
import { outlined } from '@parapet/runtime/ui/draw.ts';

const METER_MAX = 5120;
const MULTIPLIERS = [1, 2, 4, 6, 8, 10];
const METER_WIDTH = 60;
const METER_HEIGHT = 5;
const DOT_SIZE = 8;
const DOT_PITCH = 11;

export interface HudOptions {
  /** 'elapsed' shows the clock, 'countdown' the time left of `limitMs`, 'none' no timer. */
  timer: 'elapsed' | 'countdown' | 'none';
  /** Time limit the countdown runs against, in ms. */
  limitMs: number;
  /** Mode label under the timer (free run), or an empty string. */
  label: string;
}

export class Hud {
  private readonly fonts: Fonts;
  private readonly i18n: I18n;

  constructor(fonts: Fonts, i18n: I18n) {
    this.fonts = fonts;
    this.i18n = i18n;
  }

  draw(ctx: CanvasRenderingContext2D, world: World, viewport: Viewport, opts: HudOptions): void {
    const { small, display } = this.fonts;
    const left = 5 + viewport.safeArea.left;
    const top = 5 + viewport.safeArea.top;
    const right = viewport.width - 5 - viewport.safeArea.right;
    const player = world.player;
    const score = player.score;
    const rules = world.rules;

    let timerShown = false;
    if (opts.timer === 'elapsed') {
      outlined(ctx, display, formatTime(world.clock), left, top, {
        color: Theme.text,
        tabular: true,
      });
      timerShown = true;
    } else if (opts.timer === 'countdown') {
      const remaining = Math.max(0, opts.limitMs - world.clock);
      // The last ten seconds blink: hidden for a quarter of every second.
      const hidden = remaining <= 10000 && remaining % 1000 >= 750;
      if (!hidden) {
        outlined(ctx, display, formatTime(remaining), left, top, {
          color: remaining <= 10000 ? Theme.danger : Theme.text,
          tabular: true,
        });
      }
      timerShown = true;
    }

    // Score and multiplier.
    if (score) {
      outlined(ctx, display, String(score.score), right, top, {
        align: 'right',
        color: Theme.text,
        tabular: true,
      });
      const mult = MULTIPLIERS[Math.min(5, score.meter >> 10)] ?? 1;
      const barX = right - METER_WIDTH;
      const barY = top + display.lineHeight + 3;
      ctx.fillStyle = '#000000';
      ctx.fillRect(barX - 1, barY - 1, METER_WIDTH + 2, METER_HEIGHT + 2);
      ctx.fillStyle = Theme.panelBorder;
      ctx.fillRect(barX, barY, METER_WIDTH, METER_HEIGHT);
      ctx.fillStyle = score.meterFlash < 0 ? Theme.danger : Theme.accent;
      ctx.fillRect(barX, barY, Math.round((METER_WIDTH * score.meter) / METER_MAX), METER_HEIGHT);
      outlined(ctx, small, `x${mult}`, barX - 4, barY - 3, {
        align: 'right',
        color: Theme.accent,
        tabular: true,
      });

      // Popups: the chain values queued by the scoring code, newest at the bottom.
      let py = barY + 10;
      for (const popup of score.popups) {
        if (popup.until <= world.clock) continue;
        outlined(ctx, small, `+${popup.value}`, right, py, {
          align: 'right',
          color: Theme.success,
          tabular: true,
        });
        py += small.lineHeight;
      }
    }

    // Mission progress.
    const dotsY = top + (timerShown ? display.lineHeight + 4 : 0);
    if (rules.missionType === MissionType.SPRINT) {
      const count = world.level.checkpoints.length;
      for (let i = 0; i < count; i++) {
        const taken = (rules.remainingMask & (1 << i)) === 0;
        const next = !taken && (i === 0 || (rules.remainingMask & (1 << (i - 1))) === 0);
        const x = left + i * DOT_PITCH;
        ctx.fillStyle = '#000000';
        ctx.fillRect(x - 1, dotsY - 1, DOT_SIZE + 2, DOT_SIZE + 2);
        ctx.fillStyle = taken ? Theme.success : next ? Theme.accent : Theme.panelBorder;
        ctx.fillRect(x, dotsY, DOT_SIZE, DOT_SIZE);
      }
      if (opts.label) {
        outlined(ctx, small, opts.label, left, dotsY + DOT_SIZE + 4, { color: Theme.muted });
      }
    } else if (rules.missionType === MissionType.FLAG_HUNT) {
      outlined(ctx, small, this.i18n.t('hud.flagsLeft', { n: rules.flagsLeft }), left, dotsY, {
        color: Theme.text,
        tabular: true,
      });
    } else if (rules.missionType === MissionType.CHALLENGE && world.level.checkpoints.length > 0) {
      const taken = rules.flagsLeft === 0;
      ctx.fillStyle = '#000000';
      ctx.fillRect(left - 1, dotsY - 1, DOT_SIZE + 2, DOT_SIZE + 2);
      ctx.fillStyle = taken ? Theme.success : Theme.accent;
      ctx.fillRect(left, dotsY, DOT_SIZE, DOT_SIZE);
    } else if (opts.label) {
      outlined(ctx, small, opts.label, left, dotsY, { color: Theme.muted });
    }
  }
}
