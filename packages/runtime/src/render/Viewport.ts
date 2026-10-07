/**
 * Logical canvas size and integer scale.
 *
 * The game draws at a small logical resolution and the browser upscales the canvas by an integer
 * factor, so pixels stay square and crisp on any screen. The scale targets roughly 384 logical
 * pixels of height (a little more than the original 320) but never lets the logical size drop
 * below the original 240×320; the logical width is capped at 960 so ultra-wide screens get black
 * margins instead of a huge playfield.
 */

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
  /** Debounce for window resize events, in ms (default 100). */
  debounceMs?: number;
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
  private readonly container: HTMLElement;
  private readonly probe: HTMLElement;
  private readonly listeners = new Set<ViewportListener>();
  private readonly debounceMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly coarseQuery: MediaQueryList | null;
  private readonly onWindowResize = (): void => this.scheduleLayout();
  private readonly onPointerQueryChange = (): void => {
    this.isCoarsePointer = this.coarseQuery?.matches ?? false;
  };

  constructor(opts: ViewportOptions = {}) {
    const container = opts.container ?? document.getElementById('game');
    if (!container) throw new Error('Viewport: no #game container in the document');
    this.container = container;
    this.mode = opts.scaleMode ?? 'auto';
    this.debounceMs = opts.debounceMs ?? 100;
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Viewport: 2D canvas context unavailable');
    this.ctx = ctx;
    this.probe = createSafeAreaProbe();
    container.appendChild(this.probe);
    container.appendChild(this.canvas);
    this.coarseQuery =
      typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)') : null;
    this.isCoarsePointer = this.coarseQuery?.matches ?? false;
    this.coarseQuery?.addEventListener('change', this.onPointerQueryChange);
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('orientationchange', this.onWindowResize);
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

  /** Recomputes the layout now (resize events call this through a debounce). */
  layout(): void {
    const dpr = window.devicePixelRatio || 1;
    const physicalWidth = Math.round(window.innerWidth * dpr);
    const physicalHeight = Math.round(window.innerHeight * dpr);
    const { width, height, scale } = computeLayout(physicalWidth, physicalHeight, this.mode);
    const orientation: Orientation = physicalWidth >= physicalHeight ? 'landscape' : 'portrait';
    let changed =
      width !== this.width ||
      height !== this.height ||
      scale !== this.scale ||
      dpr !== this.dpr ||
      orientation !== this.orientation;
    this.width = width;
    this.height = height;
    this.scale = scale;
    this.dpr = dpr;
    this.orientation = orientation;
    // Setting the size clears the canvas and resets the context state.
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.canvas.style.width = `${(width * scale) / dpr}px`;
    this.canvas.style.height = `${(height * scale) / dpr}px`;
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
  }

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('orientationchange', this.onWindowResize);
    this.coarseQuery?.removeEventListener('change', this.onPointerQueryChange);
    this.listeners.clear();
    this.probe.remove();
    this.canvas.remove();
  }

  private scheduleLayout(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.layout();
    }, this.debounceMs);
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
