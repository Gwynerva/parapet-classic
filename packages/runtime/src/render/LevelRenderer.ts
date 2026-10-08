/**
 * Level drawing: parallax sky and layers (`bb()`, d.java line 9958), level art (`aV()`, line
 * 9847), checkpoint flags and finish marker (`aS()`, line 9747), birds and debug tile shapes.
 *
 * The original screen was 240×320; vertical positions that are fractions of the screen
 * (horizon, near-layer base, sky band) are scaled by `viewHeight / 320`, parallax factors stay
 * the original ones (far 0.117×, near 0.234×, clouds 0.059× of the camera x), and the sprites
 * keep their pixel size. The original moved the background a whole pixel at a time; on a big
 * screen that is a jump of several screen pixels every few frames, so here the layers glide a
 * screen pixel at a time (`splitPixel`), the same path at a finer step.
 */
import { idiv, type Level, type MissionRules } from '@parapet/sim';
import type { LevelArtContent } from '../content/types.ts';
import { PIVOT_ANCHOR, type SceneRenderer, TWEEN_ONE } from './SceneRenderer.ts';
import {
  ANCHOR_BOTTOM_CENTER,
  ANCHOR_BOTTOM_LEFT,
  ANCHOR_CENTER,
  ANCHOR_TOP_LEFT,
  type SpriteSheet,
} from './SpriteSheet.ts';
import { screenPixels, splitPixel, toScreen, type CameraPos, type ViewSize } from './View.ts';

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

const FLAG_SPRITE = 137;
const FLAG_FRAMES = 3;
const FLAG_INACTIVE = 140;
const FINISH_SPRITE = 191;
const BIRD_SPRITE = 296;
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
  }

  // -------------------------------------------------------------------------------------------
  // Background (`bb`)
  // -------------------------------------------------------------------------------------------

  drawBackground(
    ctx: CanvasRenderingContext2D,
    cam: CameraPos,
    view: ViewSize,
    clockMs: number,
    theme: number,
  ): void {
    const M = this.content.tables.M;
    const base = theme * 5;
    const ground = M[base] ?? 0;
    const skyBottom = M[base + 1] ?? 0;
    const skyTop = M[base + 2] ?? 0;
    const farSprite = M[base + 3] ?? -1;
    const cloudSprite = M[base + 4] ?? -1;
    const colours = this.themeColours(theme, ground, skyBottom, skyTop);
    const scaleY = view.height / BASE_HEIGHT;
    const per = screenPixels(ctx);

    // Horizon: 260 - (camY / levelHeightTiles >> 4), 32 px higher in theme 3.
    const levelH = this.levelHeightTiles;
    const camRatio = levelH > 0 ? cam.y / levelH : 0;
    let horizon = 260 - camRatio / 16;
    if (theme === 3) horizon -= 32;
    const sky = splitPixel(horizon * scaleY, per);
    const horizonPx = sky.whole;
    const bandPx = Math.round(SKY_BAND * scaleY);

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
    const nearY = splitPixel(nearBase * scaleY, per);
    const near = splitPixel(-(((cam.x * 240) / (1 << 15)) % LAYER_WIDTH), per);
    ctx.save();
    ctx.translate(near.rest, nearY.rest);
    for (let x = near.whole; x < view.width; x += LAYER_WIDTH) {
      this.sheet.drawSprite(ctx, farSprite + 1, x, nearY.whole, 0, ANCHOR_BOTTOM_LEFT);
    }
    if (theme === 3 && nearY.whole < view.height) {
      this.drawWater(ctx, near.whole, nearY.whole, view, clockMs);
    }
    ctx.restore();
  }

  /** Wavy water rows below the near layer in theme 3 (line 10005). */
  private drawWater(
    ctx: CanvasRenderingContext2D,
    startX: number,
    baseY: number,
    view: ViewSize,
    clockMs: number,
  ): void {
    const sine = this.sine;
    const phase = clockMs >> 2;
    for (let x = startX; x < view.width; x += LAYER_WIDTH) {
      for (let row = 0; row < WATER_ROWS && baseY + row < view.height; row++) {
        const n = idiv((WATER_ROWS - row) << 16, row + 1);
        let srcRow = WATER_ROWS - row + (sine[(row + n + phase) & 0x1ff]! >> 8);
        if (srcRow < 0) srcRow = 0;
        else if (srcRow > WATER_ROWS - 1) srcRow = WATER_ROWS - 1;
        const wobble = idiv(sine[(row + (n >> 4) + phase) & 0x1ff]!, WATER_ROWS - row + 1) >> 8;
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
      ctx.fillStyle = cssRgb(((r << 8) & 0xff0000) | (g & 0xff00) | ((b >> 8) & 0xff));
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
    if (!obj) return;
    let canvas = this.artCache.get(frame);
    if (!canvas) {
      canvas = this.scene.renderObjectToCanvas(this.artObjectId, frame);
      this.artCache.set(frame, canvas);
    }
    const x = -((cam.x * 32) >> 10) - obj.pivotX;
    const y = -((cam.y * 32) >> 10) - obj.pivotY;
    if (x >= view.width || y >= view.height || x + obj.width <= 0 || y + obj.height <= 0) return;
    if (ctx.imageSmoothingEnabled) ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, x, y);
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
    this.scene.setViewport(view.width, view.height);
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
    );
  }

  /**
   * A small picture of a level for the menus: the real level art at 1:1 around the start
   * cell, on the theme's sky colour. The scene renderer culls objects outside the small
   * canvas, so this is one cheap draw without a large intermediate canvas.
   */
  renderPreview(
    levelId: number,
    level: Level,
    width: number,
    height: number,
    zoom = 2,
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.imageSmoothingEnabled = false;
    if (zoom > 1) {
      // Render a window `zoom` times larger at 1:1 and shrink it without smoothing, so the
      // preview shows more of the level while every pixel stays a level pixel.
      const large = this.renderPreview(levelId, level, width * zoom, height * zoom, 1);
      ctx.drawImage(large, 0, 0, width, height);
      return canvas;
    }
    const theme = themeOfLevel(levelId);
    const M = this.content.tables.M;
    const base = theme * 5;
    const colours = this.themeColours(theme, M[base] ?? 0, M[base + 1] ?? 0, M[base + 2] ?? 0);
    ctx.fillStyle = colours.skyBottom;
    ctx.fillRect(0, 0, width, height);
    const mission = this.content.missions.levels[levelId];
    const objectId = mission ? mission.backgroundSceneId : -1;
    const obj = this.scene.getObject(objectId);
    if (!obj) return canvas;
    // The start cell sits a third up from the bottom, horizontally centred.
    const startPx = level.start.x * 32 + 16;
    const startPy = (level.start.y + 1) * 32;
    const cropX = Math.max(0, Math.min(obj.width - width, startPx - (width >> 1)));
    const cropY = Math.max(0, Math.min(obj.height - height, startPy - Math.round(height * 0.7)));
    const savedW = this.scene.viewWidth;
    const savedH = this.scene.viewHeight;
    this.scene.setViewport(width, height);
    this.scene.drawObject(
      ctx,
      objectId,
      defaultLevelArtFrame(levelId),
      defaultLevelArtFrame(levelId),
      0,
      -cropX,
      -cropY,
      false,
      undefined,
      PIVOT_ANCHOR,
    );
    this.scene.setViewport(savedW, savedH);
    return canvas;
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

  /** Resting birds at the positions that replaced tile 63 (`Particles` animates them). */
  drawBirds(ctx: CanvasRenderingContext2D, cam: CameraPos, view: ViewSize, level: Level): void {
    for (const b of level.birds) {
      const x = toScreen(b.x, cam.x);
      const y = toScreen(b.y, cam.y);
      if (x < -16 || x > view.width + 16 || y < -16 || y > view.height + 16) continue;
      this.sheet.drawSprite(ctx, BIRD_SPRITE, x, y, 0, ANCHOR_BOTTOM_CENTER);
    }
  }

  // -------------------------------------------------------------------------------------------
  // Debug
  // -------------------------------------------------------------------------------------------

  /** Outline the collision shape of every visible tile (see the tile catalogue in 01-formats). */
  drawDebugTiles(
    ctx: CanvasRenderingContext2D,
    cam: CameraPos,
    view: ViewSize,
    level: Level,
  ): void {
    const x0 = Math.max(0, cam.x >> 10);
    const y0 = Math.max(0, cam.y >> 10);
    const x1 = Math.min(level.width - 1, (cam.x + (view.width << 5)) >> 10);
    const y1 = Math.min(level.height - 1, (cam.y + (view.height << 5)) >> 10);
    ctx.save();
    ctx.lineWidth = 1;
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const tile = level.tileAt(tx, ty);
        if (tile === 0) continue;
        const px = toScreen(tx << 10, cam.x) + 0.5;
        const py = toScreen(ty << 10, cam.y) + 0.5;
        drawTileShape(ctx, tile, px, py);
      }
    }
    ctx.restore();
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
        ground: cssRgb(ground),
        skyBottom: cssRgb(skyBottom),
        skyTop: cssRgb(skyTop),
      };
    }
    return this.colourCache;
  }
}

function cssRgb(rgb: number): string {
  return '#' + (rgb & 0xffffff).toString(16).padStart(6, '0');
}

const SOLID = '#ff4040';
const SURFACE = '#40ff40';
const WALL = '#ffb040';
const HANDS = '#40c0ff';
const MARKER = '#ff40ff';

function drawTileShape(ctx: CanvasRenderingContext2D, tile: number, x: number, y: number): void {
  const s = 32;
  ctx.strokeStyle = SOLID;
  switch (tile) {
    case 1:
      ctx.strokeRect(x, y, s - 1, s - 1);
      return;
    case 2:
    case 17:
      ctx.strokeStyle = tile === 17 ? HANDS : WALL;
      line(ctx, x, y, x, y + s - 1);
      return;
    case 4:
    case 18:
      ctx.strokeStyle = tile === 18 ? HANDS : WALL;
      line(ctx, x + s - 1, y, x + s - 1, y + s - 1);
      return;
    case 3:
    case 20:
      ctx.strokeStyle = SURFACE;
      line(ctx, x, y, x + s - 1, y);
      return;
    case 5:
      ctx.strokeStyle = SURFACE;
      line(ctx, x, y, x + s - 1, y);
      ctx.strokeStyle = WALL;
      line(ctx, x, y, x, y + s - 1);
      ctx.strokeStyle = HANDS;
      line(ctx, x, y, x, y + (s >> 1));
      return;
    case 6:
      ctx.strokeStyle = SURFACE;
      line(ctx, x, y, x + s - 1, y);
      ctx.strokeStyle = WALL;
      line(ctx, x + s - 1, y, x + s - 1, y + s - 1);
      ctx.strokeStyle = HANDS;
      line(ctx, x + s - 1, y, x + s - 1, y + (s >> 1));
      return;
    case 7:
      ctx.strokeStyle = SURFACE;
      line(ctx, x, y + s - 1, x + s - 1, y);
      return;
    case 8:
      ctx.strokeStyle = SURFACE;
      line(ctx, x, y, x + s - 1, y + s - 1);
      return;
    case 13:
      ctx.strokeRect(x, y, 7, s - 1);
      return;
    case 14:
      ctx.strokeRect(x + s - 8, y, 7, s - 1);
      return;
    case 19:
      ctx.strokeStyle = HANDS;
      line(ctx, x, y, x + s - 1, y);
      return;
    case 21:
      ctx.strokeStyle = SURFACE;
      line(ctx, x, y, x + s - 1, y);
      ctx.strokeStyle = SOLID;
      line(ctx, x, y + 8, x + s - 1, y + 8);
      return;
    case 22:
      ctx.strokeStyle = HANDS;
      line(ctx, x + (s >> 1), y, x + (s >> 1), y + s - 1);
      return;
    default:
      if (tile >= 49) {
        ctx.strokeStyle = MARKER;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(x, y, s - 1, s - 1);
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(x, y, s - 1, s - 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(String(tile), x + 2, y + 2);
      }
      return;
  }
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
