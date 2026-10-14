/**
 * The effects of characters as they move: for every runner (or anything that has a pose and a
 * move, like a character preview) the particles its effect scatters, its afterimages and its
 * ribbons. Steps follow the simulation (`step` after `CharacterRenderer.step`); drawing follows
 * real time, so particles keep drifting while the run is paused.
 *
 * Afterimages generalise the trails of Gwynerva's looks:
 *
 * - `echo`: three hologram afterimages of the poses two, four and six steps back, textured and
 *   with scanlines; `rush`: a streak of flat silhouettes of the last six steps;
 * - other step lists, flat or textured, in the accent, in given colours or in the rainbow;
 * - `snapshot`: a pose captured when a move starts (a dodge, a flip), fading and drifting.
 *
 * Draw `drawBehind` before the runners and `drawFront` after them.
 */
import { CHARACTER_OBJECT, type SceneRenderer, type SpriteSwap } from '../SceneRenderer.ts';
import { drawPose, type CharacterPose } from '../CharacterRenderer.ts';
import { HOLOGRAM_ALPHA, HologramLayer } from '../Hologram.ts';
import { ECHO_PALETTE, makeEchoColor, type EchoColor, type EchoSheets } from '../EchoSkin.ts';
import type { LookRibbon } from '../Look.ts';
import { PoseHistory, RUNNING_UNITS } from '../PoseHistory.ts';
import { poseAnchors } from '../Pose.ts';
import { emptyAnchors, type PoseAnchors } from '../Rig.ts';
import type { CameraPos, ViewSize } from '../View.ts';
import type { FxAfterimage, FxAnchor } from './FxData.ts';
import { pick, resolveToken, type CompiledEmitter, type CompiledFx } from './FxSheet.ts';
import { FxSystem } from './FxSystem.ts';
import { MotionTracker, triggerBit, type MotionStep } from './Motion.ts';
import { Ribbon } from './Ribbon.ts';
import { FrameTimer, Xorshift32 } from '../../math.ts';
import { cssColor } from '../color.ts';
import { UNITS_PER_PX } from '../View.ts';
import { STEP } from '@parapet/sim';

/** A thing with effects: its pose this step and its move. */
export interface FxBody {
  /** The pose at the end of the step (`CharacterRenderer.pose(runner, 1)`). */
  pose(): CharacterPose | null;
  /** The move id (`RunnerState.moveId`), or -1. */
  move(): number;
}

export interface FxStyle {
  /** The effects file compiled for the colour, or null for none. */
  fx: CompiledFx | null;
  /**
   * Which of its variants, worn together (their particles and cloth; the first afterimage);
   * none for just the outfit's own cloth.
   */
  variants: readonly string[];
  color: EchoColor;
  /** The atlas of the runner's look (afterimages and anchors keep its shapes). */
  source: SceneRenderer;
  /** Body-part swap for the frame (`clock` in ms of game clock). */
  swap: (clock: number) => SpriteSwap;
  /** Cloth of the outfit, and how its colours read. */
  ribbons?: readonly LookRibbon[];
  ribbonColor?: (token: string) => string;
  seed?: number;
}

const ECHO_STEPS = [
  { back: 6, alpha: 0.18 },
  { back: 4, alpha: 0.32 },
  { back: 2, alpha: 0.5 },
] as const;
const RUSH_STEPS = [
  { back: 6, alpha: 0.08 },
  { back: 5, alpha: 0.14 },
  { back: 4, alpha: 0.2 },
  { back: 3, alpha: 0.28 },
  { back: 2, alpha: 0.36 },
  { back: 1, alpha: 0.45 },
] as const;
const MAX_SNAPSHOTS = 8;
/** Delayed particles waiting for their time, per body, at most. */
const MAX_PENDING = 64;
/** Below this speed across (world units a second) a body is not going either way. */
const ACROSS = 10 * UNITS_PER_PX;

interface Snapshot {
  pose: CharacterPose;
  clock: number;
  age: number;
  /** Its place in its trick's chain (0 first): the colour it takes. */
  index: number;
}

interface Entry {
  body: FxBody;
  style: FxStyle;
  history: PoseHistory;
  tracker: MotionTracker;
  anchors: PoseAnchors;
  facingRight: boolean;
  /** Continuous emission owed (fractions of a particle), per emitter. */
  owed: Map<CompiledEmitter, number>;
  emitters: CompiledEmitter[];
  afterimage: FxAfterimage | null;
  snapshots: Snapshot[];
  /** A snapshot chain under way: copies still to take, when the next is due, its place. */
  chain: { left: number; next: number; index: number } | null;
  /** Particles of delayed bursts, each due at a time of the body's clock. */
  pending: { em: CompiledEmitter; due: number }[];
  ribbons: { ribbon: Ribbon; anchor: FxAnchor; front: boolean }[];
  rand: () => number;
  clock: number;
  motion: MotionStep | null;
}

/** An effect's random numbers: fractions of six digits, as the effects were tuned with. */
function effectRandom(seed: number): () => number {
  const rng = new Xorshift32(seed);
  return () => (rng.next() % 1_000_000) / 1_000_000;
}

export interface CharacterFxOptions {
  reducedMotion?: boolean;
  capacity?: number;
}

export class CharacterFx {
  private readonly echo: EchoSheets;
  private readonly entries = new Map<object, Entry>();
  readonly particles: FxSystem;
  private readonly reduced: boolean;
  private readonly hologram = new HologramLayer();
  private readonly frames = new FrameTimer();
  private readonly colours = new Map<string, EchoColor>();

  constructor(echo: EchoSheets, options: CharacterFxOptions = {}) {
    this.echo = echo;
    this.reduced = options.reducedMotion ?? false;
    this.particles = new FxSystem(options.capacity ?? 256);
  }

  add(key: object, body: FxBody, style: FxStyle): void {
    const fx = style.fx;
    const variants = fx ? style.variants.map((v) => fx.file.variants[v]).filter((v) => !!v) : [];
    const emitterNames = [...new Set(variants.flatMap((v) => v.emitters ?? []))];
    const emitters = emitterNames
      .map((n) => fx!.emitters.get(n))
      .filter((e): e is CompiledEmitter => !!e);
    const ribbonSpecs: { spec: LookRibbon; color: (t: string) => string }[] = [];
    if (!this.reduced) {
      for (const spec of style.ribbons ?? []) {
        ribbonSpecs.push({ spec, color: style.ribbonColor ?? ((t) => t) });
      }
      for (const name of new Set(variants.flatMap((v) => v.ribbons ?? []))) {
        const spec = fx!.file.ribbons?.[name];
        if (spec) ribbonSpecs.push({ spec, color: (t) => fx!.color(t) });
      }
    }
    this.entries.set(key, {
      body,
      style,
      history: new PoseHistory(),
      tracker: new MotionTracker(),
      anchors: emptyAnchors(),
      facingRight: true,
      owed: new Map(),
      emitters,
      afterimage: variants.find((v) => v.afterimage)?.afterimage ?? null,
      snapshots: [],
      chain: null,
      pending: [],
      ribbons: ribbonSpecs.map(({ spec, color }) => ({
        ribbon: new Ribbon(spec, color),
        anchor: spec.anchor,
        front: spec.layer === 'front',
      })),
      rand: effectRandom(style.seed ?? this.entries.size * 7919 + 17),
      clock: 0,
      motion: null,
    });
  }

  remove(key: object): void {
    this.entries.delete(key);
  }

  has(key: object): boolean {
    return this.entries.has(key);
  }

  clear(): void {
    this.entries.clear();
    this.particles.clear();
  }

  /**
   * Records the step's poses and emits what the moves call for; call after
   * `CharacterRenderer.step`. `silent` (a fast-forward) records without emitting.
   */
  step(options: { silent?: boolean; clock?: number } = {}): void {
    for (const e of this.entries.values()) {
      const pose = e.body.pose();
      e.history.push(pose);
      e.clock = options.clock ?? e.clock + STEP;
      if (!pose) continue;
      e.facingRight = !pose.flipX;
      this.measure(e, pose);
      const m = e.tracker.step(e.body.move(), pose.x, pose.y);
      e.motion = m;
      for (const r of e.ribbons) {
        const p = this.anchorPoint(e, pose, r.anchor);
        r.ribbon.follow(p.x, p.y, e.facingRight);
      }
      if (options.silent) continue;
      this.emit(e, pose, m);
      const a = e.afterimage;
      if (a?.mode === 'snapshot' && !this.reduced) {
        let bits = 0;
        for (const t of a.enter ?? ['roll', 'flip']) bits |= triggerBit(t);
        if ((m.entered & bits) !== 0 && (a.chance === undefined || e.rand() < a.chance)) {
          if (a.burst) this.burstWith(e, pose, m, a.burst);
          const r = a.repeat;
          if (a.delay) {
            // The whole chain later (an aim before the shot); its burst came now.
            e.chain = { left: r?.count ?? 1, next: e.clock + a.delay, index: 0 };
          } else {
            this.snap(e, pose, 0);
            e.chain =
              r && r.count > 1 ? { left: r.count - 1, next: e.clock + r.every, index: 1 } : null;
          }
        } else if (e.chain && e.clock >= e.chain.next) {
          // The rest of the chain, as the trick goes on (the chance was taken by its first).
          const { left, next, index } = e.chain;
          this.snap(e, pose, index);
          const every = a.repeat?.every ?? 0;
          e.chain = left > 1 ? { left: left - 1, next: next + every, index: index + 1 } : null;
        }
      }
      this.release(e, pose, m);
    }
  }

  /** The particles of delayed bursts whose time has come, from where the body is now. */
  private release(e: Entry, pose: CharacterPose, m: MotionStep): void {
    if (e.pending.length === 0) return;
    const fx = e.style.fx;
    const due = e.pending.filter((p) => p.due <= e.clock);
    if (due.length === 0) return;
    e.pending = e.pending.filter((p) => p.due > e.clock);
    if (!fx) return;
    for (const p of due) this.spawnNow(e, pose, m, p.em);
  }

  /** One particle of an emitter from the body this step. */
  private spawnNow(e: Entry, pose: CharacterPose, m: MotionStep, em: CompiledEmitter): void {
    const fx = e.style.fx;
    if (!fx) return;
    const vx = m.vx * (1000 / STEP);
    const vy = m.vy * (1000 / STEP);
    const right = em.spec.toward === 'motion' && Math.abs(vx) > ACROSS ? vx > 0 : e.facingRight;
    const p = this.anchorPoint(e, pose, em.spec.anchor);
    this.particles.spawn(fx, em, { x: p.x, y: p.y, facingRight: right, vx, vy }, e.rand);
  }

  /** `count` particles of a burst: now, or each after its delay. */
  private burstOf(
    e: Entry,
    pose: CharacterPose,
    m: MotionStep,
    em: CompiledEmitter,
    count: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const delay = em.spec.delay === undefined ? 0 : pick(em.spec.delay, e.rand, 0);
      if (delay > 0) {
        if (e.pending.length < MAX_PENDING) e.pending.push({ em, due: e.clock + delay });
      } else {
        this.spawnNow(e, pose, m, em);
      }
    }
  }

  /** The body's points this step from the composed pose. */
  private measure(e: Entry, pose: CharacterPose): void {
    const composed = e.style.source.compose(
      CHARACTER_OBJECT,
      pose.a,
      pose.b,
      pose.t,
      pose.flipX,
      e.style.swap(e.clock),
    );
    if (!composed) return;
    poseAnchors(
      composed.cmds,
      composed.count,
      composed.obj,
      e.style.source.sizes,
      pose.flipX,
      e.anchors,
    );
    // Into world units relative to the pose origin.
    const pivotX = pose.flipX ? composed.obj.width - composed.obj.pivotX : composed.obj.pivotX;
    const pivotY = composed.obj.pivotY;
    const a = e.anchors;
    for (const p of [
      a.head,
      a.neck,
      a.chest,
      a.hips,
      a.handNear,
      a.handFar,
      a.footNear,
      a.footFar,
    ]) {
      p.x = (p.x - pivotX) * UNITS_PER_PX;
      p.y = (p.y - pivotY) * UNITS_PER_PX;
    }
    a.box.x = (a.box.x - pivotX) * UNITS_PER_PX;
    a.box.y = (a.box.y - pivotY) * UNITS_PER_PX;
    a.box.w *= UNITS_PER_PX;
    a.box.h *= UNITS_PER_PX;
  }

  private anchorPoint(
    e: Entry,
    pose: CharacterPose,
    anchor: FxAnchor | undefined,
  ): { x: number; y: number } {
    const a = e.anchors;
    const at = (p: { x: number; y: number }): { x: number; y: number } => ({
      x: pose.x + p.x,
      y: pose.y + p.y,
    });
    switch (anchor) {
      case 'head':
        return at(a.head);
      case 'neck':
        return at(a.neck);
      case 'back':
        // Between the shoulders: halfway from the nape to the chest's middle.
        return {
          x: pose.x + (a.neck.x + a.chest.x) / 2,
          y: pose.y + (a.neck.y + a.chest.y) / 2,
        };
      case 'chest':
        return at(a.chest);
      case 'hips':
        return at(a.hips);
      case 'hand.near':
        return at(a.handNear);
      case 'hand.far':
        return at(a.handFar);
      case 'hands':
        return at(e.rand() < 0.5 ? a.handNear : a.handFar);
      case 'foot.near':
        return at(a.footNear);
      case 'foot.far':
        return at(a.footFar);
      case 'body':
        return {
          x: pose.x + a.box.x + e.rand() * a.box.w,
          y: pose.y + a.box.y + e.rand() * a.box.h,
        };
      default:
        // The feet: between the shoes, on the ground.
        return {
          x: pose.x + (a.footNear.x + a.footFar.x) / 2,
          y: pose.y + Math.max(a.footNear.y, a.footFar.y) + 2 * UNITS_PER_PX,
        };
    }
  }

  private emit(e: Entry, pose: CharacterPose, m: MotionStep): void {
    const fx = e.style.fx;
    if (!fx) return;
    for (const em of e.emitters) {
      const spec = em.spec;
      const amount = this.reduced ? (spec.reduced ?? 0) : 1;
      if (amount <= 0) continue;
      let count = 0;
      if ((m.active & em.whileBits) !== 0 && m.speed >= (spec.minSpeed ?? 0)) {
        // Reduced motion thins what each step adds; scaling the whole debt every step would
        // keep a rare emitter (a butterfly every few seconds) from ever reaching one particle.
        let owed = e.owed.get(em) ?? 0;
        if (spec.every) owed += (m.distance / spec.every) * amount;
        if (spec.perSecond) owed += ((spec.perSecond * STEP) / 1000) * amount;
        count += Math.floor(owed);
        e.owed.set(em, owed - Math.floor(owed));
      }
      // The burst's chance and size are drawn before any particle, as they always were.
      let burst = 0;
      if ((m.entered & em.enterBits) !== 0 || (m.enteredMove >= 0 && em.moves.has(m.enteredMove))) {
        if (spec.chance === undefined || e.rand() < spec.chance) {
          burst = Math.round(pick(spec.burst, e.rand, 6) * amount);
        }
      }
      for (let i = 0; i < count; i++) this.spawnNow(e, pose, m, em);
      this.burstOf(e, pose, m, em, burst);
    }
  }

  /** A snapshot of the pose this step, the `index`-th of its chain. */
  private snap(e: Entry, pose: CharacterPose, index: number): void {
    e.snapshots.push({ pose: { ...pose }, clock: e.clock, age: 0, index });
    if (e.snapshots.length > MAX_SNAPSHOTS) e.snapshots.shift();
  }

  /** A burst of the named emitters on a body this step (what a snapshot brings with it). */
  private burstWith(e: Entry, pose: CharacterPose, m: MotionStep, names: readonly string[]): void {
    const fx = e.style.fx;
    if (!fx) return;
    for (const n of names) {
      const em = fx.emitters.get(n);
      if (!em) continue;
      this.burstOf(e, pose, m, em, Math.round(pick(em.spec.burst, e.rand, 6)));
    }
  }

  /**
   * A burst of an effect's emitters at a point (feet, world units) without a body: a boss
   * vanishing at the start or appearing at the goal.
   */
  burstAt(
    fx: CompiledFx,
    names: readonly string[],
    x: number,
    y: number,
    facingRight: boolean,
    seed = 1,
  ): void {
    const rand = effectRandom(seed);
    const box = { top: y - 46 * UNITS_PER_PX, height: 46 * UNITS_PER_PX };
    for (const n of names) {
      const em = fx.emitters.get(n);
      if (!em) continue;
      const amount = this.reduced ? (em.spec.reduced ?? 0.3) : 1;
      const count = Math.round(pick(em.spec.burst, rand, 20) * amount);
      for (let i = 0; i < count; i++) {
        const anchor = em.spec.anchor;
        let py = y - 26 * UNITS_PER_PX;
        if (anchor === 'feet' || anchor === 'foot.near' || anchor === 'foot.far') py = y;
        else if (anchor === 'head') py = y - 44 * UNITS_PER_PX;
        else if (anchor === 'body') py = box.top + rand() * box.height;
        this.particles.spawn(fx, em, { x, y: py, facingRight, vx: 0, vy: 0 }, rand);
      }
    }
  }

  /** Emits continuous idle particles around a still body at (x, y) for one step. */
  idleAt(
    fx: CompiledFx,
    names: readonly string[],
    x: number,
    y: number,
    facingRight: boolean,
    rand: () => number,
  ): void {
    if (this.reduced) return;
    for (const n of names) {
      const em = fx.emitters.get(n);
      if (!em) continue;
      const chance = ((em.spec.perSecond ?? 4) * STEP) / 1000;
      if (rand() >= chance) continue;
      const py = em.spec.anchor === 'feet' ? y : y - (8 + rand() * 38) * UNITS_PER_PX;
      this.particles.spawn(fx, em, { x, y: py, facingRight, vx: 0, vy: 0 }, rand);
    }
  }

  private colour(hex: string): EchoColor {
    let col = this.colours.get(hex);
    if (!col) {
      col = makeEchoColor(`fx${hex}`, hex);
      this.colours.set(hex, col);
    }
    return col;
  }

  /** Afterimages, ribbons and particles behind the runners; moves the particles first. */
  drawBehind(
    ctx: CanvasRenderingContext2D,
    cam: CameraPos,
    clock: number,
    nowMs: number,
    view: ViewSize,
  ): void {
    const dt = this.frames.tick(nowMs);
    this.particles.update(dt);
    for (const e of this.entries.values()) {
      for (const r of e.ribbons) r.ribbon.update(dt);
      for (const s of e.snapshots) s.age += dt;
      e.snapshots = e.snapshots.filter((s) => s.age < (e.afterimage?.life ?? 450));
      this.drawAfterimages(ctx, e, cam, clock, nowMs, view);
      for (const r of e.ribbons) if (!r.front) r.ribbon.draw(ctx, cam);
    }
    this.particles.draw(ctx, cam, false);
  }

  drawFront(ctx: CanvasRenderingContext2D, cam: CameraPos): void {
    for (const e of this.entries.values()) {
      for (const r of e.ribbons) if (r.front) r.ribbon.draw(ctx, cam);
    }
    this.particles.draw(ctx, cam, true);
  }

  private drawAfterimages(
    ctx: CanvasRenderingContext2D,
    e: Entry,
    cam: CameraPos,
    clock: number,
    nowMs: number,
    view: ViewSize,
  ): void {
    const a = e.afterimage;
    if (!a) return;
    const swap = e.style.swap(clock);
    if (a.mode === 'snapshot') {
      if (e.snapshots.length === 0) return;
      const life = a.life ?? 450;
      const [dx, dy] = a.drift ?? [0, -10];
      const paint = (target: CanvasRenderingContext2D): boolean => {
        target.save();
        for (const s of e.snapshots) {
          const k = 1 - s.age / life;
          const color = this.pickColour(a, e, s.index, nowMs);
          const scene = this.echo.scene(color, a.textured ?? false, e.style.source);
          target.globalAlpha = (a.alpha ?? 0.55) * k;
          const behind = s.pose.flipX ? 1 : -1;
          const pose = {
            ...s.pose,
            x: s.pose.x + dx * behind * UNITS_PER_PX * (s.age / 1000),
            y: s.pose.y + dy * UNITS_PER_PX * (s.age / 1000),
          };
          drawCulled(target, scene, view, pose, cam, e.style.swap(s.clock));
        }
        target.restore();
        return true;
      };
      // With scanlines the copies are a hologram of their own.
      if (a.scanlines) this.hologram.draw(ctx, view, nowMs, 1, paint);
      else paint(ctx);
      return;
    }
    const when = a.while ?? 'running';
    if (when === 'running' && !e.history.movedOver(RUNNING_UNITS)) return;
    if (when === 'fast' && !e.history.fast) return;
    const preset = a.preset;
    const steps = a.steps ?? (preset === 'echo' ? ECHO_STEPS : RUSH_STEPS);
    const textured = a.textured ?? preset === 'echo';
    const scanlines = a.scanlines ?? preset === 'echo';
    const paint = (target: CanvasRenderingContext2D): boolean => {
      target.save();
      steps.forEach(({ back, alpha }, i) => {
        const past = e.history.back(back);
        if (!past) return;
        const scene = this.echo.scene(this.pickColour(a, e, i, nowMs), textured, e.style.source);
        target.globalAlpha = alpha;
        drawCulled(target, scene, view, past, cam, swap);
      });
      target.restore();
      return true;
    };
    if (scanlines) this.hologram.draw(ctx, view, nowMs, HOLOGRAM_ALPHA, paint);
    else paint(ctx);
  }

  private pickColour(a: FxAfterimage, e: Entry, i: number, nowMs: number): EchoColor {
    const c = a.colors ?? 'accent';
    if (c === 'accent') return e.style.color;
    if (c === 'rainbow') {
      return ECHO_PALETTE[(i * 2 + Math.floor(nowMs / 70)) % ECHO_PALETTE.length]!;
    }
    const token = c[i % c.length]!;
    const rgba = resolveToken(token, e.style.fx?.file.palette ?? {}, e.style.color.css);
    return this.colour(cssColor(rgba));
  }
}

/**
 * Draws a pose culled to `view`, leaving the scene's own culling box as it was (scenes are
 * shared: menus draw with them at other sizes).
 */
function drawCulled(
  ctx: CanvasRenderingContext2D,
  scene: SceneRenderer,
  view: ViewSize,
  pose: CharacterPose,
  cam: CameraPos,
  swap: SpriteSwap,
): void {
  scene.withViewport(view.width, view.height, () => drawPose(ctx, scene, pose, cam, swap));
}
