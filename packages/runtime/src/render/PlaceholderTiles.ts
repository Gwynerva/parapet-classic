/**
 * The grey stand-ins of the Moves screen's little levels: every collision tile drawn as a
 * plain block with a light edge where feet or hands meet it, so the shape the move uses reads
 * at a glance (a wall, a ledge, a ladder, a pole, a post).
 */
import type { DemoLevel } from '../moves/demoLevel.ts';
import { demoTileAt } from '../moves/demoLevel.ts';

/** Pixels per tile, as in the levels. */
const T = 32;

export const PLACEHOLDER_COLORS = {
  /** Building interiors (`x`): darker, they are only scenery. */
  body: '#2c333d',
  /** Blocks the runner touches. */
  block: '#4a525e',
  /** Edges that carry the feet or the hands. */
  edge: '#8b98a8',
  /** Ladders, poles and bars. */
  rail: '#b8c2ce',
} as const;

/**
 * Draws the tiles in view. `camX`/`camY` are the top-left of the view in pixels, the view is
 * `w × h` pixels from (0, 0) of the context.
 */
export function drawPlaceholderTiles(
  ctx: CanvasRenderingContext2D,
  level: DemoLevel,
  camX: number,
  camY: number,
  w: number,
  h: number,
): void {
  const c = PLACEHOLDER_COLORS;
  const x0 = Math.max(0, Math.floor(camX / T));
  const y0 = Math.max(0, Math.floor(camY / T));
  const x1 = Math.min(level.width - 1, Math.floor((camX + w) / T));
  const y1 = Math.min(level.height - 1, Math.floor((camY + h) / T));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const x = tx * T - Math.round(camX);
      const y = ty * T - Math.round(camY);
      if (level.fill[ty * level.width + tx]) {
        ctx.fillStyle = c.body;
        ctx.fillRect(x, y, T, T);
        continue;
      }
      const tile = demoTileAt(level, tx, ty);
      switch (tile) {
        case 1: // solid block
        case 2: // walls
        case 4:
          ctx.fillStyle = c.block;
          ctx.fillRect(x, y, T, T);
          if (tile === 1 && demoTileAt(level, tx, ty - 1) === 0) edge(ctx, x, y, T, 2);
          break;
        case 3: // floor surface
          ctx.fillStyle = c.block;
          ctx.fillRect(x, y, T, T);
          edge(ctx, x, y, T, 2);
          break;
        case 5: // building corners: the ledge the hands grab
        case 6:
          ctx.fillStyle = c.block;
          ctx.fillRect(x, y, T, T);
          edge(ctx, x, y, T, 2);
          ctx.fillStyle = c.edge;
          ctx.fillRect(tile === 5 ? x : x + T - 2, y, 2, T >> 1);
          break;
        case 7: // slope up to the right
        case 8: // slope down to the right
          slope(ctx, x, y, tile === 7);
          break;
        case 13: // posts: a quarter of the tile, at its left or right side
        case 14: {
          const px = tile === 13 ? x : x + T - 8;
          ctx.fillStyle = c.block;
          ctx.fillRect(px, y, 8, T);
          ctx.fillStyle = c.edge;
          ctx.fillRect(px, y, 8, 2);
          break;
        }
        case 17: // ladder or wall-run face
        case 18:
          ctx.fillStyle = c.block;
          ctx.fillRect(x, y, T, T);
          ladder(ctx, tile === 17 ? x - 6 : x + T - 2, y);
          break;
        case 19: // overhead bar
          ctx.fillStyle = c.rail;
          ctx.fillRect(x, y, T, 2);
          break;
        case 20: // plank
          ctx.fillStyle = c.edge;
          ctx.fillRect(x, y, T, 3);
          break;
        case 21: // low slab
          ctx.fillStyle = c.block;
          ctx.fillRect(x, y, T, 8);
          edge(ctx, x, y, T, 2);
          break;
        case 22: // pole
          ctx.fillStyle = c.rail;
          ctx.fillRect(x + (T >> 1) - 1, y, 2, T);
          break;
        default:
          break;
      }
    }
  }
}

function edge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = PLACEHOLDER_COLORS.edge;
  ctx.fillRect(x, y, w, h);
}

/** A 45° ramp: stone under the line, the line itself light. */
function slope(ctx: CanvasRenderingContext2D, x: number, y: number, up: boolean): void {
  for (let i = 0; i < T; i++) {
    const top = up ? T - 1 - i : i;
    ctx.fillStyle = PLACEHOLDER_COLORS.block;
    ctx.fillRect(x + i, y + top, 1, T - top);
    ctx.fillStyle = PLACEHOLDER_COLORS.edge;
    ctx.fillRect(x + i, y + top, 1, 2);
  }
}

/** Rails and rungs on a wall face, 8 px wide. */
function ladder(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = PLACEHOLDER_COLORS.rail;
  ctx.fillRect(x, y, 1, T);
  ctx.fillRect(x + 7, y, 1, T);
  for (let r = 3; r < T; r += 8) ctx.fillRect(x, y + r, 8, 1);
}
