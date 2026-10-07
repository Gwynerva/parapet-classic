/**
 * Draws the echoes: ghosts of recorded runs and the rivals of the original, as holograms.
 *
 * Every echo is drawn into an offscreen layer with its recoloured skin (`EchoSheets`), then
 * the layer gets scanlines (every third pixel row dimmed, the phase crawling downwards) and
 * is laid over the scene slightly transparent. On top of that:
 *
 * - a speed trail: three afterimages of the poses two, four and six steps back while the
 *   runner moves fast;
 * - materialising: when the run starts, the echo is revealed from the head down behind a
 *   bright scan edge;
 * - dissolving: when a ghost's run ends it bursts into sparks of its colour and leaves a small
 *   flag where it stopped.
 *
 * Animation stays with `CharacterRenderer` (echo runners are attached with `echo: true`);
 * this class only asks for their poses.
 */
import type { RunnerState } from '@parapet/sim';
import { drawPose, type CharacterPose, type CharacterRenderer } from './CharacterRenderer.ts';
import type { EchoColor, EchoSheets } from './EchoSkin.ts';
import type { SpriteSwap } from './SceneRenderer.ts';
import { toScreen, type CameraPos, type ViewSize } from './View.ts';

/** Pivot and size of the character object (feet at y = 76 of a 142 px tall box). */
const BODY_TOP = 76;
const BODY_HEIGHT = 142;
const BODY_WIDTH = 134;
const BODY_LEFT = 50;
/** Opacity of the hologram layer. */
const LAYER_ALPHA = 0.85;
/** Scanlines: one dimmed row in every `SCAN_PERIOD`, moving one row every `SCAN_STEP_MS`. */
const SCAN_PERIOD = 3;
const SCAN_STEP_MS = 90;
const SCAN_DIM = 'rgba(0, 0, 0, 0.55)';
/** Steps back of the afterimages and their opacity. */
const TRAIL = [
  { back: 6, alpha: 0.1 },
  { back: 4, alpha: 0.2 },
  { back: 2, alpha: 0.35 },
] as const;
const TRAIL_LENGTH = 7;
/** Distance (world units) covered over six steps above which the trail shows. */
const TRAIL_MIN_UNITS = 900;
const REVEAL_MS = 320;
const SPARK_COUNT = 28;
/** Body centre above the feet, in world units (32 per pixel). */
const BURST_HEIGHT = 900;

export interface EchoStyle {
  color: EchoColor;
  /** Keep the sprite detail (players) or draw a flat silhouette (the original's rivals). */
  textured: boolean;
  /** Body-part swap for the frame (`clock` in ms of game clock). */
  swap: (clock: number) => SpriteSwap;
}

/** Where a ghost's run ended. */
export interface EchoMarker {
  runner: RunnerState;
  x: number;
  y: number;
  color: EchoColor;
}

interface Entry {
  runner: RunnerState;
  style: EchoStyle;
  trail: (CharacterPose | null)[];
  steps: number;
  revealAt: number;
  gone: boolean;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: string;
}

export class EchoRenderer {
  private readonly characters: CharacterRenderer;
  private readonly sheets: EchoSheets;
  private readonly entries = new Map<RunnerState, Entry>();
  private readonly sparks: Spark[] = [];
  private readonly markerList: EchoMarker[] = [];
  private layer: HTMLCanvasElement | null = null;
  private lastDrawAt = -1;

  constructor(characters: CharacterRenderer, sheets: EchoSheets) {
    this.characters = characters;
    this.sheets = sheets;
  }

  /** Draw `runner` as an echo; it stays hidden until `reveal`. */
  add(runner: RunnerState, style: EchoStyle): void {
    this.entries.set(runner, {
      runner,
      style,
      trail: new Array<CharacterPose | null>(TRAIL_LENGTH).fill(null),
      steps: 0,
      revealAt: -1,
      gone: false,
    });
  }

  has(runner: RunnerState): boolean {
    return this.entries.has(runner);
  }

  styleOf(runner: RunnerState): EchoStyle | undefined {
    return this.entries.get(runner)?.style;
  }

  /** Starts materialising every echo not shown yet (`nowMs` is real time). */
  reveal(nowMs: number): void {
    for (const e of this.entries.values()) if (e.revealAt < 0) e.revealAt = nowMs;
  }

  /** Whether a runner is drawn right now (revealed and not dissolved). */
  isVisible(runner: RunnerState): boolean {
    const e = this.entries.get(runner);
    return !!e && e.revealAt >= 0 && !e.gone;
  }

  /** Record the step's poses for the trails; call after `CharacterRenderer.step`. */
  step(): void {
    for (const e of this.entries.values()) {
      e.trail[e.steps % TRAIL_LENGTH] = this.characters.pose(e.runner, 1);
      e.steps++;
    }
  }

  /** The ghost's run ended: burst into sparks and leave a flag where it stood. */
  dissolve(runner: RunnerState): void {
    const e = this.entries.get(runner);
    if (!e || e.gone) return;
    e.gone = true;
    const pose = this.characters.pose(runner, 1);
    if (!pose || e.revealAt < 0) return;
    const { ramp } = e.style.color;
    const colors = [e.style.color.css, e.style.color.light, rgbCss(ramp.highlight)];
    const x = runner.x;
    const y = runner.y - BURST_HEIGHT;
    for (let i = 0; i < SPARK_COUNT; i++) {
      const angle = (i / SPARK_COUNT) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 1.6 + Math.random() * 3.2;
      this.sparks.push({
        x,
        y: y + (Math.random() - 0.5) * 1200,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        age: 0,
        life: 550 + Math.random() * 450,
        color: colors[i % colors.length]!,
      });
    }
    this.markerList.push({ runner, x: runner.x, y: runner.y, color: e.style.color });
  }

  get markers(): readonly EchoMarker[] {
    return this.markerList;
  }

  /**
   * Screen position (pixels) of a visible echo's draw origin, or null; `anchored` tells
   * whether that origin is the hands (hanging, climbing) rather than the feet.
   */
  screenPosition(
    runner: RunnerState,
    cam: CameraPos,
    alpha: number,
  ): { x: number; y: number; anchored: boolean } | null {
    if (!this.isVisible(runner)) return null;
    const pose = this.characters.pose(runner, alpha);
    if (!pose) return null;
    return { x: toScreen(pose.x, cam.x), y: toScreen(pose.y, cam.y), anchored: pose.anchored };
  }

  draw(
    ctx: CanvasRenderingContext2D,
    cam: CameraPos,
    alpha: number,
    clock: number,
    nowMs: number,
    view: ViewSize,
  ): void {
    const dt = this.lastDrawAt < 0 ? 0 : Math.min(100, Math.max(0, nowMs - this.lastDrawAt));
    this.lastDrawAt = nowMs;
    this.drawMarkers(ctx, cam);
    const layer = this.ensureLayer(view);
    const lctx = layer?.getContext('2d');
    if (layer && lctx) {
      lctx.clearRect(0, 0, layer.width, layer.height);
      let drawn = false;
      for (const e of this.entries.values()) {
        if (e.revealAt < 0 || e.gone) continue;
        drawn = this.drawEntry(lctx, e, cam, alpha, clock, nowMs, view) || drawn;
      }
      if (drawn) {
        lctx.globalCompositeOperation = 'destination-out';
        lctx.fillStyle = SCAN_DIM;
        const phase = Math.floor(nowMs / SCAN_STEP_MS) % SCAN_PERIOD;
        for (let y = phase; y < layer.height; y += SCAN_PERIOD) lctx.fillRect(0, y, layer.width, 1);
        lctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.globalAlpha = LAYER_ALPHA;
        ctx.drawImage(layer, 0, 0);
        ctx.restore();
      }
    }
    this.drawSparks(ctx, cam, dt);
  }

  private drawEntry(
    lctx: CanvasRenderingContext2D,
    e: Entry,
    cam: CameraPos,
    alpha: number,
    clock: number,
    nowMs: number,
    view: ViewSize,
  ): boolean {
    const pose = this.characters.pose(e.runner, alpha);
    if (!pose) return false;
    const scene = this.sheets.scene(e.style.color, e.style.textured);
    scene.setViewport(view.width, view.height);
    const swap = e.style.swap(clock);
    const revealed = (nowMs - e.revealAt) / REVEAL_MS;

    if (revealed >= 1 && this.isFast(e)) {
      for (const { back, alpha: a } of TRAIL) {
        const past = e.trail[(e.steps - 1 - back + TRAIL_LENGTH * 4) % TRAIL_LENGTH];
        if (!past) continue;
        lctx.globalAlpha = a;
        drawPose(lctx, scene, past, cam, swap);
      }
      lctx.globalAlpha = 1;
    }

    if (revealed < 1) {
      const sx = toScreen(pose.x, cam.x);
      const top = toScreen(pose.y, cam.y) - BODY_TOP;
      const left = sx - (pose.flipX ? BODY_WIDTH - BODY_LEFT : BODY_LEFT);
      const edge = top + Math.round(BODY_HEIGHT * Math.max(0, revealed));
      lctx.save();
      lctx.beginPath();
      lctx.rect(left, top, BODY_WIDTH, edge - top);
      lctx.clip();
      drawPose(lctx, scene, pose, cam, swap);
      lctx.restore();
      lctx.fillStyle = e.style.color.light;
      lctx.fillRect(left + 24, edge, BODY_WIDTH - 48, 1);
    } else {
      drawPose(lctx, scene, pose, cam, swap);
    }
    return true;
  }

  private isFast(e: Entry): boolean {
    if (e.steps < TRAIL_LENGTH) return false;
    const now = e.trail[(e.steps - 1) % TRAIL_LENGTH];
    const then = e.trail[e.steps % TRAIL_LENGTH];
    if (!now || !then) return false;
    return Math.abs(now.x - then.x) + Math.abs(now.y - then.y) > TRAIL_MIN_UNITS;
  }

  /** A small flag at every place a ghost's run ended: pole in the rim tone, cloth in the body. */
  private drawMarkers(ctx: CanvasRenderingContext2D, cam: CameraPos): void {
    for (const m of this.markerList) {
      const x = toScreen(m.x, cam.x);
      const y = toScreen(m.y, cam.y);
      ctx.fillStyle = '#000000';
      ctx.fillRect(x - 1, y - 15, 3, 16);
      ctx.fillStyle = m.color.light;
      ctx.fillRect(x, y - 14, 1, 14);
      ctx.fillStyle = m.color.css;
      for (let row = 0; row < 7; row++) {
        const w = 7 - Math.abs(row - 3) * 2;
        ctx.fillRect(x + 1, y - 14 + row, w, 1);
      }
    }
  }

  private drawSparks(ctx: CanvasRenderingContext2D, cam: CameraPos, dt: number): void {
    let alive = 0;
    for (const s of this.sparks) {
      s.age += dt;
      if (s.age >= s.life) continue;
      s.vy += 0.008 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      this.sparks[alive++] = s;
      const size = s.age < s.life * 0.6 ? 2 : 1;
      ctx.fillStyle = s.color;
      ctx.fillRect(toScreen(s.x, cam.x), toScreen(s.y, cam.y), size, size);
    }
    this.sparks.length = alive;
  }

  private ensureLayer(view: ViewSize): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    if (!this.layer) this.layer = document.createElement('canvas');
    if (this.layer.width !== view.width) this.layer.width = view.width;
    if (this.layer.height !== view.height) this.layer.height = view.height;
    const lctx = this.layer.getContext('2d');
    if (lctx) lctx.imageSmoothingEnabled = false;
    return this.layer;
  }
}

function rgbCss(c: readonly [number, number, number]): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
