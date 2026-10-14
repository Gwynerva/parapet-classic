/**
 * Press feedback for anything tappable: a target shows as pressed while the pointer is down on
 * it and fires on release over the same target, like a native button. Moving a finger further
 * than a few pixels turns the press into a drag (a scroll), which fires nothing; so does a
 * cancelled pointer.
 */
import type { UiPointer } from '../app/Screen.ts';

/** Movement (logical px) after which a press becomes a drag. */
export const DRAG_THRESHOLD = 6;

export class PressTracker<Id> {
  /** The target under a pointer that is down, or null. */
  pressed: Id | null = null;
  /** The pointer moved past the threshold since it went down. */
  dragging = false;
  /** Whether a pointer is down at all (on a target or not). */
  down = false;
  startX = 0;
  startY = 0;
  pointerType = 'mouse';

  /** A pointer went down on `target` (null: on no target). */
  press(target: Id | null, p: UiPointer): void {
    this.pressed = target;
    this.down = true;
    this.dragging = false;
    this.startX = p.x;
    this.startY = p.y;
    this.pointerType = p.pointerType ?? 'mouse';
  }

  /**
   * The pointer moved; returns true when it has just become a drag. `hit` is the target now
   * under it: leaving the pressed target releases the press (it still fires nothing).
   */
  move(p: UiPointer, hit?: Id | null): boolean {
    if (!this.down) return false;
    if (hit !== undefined && hit !== this.pressed) this.pressed = null;
    if (this.dragging) return false;
    if (
      Math.abs(p.x - this.startX) > DRAG_THRESHOLD ||
      Math.abs(p.y - this.startY) > DRAG_THRESHOLD
    ) {
      this.dragging = true;
      this.pressed = null;
      return true;
    }
    return false;
  }

  /** The pointer was released over `hit`: returns the target to fire, or null. */
  release(hit: Id | null): Id | null {
    const pressed = this.pressed;
    const fire = this.down && !this.dragging && pressed !== null && pressed === hit;
    this.reset();
    return fire ? pressed : null;
  }

  reset(): void {
    this.pressed = null;
    this.down = false;
    this.dragging = false;
  }

  /** Whole rows of `pitch` px a finger dragging from where it went down has moved (up: +). */
  dragRows(p: UiPointer, pitch: number): number {
    return Math.round((this.startY - p.y) / pitch);
  }
}

/** A touch or a pen (they scroll by dragging and do not hover), not a mouse. */
export function isFinger(p: UiPointer): boolean {
  return p.pointerType !== undefined && p.pointerType !== 'mouse';
}

/** The mouse wheel in whole rows: what is left of a row waits for the next turn. */
export class WheelRows {
  private rest = 0;

  /** Rows to scroll for a wheel turn of `dy` px over rows `pitch` px high. */
  take(dy: number, pitch: number): number {
    this.rest += dy;
    const rows = Math.trunc(this.rest / pitch);
    this.rest -= rows * pitch;
    return rows;
  }
}

/**
 * Actions that need the browser's user activation (a link, the clipboard, a file dialog): a
 * mouse press fires at once, a finger or a pen on release over the target it went down on.
 */
export class GestureArm<Id> {
  private armed: Id | null = null;

  /** A pointer went down on `target`: true when the action fires now (a mouse). */
  down(target: Id, pointerType: string | undefined): boolean {
    this.armed = null;
    if ((pointerType ?? 'mouse') === 'mouse') return true;
    this.armed = target;
    return false;
  }

  /** A press waits for its release (the target shows as pressed). */
  get waiting(): boolean {
    return this.armed !== null;
  }

  /** A pointer went down on nothing: forgets an armed press. */
  clear(): void {
    this.armed = null;
  }

  /** The pointer came up over `target`: null when nothing was armed, else whether it fires. */
  up(target: Id | null): boolean | null {
    const armed = this.armed;
    this.armed = null;
    return armed === null ? null : target === armed;
  }
}
