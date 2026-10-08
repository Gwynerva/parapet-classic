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
}
