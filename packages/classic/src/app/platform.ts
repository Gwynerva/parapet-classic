/**
 * The game's place in the browser: full screen (entered by the first tap on touch screens,
 * the corner button, F or the options), the phone's Back button kept inside the game, the
 * installed app's Exit, and the toasts that explain them.
 */
import type { UiGesture } from '@parapet/runtime/app/Screen.ts';
import { Fullscreen, isInstalledApp, isIOS } from '@parapet/runtime/platform/fullscreen.ts';
import { HistoryGuard, type BackDecision } from '@parapet/runtime/platform/HistoryGuard.ts';
import { saveOptions, wantsFullscreen } from '@parapet/runtime/storage/profile.ts';
import { Button } from '@parapet/runtime/ui/Button.ts';
import { BACK_BUTTON_SIZE, headingCenterY } from '@parapet/runtime/ui/draw.ts';
import { Theme } from '@parapet/runtime/ui/theme.ts';
import { Toast } from '@parapet/runtime/ui/Toast.ts';
import type { GameContext } from './Context.ts';

export interface Platform {
  fullscreen: Fullscreen;
  /** Started from the home screen or the app list: the whole screen, and Exit works. */
  installed: boolean;
  /** iPhone or iPad: no full screen in the browser, only from the home screen. */
  ios: boolean;
  history: HistoryGuard;
  toast: Toast;
  /** Whether the corner button and the options row can switch full screen here. */
  readonly canFullscreen: boolean;
  /** Switches full screen from a user gesture and remembers the choice. */
  toggleFullscreen(): void;
  /** The installed app's Exit: closes the window, or explains how when it cannot. */
  exit(): void;
}

export interface PlatformHooks {
  /** Back on the bottom screen: the player is warned, the next Back leaves. */
  isAtRoot: () => boolean;
  /** Back anywhere else: the game's own Back action. */
  back: () => void;
  /** The player left full screen by the browser's means (a run should pause). */
  onFullscreenLost: () => void;
}

export function createPlatform(ctx: GameContext, hooks: PlatformHooks): Platform {
  const fullscreen = new Fullscreen();
  const installed = isInstalledApp();
  const toast = new Toast();
  const onBack = (): BackDecision => {
    if (hooks.isAtRoot()) {
      toast.show(ctx.i18n.t('system.backAgain'));
      return 'leave';
    }
    hooks.back();
    return 'stay';
  };
  const history = new HistoryGuard(window, onBack);
  const platform: Platform = {
    fullscreen,
    installed,
    ios: isIOS(),
    history,
    toast,
    get canFullscreen(): boolean {
      return fullscreen.supported && !installed;
    },
    toggleFullscreen(): void {
      if (!platform.canFullscreen) return;
      const entering = !fullscreen.active;
      fullscreen.toggle();
      Object.assign(ctx.options, saveOptions({ fullscreen: entering ? 'on' : 'off' }));
    },
    exit(): void {
      history.standAside();
      window.close();
      // Browsers only let a page close a window a script opened; say how instead.
      setTimeout(() => toast.show(ctx.i18n.t('system.exitHint')), 300);
    },
  };

  fullscreen.onChange((active, byUser) => {
    if (active || !byUser) return;
    Object.assign(ctx.options, saveOptions({ fullscreen: 'off' }));
    toast.show(ctx.i18n.t('system.fullscreenOff'));
    hooks.onFullscreenLost();
  });

  // The first tap or key press: arm the Back guard and, when wanted, enter full screen. Both
  // need user activation, so they run inside the browser's own event handlers.
  let autoTried = false;
  const onActivation = (event: Event): void => {
    history.arm();
    if (autoTried) return;
    if (event.type === 'pointerup' && (event as PointerEvent).pointerType === 'mouse') {
      if (ctx.options.fullscreen !== 'on') return;
    }
    autoTried = true;
    if (
      platform.canFullscreen &&
      !fullscreen.active &&
      wantsFullscreen(ctx.options, ctx.viewport.isCoarsePointer)
    ) {
      void fullscreen.request();
    }
  };
  window.addEventListener('pointerup', onActivation, true);
  window.addEventListener('keydown', onActivation, true);
  return platform;
}

/** The full-screen button at the top-right of menu screens (`Screen.chrome`). */
export class FullscreenCorner {
  private readonly button = new Button();
  private readonly ctx: GameContext;
  private readonly platform: Platform;

  constructor(ctx: GameContext, platform: Platform) {
    this.ctx = ctx;
    this.platform = platform;
  }

  /** Whether the top screen shows the button. */
  get shown(): boolean {
    return this.platform.canFullscreen && this.ctx.screens.top?.chrome?.fullscreenButton === true;
  }

  private place(): void {
    const { viewport, fonts } = this.ctx;
    const size = BACK_BUTTON_SIZE;
    const centerY = headingCenterY(fonts.display, viewport.safeArea.top);
    this.button.rect = {
      x: viewport.width - viewport.safeArea.right - 6 - size,
      y: Math.round(centerY - size / 2),
      w: size,
      h: size,
    };
    this.button.slop = 9;
  }

  /** Taps and the F key, inside the browser's event handler (full screen needs it). */
  onGesture(g: UiGesture): boolean {
    if (g.kind === 'key') {
      if (g.action !== 'fullscreen' || !this.platform.canFullscreen) return false;
      this.platform.toggleFullscreen();
      return true;
    }
    if (!this.shown) return false;
    this.place();
    return this.button.onGesture(g, () => this.platform.toggleFullscreen());
  }

  draw(c: CanvasRenderingContext2D): void {
    if (!this.shown) return;
    this.place();
    const r = this.button.rect;
    this.button.draw(c, this.ctx.fonts.text, '');
    drawFullscreenIcon(c, r.x, r.y, r.w, this.platform.fullscreen.active, this.button.pressed);
  }
}

/** Four corner brackets: pointing out to enter full screen, in to leave it. */
function drawFullscreenIcon(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  active: boolean,
  pressed: boolean,
): void {
  c.fillStyle = pressed ? Theme.background : Theme.accent;
  const inset = 6;
  const arm = 4;
  const corners: [number, number, number, number][] = [
    [x + inset, y + inset, 1, 1],
    [x + size - inset - 1, y + inset, -1, 1],
    [x + inset, y + size - inset - 1, 1, -1],
    [x + size - inset - 1, y + size - inset - 1, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    // Entering: the bracket opens towards the middle; leaving: it opens towards the corner.
    const ox = active ? cx + dx * (arm - 1) : cx;
    const oy = active ? cy + dy * (arm - 1) : cy;
    const sx = active ? -dx : dx;
    const sy = active ? -dy : dy;
    c.fillRect(Math.min(ox, ox + sx * (arm - 1)), oy, arm, 1);
    c.fillRect(ox, Math.min(oy, oy + sy * (arm - 1)), 1, arm);
  }
}
