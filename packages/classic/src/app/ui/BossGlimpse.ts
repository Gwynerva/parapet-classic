/**
 * A glimpse of the boss's route: a hologram of what the boss did from a second before taking
 * a flag to a second after (`contestGlimpses`), looping by the flag the player is to take next
 * (the next checkpoint in a sprint, the nearest flag still up in a flag hunt), with a short
 * pause between loops. It is drawn like the ghosts (`EchoRenderer`: the boss's run outfit
 * recoloured into its colour, scanlines, a little transparent), fades in and out at the ends
 * of the loop, and gives off a few sparks on the step the flag is taken. It moves on game steps
 * only, so it pauses with the game. With reduced motion it does not loop: three still poses,
 * before, at and after the flag.
 *
 * The glimpse plays the found run at its own pace, while the boss's times on the HUD are those
 * of the slower run the player races (`CONTEST_ALLOWANCE`).
 */
import type { GlimpseTrack } from '@parapet/runtime/content/glimpses.ts';
import { drawPose, type CharacterPose } from '@parapet/runtime/render/CharacterRenderer.ts';
import type { EchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import { HologramLayer } from '@parapet/runtime/render/Hologram.ts';
import type { SceneRenderer, SpriteSwap } from '@parapet/runtime/render/SceneRenderer.ts';
import { Sparks, sparkColors } from '@parapet/runtime/render/Sparks.ts';
import type { CameraPos, ViewSize } from '@parapet/runtime/render/View.ts';
import { FrameTimer } from '@parapet/runtime/math.ts';

export interface GlimpseLook {
  /** The hologram's atlas (`EchoSheets.scene` of the boss's outfit). */
  scene: SceneRenderer;
  swap: SpriteSwap;
  color: EchoColor;
}

/** Steps of nothing between two loops (half a second). */
export const GLIMPSE_GAP_STEPS = 17;
const FADE_IN_STEPS = 4;
const FADE_OUT_STEPS = 6;
/** Opacity of the hologram: fainter than a ghost, it is a memory. */
const GLIMPSE_ALPHA = 0.6;
/** Reduced motion: the poses this many steps before and after the flag, and their opacity. */
const STILL_STEPS = 15;
const STILL_ALPHAS = [0.35, 0.8, 0.35];

/**
 * The pose of a loop `cursor` steps after it started, `alpha` of the way to the next step, and
 * its opacity; null before the loop starts (a negative cursor) and in the pause after it.
 * Positions are interpolated from the previous pose, except into a cut.
 */
export function glimpseFrame(
  track: GlimpseTrack,
  cursor: number,
  alpha: number,
): { pose: CharacterPose; opacity: number } | null {
  const n = track.poses.length;
  if (cursor < 0 || cursor >= n) return null;
  const p = track.poses[cursor]!;
  const prev = cursor > 0 && !p.cut ? track.poses[cursor - 1]! : p;
  const time = cursor + alpha;
  const opacity = Math.max(0, Math.min(1, time / FADE_IN_STEPS, (n - time) / FADE_OUT_STEPS));
  return {
    pose: {
      x: Math.round(prev.x + (p.x - prev.x) * alpha),
      y: Math.round(prev.y + (p.y - prev.y) * alpha),
      a: p.a,
      b: p.b,
      t: p.t,
      flipX: p.flipX,
      anchored: p.anchored,
    },
    opacity,
  };
}

export class BossGlimpse {
  private readonly look: GlimpseLook;
  private readonly reducedMotion: boolean;
  private readonly sparks = new Sparks();
  private track: GlimpseTrack | null = null;
  /** Steps since the loop started (negative: waiting to start). */
  private cursor = 0;
  private readonly hologram = new HologramLayer();
  private readonly frames = new FrameTimer();

  constructor(look: GlimpseLook, reducedMotion = false) {
    this.look = look;
    this.reducedMotion = reducedMotion;
  }

  /** The glimpse to loop now (null: none). A loop under way breaks off into sparks. */
  show(track: GlimpseTrack | null): void {
    if (track === this.track) return;
    const visible = this.track ? glimpseFrame(this.track, this.cursor, 1) : null;
    if (visible && !this.reducedMotion) {
      this.sparks.burst(visible.pose.x, visible.pose.y, sparkColors(this.look.color));
    }
    this.track = track;
    this.cursor = -(GLIMPSE_GAP_STEPS >> 1);
  }

  /** One game step; true when a loop has just ended (the moment to move to another flag). */
  step(): boolean {
    const track = this.track;
    if (!track || this.reducedMotion) return false;
    this.cursor++;
    if (this.cursor >= track.poses.length + GLIMPSE_GAP_STEPS) {
      this.cursor = 0;
      return true;
    }
    if (this.cursor === track.at) {
      const p = track.poses[track.at]!;
      this.sparks.burst(p.x, p.y, sparkColors(this.look.color));
    }
    return false;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    cam: CameraPos,
    alpha: number,
    nowMs: number,
    view: ViewSize,
  ): void {
    const dt = this.frames.tick(nowMs);
    const track = this.track;
    const frames: { pose: CharacterPose; opacity: number }[] = [];
    if (track && this.reducedMotion) {
      [-STILL_STEPS, 0, STILL_STEPS].forEach((d, i) => {
        const p = track.poses[Math.max(0, Math.min(track.poses.length - 1, track.at + d))];
        if (p) frames.push({ pose: p, opacity: STILL_ALPHAS[i]! });
      });
    } else if (track) {
      const frame = glimpseFrame(track, this.cursor, alpha);
      if (frame) frames.push(frame);
    }
    if (frames.length > 0) this.drawFrames(ctx, cam, frames, this.reducedMotion ? 0 : nowMs, view);
    this.sparks.draw(ctx, cam, dt);
  }

  private drawFrames(
    ctx: CanvasRenderingContext2D,
    cam: CameraPos,
    frames: readonly { pose: CharacterPose; opacity: number }[],
    nowMs: number,
    view: ViewSize,
  ): void {
    const { scene, swap } = this.look;
    for (const { pose, opacity } of frames) {
      if (opacity <= 0) continue;
      this.hologram.draw(ctx, view, nowMs, GLIMPSE_ALPHA * opacity, (lctx) => {
        scene.withViewport(view.width, view.height, () => drawPose(lctx, scene, pose, cam, swap));
        return true;
      });
    }
  }
}
