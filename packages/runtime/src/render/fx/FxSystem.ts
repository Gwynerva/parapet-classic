/**
 * The particles of the effects: a fixed pool (no allocation while running; when it is full the
 * oldest particle makes room), moved in real time and drawn in world space behind or in front of
 * the runners. Sprites turn in right angles and keep their pixels square.
 */
import { SpriteSheet, ANCHOR_CENTER, mirrorTransform } from '../SpriteSheet.ts';
import { toScreen, type CameraPos } from '../View.ts';
import { pick, type CompiledEmitter, type CompiledFx } from './FxSheet.ts';

/** World units per pixel. */
export const UNITS = 32;

interface Particle {
  alive: boolean;
  fx: CompiledFx | null;
  emitter: CompiledEmitter | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  fadeIn: number;
  fadeOut: number;
  s0: number;
  s1: number;
  tumble: number;
  turn: number;
  flutterAmp: number;
  flutterFreq: number;
  phase: number;
  gravity: number;
  drag: number;
  frame: number;
  fps: number;
  loop: boolean;
  mirror: boolean;
  color: string;
  size: number;
  add: boolean;
  front: boolean;
}

function particle(): Particle {
  return {
    alive: false,
    fx: null,
    emitter: null,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
    life: 1,
    fadeIn: 0,
    fadeOut: 0,
    s0: 1,
    s1: 1,
    tumble: 0,
    turn: 0,
    flutterAmp: 0,
    flutterFreq: 0,
    phase: 0,
    gravity: 0,
    drag: 0,
    frame: 0,
    fps: 0,
    loop: true,
    mirror: false,
    color: '#fff',
    size: 1,
    add: false,
    front: false,
  };
}

/** How a particle starts: the point, the runner's facing and the velocity it may inherit. */
export interface SpawnAt {
  x: number;
  y: number;
  facingRight: boolean;
  /** The emitter's source velocity in world units per second. */
  vx: number;
  vy: number;
}

export class FxSystem {
  private readonly pool: Particle[];
  private cursor = 0;
  private readonly counts = new Map<CompiledEmitter, number>();

  constructor(capacity = 256) {
    this.pool = Array.from({ length: capacity }, particle);
  }

  get alive(): number {
    let n = 0;
    for (const p of this.pool) if (p.alive) n++;
    return n;
  }

  /** How many particles of an emitter are alive. */
  count(e: CompiledEmitter): number {
    return this.counts.get(e) ?? 0;
  }

  clear(): void {
    for (const p of this.pool) p.alive = false;
    this.counts.clear();
  }

  /** Emits one particle of `e` (unless the emitter is at its maximum). */
  spawn(fx: CompiledFx, e: CompiledEmitter, at: SpawnAt, rand: () => number): void {
    const spec = e.spec;
    if (spec.max !== undefined && this.count(e) >= spec.max) return;
    let p: Particle | undefined;
    for (let i = 0; i < this.pool.length; i++) {
      const c = this.pool[(this.cursor + i) % this.pool.length]!;
      if (!c.alive) {
        p = c;
        this.cursor = (this.cursor + i + 1) % this.pool.length;
        break;
      }
    }
    if (!p) {
      p = this.pool[this.cursor]!;
      this.cursor = (this.cursor + 1) % this.pool.length;
      this.release(p);
    }
    const behind = at.facingRight ? -1 : 1;
    const angle = (pick(spec.angle, rand, 90) * Math.PI) / 180;
    const speed = pick(spec.speed, rand, 0) * UNITS;
    const inherit = spec.inherit ?? 0;
    const [ox, oy] = spec.offset ?? [0, 0];
    const [jx, jy] = spec.jitter ?? [0, 0];
    p.alive = true;
    p.fx = fx;
    p.emitter = e;
    p.x = at.x + (ox * behind + (rand() * 2 - 1) * jx) * UNITS;
    p.y = at.y + (oy + (rand() * 2 - 1) * jy) * UNITS;
    p.vx = Math.cos(angle) * speed * behind + at.vx * inherit;
    p.vy = -Math.sin(angle) * speed + at.vy * inherit;
    p.age = 0;
    p.life = Math.max(1, pick(spec.life, rand, 500));
    p.fadeIn = spec.fadeIn ?? 0;
    p.fadeOut = spec.fadeOut ?? p.life * 0.4;
    p.s0 = pick(spec.scale, rand, 1);
    p.s1 = spec.scaleEnd ?? p.s0;
    p.tumble = pick(spec.tumble, rand, 0) * (rand() < 0.5 ? -1 : 1);
    p.turn = spec.tumble ? Math.floor(rand() * 4) : 0;
    p.flutterAmp = (spec.flutter?.amp ?? 0) * UNITS;
    p.flutterFreq = spec.flutter?.freq ?? 0;
    p.phase = rand() * Math.PI * 2;
    p.gravity = (spec.gravity ?? 0) * UNITS;
    p.drag = spec.drag ?? 0;
    const frames = e.frames.length;
    p.frame = spec.sprite?.random && frames > 0 ? Math.floor(rand() * frames) : 0;
    p.fps = spec.sprite?.random ? 0 : (spec.sprite?.fps ?? 0);
    p.loop = spec.sprite?.loop ?? true;
    p.mirror = !!spec.face && !at.facingRight;
    p.color = e.colors.length > 0 ? e.colors[Math.floor(rand() * e.colors.length)]! : '#fff';
    p.size = Math.max(1, Math.round(pick(spec.rect?.size, rand, 1)));
    p.add = spec.blend === 'add';
    p.front = spec.layer === 'front';
    this.counts.set(e, this.count(e) + 1);
  }

  private release(p: Particle): void {
    if (!p.alive) return;
    p.alive = false;
    if (p.emitter) this.counts.set(p.emitter, Math.max(0, this.count(p.emitter) - 1));
  }

  /** Moves every particle by `dtMs` of real time. */
  update(dtMs: number): void {
    if (dtMs <= 0) return;
    const dt = Math.min(dtMs, 100) / 1000;
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.age += dt * 1000;
      if (p.age >= p.life) {
        this.release(p);
        continue;
      }
      if (p.drag > 0) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  /** Draws the particles of one layer (`front` or behind the runners). */
  draw(ctx: CanvasRenderingContext2D, cam: CameraPos, front: boolean): void {
    const savedAlpha = ctx.globalAlpha;
    const savedOp = ctx.globalCompositeOperation;
    for (const p of this.pool) {
      if (!p.alive || p.front !== front || !p.emitter || !p.fx) continue;
      const t = p.age / p.life;
      let alpha = 1;
      if (p.fadeIn > 0 && p.age < p.fadeIn) alpha = p.age / p.fadeIn;
      const left = p.life - p.age;
      if (p.fadeOut > 0 && left < p.fadeOut) alpha = Math.min(alpha, left / p.fadeOut);
      if (alpha <= 0.02) continue;
      const wobble = p.flutterAmp
        ? p.flutterAmp * Math.sin((p.age / 1000) * p.flutterFreq * Math.PI * 2 + p.phase)
        : 0;
      const sx = toScreen(p.x + wobble, cam.x);
      const sy = toScreen(p.y, cam.y);
      const scale = p.s0 + (p.s1 - p.s0) * t;
      ctx.globalAlpha = savedAlpha * alpha;
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      const frames = p.emitter.frames;
      if (frames.length === 0) {
        const size = Math.max(1, Math.round(p.size * scale));
        ctx.fillStyle = p.color;
        ctx.fillRect(sx - (size >> 1), sy - (size >> 1), size, size);
        continue;
      }
      let index = p.frame;
      if (p.fps > 0) {
        const step = Math.floor((p.age / 1000) * p.fps);
        index = p.loop ? step % frames.length : Math.min(step, frames.length - 1);
      }
      const id = frames[index] ?? frames[0]!;
      const sheet = sheetOf(p.fx);
      if (!sheet) continue;
      const quarters = Math.floor((p.age / 1000) * p.tumble);
      let tr = (((p.turn + quarters) % 4) + 4) % 4;
      if (p.mirror) tr = mirrorTransform(tr);
      if (scale > 0.98 && scale < 1.02) {
        sheet.drawSprite(ctx, id, sx, sy, tr, ANCHOR_CENTER);
      } else if (scale > 0.05) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(scale, scale);
        sheet.drawSprite(ctx, id, 0, 0, tr, ANCHOR_CENTER);
        ctx.restore();
      }
    }
    ctx.globalAlpha = savedAlpha;
    ctx.globalCompositeOperation = savedOp;
  }
}

/** The sprite sheet of compiled effects (a canvas made the first time). */
export function sheetOf(fx: CompiledFx): SpriteSheet | null {
  if (fx.image instanceof SpriteSheet) return fx.image;
  if (typeof document === 'undefined' || fx.width <= 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, fx.width);
  canvas.height = Math.max(1, fx.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(canvas.width, canvas.height);
  img.data.set(fx.data);
  ctx.putImageData(img, 0, 0);
  const sheet = new SpriteSheet(canvas, fx.frames);
  fx.image = sheet;
  return sheet;
}
