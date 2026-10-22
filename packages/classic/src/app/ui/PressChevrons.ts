/**
 * The pressed keys as chevrons: two strokes pointing the key's way, in the key's colour, drawn
 * at the screen's own resolution so they stay thin and sharp however big a logical pixel is.
 * The replay's timeline marks every press with one; a press as it happens pops one out that
 * drifts away and fades (over the replay's play head, and beside the full-game timer in a run).
 */
import { Input } from '@parapet/sim';
import { screenPixels } from '@parapet/runtime/render/View.ts';

export type Direction = 'up' | 'down' | 'left' | 'right';

/** The keys: their bit, the way they point, colour, and band of the timeline (as they point). */
export const PRESS_KEYS: readonly { bit: number; dir: Direction; color: string; band: number }[] = [
  { bit: Input.UP, dir: 'up', color: '#7fd4ff', band: 0 },
  { bit: Input.DOWN, dir: 'down', color: '#ff8a5c', band: 2 },
  { bit: Input.LEFT, dir: 'left', color: '#c79bff', band: 1 },
  { bit: Input.RIGHT, dir: 'right', color: '#ffd35c', band: 1 },
];

const POPUP_MS = 900;
/** A popup's chevron: half width, depth (logical px) and line (screen px). */
const POPUP_W = 3.5;
const POPUP_D = 3;
const POPUP_LINE = 3;

/**
 * A chevron pointing `dir` (two strokes, no base), `w` logical px either side of (x, y) across
 * and `d` deep, `line` screen pixels thick.
 */
export function chevron(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  d: number,
  dir: Direction,
  color: string,
  line: number,
): void {
  const h = d / 2;
  c.beginPath();
  if (dir === 'up' || dir === 'down') {
    const tip = dir === 'up' ? -h : h;
    c.moveTo(x - w, y - tip);
    c.lineTo(x, y + tip);
    c.lineTo(x + w, y - tip);
  } else {
    const tip = dir === 'left' ? -h : h;
    c.moveTo(x - tip, y - w);
    c.lineTo(x + tip, y);
    c.lineTo(x - tip, y + w);
  }
  c.strokeStyle = color;
  c.lineWidth = line / screenPixels(c);
  c.lineJoin = 'miter';
  c.lineCap = 'butt';
  c.stroke();
}

/** Chevrons popping out at each press, drifting away and fading. */
export class PressPopups {
  private readonly popups: { key: number; born: number; order: number }[] = [];

  /** A step ran with these bits: one chevron per key pressed. */
  pressed(bits: number): void {
    const now = performance.now();
    let order = 0;
    PRESS_KEYS.forEach((key, i) => {
      if (bits & key.bit) this.popups.push({ key: i, born: now, order: order++ });
    });
  }

  clear(): void {
    this.popups.length = 0;
  }

  /**
   * Born at (x, y), they drift by (dx, dy) over their life; keys pressed together stand apart
   * across the drift.
   */
  draw(c: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number): void {
    const now = performance.now();
    while (this.popups.length > 0 && now - this.popups[0]!.born > POPUP_MS) this.popups.shift();
    const apart = 2 * POPUP_W + 3;
    for (const popup of this.popups) {
      const k = (now - popup.born) / POPUP_MS;
      const key = PRESS_KEYS[popup.key]!;
      const px = x + dx * k + (dy !== 0 ? popup.order * apart : 0);
      const py = y + dy * k + (dy === 0 ? popup.order * apart : 0);
      c.save();
      c.globalAlpha = 1 - k * k;
      // A dark edge under the colour, so it reads over any sky.
      chevron(c, px, py, POPUP_W, POPUP_D, key.dir, '#000000', POPUP_LINE + 2);
      chevron(c, px, py, POPUP_W, POPUP_D, key.dir, key.color, POPUP_LINE);
      c.restore();
    }
  }
}
