/**
 * A character's little world (`content/bosses/<boss>/stage.json`), drawn behind it on the
 * character screen: the sky and parallax strips of its level (drawn by the caller), then layers
 * of themed things scrolling at their own speeds as the character runs, a strip of ground under
 * its feet, a tint of light and ambient particles. All of it is data: pixel-art sprites like the
 * effects', placed along repeating layers.
 */
import type { FxEmitter, FxFile } from './fx/FxData.ts';
import { fxProblems } from './fx/FxData.ts';
import { compileFx, type CompiledFx } from './fx/FxSheet.ts';
import { sheetOf } from './fx/FxSystem.ts';
import { parseColor } from './Look.ts';
import { ANCHOR_BOTTOM_LEFT } from './SpriteSheet.ts';
import { screenPixels, splitPixel } from './View.ts';

export interface StageItem {
  sprite: string;
  /** Pixels from the start of the layer's period. */
  x: number;
  /** Pixels of the sprite's bottom above the ground line (negative: below it). */
  y?: number;
  /** Mirror the sprite. */
  flip?: boolean;
  /** An animation instead of one sprite: these in turn, `fps` a second (waves, lights, flags). */
  frames?: string[];
  fps?: number;
}

export interface StageLayer {
  /** How fast it scrolls: 0 stays (far away), 1 moves with the ground. */
  speed: number;
  /** The layer repeats every this many pixels. */
  period: number;
  items: StageItem[];
  /** Drawn in front of the character. */
  front?: boolean;
  /** Opacity (haze on far layers). */
  alpha?: number;
  /** Its own motion, pixels per second to the left (clouds, flying cars, a ship); negative: right. */
  drift?: number;
}

export interface StageFile {
  /** The level whose sky shows behind (default: the boss's own). */
  level?: number;
  palette: Record<string, string>;
  sprites: Record<string, string[]>;
  /** Back to front. */
  layers: StageLayer[];
  /** A strip tiled along the ground line, its top at the line. */
  ground?: string;
  /** A colour laid over the sky (`#rrggbbaa`): night, dusk, haze. */
  tint?: string;
  /**
   * The place's own sky instead of the level's: colours from the top down to the horizon, in
   * bands of equal height (pixel-art dithering steps).
   */
  sky?: string[];
  /** Stars over the sky: how many, their colours; they twinkle. */
  stars?: { count: number; colors: string[] };
  /** Particles of the place (sand in the wind, rain, fireflies) by name in `emitters`. */
  ambient?: string[];
  emitters?: Record<string, FxEmitter>;
}

/** The stage's sprites and emitters as an effects file (they share the pixel-art machinery). */
export function stageAsFx(stage: StageFile): FxFile {
  return {
    palette: stage.palette,
    sprites: stage.sprites,
    emitters: stage.emitters ?? {},
    variants: {},
  };
}

/** What is wrong with a stage, or nothing. */
export function stageProblems(stage: StageFile): string[] {
  const out = fxProblems(stageAsFx(stage)).map((p) => p.replace(/^variant .*/, ''));
  for (const [i, layer] of stage.layers.entries()) {
    if (!(layer.period > 0)) out.push(`layer ${i}: period must be positive`);
    for (const item of layer.items) {
      for (const s of [item.sprite, ...(item.frames ?? [])]) {
        if (!(s in stage.sprites)) out.push(`layer ${i}: sprite "${s}"`);
      }
    }
  }
  if (stage.ground && !(stage.ground in stage.sprites)) out.push(`ground "${stage.ground}"`);
  if (stage.tint && !parseColor(stage.tint)) out.push(`tint ${stage.tint}`);
  for (const c of stage.sky ?? []) if (!parseColor(c)) out.push(`sky colour ${c}`);
  for (const c of stage.stars?.colors ?? []) if (!parseColor(c)) out.push(`star colour ${c}`);
  for (const n of stage.ambient ?? []) {
    if (!(n in (stage.emitters ?? {}))) out.push(`ambient "${n}" does not exist`);
  }
  return out.filter(Boolean);
}

/** A stage ready to draw in an accent colour. */
export class StageRenderer {
  readonly file: StageFile;
  readonly fx: CompiledFx;

  constructor(file: StageFile, accent: string) {
    this.file = file;
    this.fx = compileFx(stageAsFx(file), accent);
  }

  /** Whether the stage brings its own sky (else the level's shows). */
  get hasSky(): boolean {
    return (this.file.sky?.length ?? 0) > 0;
  }

  /**
   * The stage's sky from `top` down to the ground line: bands of its colours, then stars
   * twinkling with `clock` (ms). Stars stay put: they are far away.
   */
  drawSky(
    ctx: CanvasRenderingContext2D,
    x: number,
    width: number,
    groundY: number,
    clock: number,
    top = 0,
  ): void {
    const sky = this.file.sky;
    if (!sky?.length) return;
    const h = groundY - top;
    sky.forEach((c, i) => {
      const y0 = top + Math.floor((h * i) / sky.length);
      const y1 = top + Math.floor((h * (i + 1)) / sky.length);
      ctx.fillStyle = c;
      ctx.fillRect(x, y0, width, y1 - y0);
    });
    const stars = this.file.stars;
    if (!stars?.count || !stars.colors.length) return;
    let s = 0x2545f491;
    const next = (): number => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
    for (let i = 0; i < stars.count; i++) {
      const sx = x + Math.floor(next() * width);
      const sy = top + Math.floor(next() * h * 0.7);
      const phase = next() * Math.PI * 2;
      const colour = stars.colors[Math.floor(next() * stars.colors.length)]!;
      // Most of the time lit; now and then a star dims for a moment.
      if (Math.sin(clock * 0.002 + phase * 7) < -0.85) continue;
      ctx.fillStyle = colour;
      ctx.fillRect(sx, sy, 1, 1);
    }
  }

  /**
   * Draws the layers (`front`: only those in front of the character, else the others, the
   * ground and the tint) in a box of `width` px, the ground line at `groundY`, after the
   * character ran `scroll` px. The caller clips and draws the sky first.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    width: number,
    groundY: number,
    scroll: number,
    front: boolean,
    top = 0,
    clock = 0,
  ): void {
    const sheet = sheetOf(this.fx);
    if (!sheet) return;
    if (!front && this.file.tint) {
      ctx.fillStyle = this.file.tint;
      ctx.fillRect(x, top, width, groundY - top);
    }
    const saved = ctx.globalAlpha;
    // Layers glide a screen pixel at a time, not a whole (zoomed) pixel every few frames.
    const per = screenPixels(ctx);
    for (const layer of this.file.layers) {
      if (!!layer.front !== front) continue;
      ctx.globalAlpha = saved * (layer.alpha ?? 1);
      const at = splitPixel(scroll * layer.speed + (clock * (layer.drift ?? 0)) / 1000, per);
      const shift = at.whole;
      ctx.translate(-at.rest, 0);
      const period = layer.period;
      const start = Math.floor((shift - 64) / period) * period;
      for (let p = start; p < shift + width + 64; p += period) {
        for (const item of layer.items) {
          const name = item.frames?.length
            ? item.frames[Math.floor((clock * (item.fps ?? 4)) / 1000) % item.frames.length]!
            : item.sprite;
          const id = this.fx.spriteIds.get(name);
          if (id === undefined) continue;
          const sx = x + p + item.x - shift;
          const w = this.fx.frames[id]!.w;
          if (sx + w < x - 2 || sx > x + width + 2) continue;
          sheet.drawSprite(
            ctx,
            id,
            sx,
            groundY - (item.y ?? 0),
            item.flip ? 4 : 0,
            ANCHOR_BOTTOM_LEFT,
          );
        }
      }
      ctx.translate(at.rest, 0);
    }
    ctx.globalAlpha = saved;
    if (!front && this.file.ground) {
      const id = this.fx.spriteIds.get(this.file.ground);
      if (id !== undefined) {
        const f = this.fx.frames[id]!;
        const at = splitPixel(scroll, per);
        const shift = at.whole % f.w;
        ctx.translate(-at.rest, 0);
        for (let gx = x - shift; gx < x + width + 1; gx += f.w) {
          sheet.drawSprite(ctx, id, gx, groundY + f.h, 0, ANCHOR_BOTTOM_LEFT);
        }
        ctx.translate(at.rest, 0);
      }
    }
  }
}
