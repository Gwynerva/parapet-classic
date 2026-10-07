/**
 * Virtual buttons for touch screens, drawn on the game canvas: left/right on one side of the
 * screen, up/down on the other (swappable). A button is sized `max(16, ceil(48 / scale))`
 * logical pixels (about 48 device pixels) with a much larger hit area, and the layout respects
 * the safe-area insets. `pointerdown` on a button is a press, like a key-down.
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

/** Visible button size in logical pixels for an upscale factor and device pixel ratio. */
export function touchButtonSize(scale: number, dpr = 1): number {
  return Math.max(16, Math.ceil((BUTTON_CSS_PX * dpr) / scale));
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

export class TouchControls {
  enabled: boolean;
  private layoutMode: TouchLayout;
  private readonly margin: number;
  private buttons: TouchButton[] = [];
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

  relayout(): void {
    this.buttons = layoutTouchButtons(this.viewport, this.layoutMode, this.margin);
  }

  /** The button under a logical point (nearest centre when hit areas overlap), or null. */
  hitTest(x: number, y: number): Direction | null {
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

  setPressed(pointerId: number, direction: Direction): void {
    this.pressed.set(pointerId, direction);
  }

  release(pointerId: number): void {
    this.pressed.delete(pointerId);
  }

  releaseAll(): void {
    this.pressed.clear();
  }

  isPressed(direction: Direction): boolean {
    for (const held of this.pressed.values()) if (held === direction) return true;
    return false;
  }

  /** Draws the buttons; call after the scene so they sit on top. */
  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.enabled) return;
    for (const b of this.buttons) {
      const pressed = this.isPressed(b.direction);
      ctx.fillStyle = pressed ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(b.x, b.y, b.size, b.size);
      ctx.fillStyle = pressed ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)';
      ctx.fillRect(b.x, b.y, b.size, 1);
      ctx.fillRect(b.x, b.y + b.size - 1, b.size, 1);
      ctx.fillRect(b.x, b.y, 1, b.size);
      ctx.fillRect(b.x + b.size - 1, b.y, 1, b.size);
      ctx.fillStyle = pressed ? '#ffffff' : 'rgba(255,255,255,0.85)';
      drawArrow(ctx, b.direction, b.x, b.y, b.size);
    }
  }

  dispose(): void {
    this.unsubscribe();
    this.pressed.clear();
  }
}
