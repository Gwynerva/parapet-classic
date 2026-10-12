/**
 * Virtual buttons for touch screens, drawn on the game canvas and laid out for two thumbs, the
 * way mobile games place them: left/right side by side under one thumb, down and up under the
 * other (the layout option swaps the sides), and restart and pause between them, everything
 * along the bottom. Down sits on the bottom row on the inner side and up a little higher and
 * further out, on the arc a thumb sweeps from its base in the corner. The size follows the
 * screen's shorter side, 52 to 72 CSS pixels (over 1 cm on a phone, where platform guides ask 44
 * at the least); in landscape the clusters stand a little in from the side edges, where thumbs
 * reach round the phone. The buttons are round pixel discs with a light ring.
 *
 * A thumb never has to hit a button: each cluster owns a large part of its side of the screen
 * (the lower two thirds), and a press there goes to the cluster's button whose centre is
 * nearest, so a press anywhere near counts (up and down split along a diagonal). Restart and
 * pause own only their own squares and are tested first. A direction counts on `pointerdown`,
 * like a key-down; pause too; restart when the finger lifts on it, so a thumb that strays onto
 * it can slide off. The layout respects the safe-area insets. The buttons only exist while a
 * run is played (`shown`); menus get every tap.
 */
import type { SafeArea, Viewport } from '../render/Viewport.ts';
import type { Direction } from './InputManager.ts';

/** Which side the left/right (move) buttons sit on; up/down take the other side. */
export type TouchLayout = 'move-left' | 'move-right';

export function isTouchLayout(value: unknown): value is TouchLayout {
  return value === 'move-left' || value === 'move-right';
}

/**
 * A round button (its bounding square, `size` across) and the rectangle where a press may go
 * to it (logical pixels). Restart and pause own their rectangle; the directions share theirs
 * with the other button of their cluster, the nearest centre taking the press.
 */
export interface TouchRect {
  x: number;
  y: number;
  size: number;
  hitX: number;
  hitY: number;
  hitW: number;
  hitH: number;
}

export interface TouchButton extends TouchRect {
  direction: Direction;
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

/** Everything on screen during a run. */
export interface TouchControlsLayout {
  buttons: TouchButton[];
  restart: TouchRect;
  pause: TouchRect;
}

export type TouchHit = Direction | 'pause' | 'restart';

/** Comfortable minimum touch target in CSS pixels. */
const MIN_HIT_CSS_PX = 44;
/** Direction buttons: this share of the screen's shorter side, within the bounds below. */
const BUTTON_SHARE = 0.15;
export const BUTTON_MIN_CSS_PX = 52;
export const BUTTON_MAX_CSS_PX = 72;
/** Between the buttons of a cluster, CSS pixels. */
const GAP_CSS_PX = 8;
/** Up stands this share of a button pitch above down and as far out to the side. */
const DIAGONAL = 0.75;
/** Restart and pause: smaller, they are rarely needed. */
const SYSTEM_CSS_PX = 36;
/** In landscape the clusters stand this share of a button in from the side. */
const LANDSCAPE_INSET = 0.35;
/** The directions' areas start this far down the screen (the HUD and the sky stay free). */
const ZONE_TOP = 0.35;
/** Between the runner's frame and the top of the buttons, logical px. */
const FRAME_GAP = 4;

function rect(
  x: number,
  y: number,
  size: number,
  hit: number,
  metrics: TouchLayoutMetrics,
): TouchRect {
  const hitX = Math.max(0, Math.round(x + size / 2 - hit / 2));
  const hitY = Math.max(0, Math.round(y + size / 2 - hit / 2));
  return {
    x,
    y,
    size,
    hitX,
    hitY,
    hitW: Math.min(metrics.width, hitX + hit) - hitX,
    hitH: Math.min(metrics.height, hitY + hit) - hitY,
  };
}

/** Pure layout, for tests: every button and its area for a viewport and a layout choice. */
export function layoutTouchControls(
  metrics: TouchLayoutMetrics,
  layout: TouchLayout,
  margin = 8,
): TouchControlsLayout {
  const { width, height, scale, dpr, safeArea } = metrics;
  const toLogical = (css: number): number => (css * dpr) / scale;
  const shortCss = (Math.min(width, height) * scale) / dpr;
  const sizeCss = Math.max(BUTTON_MIN_CSS_PX, Math.min(BUTTON_MAX_CSS_PX, shortCss * BUTTON_SHARE));
  const size = Math.max(16, Math.round(toLogical(sizeCss)));
  const gap = Math.max(4, Math.round(toLogical(GAP_CSS_PX)));
  const landscape = width > height;
  const left = safeArea.left + margin;
  const right = width - safeArea.right - margin;
  const bottom = height - safeArea.bottom - margin;
  const inset = landscape ? Math.round(size * LANDSCAPE_INSET) : 0;
  const moveOnLeft = layout === 'move-left';

  // Along the bottom: left and right side by side; down on the inner side of the other cluster
  // and up a step higher and further out.
  const step = size + gap;
  const diagonal = Math.round(step * DIAGONAL);
  const rowY = bottom - size;
  const upY = rowY - diagonal;
  const moveX = moveOnLeft ? left + inset : right - inset - (size + step);
  const upX = moveOnLeft ? right - inset - size : left + inset;
  const downX = moveOnLeft ? upX - diagonal : upX + diagonal;

  // Each cluster's area: its side of the screen from ZONE_TOP down.
  const centre = Math.round(safeArea.left + (width - safeArea.left - safeArea.right) / 2);
  const zoneTop = Math.max(0, Math.min(Math.round(height * ZONE_TOP), upY - (size >> 1)));
  const [moveFrom, moveTo] = moveOnLeft ? [0, centre] : [centre, width];
  const [jumpFrom, jumpTo] = moveOnLeft ? [centre, width] : [0, centre];
  const area = (x0: number, x1: number) => ({
    hitX: x0,
    hitY: zoneTop,
    hitW: x1 - x0,
    hitH: height - zoneTop,
  });
  const buttons: TouchButton[] = [
    { direction: 'left', x: moveX, y: rowY, size, ...area(moveFrom, moveTo) },
    { direction: 'right', x: moveX + step, y: rowY, size, ...area(moveFrom, moveTo) },
    { direction: 'up', x: upX, y: upY, size, ...area(jumpFrom, jumpTo) },
    { direction: 'down', x: downX, y: rowY, size, ...area(jumpFrom, jumpTo) },
  ];

  // Restart and pause side by side in the middle of the row, standing on the same line as the
  // other buttons; on a screen too narrow for that, above the clusters.
  const small = Math.max(14, Math.round(toLogical(SYSTEM_CSS_PX)));
  const hit = Math.max(small + 4, Math.ceil(toLogical(MIN_HIT_CSS_PX)));
  const pairGap = Math.max(2, Math.round(toLogical(4)));
  const innerLeft = moveOnLeft ? moveX + size + step : downX + size;
  const innerRight = moveOnLeft ? downX : moveX;
  const fits =
    centre - hit - (pairGap >> 1) >= innerLeft + gap &&
    centre + hit + (pairGap >> 1) <= innerRight - gap;
  const pairY = fits ? rowY + size - small : upY - gap - (hit >> 1) - (small >> 1);
  const restartX = centre - (pairGap >> 1) - (hit >> 1) - (small >> 1);
  const pauseX = centre + (pairGap >> 1) + (hit >> 1) - (small >> 1);
  return {
    buttons,
    restart: rect(restartX, pairY, small, hit, metrics),
    pause: rect(pauseX, pairY, small, hit, metrics),
  };
}

function inside(r: TouchRect, x: number, y: number): boolean {
  return x >= r.hitX && x < r.hitX + r.hitW && y >= r.hitY && y < r.hitY + r.hitH;
}

/**
 * What a press at a logical point hits in a layout: restart or pause in their own squares,
 * else the nearest direction button among those whose area holds the point. `directions`
 * false leaves only restart and pause (touch buttons switched off).
 */
export function hitTestLayout(
  placed: TouchControlsLayout,
  x: number,
  y: number,
  directions = true,
): TouchHit | null {
  if (inside(placed.restart, x, y)) return 'restart';
  if (inside(placed.pause, x, y)) return 'pause';
  if (!directions) return null;
  let best: TouchButton | null = null;
  let bestDistance = Infinity;
  for (const b of placed.buttons) {
    if (!inside(b, x, y)) continue;
    const half = b.size / 2;
    const d = Math.hypot(x + 0.5 - (b.x + half), y + 0.5 - (b.y + half));
    if (d < bestDistance) {
      best = b;
      bestDistance = d;
    }
  }
  return best?.direction ?? null;
}

/**
 * Row `i` of a pixel disc `size` across: the columns it covers, `[from, to)` from the left of
 * its square, or null outside it.
 */
function discRow(size: number, i: number): [number, number] | null {
  if (i < 0 || i >= size) return null;
  const r = size / 2;
  const dy = i + 0.5 - r;
  const half = Math.sqrt(Math.max(0, r * r - dy * dy));
  const from = Math.round(r - half);
  const to = Math.round(r + half);
  return to > from ? [from, to] : null;
}

/** The columns of row `i` in the disc and outside the inner disc `inner` px in, as runs. */
function ringRuns(size: number, inner: number, i: number): [number, number][] {
  const outer = discRow(size, i);
  if (!outer) return [];
  const hole = discRow(size - 2 * inner, i - inner);
  if (!hole) return [outer];
  const [a, b] = [hole[0] + inner, hole[1] + inner];
  const runs: [number, number][] = [];
  if (a > outer[0]) runs.push([outer[0], a]);
  if (outer[1] > b) runs.push([b, outer[1]]);
  return runs;
}

const FILL = 'rgba(16,20,24,0.38)';
const FILL_PRESSED = 'rgba(255,255,255,0.4)';
const RING = 'rgba(255,255,255,0.62)';
const RING_PRESSED = '#ffffff';
const HIGHLIGHT = 'rgba(255,255,255,0.16)';
const SHADOW = 'rgba(0,0,0,0.35)';
const INK = 'rgba(255,255,255,0.88)';
const INK_PRESSED = '#ffffff';

/**
 * A round button: a pixel disc, dark and see-through (lit while held), a light ring, a faint
 * highlight along the inside of its top and a one-pixel shadow under it, readable on sky and
 * walls alike.
 */
function drawDisc(ctx: CanvasRenderingContext2D, r: TouchRect, pressed: boolean): void {
  const { x, y, size } = r;
  const ring = size >= 40 ? 2 : 1;
  // The shadow: what the disc one pixel lower covers beyond the disc itself.
  ctx.fillStyle = SHADOW;
  for (let i = 1; i <= size; i++) {
    const low = discRow(size, i - 1);
    if (!low) continue;
    const here = discRow(size, i);
    if (!here) {
      ctx.fillRect(x + low[0], y + i, low[1] - low[0], 1);
      continue;
    }
    if (low[0] < here[0]) ctx.fillRect(x + low[0], y + i, here[0] - low[0], 1);
    if (low[1] > here[1]) ctx.fillRect(x + here[1], y + i, low[1] - here[1], 1);
  }
  for (let i = 0; i < size; i++) {
    const hole = discRow(size - 2 * ring, i - ring);
    if (hole) {
      ctx.fillStyle = pressed ? FILL_PRESSED : FILL;
      ctx.fillRect(x + ring + hole[0], y + i, hole[1] - hole[0], 1);
    }
    ctx.fillStyle = pressed ? RING_PRESSED : RING;
    for (const [a, b] of ringRuns(size, ring, i)) ctx.fillRect(x + a, y + i, b - a, 1);
    // The highlight: one more ring just inside, on the upper part only.
    if (!pressed && i < size * 0.42) {
      ctx.fillStyle = HIGHLIGHT;
      for (const [a, b] of ringRuns(size - 2 * ring, 1, i - ring)) {
        ctx.fillRect(x + ring + a, y + i, b - a, 1);
      }
    }
  }
}

/** Pixel-art arrow: a stepped triangle built from 1-px strips, centred in the disc. */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  direction: Direction,
  x: number,
  y: number,
  size: number,
): void {
  const inset = Math.max(3, Math.floor(size * 0.3));
  const span = size - inset * 2; // arrow length along its axis and its base width
  const centre = Math.floor(size / 2);
  // The triangle is half as long as it is wide: centre it along its axis.
  const lead = inset + (span >> 2);
  for (let i = 0; i < Math.ceil(span / 2); i++) {
    const half = Math.min(i + 1, Math.floor(span / 2));
    const breadth = half * 2;
    switch (direction) {
      case 'up':
        ctx.fillRect(x + centre - half, y + lead + i, breadth, 1);
        break;
      case 'down':
        ctx.fillRect(x + centre - half, y + size - lead - 1 - i, breadth, 1);
        break;
      case 'left':
        ctx.fillRect(x + lead + i, y + centre - half, 1, breadth);
        break;
      case 'right':
        ctx.fillRect(x + size - lead - 1 - i, y + centre - half, 1, breadth);
        break;
    }
  }
}

/** Two bars: the usual pause sign. */
function drawPauseSign(ctx: CanvasRenderingContext2D, r: TouchRect, dy: number): void {
  const barW = Math.max(2, Math.floor(r.size / 7));
  const barH = r.size - 2 * Math.max(3, Math.floor(r.size * 0.3));
  const top = r.y + dy + ((r.size - barH) >> 1);
  const gap = Math.max(2, barW);
  const left = r.x + ((r.size - (barW * 2 + gap)) >> 1);
  ctx.fillRect(left, top, barW, barH);
  ctx.fillRect(left + barW + gap, top, barW, barH);
}

/** A circle of pixels open at the top right, with an arrowhead going round: start over. */
function drawRestartSign(ctx: CanvasRenderingContext2D, r: TouchRect, dy0: number): void {
  const radius = Math.max(3, Math.floor(r.size * 0.22));
  const thick = Math.max(1, Math.round(radius / 3));
  const cx = r.x + (r.size >> 1);
  const cy = r.y + dy0 + (r.size >> 1);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d = Math.hypot(dx + 0.5, dy + 0.5);
      if (d > radius || d < radius - thick) continue;
      // The opening: between straight up and the upper right.
      const angle = Math.atan2(dy + 0.5, dx + 0.5);
      if (angle > -Math.PI / 2 && angle < -Math.PI / 8) continue;
      ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
  // The arrowhead at the top end of the circle, pointing on round (to the right).
  const head = Math.max(2, thick + 1);
  const tipY = cy - radius + (thick >> 1);
  for (let i = 0; i <= head; i++) {
    ctx.fillRect(cx + i, tipY - head + i, 1, (head - i) * 2 + 1);
  }
}

export class TouchControls {
  /** The direction buttons (the option "touch controls"). */
  enabled: boolean;
  /** A run is being played: the buttons exist (set by the play screen). */
  shown = false;
  private layoutMode: TouchLayout;
  private readonly margin: number;
  private placed: TouchControlsLayout | null = null;
  private readonly pressed = new Map<number, TouchHit>();
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
    return this.placed?.buttons ?? [];
  }

  /** Whether restart and pause are there: with the direction buttons, or on any touch screen. */
  get systemShown(): boolean {
    return this.enabled || this.viewport.isCoarsePointer;
  }

  relayout(): void {
    this.placed = layoutTouchControls(this.viewport, this.layoutMode, this.margin);
  }

  /**
   * The height of the screen above the buttons' place (logical px), where a run keeps its
   * runner (`Camera.setFrame`). The place counts while the buttons are off too (a keyboard),
   * so the picture is the same on any device; it follows the viewport at once.
   */
  frameHeight(): number {
    const placed = layoutTouchControls(this.viewport, this.layoutMode, this.margin);
    const top = Math.min(placed.restart.y, placed.pause.y, ...placed.buttons.map((b) => b.y));
    return Math.max(1, top - FRAME_GAP);
  }

  /** The button under a logical point while a run is shown, or null. */
  hitTest(x: number, y: number): TouchHit | null {
    const placed = this.placed;
    if (!this.shown || !placed || !this.systemShown) return null;
    return hitTestLayout(placed, x, y, this.enabled);
  }

  setPressed(pointerId: number, hit: TouchHit): void {
    this.pressed.set(pointerId, hit);
  }

  release(pointerId: number): void {
    this.pressed.delete(pointerId);
  }

  releaseAll(): void {
    this.pressed.clear();
  }

  isPressed(hit: TouchHit): boolean {
    for (const held of this.pressed.values()) if (held === hit) return true;
    return false;
  }

  /** Draws the buttons; call after the scene so they sit on top. */
  draw(ctx: CanvasRenderingContext2D): void {
    const placed = this.placed;
    if (!placed) return;
    // A held button's sign sinks a pixel, as if pressed in.
    const sink = (pressed: boolean): number => (pressed ? 1 : 0);
    if (this.systemShown) {
      const restart = this.isPressed('restart');
      drawDisc(ctx, placed.restart, restart);
      ctx.fillStyle = restart ? INK_PRESSED : INK;
      drawRestartSign(ctx, placed.restart, sink(restart));
      const pause = this.isPressed('pause');
      drawDisc(ctx, placed.pause, pause);
      ctx.fillStyle = pause ? INK_PRESSED : INK;
      drawPauseSign(ctx, placed.pause, sink(pause));
    }
    if (!this.enabled) return;
    for (const b of placed.buttons) {
      const pressed = this.isPressed(b.direction);
      drawDisc(ctx, b, pressed);
      ctx.fillStyle = pressed ? INK_PRESSED : INK;
      drawArrow(ctx, b.direction, b.x, b.y + sink(pressed), b.size);
    }
  }

  dispose(): void {
    this.unsubscribe();
    this.pressed.clear();
  }
}
