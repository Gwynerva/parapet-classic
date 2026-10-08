/**
 * Virtual buttons for touch screens, drawn on the game canvas: left/right on one side of the
 * screen, up/down on the other (swappable), and a pause button at the top centre (the way back
 * to the menu). A button is about 40 CSS pixels with a larger hit area, and the layout respects
 * the safe-area insets. `pointerdown` on a button is a press, like a key-down. The buttons only
 * exist while a run is played (`shown`); menus get every tap.
 */
import type { SafeArea, Viewport } from '../render/Viewport.ts';
import type { Direction } from './InputManager.ts';

/** Which side the left/right (move) buttons sit on; up/down take the other side. */
export type TouchLayout = 'move-left' | 'move-right';

export function isTouchLayout(value: unknown): value is TouchLayout {
  return value === 'move-left' || value === 'move-right';
}

export interface TouchButton {
  direction: Direction;
  /** Visual square, logical pixels. */
  x: number;
  y: number;
  size: number;
  /** Hit rectangle, logical pixels (contains the visual square). */
  hitX: number;
  hitY: number;
  hitW: number;
  hitH: number;
}

export interface TouchControlsOptions {
  layout?: TouchLayout;
  /** Defaults to the viewport's coarse-pointer detection. */
  enabled?: boolean;
  /** Distance from the screen edge (plus the safe area), logical pixels. */
  margin?: number;
}

/** Geometry the layout needs; `Viewport` satisfies it. */
export interface TouchLayoutMetrics {
  width: number;
  height: number;
  scale: number;
  dpr: number;
  safeArea: SafeArea;
}

/** Comfortable minimum touch target in CSS pixels. */
const MIN_HIT_CSS_PX = 44;

/** Visible button square in CSS pixels (about 1 cm on a phone). */
export const BUTTON_CSS_PX = 40;
/** Invisible padding around each button that still counts as a hit, in CSS pixels. */
export const BUTTON_PADDING_CSS_PX = 14;

/** Visible size of the pause button in CSS pixels (smaller: it is rarely needed). */
export const PAUSE_CSS_PX = 30;

/** Visible button size in logical pixels for an upscale factor and device pixel ratio. */
export function touchButtonSize(scale: number, dpr = 1): number {
  return Math.max(16, Math.ceil((BUTTON_CSS_PX * dpr) / scale));
}

export interface PauseButton {
  x: number;
  y: number;
  size: number;
  hitX: number;
  hitY: number;
  hitW: number;
  hitH: number;
}

/**
 * The pause button: top centre of the safe area, where the HUD leaves room (timer on the
 * left, score on the right).
 */
export function layoutPauseButton(metrics: TouchLayoutMetrics, margin = 4): PauseButton {
  const { width, height, scale, dpr, safeArea } = metrics;
  const size = Math.max(14, Math.ceil((PAUSE_CSS_PX * dpr) / scale));
  const hit = Math.max(size + 8, Math.ceil((MIN_HIT_CSS_PX * dpr) / scale));
  const centre = safeArea.left + ((width - safeArea.left - safeArea.right) >> 1);
  const x = centre - (size >> 1);
  const y = safeArea.top + margin;
  const hitX = Math.max(0, x + (size >> 1) - (hit >> 1));
  const hitY = Math.max(0, y + (size >> 1) - (hit >> 1));
  return {
    x,
    y,
    size,
    hitX,
    hitY,
    hitW: Math.min(width, hitX + hit) - hitX,
    hitH: Math.min(height, hitY + hit) - hitY,
  };
}

/** Pure layout, for tests: button rectangles for a viewport and a layout choice. */
export function layoutTouchButtons(
  metrics: TouchLayoutMetrics,
  layout: TouchLayout,
  margin = 8,
): TouchButton[] {
  const { width, height, scale, dpr, safeArea } = metrics;
  const size = touchButtonSize(scale, dpr);
  const padding = Math.ceil((BUTTON_PADDING_CSS_PX * dpr) / scale);
  const gap = Math.max(4, padding);
  const hit = Math.max(size + padding * 2, Math.ceil((MIN_HIT_CSS_PX * dpr) / scale));
  const bottom = height - safeArea.bottom - margin;
  const leftEdge = safeArea.left + margin;
  const rightEdge = width - safeArea.right - margin;
  // Both pairs sit side by side on the bottom edge. The jump button is always the one nearest
  // the screen edge, where a thumb rests naturally: right side → [down][up], left → [up][down].
  const pairWidth = size * 2 + gap;
  const moveX = layout === 'move-left' ? leftEdge : rightEdge - pairWidth;
  const jumpX = layout === 'move-left' ? rightEdge - pairWidth : leftEdge;
  const jumpOnRight = layout === 'move-left';
  const y = bottom - size;
  const squares: { direction: Direction; x: number; y: number }[] = [
    { direction: 'left', x: moveX, y },
    { direction: 'right', x: moveX + size + gap, y },
    { direction: 'down', x: jumpOnRight ? jumpX : jumpX + size + gap, y },
    { direction: 'up', x: jumpOnRight ? jumpX + size + gap : jumpX, y },
  ];
  return squares.map(({ direction, x, y }) => {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const hitX = Math.max(0, Math.floor(cx - hit / 2));
    const hitY = Math.max(0, Math.floor(cy - hit / 2));
    return {
      direction,
      x,
      y,
      size,
      hitX,
      hitY,
      hitW: Math.min(width, Math.ceil(cx + hit / 2)) - hitX,
      hitH: Math.min(height, Math.ceil(cy + hit / 2)) - hitY,
    };
  });
}

/** Pixel-art arrow: a stepped triangle built from 1-px strips. */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  direction: Direction,
  x: number,
  y: number,
  size: number,
): void {
  const inset = Math.max(3, Math.floor(size / 4));
  const span = size - inset * 2; // arrow length along its axis and its base width
  const centre = Math.floor(size / 2);
  for (let i = 0; i < Math.ceil(span / 2); i++) {
    const half = Math.min(i + 1, Math.floor(span / 2));
    const breadth = half * 2;
    switch (direction) {
      case 'up':
        ctx.fillRect(x + centre - half, y + inset + i, breadth, 1);
        break;
      case 'down':
        ctx.fillRect(x + centre - half, y + size - inset - 1 - i, breadth, 1);
        break;
      case 'left':
        ctx.fillRect(x + inset + i, y + centre - half, 1, breadth);
        break;
      case 'right':
        ctx.fillRect(x + size - inset - 1 - i, y + centre - half, 1, breadth);
        break;
    }
  }
}

export type TouchHit = Direction | 'pause';

/** A translucent square with a light border (brighter while held). */
function drawSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  pressed: boolean,
): void {
  ctx.fillStyle = pressed ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = pressed ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)';
  ctx.fillRect(x, y, size, 1);
  ctx.fillRect(x, y + size - 1, size, 1);
  ctx.fillRect(x, y, 1, size);
  ctx.fillRect(x + size - 1, y, 1, size);
}

export class TouchControls {
  /** The direction buttons (the option "touch controls"). */
  enabled: boolean;
  /** A run is being played: the buttons exist (set by the play screen). */
  shown = false;
  private layoutMode: TouchLayout;
  private readonly margin: number;
  private buttons: TouchButton[] = [];
  private pauseButton: PauseButton | null = null;
  private pausePressed = -1;
  private readonly pressed = new Map<number, Direction>();
  private readonly viewport: Viewport;
  private readonly unsubscribe: () => void;

  constructor(viewport: Viewport, opts: TouchControlsOptions = {}) {
    this.viewport = viewport;
    this.enabled = opts.enabled ?? viewport.isCoarsePointer;
    this.layoutMode = opts.layout ?? 'move-left';
    this.margin = opts.margin ?? 8;
    this.relayout();
    this.unsubscribe = viewport.onResize(() => this.relayout());
  }

  get layout(): TouchLayout {
    return this.layoutMode;
  }

  set layout(layout: TouchLayout) {
    if (layout === this.layoutMode) return;
    this.layoutMode = layout;
    this.relayout();
  }

  get buttonList(): readonly TouchButton[] {
    return this.buttons;
  }

  /** Whether the pause button is there: with the direction buttons, or on any touch screen. */
  get pauseShown(): boolean {
    return this.enabled || this.viewport.isCoarsePointer;
  }

  get pauseRect(): PauseButton | null {
    return this.pauseButton;
  }

  relayout(): void {
    this.buttons = layoutTouchButtons(this.viewport, this.layoutMode, this.margin);
    this.pauseButton = layoutPauseButton(this.viewport);
  }

  /** The button under a logical point while a run is shown (nearest centre wins), or null. */
  hitTest(x: number, y: number): TouchHit | null {
    if (!this.shown) return null;
    const p = this.pauseButton;
    if (
      p &&
      this.pauseShown &&
      x >= p.hitX &&
      x < p.hitX + p.hitW &&
      y >= p.hitY &&
      y < p.hitY + p.hitH
    ) {
      return 'pause';
    }
    if (!this.enabled) return null;
    let best: Direction | null = null;
    let bestDistance = Infinity;
    for (const b of this.buttons) {
      if (x < b.hitX || x >= b.hitX + b.hitW || y < b.hitY || y >= b.hitY + b.hitH) continue;
      const dx = x - (b.x + b.size / 2);
      const dy = y - (b.y + b.size / 2);
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = b.direction;
      }
    }
    return best;
  }

  setPressed(pointerId: number, hit: TouchHit): void {
    if (hit === 'pause') this.pausePressed = pointerId;
    else this.pressed.set(pointerId, hit);
  }

  release(pointerId: number): void {
    this.pressed.delete(pointerId);
    if (this.pausePressed === pointerId) this.pausePressed = -1;
  }

  releaseAll(): void {
    this.pressed.clear();
    this.pausePressed = -1;
  }

  isPressed(direction: Direction): boolean {
    for (const held of this.pressed.values()) if (held === direction) return true;
    return false;
  }

  /** Draws the buttons; call after the scene so they sit on top. */
  draw(ctx: CanvasRenderingContext2D): void {
    const p = this.pauseButton;
    if (p && this.pauseShown) {
      const pressed = this.pausePressed >= 0;
      drawSquare(ctx, p.x, p.y, p.size, pressed);
      // Two bars: the usual pause sign.
      const barW = Math.max(2, Math.floor(p.size / 6));
      const barH = p.size - 2 * Math.max(3, Math.floor(p.size / 4));
      const top = p.y + ((p.size - barH) >> 1);
      const gap = Math.max(2, barW);
      const left = p.x + ((p.size - (barW * 2 + gap)) >> 1);
      ctx.fillStyle = pressed ? '#ffffff' : 'rgba(255,255,255,0.85)';
      ctx.fillRect(left, top, barW, barH);
      ctx.fillRect(left + barW + gap, top, barW, barH);
    }
    if (!this.enabled) return;
    for (const b of this.buttons) {
      const pressed = this.isPressed(b.direction);
      drawSquare(ctx, b.x, b.y, b.size, pressed);
      ctx.fillStyle = pressed ? '#ffffff' : 'rgba(255,255,255,0.85)';
      drawArrow(ctx, b.direction, b.x, b.y, b.size);
    }
  }

  dispose(): void {
    this.unsubscribe();
    this.pressed.clear();
  }
}
