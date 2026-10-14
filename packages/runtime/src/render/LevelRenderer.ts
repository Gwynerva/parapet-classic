/**
 * Level drawing: parallax sky and layers (`bb()`, d.java line 9958), level art (`aV()`, line
 * 9847), checkpoint flags and finish marker (`aS()`, line 9747), birds and debug tile shapes.
 *
 * The original screen was 240×320. Its vertical layout (horizon, near-layer base, water) is kept
 * to the pixel, standing on the bottom of the camera's frame (`Camera.frameH`, the view above
 * the touch buttons): the level art keeps its pixel size, so the skyline sits behind it exactly
 * as on the original screen whatever the height; a taller frame only gets a taller sky
 * gradient. Parallax factors stay the original ones (far 0.117×, near 0.234×, clouds 0.059× of
 * the camera x), and the sprites keep their pixel size. The original moved the background a whole pixel at a time; on a big
 * screen that is a jump of several screen pixels every few frames, so here the layers glide a
 * screen pixel at a time (`splitPixel`), the same path at a finer step.
 *
 * The original's camera never showed what lies below a level. Ours may (`Camera.setFrame`: the
 * runner kept above the touch buttons, the strip under them below the level): the sky and the
 * skyline then rise with the level's bottom edge, staying behind the level as on the original
 * screen; every column of the art that reaches down to the level's bottom (walls, ground) goes
 * on down in its own colour, and below the level's bottom edge all of it sinks into shadow
 * (`drawUnder`): the city continues below, plainly not a part of the level.
 */
import { idiv, type Level, type MissionRules } from '@parapet/sim';
import type { LevelArtContent } from '../content/types.ts';
import { PIVOT_ANCHOR, type SceneRenderer, TWEEN_ONE } from './SceneRenderer.ts';
import {
  ANCHOR_BOTTOM_LEFT,
  ANCHOR_CENTER,
  ANCHOR_TOP_LEFT,
  type SpriteSheet,
} from './SpriteSheet.ts';
import { screenPixels, splitPixel, toScreen, type CameraPos, type ViewSize } from './View.ts';
import { cssOf24 } from './color.ts';

/** Original screen height the vertical layout constants refer to. */
const BASE_HEIGHT = 320;
/** Width of the parallax strips (sprites 212+ are 200 px wide). */
const LAYER_WIDTH = 200;
/** Height of the sky gradient band above the horizon. */
const SKY_BAND = 100;
const SKY_BANDS = 12;
const CLOUD_PERIOD_FACTOR = 2;
const WATER_SPRITE = 222;
const WATER_ROWS = 51;
/** The water's fade from the far shore down: its steps and its opacity at the bottom. */
const WATER_FADE_BANDS = 8;
const WATER_DARKEST = 0.85;
/**
 * Under a level: the shade's colour, its bands (height in px) and its opacity at the end; a
 * column of the art goes on down when it reaches this close to the level's bottom (px).
 */
const UNDER_SHADE = '12, 14, 18';
const UNDER_BAND = 16;
const UNDER_BANDS = 6;
const UNDER_DARKEST = 0.8;
const UNDER_REACH = 32;

/** What goes on below a frame of the level art: its columns carried down, and their last row. */
interface Under {
  /** The art's size, transparent but below the columns that reach the level's bottom. */
  fill: HTMLCanvasElement;
  /** One row, the art's width: the colour each such column goes on with. */
  row: HTMLCanvasElement;
}

const FLAG_SPRITE = 137;
const FLAG_FRAMES = 3;
const FLAG_INACTIVE = 140;
const FINISH_SPRITE = 191;
/** Bounce of a just-collected flag lasts this long (`bO = 0x1F400 | bit`, line 9498). */
export const FLAG_BOUNCE_MS = 500;

/** Theme of a level (`ce = ci / 3`, line 9949). */
export function themeOfLevel(levelId: number): number {
  return idiv(levelId, 3);
}

/**
 * Static level-art frame of a level outside the tutorial/challenge pulses (`aV`, line 9857):
 * frame 4 for levels 0, 2, 3, 6; frame 2 for level 5; frame 0 otherwise.
 */
export function defaultLevelArtFrame(levelId: number): number {
  if (levelId === 0 || levelId === 2 || levelId === 3 || levelId === 6) return 4;
  if (levelId === 5) return 2;
  return 0;
}

/** Bounce timers of just-collected markers (`bO`): a 500 ms timer and a bit per marker. */
export class MarkerBounce {
  timer = 0;
  mask = 0;

  /** Start the bounce of marker `index` (called on `checkpoint` / `flag` events). */
  trigger(index: number): void {
    this.timer = FLAG_BOUNCE_MS;
    this.mask = 1 << index;
  }

  /** Count down by the frame's game time (`ch`). */
  advance(dtUnits: number): void {
    if (this.timer <= 0) return;
    this.timer -= dtUnits;
    if (this.timer <= 0) {
      this.timer = 0;
      this.mask = 0;
    }
  }
}

export class LevelRenderer {
  private readonly content: LevelArtContent;
  private readonly sheet: SpriteSheet;
  private readonly scene: SceneRenderer;
  private readonly sine: Int16Array;
  private readonly artCache = new Map<number, HTMLCanvasElement>();
  private readonly underCache = new Map<number, Under | null>();
  private artObjectId = -1;
  /** Level height in tiles (`bQ`), used by the vertical parallax. */
  private levelHeightTiles = 0;
  private colourCache: { theme: number; ground: string; skyBottom: string; skyTop: string } | null =
    null;

  constructor(
    content: LevelArtContent,
    sheet: SpriteSheet,
    scene: SceneRenderer,
    sine: Int16Array,
  ) {
    this.content = content;
    this.sheet = sheet;
    this.scene = scene;
    this.sine = sine;
  }

  /**
   * Select the level: its art object (`missions.backgroundSceneId`, `S(int)` line 9836) and
   * its height for the parallax.
   */
  setLevel(levelId: number, level: Level): void {
    this.currentLevel = levelId;
    const mission = this.content.missions.levels[levelId];
    this.setLevelArt(mission ? mission.backgroundSceneId : -1);
    if (level.height !== this.levelHeightTiles) this.underCache.clear();
    this.levelHeightTiles = level.height;
  }

  /** The level last selected with `setLevel` (-1: none yet). */
  get levelId(): number {
    return this.currentLevel;
  }

  private currentLevel = -1;

  /** Select the level art object directly. */
  setLevelArt(objectId: number): void {
    if (objectId === this.artObjectId) return;
    this.artObjectId = objectId;
    this.artCache.clear();
    this.underCache.clear();
  }

  // -------------------------------------------------------------------------------------------
  // Background (`bb`)
  // -------------------------------------------------------------------------------------------

  /**
   * `frameHeight`: the part of the view, from the top, whose bottom the original screen stands
   * on (the camera's frame above the touch buttons, `Camera.frameH`); the ground and the water
   * go on below it to the bottom of the view.
   */
  drawBackground(
    ctx: CanvasRenderingContext2D,
    cam: CameraPos,
    view: ViewSize,
    clockMs: number,
    theme: number,
    frameHeight = view.height,
  ): void {
    const M = this.content.tables.M;
    const base = theme * 5;
    const ground = M[base] ?? 0;
    const skyBottom = M[base + 1] ?? 0;
    const skyTop = M[base + 2] ?? 0;
    const farSprite = M[base + 3] ?? -1;
    const cloudSprite = M[base + 4] ?? -1;
    const colours = this.themeColours(theme, ground, skyBottom, skyTop);
    const frame = Math.max(1, Math.min(view.height, frameHeight));
    const per = screenPixels(ctx);
    // The original screen's top within the view (above it on a short frame).
    const shift = frame - BASE_HEIGHT;

    // Horizon: 260 - (camY / levelHeightTiles >> 4), 32 px higher in theme 3; camY is the top
    // of that original screen.
    const levelH = this.levelHeightTiles;
    const camRatio = levelH > 0 ? (cam.y + (shift << 5)) / levelH : 0;
    let horizon = 260 - camRatio / 16;
    if (theme === 3) horizon -= 32;
    // The level's bottom edge above the bottom of the frame: everything rises with it.
    const lift = levelH > 0 ? Math.max(0, frame - ((levelH << 10) - cam.y) / 32) : 0;
    const sky = splitPixel(horizon + shift - lift, per);
    const horizonPx = sky.whole;
    const bandPx = Math.round(SKY_BAND * Math.max(1, frame / BASE_HEIGHT));

    ctx.save();
    ctx.translate(0, sky.rest);
    this.drawGradient(ctx, 0, horizonPx - bandPx, view.width, bandPx, skyTop, skyBottom, view);
    ctx.fillStyle = colours.ground;
    ctx.fillRect(0, horizonPx, view.width, view.height - horizonPx);
    if (horizonPx - bandPx >= 0) {
      // From a pixel above the top: the sky moved down by the rest of a pixel.
      ctx.fillStyle = colours.skyTop;
      ctx.fillRect(0, -1, view.width, horizonPx - bandPx + 1);
    }

    if (cloudSprite !== -1) {
      const period = view.width * CLOUD_PERIOD_FACTOR;
      const scroll = -((cam.x * 240) / (1 << 17));
      for (let i = 0; i < 3; i++) {
        const x = splitPixel(((scroll + i * 5423 + clockMs / 512) % period) - view.width, per);
        ctx.translate(x.rest, 0);
        this.sheet.drawSprite(
          ctx,
          cloudSprite,
          x.whole,
          horizonPx - SKY_BAND - i * 28,
          0,
          ANCHOR_BOTTOM_LEFT,
        );
        ctx.translate(-x.rest, 0);
      }
    }

    if (farSprite === -1) {
      ctx.restore();
      return;
    }
    const far = splitPixel(-(((cam.x * 240) / (1 << 16)) % LAYER_WIDTH), per);
    ctx.translate(far.rest, 0);
    for (let x = far.whole; x < view.width; x += LAYER_WIDTH) {
      this.sheet.drawSprite(ctx, farSprite, x, horizonPx, 0, ANCHOR_BOTTOM_LEFT);
    }
    ctx.restore();

    let nearBase = 310 - camRatio / 16 - camRatio / 32;
    if (theme === 3) nearBase -= 32;
    const nearY = splitPixel(nearBase + shift - lift, per);
    const near = splitPixel(-(((cam.x * 240) / (1 << 15)) % LAYER_WIDTH), per);
    ctx.save();
    ctx.translate(near.rest, nearY.rest);
    for (let x = near.whole; x < view.width; x += LAYER_WIDTH) {
      this.sheet.drawSprite(ctx, farSprite + 1, x, nearY.whole, 0, ANCHOR_BOTTOM_LEFT);
    }
    if (theme === 3 && nearY.whole < view.height) {
      this.drawWater(ctx, near.whole, nearY.whole, view, clockMs, frame - nearY.rest, ground);
    }
    ctx.restore();
  }

  /**
   * Wavy water rows below the near layer in theme 3 (line 10005). The original drew its 51 rows
   * and left the theme's dark ground under them, which on a taller screen is a black band
   * between the far shore and the quay. Here the nearest row's waves go on down (still moving),
   * and the water darkens in steps the further it lies from the far shore, into the night's
   * ground colour by the bottom of the frame (`frameBottom`): the lights' reflections fade out
   * instead of stopping at a line.
   */
  private drawWater(
    ctx: CanvasRenderingContext2D,
    startX: number,
    baseY: number,
    view: ViewSize,
    clockMs: number,
    frameBottom: number,
    ground: number,
  ): void {
    const sine = this.sine;
    const phase = clockMs >> 2;
    for (let x = startX; x < view.width; x += LAYER_WIDTH) {
      for (let row = 0; baseY + row < view.height; row++) {
        const r = Math.min(row, WATER_ROWS - 1);
        const n = idiv((WATER_ROWS - r) << 16, r + 1);
        let srcRow = WATER_ROWS - r + (sine[(row + n + phase) & 0x1ff]! >> 8);
        if (srcRow < 0) srcRow = 0;
        else if (srcRow > WATER_ROWS - 1) srcRow = WATER_ROWS - 1;
        const wobble = idiv(sine[(row + (n >> 4) + phase) & 0x1ff]!, WATER_ROWS - r + 1) >> 8;
        this.sheet.drawStrip(
          ctx,
          WATER_SPRITE,
          x + wobble,
          baseY + row,
          ANCHOR_TOP_LEFT,
          LAYER_WIDTH,
          1,
          0,
          srcRow,
        );
      }
    }
    // The fade: clear by the far shore, the ground colour at `WATER_DARKEST` from the last
    // band (by the frame's bottom) down, in bands like the sky's.
    const span = Math.max(WATER_FADE_BANDS, Math.round(frameBottom - baseY));
    const rgb = `${(ground >> 16) & 0xff}, ${(ground >> 8) & 0xff}, ${ground & 0xff}`;
    const left = Math.min(0, startX);
    for (let i = 0; i < WATER_FADE_BANDS; i++) {
      const y0 = baseY + Math.round((span * i) / WATER_FADE_BANDS);
      const last = i === WATER_FADE_BANDS - 1;
      const y1 = last ? view.height : baseY + Math.round((span * (i + 1)) / WATER_FADE_BANDS);
      if (y0 >= view.height) break;
      if (y1 <= y0) continue;
      const alpha = (WATER_DARKEST * i) / (WATER_FADE_BANDS - 1);
      if (alpha <= 0) continue;
      ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
      ctx.fillRect(left, y0, view.width - left + 1, y1 - y0);
    }
  }

  /** Vertical gradient in `bands` steps (`a(int,int,int,int,int,int,int)`, line 3583). */
  private drawGradient(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    from: number,
    to: number,
    view: ViewSize,
  ): void {
    if (x >= view.width || x + w < 0 || y >= view.height || y + h < 0 || w < 0 || h < 0) return;
    const step = idiv(h << 8, SKY_BANDS);
    const bandH = (step >> 8) + 1;
    let r = (from >> 16) & 0xff;
    let g = (from >> 8) & 0xff;
    let b = from & 0xff;
    const dr = idiv((((to >> 16) & 0xff) - r) << 8, SKY_BANDS);
    const dg = idiv((((to >> 8) & 0xff) - g) << 8, SKY_BANDS);
    const db = idiv(((to & 0xff) - b) << 8, SKY_BANDS);
    r <<= 8;
    g <<= 8;
    b <<= 8;
    const end = (y + h) << 8;
    for (let yy = y << 8; yy < end; yy += step) {
      if (yy >> 8 >= view.height) return;
      ctx.fillStyle = cssOf24(((r << 8) & 0xff0000) | (g & 0xff00) | ((b >> 8) & 0xff));
      ctx.fillRect(x, yy >> 8, w, bandH);
      r += dr;
      g += dg;
      b += db;
    }
  }

  // -------------------------------------------------------------------------------------------
  // Level art (`aV`)
  // -------------------------------------------------------------------------------------------

  /** Draw one (cached) frame of the level art. */
  drawLevelArt(ctx: CanvasRenderingContext2D, cam: CameraPos, view: ViewSize, frame: number): void {
    const obj = this.scene.getObject(this.artObjectId);
    const canvas = this.artFrame(frame);
    if (!obj || !canvas) return;
    const x = -((cam.x * 32) >> 10) - obj.pivotX;
    const y = -((cam.y * 32) >> 10) - obj.pivotY;
    if (ctx.imageSmoothingEnabled) ctx.imageSmoothingEnabled = false;
    if (x < view.width && y < view.height && x + obj.width > 0 && y + obj.height > 0) {
      ctx.drawImage(canvas, x, y);
    }
    this.drawUnder(ctx, cam, view, frame);
  }

  /** The cached picture of an art frame (made on first use). */
  private artFrame(frame: number): HTMLCanvasElement | null {
    if (!this.scene.getObject(this.artObjectId)) return null;
    let canvas = this.artCache.get(frame);
    if (!canvas) {
      canvas = this.scene.renderObjectToCanvas(this.artObjectId, frame);
      this.artCache.set(frame, canvas);
    }
    return canvas;
  }

  /**
   * What lies below the level, when the view reaches there: the art's columns that come down
   * to the level's bottom go on down in their own colour (to the art's edge, then stretched to
   * the bottom of the view), and from the level's bottom edge a shade deepens in bands over
   * everything, the background in the gaps too.
   */
  private drawUnder(
    ctx: CanvasRenderingContext2D,
    cam: CameraPos,
    view: ViewSize,
    frame: number,
  ): void {
    const obj = this.scene.getObject(this.artObjectId);
    if (!obj || this.levelHeightTiles <= 0) return;
    const floor = this.levelHeightTiles * 32 - ((cam.y * 32) >> 10);
    if (floor >= view.height + 1) return;
    const left = -((cam.x * 32) >> 10) - obj.pivotX;
    const top = -((cam.y * 32) >> 10) - obj.pivotY;
    const under = this.underFor(frame);
    if (under && left < view.width && left + obj.width > 0) {
      if (top < view.height && top + obj.height > 0) ctx.drawImage(under.fill, left, top);
      const from = Math.max(top + obj.height, -1);
      if (from < view.height + 1) {
        const width = under.row.width;
        ctx.drawImage(under.row, 0, 0, width, 1, left, from, width, view.height + 1 - from);
      }
    }
    for (let i = 0; i < UNDER_BANDS; i++) {
      const y = floor + i * UNDER_BAND;
      if (y >= view.height + 1) return;
      const h = i === UNDER_BANDS - 1 ? view.height + 1 - y : UNDER_BAND;
      if (y + h <= -1) continue;
      ctx.fillStyle = `rgba(${UNDER_SHADE}, ${((UNDER_DARKEST * (i + 1)) / UNDER_BANDS).toFixed(3)})`;
      ctx.fillRect(-1, y, view.width + 2, h);
    }
  }

  /**
   * The columns of an art frame carried down (made once per frame): a column whose lowest
   * pixel lies within `UNDER_REACH` of the level's bottom edge or below it goes on with the
   * colour a little above that pixel (the very last one is often an outline).
   */
  private underFor(frame: number): Under | null {
    const cached = this.underCache.get(frame);
    if (cached !== undefined) return cached;
    const obj = this.scene.getObject(this.artObjectId);
    const art = this.artFrame(frame);
    const actx = art?.getContext('2d', { willReadFrequently: true });
    let under: Under | null = null;
    if (obj && art && actx && typeof document !== 'undefined') {
      const w = art.width;
      const h = art.height;
      const reach = Math.max(0, this.levelHeightTiles * 32 + obj.pivotY - UNDER_REACH);
      const src = new Uint32Array(actx.getImageData(0, 0, w, h).data.buffer);
      const fill = document.createElement('canvas');
      fill.width = w;
      fill.height = h;
      const row = document.createElement('canvas');
      row.width = w;
      row.height = 1;
      const fctx = fill.getContext('2d');
      const rctx = row.getContext('2d');
      if (fctx && rctx) {
        const fillData = fctx.createImageData(w, h);
        const rowData = rctx.createImageData(w, 1);
        const fillPx = new Uint32Array(fillData.data.buffer);
        const rowPx = new Uint32Array(rowData.data.buffer);
        // Alpha is the top byte of a little-endian pixel word (every browser here).
        const opaque = (i: number): boolean => src[i]! >>> 24 !== 0;
        for (let x = 0; x < w; x++) {
          let low = -1;
          for (let y = h - 1; y >= reach; y--) {
            if (opaque(y * w + x)) {
              low = y;
              break;
            }
          }
          if (low < 0) continue;
          const above = Math.max(0, low - 2) * w + x;
          const colour = src[opaque(above) ? above : low * w + x]!;
          for (let y = low + 1; y < h; y++) fillPx[y * w + x] = colour;
          rowPx[x] = colour;
        }
        fctx.putImageData(fillData, 0, 0);
        rctx.putImageData(rowData, 0, 0);
        under = { fill, row };
      }
    }
    this.underCache.set(frame, under);
    return under;
  }

  /**
   * Draw the level art tweened between two frames (the tutorial / challenge pulse:
   * `b(bZ, ca, cb, |sin| << 6, ...)`). Not cached.
   */
  drawLevelArtTween(
    ctx: CanvasRenderingContext2D,
    cam: CameraPos,
    view: ViewSize,
    frameA: number,
    frameB: number,
    t: number,
  ): void {
    if (this.artObjectId < 0) return;
    this.scene.withViewport(view.width, view.height, () =>
      this.scene.drawObject(
        ctx,
        this.artObjectId,
        frameA,
        frameB,
        Math.max(0, Math.min(TWEEN_ONE, t)),
        -((cam.x * 32) >> 10),
        -((cam.y * 32) >> 10),
        false,
        undefined,
        PIVOT_ANCHOR,
      ),
    );
    // Under it, the frame it is closer to (their bottoms hardly differ).
    this.drawUnder(ctx, cam, view, t < TWEEN_ONE / 2 ? frameA : frameB);
  }

  /** Pulse fraction 0..65536 of the tutorial level art at real time `clockMs` (line 9849). */
  pulse(clockMs: number): number {
    const s = this.sine[(clockMs >> 2) & 0x1ff]!;
    return Math.abs(s << 6);
  }

  // -------------------------------------------------------------------------------------------
  // Markers (`aS`)
  // -------------------------------------------------------------------------------------------

  /**
   * Checkpoint flags and the finish marker. Collected markers disappear
   * (`rules.remainingMask`); in a sprint only the next checkpoint waves, the others are static.
   * `clockMs` is real time (flag animation), `bounce` the bounce timers of just-taken flags.
   */
  drawMarkers(
    ctx: CanvasRenderingContext2D,
    cam: CameraPos,
    view: ViewSize,
    level: Level,
    rules: MissionRules,
    clockMs: number,
    bounce?: MarkerBounce,
  ): void {
    const remaining = rules.remainingMask;
    const bouncing = bounce && bounce.timer > 0 ? bounce.mask : 0;
    const bounceTimer = bounce ? bounce.timer : 0;
    const animFrame =
      ((((clockMs >> 7) * (bounceTimer > 0 ? 4 : 1)) % FLAG_FRAMES) + FLAG_FRAMES) % FLAG_FRAMES;
    level.checkpoints.forEach((cp, i) => {
      const bit = 1 << i;
      const x = toScreen(cp.x << 10, cam.x);
      const y = toScreen(cp.y << 10, cam.y);
      let lift = 0;
      if (bounceTimer > 0 && (bouncing & bit) !== 0) {
        lift = (this.sine[(idiv(bounceTimer * 128, FLAG_BOUNCE_MS) + 128) & 0x1ff]! * 96) >> 10;
      }
      const visible = (remaining & bit) !== 0 || (bouncing & bit) !== 0;
      if (!visible) return;
      let sprite = FLAG_SPRITE + animFrame;
      if (rules.missionType === 0) {
        // Sprint: only the next checkpoint (or a bouncing one) is animated.
        if (i !== 0) {
          const prevTaken = (remaining & (bit >> 1)) === 0;
          const thisTaken = (remaining & bit) === 0;
          if (prevTaken === thisTaken && (bouncing & bit) === 0) sprite = FLAG_INACTIVE;
        }
      }
      if (x + 16 < -40 || x + 16 > view.width + 40) return;
      this.sheet.drawSprite(ctx, sprite, x + 16, y + 16 - lift, 0, ANCHOR_CENTER);
    });
    if (level.finish) {
      const x = toScreen(level.finish.x << 10, cam.x);
      const y = toScreen(level.finish.y << 10, cam.y);
      this.sheet.drawSprite(ctx, FINISH_SPRITE, x + 16, y + 16, 0, ANCHOR_CENTER);
    }
  }

  private themeColours(
    theme: number,
    ground: number,
    skyBottom: number,
    skyTop: number,
  ): { ground: string; skyBottom: string; skyTop: string } {
    if (!this.colourCache || this.colourCache.theme !== theme) {
      this.colourCache = {
        theme,
        ground: cssOf24(ground),
        skyBottom: cssOf24(skyBottom),
        skyTop: cssOf24(skyTop),
      };
    }
    return this.colourCache;
  }
}
