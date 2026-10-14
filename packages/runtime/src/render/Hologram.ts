/**
 * Holograms: the look of ghosts, of the bosses' glimpses and of some effects' afterimages. A
 * hologram is painted on an offscreen layer, which gets scanlines (every third pixel row
 * dimmed, the phase crawling downwards) and is laid over the scene see-through.
 */
import type { ViewSize } from './View.ts';
import { offscreenLayer } from './canvas.ts';

/** Opacity of a hologram layer over the scene. */
export const HOLOGRAM_ALPHA = 0.85;
/** Scanlines: one dimmed row in every `SCAN_PERIOD`, moving one row every `SCAN_STEP_MS`. */
const SCAN_PERIOD = 3;
const SCAN_STEP_MS = 90;
const SCAN_DIM = 'rgba(0, 0, 0, 0.55)';

/** Dims every third row of a hologram layer, the phase crawling downwards with time. */
export function applyScanlines(
  lctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  nowMs: number,
): void {
  lctx.globalCompositeOperation = 'destination-out';
  lctx.fillStyle = SCAN_DIM;
  const phase = Math.floor(nowMs / SCAN_STEP_MS) % SCAN_PERIOD;
  for (let y = phase; y < height; y += SCAN_PERIOD) lctx.fillRect(0, y, width, 1);
  lctx.globalCompositeOperation = 'source-over';
}

/** The offscreen layer holograms are painted on, kept between frames. */
export class HologramLayer {
  private canvas: HTMLCanvasElement | null = null;

  /**
   * `paint` paints on the cleared layer (the size of `view`); when it painted something (it
   * returns true) the layer gets its scanlines and goes over `ctx` at `alpha`. Without a canvas
   * (tests, Node) nothing is painted.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    view: ViewSize,
    nowMs: number,
    alpha: number,
    paint: (lctx: CanvasRenderingContext2D) => boolean,
  ): void {
    this.canvas = offscreenLayer(this.canvas, view.width, view.height);
    const lctx = this.canvas?.getContext('2d');
    if (!this.canvas || !lctx) return;
    lctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!paint(lctx)) return;
    applyScanlines(lctx, this.canvas.width, this.canvas.height, nowMs);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.canvas, 0, 0);
    ctx.restore();
  }
}
