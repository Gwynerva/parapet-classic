/**
 * The collision tiles drawn without the level art, two ways: as the grey stand-ins of the Moves
 * screen's little levels (every tile a plain block with a light edge where feet or hands meet
 * it, so the shape a move uses reads at a glance), and as the debug view's outlines (each shape
 * coloured by what it does: solid, surface, wall, a place for the hands, a marker). Both paint
 * through a `TilePainter`, so they draw on a canvas or into RGBA bytes alike. The tile catalogue
 * is in reference/notes/01-formats.md.
 */
import type { Level } from '@parapet/sim';
import type { DemoLevel } from '../moves/demoLevel.ts';
import { demoTileAt } from '../moves/demoLevel.ts';
import { toScreen, type CameraPos, type ViewSize } from './View.ts';

/** Pixels per tile, as in the levels. */
const T = 32;

/** What the tiles are painted with: filled rectangles in CSS colours, and a label. */
export interface TilePainter {
  fill(x: number, y: number, w: number, h: number, color: string): void;
  label?(x: number, y: number, text: string, color: string): void;
}

/** A painter on a canvas. */
export function canvasPainter(ctx: CanvasRenderingContext2D): TilePainter {
  return {
    fill(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    },
    label(x, y, text, color) {
      ctx.save();
      ctx.font = '8px monospace';
      ctx.textBaseline = 'top';
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      ctx.restore();
    },
  };
}

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

/** One tile as a grey stand-in with its top-left at (x, y); `above` is the tile over it. */
export function paintPlaceholderTile(
  p: TilePainter,
  tile: number,
  x: number,
  y: number,
  above: number,
): void {
  const c = PLACEHOLDER_COLORS;
  switch (tile) {
    case 1: // solid block
    case 2: // walls
    case 4:
      p.fill(x, y, T, T, c.block);
      if (tile === 1 && above === 0) p.fill(x, y, T, 2, c.edge);
      return;
    case 3: // floor surface
      p.fill(x, y, T, T, c.block);
      p.fill(x, y, T, 2, c.edge);
      return;
    case 5: // building corners: the ledge the hands grab
    case 6:
      p.fill(x, y, T, T, c.block);
      p.fill(x, y, T, 2, c.edge);
      p.fill(tile === 5 ? x : x + T - 2, y, 2, T >> 1, c.edge);
      return;
    case 7: // slope up to the right
    case 8: // slope down to the right
      // A 45° ramp: stone under the line, the line itself light.
      for (let i = 0; i < T; i++) {
        const top = tile === 7 ? T - 1 - i : i;
        p.fill(x + i, y + top, 1, T - top, c.block);
        p.fill(x + i, y + top, 1, 2, c.edge);
      }
      return;
    case 13: // posts: a quarter of the tile, at its left or right side
    case 14: {
      const px = tile === 13 ? x : x + T - 8;
      p.fill(px, y, 8, T, c.block);
      p.fill(px, y, 8, 2, c.edge);
      return;
    }
    case 17: // ladder or wall-run face: rails and rungs, 8 px wide
    case 18: {
      p.fill(x, y, T, T, c.block);
      const lx = tile === 17 ? x - 6 : x + T - 2;
      p.fill(lx, y, 1, T, c.rail);
      p.fill(lx + 7, y, 1, T, c.rail);
      for (let r = 3; r < T; r += 8) p.fill(lx, y + r, 8, 1, c.rail);
      return;
    }
    case 19: // overhead bar
      p.fill(x, y, T, 2, c.rail);
      return;
    case 20: // plank
      p.fill(x, y, T, 3, c.edge);
      return;
    case 21: // low slab
      p.fill(x, y, T, 8, c.block);
      p.fill(x, y, T, 2, c.edge);
      return;
    case 22: // pole
      p.fill(x + (T >> 1) - 1, y, 2, T, c.rail);
      return;
    default:
      return;
  }
}

/**
 * Draws a demo level's tiles in view. `camX`/`camY` are the top-left of the view in pixels,
 * the view is `w × h` pixels from (0, 0) of the painter.
 */
export function drawPlaceholderTiles(
  p: TilePainter,
  level: DemoLevel,
  camX: number,
  camY: number,
  w: number,
  h: number,
): void {
  const x0 = Math.max(0, Math.floor(camX / T));
  const y0 = Math.max(0, Math.floor(camY / T));
  const x1 = Math.min(level.width - 1, Math.floor((camX + w) / T));
  const y1 = Math.min(level.height - 1, Math.floor((camY + h) / T));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const x = tx * T - Math.round(camX);
      const y = ty * T - Math.round(camY);
      if (level.fill[ty * level.width + tx]) {
        p.fill(x, y, T, T, PLACEHOLDER_COLORS.body);
        continue;
      }
      paintPlaceholderTile(p, demoTileAt(level, tx, ty), x, y, demoTileAt(level, tx, ty - 1));
    }
  }
}

/** The debug view's colours: what a shape does. */
export const OUTLINE_COLORS = {
  solid: '#ff4040',
  surface: '#40ff40',
  wall: '#ffb040',
  hands: '#40c0ff',
  marker: '#ff40ff',
  unknown: '#ffffff',
} as const;

/** One tile's collision shape outlined, its top-left at (x, y). */
export function outlineTile(p: TilePainter, tile: number, x: number, y: number): void {
  const c = OUTLINE_COLORS;
  const s = T;
  const box = (bx: number, by: number, w: number, h: number, color: string): void => {
    p.fill(bx, by, w, 1, color);
    p.fill(bx, by + h - 1, w, 1, color);
    p.fill(bx, by, 1, h, color);
    p.fill(bx + w - 1, by, 1, h, color);
  };
  const top = (color: string): void => p.fill(x, y, s, 1, color);
  const left = (color: string, h = s): void => p.fill(x, y, 1, h, color);
  const right = (color: string, h = s): void => p.fill(x + s - 1, y, 1, h, color);
  switch (tile) {
    case 1:
      box(x, y, s, s, c.solid);
      return;
    case 2:
    case 17:
      left(tile === 17 ? c.hands : c.wall);
      return;
    case 4:
    case 18:
      right(tile === 18 ? c.hands : c.wall);
      return;
    case 3:
    case 20:
      top(c.surface);
      return;
    case 5:
      top(c.surface);
      left(c.wall);
      left(c.hands, (s >> 1) + 1);
      return;
    case 6:
      top(c.surface);
      right(c.wall);
      right(c.hands, (s >> 1) + 1);
      return;
    case 7:
    case 8:
      for (let i = 0; i < s; i++) p.fill(x + i, y + (tile === 7 ? s - 1 - i : i), 1, 1, c.surface);
      return;
    case 13:
    case 14:
      box(tile === 13 ? x : x + s - 8, y, 8, s, c.solid);
      return;
    case 19:
      top(c.hands);
      return;
    case 21:
      top(c.surface);
      p.fill(x, y + 8, s, 1, c.solid);
      return;
    case 22:
      p.fill(x + (s >> 1), y, 1, s, c.hands);
      return;
    default:
      if (tile >= 49) {
        // Markers (checkpoints, flags, the finish): dashed.
        for (let i = 0; i < s; i += 4) {
          p.fill(x + i, y, 2, 1, c.marker);
          p.fill(x + i, y + s - 1, 2, 1, c.marker);
          p.fill(x, y + i, 1, 2, c.marker);
          p.fill(x + s - 1, y + i, 1, 2, c.marker);
        }
      } else {
        box(x, y, s, s, c.unknown);
        p.label?.(x + 2, y + 2, String(tile), c.unknown);
      }
      return;
  }
}

/** Outlines the collision shape of every tile of a level in view (the debug page's `T`). */
export function drawTileOutlines(
  p: TilePainter,
  level: Level,
  cam: CameraPos,
  view: ViewSize,
): void {
  const x0 = Math.max(0, cam.x >> 10);
  const y0 = Math.max(0, cam.y >> 10);
  const x1 = Math.min(level.width - 1, (cam.x + (view.width << 5)) >> 10);
  const y1 = Math.min(level.height - 1, (cam.y + (view.height << 5)) >> 10);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const tile = level.tileAt(tx, ty);
      if (tile !== 0) outlineTile(p, tile, toScreen(tx << 10, cam.x), toScreen(ty << 10, cam.y));
    }
  }
}
