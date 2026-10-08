/**
 * Screens are the UI states of the client (title, level select, play, pause, results).
 * They are stacked: the top screen receives input; screens below may still render
 * (e.g. the play screen under a pause overlay).
 */

export interface UiPointer {
  /** Logical canvas coordinates. */
  x: number;
  y: number;
  /** `cancel`: the browser took the pointer over (a scroll, a system gesture); nothing fires. */
  type: 'down' | 'up' | 'move' | 'cancel';
  /** `mouse`, `touch` or `pen` (absent for synthetic events). */
  pointerType?: string;
  id?: number;
}

/** Where a UI action came from; `system` is the phone's or browser's Back. */
export type UiSource = 'keyboard' | 'gamepad' | 'touch' | 'mouse' | 'system';

export interface UiKey {
  /**
   * Abstract UI action derived from keyboard/gamepad/touch. `next`/`prev` are Tab and
   * Shift+Tab; `fullscreen` (F) only ever arrives as a gesture.
   */
  action:
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'confirm'
    | 'back'
    | 'pause'
    | 'next'
    | 'prev'
    | 'fullscreen';
  source?: UiSource;
}

/** A mouse wheel or touchpad scroll; `dy` in logical pixels, positive scrolls down. */
export interface UiWheel {
  x: number;
  y: number;
  dy: number;
}

/** What the frame around a screen shows (drawn by the client, not by the screen). */
export interface ScreenChrome {
  /** The full-screen corner button. */
  fullscreenButton?: boolean;
}

/**
 * A press delivered synchronously, inside the browser's own input event handler. Browsers
 * allow clipboard writes, downloads and file dialogs only there ("user activation"); the
 * regular UI events are queued until the next frame, which is too late on Safari and iOS.
 * Keyboard confirm, mouse presses and touch/pen releases arrive here first.
 */
export type UiGesture =
  | { kind: 'key'; action: UiKey['action'] }
  | { kind: 'pointer'; x: number; y: number; type: 'down' | 'up'; pointerType: string };

export interface Screen {
  /** Called when the screen becomes the top of the stack. */
  enter?(): void;
  /** Called when the screen is removed or covered. */
  exit?(): void;
  /** Simulation-time update; `dt` is real elapsed milliseconds. */
  update(dt: number): void;
  /** Draw the screen; `alpha` is the interpolation fraction between simulation steps. */
  render(ctx: CanvasRenderingContext2D, alpha: number): void;
  /** Whether screens below this one should still be rendered. */
  readonly translucent?: boolean;
  readonly chrome?: ScreenChrome;
  onKey?(key: UiKey): void;
  onPointer?(p: UiPointer): void;
  onWheel?(w: UiWheel): void;
  /**
   * Handle a gesture synchronously; return true to consume it (it is then not queued as a
   * regular UI event). Only screens with actions that need user activation implement it.
   */
  onGesture?(g: UiGesture): boolean;
  onResize?(): void;
}

export class ScreenStack {
  private readonly screens: Screen[] = [];

  get top(): Screen | undefined {
    return this.screens[this.screens.length - 1];
  }

  get size(): number {
    return this.screens.length;
  }

  push(screen: Screen): void {
    this.top?.exit?.();
    this.screens.push(screen);
    screen.enter?.();
  }

  pop(): Screen | undefined {
    const removed = this.screens.pop();
    removed?.exit?.();
    this.top?.enter?.();
    return removed;
  }

  replace(screen: Screen): void {
    const removed = this.screens.pop();
    removed?.exit?.();
    this.screens.push(screen);
    screen.enter?.();
  }

  clear(screen: Screen): void {
    while (this.screens.length > 0) {
      this.screens.pop()?.exit?.();
    }
    this.screens.push(screen);
    screen.enter?.();
  }

  update(dt: number): void {
    this.top?.update(dt);
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    let first = this.screens.length - 1;
    while (first > 0 && this.screens[first]!.translucent) {
      first--;
    }
    for (let i = first; i < this.screens.length; i++) {
      this.screens[i]!.render(ctx, alpha);
    }
  }

  onKey(key: UiKey): void {
    this.top?.onKey?.(key);
  }

  onPointer(p: UiPointer): void {
    this.top?.onPointer?.(p);
  }

  onWheel(w: UiWheel): void {
    this.top?.onWheel?.(w);
  }

  onGesture(g: UiGesture): boolean {
    return this.top?.onGesture?.(g) ?? false;
  }

  onResize(): void {
    for (const s of this.screens) {
      s.onResize?.();
    }
  }
}
