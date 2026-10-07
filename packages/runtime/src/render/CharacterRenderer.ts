/**
 * Draws runners (the player, rivals, ghosts) with the character object of `k0` and the
 * per-runner `Animator`. Port of `aj()` (d.java line 5886) and of the skin logic of
 * `a(int,int[])` (line 5931). Echo runners (rivals and ghosts) are animated here too but
 * drawn by `EchoRenderer`, which asks for their `pose`.
 *
 * The character object has its pivot (50, 76) on the feet point, so the runner's render
 * position (or the hands point while a move anchors there) is passed as the pivot position.
 */
import type { MoveTable, RunnerState, WorldEvent } from '@parapet/sim';
import { Animator, HEAD_SPRITE } from '../anim/Animator.ts';
import { CHARACTER_OBJECT, type SceneRenderer, type SpriteSwap } from './SceneRenderer.ts';
import { toScreen, type CameraPos } from './View.ts';

/** Male characters get the male torso/arm parts (`a(int,int[])`: n2 ∈ {0, 1, 3, 6, 8}). */
const MALE_CHARACTERS = new Set([1, 2, 4, 7, 9]);

/**
 * Body-part swap of character `character` (0 = Blaise with the default heads 25–29).
 * `face` is the face sprite replacing the head this frame, or -1; it only applies to Blaise
 * because the other characters replace the head before the face check can keep it.
 */
export function skinSwap(character: number, face = -1): SpriteSwap {
  if (character <= 0) {
    if (face < 0) return identitySwap;
    return (id, transform) =>
      id === HEAD_SPRITE && (transform === 0 || transform === 4) ? face : id;
  }
  const c = character - 1;
  const male = MALE_CHARACTERS.has(character);
  return (id) => {
    if (id >= 13 && id <= 16) return -1;
    if (id >= 25 && id <= 29) return 82 + c * 5 + (id - 25);
    if (male) {
      if (id >= 34 && id <= 38) return 127 + (id - 34);
      if (id >= 57 && id <= 61) return 132 + (id - 57);
    }
    return id;
  };
}

const identitySwap: SpriteSwap = (id) => id;

/** A runner's draw origin (world units) and keyframe tween for one frame. */
export interface CharacterPose {
  x: number;
  y: number;
  /** Keyframes tweened from `a` to `b` by `t` (0..65536). */
  a: number;
  b: number;
  t: number;
  flipX: boolean;
  /** The origin is the hands point (hanging, climbing) rather than the feet. */
  anchored: boolean;
}

/** Draws the character object in `pose` with `scene`'s sprites. */
export function drawPose(
  ctx: CanvasRenderingContext2D,
  scene: SceneRenderer,
  pose: CharacterPose,
  cam: CameraPos,
  swap: SpriteSwap,
): void {
  scene.drawObject(
    ctx,
    CHARACTER_OBJECT,
    pose.a,
    pose.b,
    pose.t,
    toScreen(pose.x, cam.x),
    toScreen(pose.y, cam.y),
    pose.flipX,
    swap,
  );
}

export interface RunnerVisualOptions {
  /** Character id: 0 Blaise, 1..9 the other skins. */
  character?: number;
  /** Drawn by `EchoRenderer` (rivals and ghosts), not by `drawAll`. */
  echo?: boolean;
  /** Seed of the blink PRNG. */
  seed?: number;
}

/** Per-runner visual state. */
export interface RunnerVisual {
  readonly runner: RunnerState;
  readonly animator: Animator;
  character: number;
  echo: boolean;
  /** Draw positions (units) captured at the previous and the current step. */
  prevX: number;
  prevY: number;
  x: number;
  y: number;
  flipX: boolean;
  /** Draw origin convention of the current step (hands or feet). */
  anchored: boolean;
}

/**
 * Per-step displacement above which a runner is considered teleported rather than moved: the
 * fastest legitimate motion is the fall cap (17300 units per 1024 time units ≈ 507 per step).
 */
export const TELEPORT_UNITS = 600;

export interface NpcOptions {
  /** Feet position in units. */
  x: number;
  y: number;
  character: number;
  facingRight?: boolean;
  /** Keyframe shown while idle (the coach holds 434). */
  idleKeyframe: number;
  /** Clip played while `talking` (the coach's 483), looped over `talkLoopMs` of real time. */
  talkClipOffset?: number;
  talkLoopMs?: number;
}

/**
 * A character that is not simulated: the coach of the warm-ups, the pair of the Prize scene.
 * Drawn from a fixed keyframe, or from a clip cycled by real time while it talks.
 */
export interface NpcVisual {
  x: number;
  y: number;
  character: number;
  facingRight: boolean;
  idleKeyframe: number;
  talkClipOffset: number;
  talkLoopMs: number;
  talking: boolean;
}

export class CharacterRenderer {
  private readonly scene: SceneRenderer;
  private readonly moves: MoveTable;
  private readonly clips: Int16Array;
  private readonly visuals = new Map<RunnerState, RunnerVisual>();
  private readonly npcs = new Map<string, NpcVisual>();

  constructor(scene: SceneRenderer, moves: MoveTable, clips: Int16Array) {
    this.scene = scene;
    this.moves = moves;
    this.clips = clips;
  }

  /** Start tracking a runner; it shows the idle loop until its first move change. */
  attach(runner: RunnerState, options: RunnerVisualOptions = {}): RunnerVisual {
    const animator = new Animator(this.clips, options.seed ?? this.visuals.size + 1);
    animator.setIdle(runner);
    const p = animator.drawParams(runner);
    const visual: RunnerVisual = {
      runner,
      animator,
      character: options.character ?? 0,
      echo: options.echo ?? false,
      prevX: p.x,
      prevY: p.y,
      x: p.x,
      y: p.y,
      flipX: p.flipX,
      anchored: runner.handsAnchored,
    };
    this.visuals.set(runner, visual);
    return visual;
  }

  detach(runner: RunnerState): void {
    this.visuals.delete(runner);
  }

  get(runner: RunnerState): RunnerVisual | undefined {
    return this.visuals.get(runner);
  }

  /** Apply the move changes of a step (`O(int)` → `c(...)`). */
  onEvents(events: readonly WorldEvent[]): void {
    for (const e of events) {
      if (e.type !== 'move') continue;
      const visual = this.visuals.get(e.runner);
      if (!visual) continue;
      // The original sets the clip inside the physics step, before the facing flip and the
      // anchor change of that step; the event carries that moment.
      visual.animator.setMove(this.moves.get(e.to), e.timer, e.entry);
    }
  }

  /**
   * Advance every animator by one step (`z(30720)`); `clock` is the game clock in ms.
   *
   * The frame interpolation between steps is ours (the original drew the per-step position
   * only). It must not bridge discontinuities: when the draw origin switches between the feet
   * and the hands (ledge grabs, ladders, drops) or the runner is snapped by a move entry, the
   * keyframes are authored in different frames and sliding the origin over a step would throw
   * the body up or down. Such jumps are drawn instantly, like the original does.
   */
  step(clock: number, dtUnits = 30): void {
    for (const v of this.visuals.values()) {
      v.animator.update(dtUnits, v.runner, clock);
      const p = v.animator.drawParams(v.runner);
      const anchored = v.runner.handsAnchored;
      const teleport =
        anchored !== v.anchored ||
        Math.abs(p.x - v.x) > TELEPORT_UNITS ||
        Math.abs(p.y - v.y) > TELEPORT_UNITS;
      v.prevX = teleport ? p.x : v.x;
      v.prevY = teleport ? p.y : v.y;
      v.x = p.x;
      v.y = p.y;
      v.flipX = p.flipX;
      v.anchored = anchored;
    }
  }

  /**
   * Where and how a runner is drawn this frame: the draw origin in world units, interpolated
   * by `alpha` between the previous and the current step, and the keyframe tween.
   */
  pose(runner: RunnerState, alpha: number): CharacterPose | null {
    const v = this.visuals.get(runner);
    if (!v) return null;
    const f = v.animator.frames();
    return {
      x: Math.round(v.prevX + (v.x - v.prevX) * alpha),
      y: Math.round(v.prevY + (v.y - v.prevY) * alpha),
      a: f.a,
      b: f.b,
      t: f.t,
      flipX: v.flipX,
      anchored: v.anchored,
    };
  }

  /** Body-part swap of a runner's skin this frame (`clock` drives the blinking face). */
  swapFor(runner: RunnerState, clock: number): SpriteSwap {
    const v = this.visuals.get(runner);
    if (!v) return identitySwap;
    return skinSwap(v.character, v.animator.faceSprite(clock));
  }

  /**
   * Draw one runner. `alpha` interpolates the draw position between the previous and the
   * current step; `clock` is the game clock in ms (face timers).
   */
  draw(
    ctx: CanvasRenderingContext2D,
    runner: RunnerState,
    cam: CameraPos,
    alpha: number,
    clock: number,
  ): void {
    const p = this.pose(runner, alpha);
    if (!p) return;
    drawPose(ctx, this.scene, p, cam, this.swapFor(runner, clock));
  }

  attachNpc(id: string, opts: NpcOptions): NpcVisual {
    const npc: NpcVisual = {
      x: opts.x,
      y: opts.y,
      character: opts.character,
      facingRight: opts.facingRight ?? true,
      idleKeyframe: opts.idleKeyframe,
      talkClipOffset: opts.talkClipOffset ?? -1,
      talkLoopMs: opts.talkLoopMs ?? 5000,
      talking: false,
    };
    this.npcs.set(id, npc);
    return npc;
  }

  detachNpc(id: string): void {
    this.npcs.delete(id);
  }

  getNpc(id: string): NpcVisual | undefined {
    return this.npcs.get(id);
  }

  clearNpcs(): void {
    this.npcs.clear();
  }

  /** Draw the NPCs; `nowMs` is real time (`u` in the original), which drives the talk loop. */
  drawNpcs(ctx: CanvasRenderingContext2D, cam: CameraPos, nowMs: number): void {
    for (const npc of this.npcs.values()) {
      const sx = toScreen(npc.x, cam.x);
      const sy = toScreen(npc.y, cam.y);
      const swap = skinSwap(npc.character);
      const count = npc.talkClipOffset >= 0 ? (this.clips[npc.talkClipOffset] ?? 0) : 0;
      if (npc.talking && count > 0) {
        const phase = ((nowMs % npc.talkLoopMs) / npc.talkLoopMs) * count;
        const frame = Math.floor(phase) % count;
        const next = (frame + 1) % count;
        const a = this.clips[npc.talkClipOffset + 1 + frame] ?? npc.idleKeyframe;
        const b = this.clips[npc.talkClipOffset + 1 + next] ?? a;
        const t = Math.floor((phase - Math.floor(phase)) * 65536);
        this.scene.drawObject(ctx, CHARACTER_OBJECT, a, b, t, sx, sy, !npc.facingRight, swap);
      } else {
        this.scene.drawFrame(
          ctx,
          CHARACTER_OBJECT,
          npc.idleKeyframe,
          sx,
          sy,
          undefined,
          !npc.facingRight,
          swap,
        );
      }
    }
  }

  /** Draw every tracked runner except the echoes, `last` (the player) on top. */
  drawAll(
    ctx: CanvasRenderingContext2D,
    cam: CameraPos,
    alpha: number,
    clock: number,
    last?: RunnerState,
  ): void {
    for (const v of this.visuals.values()) {
      if (v.runner === last || v.echo) continue;
      this.draw(ctx, v.runner, cam, alpha, clock);
    }
    if (last && !this.visuals.get(last)?.echo) this.draw(ctx, last, cam, alpha, clock);
  }
}
