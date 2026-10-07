/**
 * Collects press bits per frame exactly like the original (`d.java` lines 5185–5197): only
 * key-down events count (no auto-repeat), RIGHT/LEFT also set FORWARD or BACK depending on the
 * facing at the moment of the press, and everything pressed since the last `consume()` is OR-ed
 * together. Keyboard, gamepad (polled, edge-detected) and the on-screen touch buttons all feed
 * the same accumulator. Menus read a separate UI stream (`consumeUi`).
 */
import type { UiKey, UiPointer } from '../app/Screen.ts';
import type { Viewport } from '../render/Viewport.ts';
import type { TouchControls } from './TouchControls.ts';

/** Press bits as the simulation reads them (`Input` in @parapet/sim). */
export const Press = {
  UP: 1,
  DOWN: 2,
  RIGHT: 4,
  LEFT: 8,
  FORWARD: 16,
  BACK: 32,
} as const;

export type Direction = 'up' | 'down' | 'left' | 'right';
export type UiAction = UiKey['action'];
export type InputSource = 'keyboard' | 'gamepad' | 'touch' | 'mouse';

export type UiEvent =
  | { type: 'key'; key: UiKey; source: InputSource }
  | { type: 'pointer'; pointer: UiPointer; pointerType: string; pointerId: number };

export interface InputManagerOptions {
  viewport: Viewport;
  /** Facing of the player at press time; decides FORWARD/BACK for left/right presses. */
  facingRight: () => boolean;
  touch?: TouchControls | null;
  /** Element receiving keyboard events (default: window). */
  keyTarget?: EventTarget;
}

const KEY_DIRECTIONS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

const KEY_ACTIONS: Readonly<Record<string, UiAction>> = {
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  Escape: 'back',
  Backspace: 'back',
  KeyP: 'pause',
};

/** Standard gamepad mapping: d-pad 12–15, A/B 0/1, Select/Start 8/9. */
const GAMEPAD_DIRECTIONS: Readonly<Record<number, Direction>> = {
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
};

const GAMEPAD_ACTIONS: Readonly<Record<number, UiAction>> = {
  0: 'confirm',
  1: 'back',
  8: 'back',
  9: 'pause',
};

const STICK_DEADZONE = 0.5;

/** Press bits for a direction, resolving FORWARD/BACK from the facing like the original. */
export function pressBits(direction: Direction, facingRight: boolean): number {
  switch (direction) {
    case 'up':
      return Press.UP;
    case 'down':
      return Press.DOWN;
    case 'right':
      return Press.RIGHT | (facingRight ? Press.FORWARD : Press.BACK);
    case 'left':
      return Press.LEFT | (facingRight ? Press.BACK : Press.FORWARD);
  }
}

interface GamepadState {
  buttons: boolean[];
  stickX: number;
  stickY: number;
}

function quantize(axis: number): number {
  if (axis <= -STICK_DEADZONE) return -1;
  if (axis >= STICK_DEADZONE) return 1;
  return 0;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

export class InputManager {
  private bits = 0;
  private ui: UiEvent[] = [];
  private readonly gamepads = new Map<number, GamepadState>();
  /** Pointers currently holding a touch button, so their move/up events are not UI events. */
  private readonly capturedPointers = new Map<number, Direction>();
  private readonly viewport: Viewport;
  private readonly facingRight: () => boolean;
  private touch: TouchControls | null;
  private readonly keyTarget: EventTarget;

  constructor(opts: InputManagerOptions) {
    this.viewport = opts.viewport;
    this.facingRight = opts.facingRight;
    this.touch = opts.touch ?? null;
    this.keyTarget = opts.keyTarget ?? window;
    this.keyTarget.addEventListener('keydown', this.onKeyDown as EventListener);
    const canvas = this.viewport.canvas;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  get touchControls(): TouchControls | null {
    return this.touch;
  }

  setTouchControls(touch: TouchControls | null): void {
    this.touch?.releaseAll();
    this.capturedPointers.clear();
    this.touch = touch;
  }

  /** Registers a direction press from any source (also a UI navigation key). */
  press(direction: Direction, source: InputSource = 'keyboard'): void {
    this.bits |= pressBits(direction, this.facingRight());
    this.ui.push({ type: 'key', key: { action: direction }, source });
  }

  /** Registers a UI action (confirm/back/pause). */
  action(action: UiAction, source: InputSource = 'keyboard'): void {
    this.ui.push({ type: 'key', key: { action }, source });
  }

  /** Press bits accumulated since the last call; clears them. */
  consume(): number {
    const bits = this.bits;
    this.bits = 0;
    return bits;
  }

  /** Press bits accumulated so far, without clearing them. */
  peek(): number {
    return this.bits;
  }

  /** UI events (keys and pointer) since the last call; clears them. */
  consumeUi(): UiEvent[] {
    if (this.ui.length === 0) return [];
    const events = this.ui;
    this.ui = [];
    return events;
  }

  /** Drops everything pending (e.g. when a screen changes). */
  clear(): void {
    this.bits = 0;
    this.ui = [];
  }

  /** Polls connected gamepads; call once per frame before `consume()`. */
  pollGamepads(): void {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    let pads: (Gamepad | null)[];
    try {
      pads = navigator.getGamepads();
    } catch {
      return;
    }
    const seen = new Set<number>();
    for (const pad of pads) {
      if (!pad) continue;
      seen.add(pad.index);
      let state = this.gamepads.get(pad.index);
      if (!state) {
        state = { buttons: [], stickX: 0, stickY: 0 };
        this.gamepads.set(pad.index, state);
      }
      for (let i = 0; i < pad.buttons.length; i++) {
        const button = pad.buttons[i];
        const pressed = button !== undefined && (button.pressed || button.value > 0.5);
        const was = state.buttons[i] ?? false;
        state.buttons[i] = pressed;
        if (pressed && !was) {
          const direction = GAMEPAD_DIRECTIONS[i];
          if (direction) this.press(direction, 'gamepad');
          const action = GAMEPAD_ACTIONS[i];
          if (action) this.action(action, 'gamepad');
        }
      }
      const x = quantize(pad.axes[0] ?? 0);
      const y = quantize(pad.axes[1] ?? 0);
      if (x !== state.stickX) {
        if (x < 0) this.press('left', 'gamepad');
        else if (x > 0) this.press('right', 'gamepad');
        state.stickX = x;
      }
      if (y !== state.stickY) {
        if (y < 0) this.press('up', 'gamepad');
        else if (y > 0) this.press('down', 'gamepad');
        state.stickY = y;
      }
    }
    for (const index of this.gamepads.keys()) {
      if (!seen.has(index)) this.gamepads.delete(index);
    }
  }

  dispose(): void {
    this.keyTarget.removeEventListener('keydown', this.onKeyDown as EventListener);
    const canvas = this.viewport.canvas;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerUp);
    canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.clear();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return; // the original counts key-down events only
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (isEditable(event.target)) return;
    const direction = KEY_DIRECTIONS[event.code];
    if (direction) {
      this.press(direction, 'keyboard');
      event.preventDefault();
      return;
    }
    const action = KEY_ACTIONS[event.code];
    if (action) {
      if (event.code === 'Space' || event.code === 'Backspace') event.preventDefault();
      this.action(action, 'keyboard');
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    const { x, y } = this.viewport.toLogical(event.clientX, event.clientY);
    const touch = this.touch;
    if (touch?.enabled) {
      const direction = touch.hitTest(x, y);
      if (direction) {
        this.capturedPointers.set(event.pointerId, direction);
        touch.setPressed(event.pointerId, direction);
        this.press(direction, event.pointerType === 'touch' ? 'touch' : 'mouse');
        event.preventDefault();
        return;
      }
    }
    this.pushPointer(event, x, y, 'down');
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.capturedPointers.has(event.pointerId)) return;
    const { x, y } = this.viewport.toLogical(event.clientX, event.clientY);
    // Coalesce moves of the same pointer within a frame: keep only the latest position.
    const last = this.ui[this.ui.length - 1];
    if (
      last?.type === 'pointer' &&
      last.pointer.type === 'move' &&
      last.pointerId === event.pointerId
    ) {
      this.ui.pop();
    }
    this.pushPointer(event, x, y, 'move');
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.capturedPointers.delete(event.pointerId)) {
      this.touch?.release(event.pointerId);
      return;
    }
    const { x, y } = this.viewport.toLogical(event.clientX, event.clientY);
    this.pushPointer(event, x, y, 'up');
  };

  private readonly onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private pushPointer(event: PointerEvent, x: number, y: number, type: UiPointer['type']): void {
    this.ui.push({
      type: 'pointer',
      pointer: { x, y, type },
      pointerType: event.pointerType,
      pointerId: event.pointerId,
    });
  }
}

let vibrationEnabled = true;

/** Master switch for `vibrate()` (the "vibration" option). */
export function setVibrationEnabled(enabled: boolean): void {
  vibrationEnabled = enabled;
}

export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * Vibrates for `pattern` ms (or an on/off pattern) when the device supports it and the option
 * is on. The original has no sound effects: a failed trick buzzes the phone instead.
 */
export function vibrate(pattern: number | number[]): boolean {
  if (!vibrationEnabled || !isVibrationSupported()) return false;
  // Browsers refuse (and log) vibration before the user has interacted with the page.
  const activation = (navigator as { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (activation && !activation.hasBeenActive) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
