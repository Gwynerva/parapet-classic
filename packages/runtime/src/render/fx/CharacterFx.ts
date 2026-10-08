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
import { applyScanlines } from '../EchoRenderer.ts';
import { ECHO_PALETTE, makeEchoColor, type EchoColor, type EchoSheets } from '../EchoSkin.ts';
import type { LookRibbon } from '../Look.ts';
import { PoseHistory, RUNNING_UNITS } from '../PoseHistory.ts';
import { poseAnchors } from '../Pose.ts';
import { emptyAnchors, type PoseAnchors } from '../Rig.ts';
import type { CameraPos, ViewSize } from '../View.ts';
import type { FxAfterimage, FxAnchor } from './FxData.ts';
import { pick, resolveToken, type CompiledEmitter, type CompiledFx } from './FxSheet.ts';
import { FxSystem, UNITS } from './FxSystem.ts';
import { MotionTracker, triggerBit, type MotionStep } from './Motion.ts';
import { Ribbon } from './Ribbon.ts';

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
const ECHO_LAYER_ALPHA = 0.85;
const RUSH_STEPS = [
  { back: 6, alpha: 0.08 },
  { back: 5, alpha: 0.14 },
  { back: 4, alpha: 0.2 },
  { back: 3, alpha: 0.28 },
  { back: 2, alpha: 0.36 },
  { back: 1, alpha: 0.45 },
] as const;
const MAX_SNAPSHOTS = 6;
/** Milliseconds of game clock per simulation step. */
const STEP_MS = 30;

interface Snapshot {
  pose: CharacterPose;
  clock: number;
  age: number;
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
  ribbons: { ribbon: Ribbon; anchor: FxAnchor; front: boolean }[];
  rand: () => number;
  clock: number;
  motion: MotionStep | null;
}

function xorshift(seed: number): () => number {
  let s = seed | 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
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
  private layer: HTMLCanvasElement | null = null;
  private lastDrawAt = -1;
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
      ribbons: ribbonSpecs.map(({ spec, color }) => ({
        ribbon: new Ribbon(spec, color),
        anchor: spec.anchor,
        front: spec.layer === 'front',
      })),
      rand: xorshift(style.seed ?? this.entries.size * 7919 + 17),
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
      e.clock = options.clock ?? e.clock + STEP_MS;
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
        if ((m.entered & bits) !== 0) {
          e.snapshots.push({ pose: { ...pose }, clock: e.clock, age: 0 });
          if (e.snapshots.length > MAX_SNAPSHOTS) e.snapshots.shift();
        }
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
      p.x = (p.x - pivotX) * UNITS;
      p.y = (p.y - pivotY) * UNITS;
    }
    a.box.x = (a.box.x - pivotX) * UNITS;
    a.box.y = (a.box.y - pivotY) * UNITS;
    a.box.w *= UNITS;
    a.box.h *= UNITS;
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
          y: pose.y + Math.max(a.footNear.y, a.footFar.y) + 2 * UNITS,
        };
    }
  }

  private emit(e: Entry, pose: CharacterPose, m: MotionStep): void {
    const fx = e.style.fx;
    if (!fx) return;
    const vx = m.vx * (1000 / STEP_MS);
    const vy = m.vy * (1000 / STEP_MS);
    for (const em of e.emitters) {
      const spec = em.spec;
      const amount = this.reduced ? (spec.reduced ?? 0) : 1;
      if (amount <= 0) continue;
      let count = 0;
      if ((m.active & em.whileBits) !== 0 && m.speed >= (spec.minSpeed ?? 0)) {
        let owed = e.owed.get(em) ?? 0;
        if (spec.every) owed += m.distance / spec.every;
        if (spec.perSecond) owed += (spec.perSecond * STEP_MS) / 1000;
        owed *= amount;
        count += Math.floor(owed);
        e.owed.set(em, owed - Math.floor(owed));
      }
      if ((m.entered & em.enterBits) !== 0 || (m.enteredMove >= 0 && em.moves.has(m.enteredMove))) {
        if (spec.chance === undefined || e.rand() < spec.chance) {
          count += Math.round(pick(spec.burst, e.rand, 6) * amount);
        }
      }
      for (let i = 0; i < count; i++) {
        const p = this.anchorPoint(e, pose, spec.anchor);
        this.particles.spawn(
          fx,
          em,
          { x: p.x, y: p.y, facingRight: e.facingRight, vx, vy },
          e.rand,
        );
      }
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
    const rand = xorshift(seed);
    const box = { top: y - 46 * UNITS, height: 46 * UNITS };
    for (const n of names) {
      const em = fx.emitters.get(n);
      if (!em) continue;
      const amount = this.reduced ? (em.spec.reduced ?? 0.3) : 1;
      const count = Math.round(pick(em.spec.burst, rand, 20) * amount);
      for (let i = 0; i < count; i++) {
        const anchor = em.spec.anchor;
        let py = y - 26 * UNITS;
        if (anchor === 'feet' || anchor === 'foot.near' || anchor === 'foot.far') py = y;
        else if (anchor === 'head') py = y - 44 * UNITS;
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
      const chance = ((em.spec.perSecond ?? 4) * STEP_MS) / 1000;
      if (rand() >= chance) continue;
      const py = em.spec.anchor === 'feet' ? y : y - (8 + rand() * 38) * UNITS;
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
    const dt = this.lastDrawAt < 0 ? 0 : Math.min(100, Math.max(0, nowMs - this.lastDrawAt));
    this.lastDrawAt = nowMs;
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
      ctx.save();
      for (const s of e.snapshots) {
        const k = 1 - s.age / life;
        const color = this.pickColour(a, e, 0, nowMs);
        const scene = this.echo.scene(color, a.textured ?? false, e.style.source);
        ctx.globalAlpha = (a.alpha ?? 0.55) * k;
        const behind = s.pose.flipX ? 1 : -1;
        const pose = {
          ...s.pose,
          x: s.pose.x + dx * behind * UNITS * (s.age / 1000),
          y: s.pose.y + dy * UNITS * (s.age / 1000),
        };
        drawCulled(ctx, scene, view, pose, cam, e.style.swap(s.clock));
      }
      ctx.restore();
      return;
    }
    const when = a.while ?? 'running';
    if (when === 'running' && !e.history.movedOver(RUNNING_UNITS)) return;
    if (when === 'fast' && !e.history.fast) return;
    const preset = a.preset;
    const steps = a.steps ?? (preset === 'echo' ? ECHO_STEPS : RUSH_STEPS);
    const textured = a.textured ?? preset === 'echo';
    const scanlines = a.scanlines ?? preset === 'echo';
    let target = ctx;
    let layer: HTMLCanvasElement | null = null;
    if (scanlines) {
      layer = this.ensureLayer(view);
      const lctx = layer?.getContext('2d');
      if (!layer || !lctx) return;
      lctx.clearRect(0, 0, layer.width, layer.height);
      target = lctx;
    }
    target.save();
    steps.forEach(({ back, alpha }, i) => {
      const past = e.history.back(back);
      if (!past) return;
      const scene = this.echo.scene(this.pickColour(a, e, i, nowMs), textured, e.style.source);
      target.globalAlpha = alpha;
      drawCulled(target, scene, view, past, cam, swap);
    });
    target.restore();
    if (layer) {
      const lctx = layer.getContext('2d')!;
      applyScanlines(lctx, layer.width, layer.height, nowMs);
      ctx.save();
      ctx.globalAlpha = ECHO_LAYER_ALPHA;
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    }
  }

  private pickColour(a: FxAfterimage, e: Entry, i: number, nowMs: number): EchoColor {
    const c = a.colors ?? 'accent';
    if (c === 'accent') return e.style.color;
    if (c === 'rainbow') {
      return ECHO_PALETTE[(i * 2 + Math.floor(nowMs / 70)) % ECHO_PALETTE.length]!;
    }
    const token = c[i % c.length]!;
    const rgba = resolveToken(token, e.style.fx?.file.palette ?? {}, e.style.color.css);
    const hex =
      '#' + [rgba[0], rgba[1], rgba[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    return this.colour(hex);
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
  const w = scene.viewWidth;
  const h = scene.viewHeight;
  scene.setViewport(view.width, view.height);
  drawPose(ctx, scene, pose, cam, swap);
  scene.setViewport(w, h);
}
