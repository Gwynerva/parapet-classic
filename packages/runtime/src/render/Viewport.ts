/**
 * Logical canvas size and integer scale.
 *
 * The game draws at a small logical resolution scaled up by an integer factor, so pixels stay
 * square and crisp on any screen. The scale targets roughly 384 logical pixels of height (a
 * little more than the original 320) but never lets the logical size drop below the original
 * 240×320; the logical width is capped at 960 so ultra-wide screens get black margins instead of
 * a huge playfield.
 *
 * The canvas itself has the screen's pixels and its context is scaled by the factor: everything
 * drawn at whole logical pixels looks exactly as if a small canvas were stretched, but what moves
 * slower than the camera (the parallax layers) can be placed between logical pixels, a screen
 * pixel at a time, and glides instead of jumping a whole big pixel every few frames.
 */

import { physicalSize, SettleSchedule, type Size } from './viewportSize.ts';

export type ScaleMode = 'auto' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Orientation = 'landscape' | 'portrait';

/** Insets in logical pixels that the OS may cover (notches, home indicators, rounded corners). */
export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Layout {
  width: number;
  height: number;
  scale: number;
}

export type ViewportListener = (viewport: Viewport) => void;

export interface ViewportOptions {
  /** Element that receives the canvas; defaults to `#game`. */
  container?: HTMLElement | null;
  scaleMode?: ScaleMode;
  /** A fixed logical size (development: looking at a phone's layout on a desktop). */
  forceLogical?: { width: number; height: number } | null;
  /** Treat the pointer as a finger (development). */
  forceCoarse?: boolean;
}

export const MIN_LOGICAL_WIDTH = 240;
export const MIN_LOGICAL_HEIGHT = 320;
export const TARGET_LOGICAL_HEIGHT = 384;
export const MAX_LOGICAL_WIDTH = 960;
export const MAX_SCALE = 8;

export function isScaleMode(value: unknown): value is ScaleMode {
  return (
    value === 'auto' ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_SCALE)
  );
}

/** Integer scale for a physical (device pixel) window size. */
export function autoScale(physicalWidth: number, physicalHeight: number): number {
  let scale = Math.round(physicalHeight / TARGET_LOGICAL_HEIGHT);
  scale = Math.min(MAX_SCALE, Math.max(1, scale));
  while (
    scale > 1 &&
    (physicalWidth / scale < MIN_LOGICAL_WIDTH || physicalHeight / scale < MIN_LOGICAL_HEIGHT)
  ) {
    scale--;
  }
  return scale;
}

/** Logical size and scale for a physical window size (pure, for tests and tools). */
export function computeLayout(
  physicalWidth: number,
  physicalHeight: number,
  scaleMode: ScaleMode = 'auto',
): Layout {
  const pw = Math.max(1, Math.floor(physicalWidth));
  const ph = Math.max(1, Math.floor(physicalHeight));
  const scale =
    scaleMode === 'auto' ? autoScale(pw, ph) : Math.min(MAX_SCALE, Math.max(1, scaleMode));
  const width = Math.max(1, Math.min(MAX_LOGICAL_WIDTH, Math.floor(pw / scale)));
  const height = Math.max(1, Math.floor(ph / scale));
  return { width, height, scale };
}

/**
 * A fixed logical size at the largest integer scale that fits the physical size (development:
 * `?vp=292x633` shows a phone's layout on a desktop).
 */
export function computeForcedLayout(
  physicalWidth: number,
  physicalHeight: number,
  width: number,
  height: number,
): Layout {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const scale = Math.max(
    1,
    Math.min(MAX_SCALE, Math.floor(physicalWidth / w), Math.floor(physicalHeight / h)),
  );
  return { width: w, height: h, scale };
}

/** Period (ms) of the safety-net look at the container size. */
const POLL_MS = 1000;

/** Creates the hidden element whose computed insets expose `env(safe-area-inset-*)`. */
function createSafeAreaProbe(): HTMLElement {
  const probe = document.createElement('div');
  const style = probe.style;
  style.position = 'fixed';
  style.visibility = 'hidden';
  style.pointerEvents = 'none';
  style.width = '0';
  style.height = '0';
  for (const side of ['top', 'right', 'bottom', 'left']) {
    style.setProperty(side, `env(safe-area-inset-${side}, 0px)`);
  }
  probe.setAttribute('aria-hidden', 'true');
  return probe;
}

export class Viewport {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Logical canvas size in pixels. */
  width = MIN_LOGICAL_WIDTH;
  height = MIN_LOGICAL_HEIGHT;
  /** Integer upscale factor from logical to device pixels. */
  scale = 1;
  dpr = 1;
  safeArea: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
  isCoarsePointer = false;
  orientation: Orientation = 'portrait';
  private mode: ScaleMode;
  private readonly forced: { width: number; height: number } | null;
  private readonly forceCoarse: boolean;
  private readonly container: HTMLElement;
  private readonly probe: HTMLElement;
  private readonly listeners = new Set<ViewportListener>();
  private readonly settle = new SettleSchedule();
  /** A change was hinted since the last measurement. */
  private dirty = true;
  private lastPoll = 0;
  private lastCss: Size = { width: 0, height: 0 };
  /** Exact device pixels of the container, as ResizeObserver last reported them. */
  private devicePixels: Size | null = null;
  private observer: ResizeObserver | null = null;
  private dprQuery: MediaQueryList | null = null;
  private readonly coarseQuery: MediaQueryList | null;
  private readonly cleanups: (() => void)[] = [];
  private readonly onHint = (): void => this.invalidate();
  private readonly onDprChange = (): void => {
    this.watchPixelRatio();
    this.invalidate();
  };

  constructor(opts: ViewportOptions = {}) {
    const container = opts.container ?? document.getElementById('game');
    if (!container) throw new Error('Viewport: no #game container in the document');
    this.container = container;
    this.mode = opts.scaleMode ?? 'auto';
    this.forced = opts.forceLogical ?? null;
    this.forceCoarse = opts.forceCoarse ?? false;
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Viewport: 2D canvas context unavailable');
    this.ctx = ctx;
    this.probe = createSafeAreaProbe();
    container.appendChild(this.probe);
    container.appendChild(this.canvas);
    this.coarseQuery =
      typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)') : null;
    this.isCoarsePointer = this.forceCoarse || (this.coarseQuery?.matches ?? false);
    this.listen(this.coarseQuery, 'change', this.onHint);
    this.observeContainer();
    this.watchPixelRatio();
    this.listen(window, 'resize', this.onHint);
    this.listen(window, 'orientationchange', this.onHint);
    this.listen(window.visualViewport ?? null, 'resize', this.onHint);
    this.listen(screen.orientation ?? null, 'change', this.onHint);
    this.listen(document, 'fullscreenchange', this.onHint);
    this.listen(document, 'webkitfullscreenchange', this.onHint);
    this.listen(window, 'pageshow', this.onHint);
    this.listen(document, 'visibilitychange', this.onHint);
    this.layout();
  }

  get scaleMode(): ScaleMode {
    return this.mode;
  }

  set scaleMode(mode: ScaleMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.layout();
  }

  /** Subscribes to layout changes; returns the unsubscribe function. */
  onResize(listener: ViewportListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Converts CSS client coordinates (pointer events) to logical canvas pixels. */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? this.width / rect.width : 1;
    const sy = rect.height > 0 ? this.height / rect.height : 1;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }

  /** Marks the size as possibly changed: it is measured on the next frames until it settles. */
  invalidate(): void {
    this.dirty = true;
    this.settle.trigger(performance.now());
  }

  /**
   * Called at the start of every frame, before drawing: measures again when a change was hinted
   * (and a few times after it, while the browser settles), and once a second regardless.
   * Resizing here means the cleared canvas is redrawn in the same frame. Returns whether the
   * layout changed.
   */
  sync(now = performance.now()): boolean {
    const due = this.settle.due(now);
    if (!this.dirty && !due) {
      if (now - this.lastPoll < POLL_MS) return false;
      // The safety net: a cheap look at the container for changes nobody announced.
      this.lastPoll = now;
      const css = this.cssSize();
      if (
        css.width === this.lastCss.width &&
        css.height === this.lastCss.height &&
        (window.devicePixelRatio || 1) === this.dpr
      ) {
        return false;
      }
    }
    this.dirty = false;
    return this.layout();
  }

  /** Recomputes the layout now; returns whether anything changed (listeners were told). */
  layout(): boolean {
    const dpr = window.devicePixelRatio || 1;
    const css = this.cssSize();
    this.lastCss = css;
    const physical = physicalSize({ devicePixels: this.devicePixels, css, dpr });
    const { width, height, scale } = this.forced
      ? computeForcedLayout(physical.width, physical.height, this.forced.width, this.forced.height)
      : computeLayout(physical.width, physical.height, this.mode);
    const orientation: Orientation = physical.width >= physical.height ? 'landscape' : 'portrait';
    const coarse = this.forceCoarse || (this.coarseQuery?.matches ?? false);
    let changed =
      width !== this.width ||
      height !== this.height ||
      scale !== this.scale ||
      dpr !== this.dpr ||
      orientation !== this.orientation ||
      coarse !== this.isCoarsePointer;
    this.width = width;
    this.height = height;
    this.scale = scale;
    this.dpr = dpr;
    this.orientation = orientation;
    this.isCoarsePointer = coarse;
    // Setting the size clears the canvas and resets the context state. The canvas has the
    // screen's pixels; the context draws in logical ones.
    if (this.canvas.width !== width * scale) this.canvas.width = width * scale;
    if (this.canvas.height !== height * scale) this.canvas.height = height * scale;
    const cssWidth = `${(width * scale) / dpr}px`;
    const cssHeight = `${(height * scale) / dpr}px`;
    if (this.canvas.style.width !== cssWidth) this.canvas.style.width = cssWidth;
    if (this.canvas.style.height !== cssHeight) this.canvas.style.height = cssHeight;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    const safeArea = this.readSafeArea();
    if (
      safeArea.top !== this.safeArea.top ||
      safeArea.right !== this.safeArea.right ||
      safeArea.bottom !== this.safeArea.bottom ||
      safeArea.left !== this.safeArea.left
    ) {
      changed = true;
    }
    this.safeArea = safeArea;
    if (changed) {
      for (const listener of this.listeners) listener(this);
    }
    return changed;
  }

  dispose(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.length = 0;
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    this.observer?.disconnect();
    this.observer = null;
    this.listeners.clear();
    this.probe.remove();
    this.canvas.remove();
  }

  /** The container's CSS size (it fills the window: `position: fixed; inset: 0`). */
  private cssSize(): Size {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    return { width, height };
  }

  private observeContainer(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      const box = entry?.devicePixelContentBoxSize?.[0];
      this.devicePixels = box ? { width: box.inlineSize, height: box.blockSize } : null;
      this.invalidate();
    });
    try {
      this.observer.observe(this.container, { box: 'device-pixel-content-box' });
    } catch {
      // Safari has no device-pixel box: the CSS size times the pixel ratio has to do.
      this.observer.observe(this.container);
    }
  }

  /** A media query that fires once when the pixel ratio leaves its current value. */
  private watchPixelRatio(): void {
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    if (typeof window.matchMedia !== 'function') return;
    this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this.dprQuery.addEventListener('change', this.onDprChange);
  }

  private listen(target: EventTarget | null, type: string, handler: () => void): void {
    if (!target) return;
    target.addEventListener(type, handler);
    this.cleanups.push(() => target.removeEventListener(type, handler));
  }

  private readSafeArea(): SafeArea {
    let computed: CSSStyleDeclaration;
    try {
      computed = window.getComputedStyle(this.probe);
    } catch {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }
    const toLogical = (css: string): number => {
      const px = Number.parseFloat(css);
      if (!Number.isFinite(px) || px <= 0) return 0;
      return Math.ceil((px * this.dpr) / this.scale);
    };
    return {
      top: toLogical(computed.top),
      right: toLogical(computed.right),
      bottom: toLogical(computed.bottom),
      left: toLogical(computed.left),
    };
  }
}
