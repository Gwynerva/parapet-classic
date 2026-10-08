/**
 * Measuring the space the game has, without the DOM: which size to trust, and when to look
 * again. Browsers report a size change late or not at all in a few cases (rotation on phones,
 * the address bar sliding away, a window dragged to a monitor with another pixel ratio, leaving
 * full screen), so the viewport re-measures a few times after every hint of a change.
 */

export interface Size {
  width: number;
  height: number;
}

export interface SizeSample {
  /** Exact device pixels of the container (ResizeObserver's device-pixel-content-box). */
  devicePixels?: Size | null;
  /** The container's CSS size. */
  css: Size;
  dpr: number;
}

/**
 * The container's size in device pixels. The exact device-pixel size wins while it agrees with
 * the CSS size (it may be a frame old: ResizeObserver reports after the frame that changed it).
 */
export function physicalSize(sample: SizeSample): Size {
  const fromCss = {
    width: Math.max(1, Math.round(sample.css.width * sample.dpr)),
    height: Math.max(1, Math.round(sample.css.height * sample.dpr)),
  };
  const exact = sample.devicePixels;
  if (
    exact &&
    exact.width > 0 &&
    exact.height > 0 &&
    Math.abs(exact.width - fromCss.width) <= Math.ceil(sample.dpr) &&
    Math.abs(exact.height - fromCss.height) <= Math.ceil(sample.dpr)
  ) {
    return { width: exact.width, height: exact.height };
  }
  return fromCss;
}

/** Delays (ms) after a change signal at which the size is measured again. */
export const SETTLE_CHECKS_MS: readonly number[] = [0, 120, 350, 800];

/** When to measure again after change signals; times come from the caller (testable). */
export class SettleSchedule {
  private readonly pending: number[] = [];
  private readonly checks: readonly number[];

  constructor(checks: readonly number[] = SETTLE_CHECKS_MS) {
    this.checks = checks;
  }

  /** A change was hinted at `now`: measure now and a few times while things settle. */
  trigger(now: number): void {
    this.pending.length = 0;
    for (const delay of this.checks) this.pending.push(now + delay);
  }

  /** Whether a check is due at `now` (consumes every check that is). */
  due(now: number): boolean {
    let hit = false;
    while (this.pending.length > 0 && this.pending[0]! <= now) {
      this.pending.shift();
      hit = true;
    }
    return hit;
  }

  get idle(): boolean {
    return this.pending.length === 0;
  }
}
