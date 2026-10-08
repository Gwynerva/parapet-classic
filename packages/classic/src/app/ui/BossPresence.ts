/**
 * The boss on the level of a contest. It does not race in sight (its route is its secret): it
 * stands next to the start while the player gets ready, with the particles of its effect
 * around it, vanishes in a burst of them when the run starts and appears again, from the head
 * down and in another burst, the moment its time is up: back at the start in a flag hunt
 * (flags may hang in the air), at the goal in a sprint. There it waits for the player.
 *
 * It is drawn in the outfit picked for the run, or as a silhouette in its colour while it is
 * still in the workshop (with plain sparks).
 */
import type { Level, PhysicsTables } from '@parapet/sim';
import { tileHasFlag, TileFlag } from '@parapet/sim';
import type { EchoColor, EchoSheets } from '@parapet/runtime/render/EchoSkin.ts';
import { CharacterFx } from '@parapet/runtime/render/fx/CharacterFx.ts';
import type { CompiledFx } from '@parapet/runtime/render/fx/FxSheet.ts';
import {
  CHARACTER_OBJECT,
  type SceneRenderer,
  type SpriteSwap,
} from '@parapet/runtime/render/SceneRenderer.ts';
import { Sparks, sparkColors } from '@parapet/runtime/render/Sparks.ts';
import { toScreen, type CameraPos } from '@parapet/runtime/render/View.ts';

/** Where the boss stands: feet point in world units and facing. */
export interface PresenceSpot {
  x: number;
  y: number;
  facingRight: boolean;
}

export type PresenceState = 'start' | 'away' | 'end';

export interface PresenceOptions {
  scene: SceneRenderer;
  swap: SpriteSwap;
  color: EchoColor;
  start: PresenceSpot;
  end: PresenceSpot;
  clips: Int16Array;
  idleKeyframe: number;
  talkClipOffset: number;
  /** The boss's effects in its outfit's colour, or null (plain sparks). */
  fx: CompiledFx | null;
  echo: EchoSheets;
  reducedMotion?: boolean;
}

/** Height and pivot of the character object (feet at y = 76 of a 142 px tall box). */
const BODY_TOP = 76;
const BODY_HEIGHT = 142;
const BODY_WIDTH = 134;
const BODY_LEFT = 50;
const FADE_MS = 320;
const TALK_LOOP_MS = 5000;
/** Head above the feet, in world units (the speech tail points there). */
export const HEAD_HEIGHT = 1800;

/**
 * A floor cell for the boss near cell (`cx`, `cy`) (the cell its feet stand in): air in the
 * cell and the one above, a walkable top below. Two or three cells towards `towardsRight` are
 * tried first, then the other side, then the next cells; without one it stands right at the
 * point, half a tile to that side.
 */
export function standingSpot(
  level: Level,
  tables: PhysicsTables,
  cx: number,
  cy: number,
  towardsRight: boolean,
  facePointX: number,
): PresenceSpot {
  const free = (x: number, y: number): boolean =>
    tileHasFlag(tables, level.collisionTileAt(x, y), TileFlag.AIR);
  const floor = (x: number, y: number): boolean =>
    tileHasFlag(tables, level.collisionTileAt(x, y), TileFlag.WALKABLE_TOP);
  const side = towardsRight ? 1 : -1;
  for (const d of [2, 3, -2, -3, 1, -1]) {
    const x = cx + d * side;
    if (free(x, cy) && free(x, cy - 1) && floor(x, cy + 1)) {
      const px = (x << 10) + 512;
      return { x: px, y: (cy << 10) + 1024, facingRight: facePointX > px };
    }
  }
  const px = (cx << 10) + 512 + side * 512;
  return { x: px, y: (cy << 10) + 1024, facingRight: facePointX > px };
}

export class BossPresence {
  readonly color: EchoColor;
  readonly start: PresenceSpot;
  readonly end: PresenceSpot;
  talking = false;
  private readonly opts: PresenceOptions;
  private readonly sparks = new Sparks();
  private readonly particles: CharacterFx;
  private readonly rand: () => number;
  private seed = 1;
  private stateValue: PresenceState = 'start';
  /** Real time of the last vanish or appearance, for the fade. */
  private changedAt = -Infinity;
  private lastDrawAt = -1;

  constructor(opts: PresenceOptions) {
    this.opts = opts;
    this.color = opts.color;
    this.start = opts.start;
    this.end = opts.end;
    this.particles = new CharacterFx(opts.echo, { reducedMotion: opts.reducedMotion });
    let s = 0x2545f491;
    this.rand = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
  }

  /** The particles of the boss's effect at a spot, or sparks without one. */
  private burst(spot: PresenceSpot, which: 'vanish' | 'appear'): void {
    const fx = this.opts.fx;
    const names = fx?.file.presence?.[which];
    if (fx && names?.length) {
      this.particles.burstAt(fx, names, spot.x, spot.y, spot.facingRight, this.seed++);
    } else {
      this.sparks.burst(spot.x, spot.y, sparkColors(this.color));
    }
  }

  /** One simulation step: the particles around the boss while it waits. */
  step(): void {
    const spot = this.spot;
    const fx = this.opts.fx;
    const idle = fx?.file.presence?.idle;
    if (!spot || !fx || !idle?.length) return;
    this.particles.idleAt(fx, idle, spot.x, spot.y, spot.facingRight, this.rand);
  }

  get state(): PresenceState {
    return this.stateValue;
  }

  /** Where the boss is drawn now, or null while it is away. */
  get spot(): PresenceSpot | null {
    if (this.stateValue === 'start') return this.start;
    if (this.stateValue === 'end') return this.end;
    return null;
  }

  /** The run starts: the boss leaves the start. */
  vanish(nowMs: number): void {
    if (this.stateValue !== 'start') return;
    this.stateValue = 'away';
    this.changedAt = nowMs;
    this.talking = false;
    this.burst(this.start, 'vanish');
  }

  /** The boss's time is up: it is there, waiting. */
  appear(nowMs: number): void {
    if (this.stateValue === 'end') return;
    this.stateValue = 'end';
    this.changedAt = nowMs;
    this.burst(this.end, 'appear');
  }

  draw(
    ctx: CanvasRenderingContext2D,
    cam: CameraPos,
    nowMs: number,
    view: { width: number; height: number },
  ): void {
    const dt = this.lastDrawAt < 0 ? 0 : Math.min(100, Math.max(0, nowMs - this.lastDrawAt));
    this.lastDrawAt = nowMs;
    this.particles.drawBehind(ctx, cam, 0, nowMs, view);
    const t = (nowMs - this.changedAt) / FADE_MS;
    if (this.stateValue === 'away') {
      // Dissolving from the feet up during the first moments after the start.
      if (t < 1) this.drawBody(ctx, cam, this.start, nowMs, 1 - t);
    } else if (this.stateValue === 'end' && t < 1) {
      // Appearing from the head down.
      this.drawBody(ctx, cam, this.end, nowMs, t);
    } else {
      this.drawBody(ctx, cam, this.spot!, nowMs, 1);
    }
    this.sparks.draw(ctx, cam, dt);
    this.particles.drawFront(ctx, cam);
  }

  /** Draws the boss clipped to the top `shown` fraction of the body box, with a bright edge. */
  private drawBody(
    ctx: CanvasRenderingContext2D,
    cam: CameraPos,
    spot: PresenceSpot,
    nowMs: number,
    shown: number,
  ): void {
    const { scene, swap, clips, idleKeyframe, talkClipOffset } = this.opts;
    const sx = toScreen(spot.x, cam.x);
    const sy = toScreen(spot.y, cam.y);
    const top = sy - BODY_TOP;
    const left = sx - (spot.facingRight ? BODY_LEFT : BODY_WIDTH - BODY_LEFT);
    const edge = top + Math.round(BODY_HEIGHT * Math.max(0, Math.min(1, shown)));
    ctx.save();
    if (shown < 1) {
      ctx.beginPath();
      ctx.rect(left, top, BODY_WIDTH, edge - top);
      ctx.clip();
    }
    const count = clips[talkClipOffset] ?? 0;
    if (this.talking && count > 0) {
      const phase = ((nowMs % TALK_LOOP_MS) / TALK_LOOP_MS) * count;
      const frame = Math.floor(phase) % count;
      const a = clips[talkClipOffset + 1 + frame] ?? idleKeyframe;
      const b = clips[talkClipOffset + 1 + ((frame + 1) % count)] ?? a;
      const tween = Math.floor((phase - Math.floor(phase)) * 65536);
      scene.drawObject(ctx, CHARACTER_OBJECT, a, b, tween, sx, sy, !spot.facingRight, swap);
    } else {
      scene.drawFrame(
        ctx,
        CHARACTER_OBJECT,
        idleKeyframe,
        sx,
        sy,
        undefined,
        !spot.facingRight,
        swap,
      );
    }
    ctx.restore();
    if (shown > 0 && shown < 1) {
      ctx.fillStyle = this.color.light;
      ctx.fillRect(left + 24, edge, BODY_WIDTH - 48, 1);
    }
  }
}
