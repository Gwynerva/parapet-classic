/**
 * A ribbon: cloth trailing a point of the body (a scarf from the neck, a plume from the helmet,
 * a cape, a sash from the hips, a bag on its strap).
 *
 * Not simulated as loose particles: a chain of segments, each an angle on a damped spring. The
 * spring pulls towards where the air would lay the cloth: the runner's speed, smoothed, blows it
 * back against its weight (`drag` how much it catches the air, `gravity` how heavy it is):
 * standing it hangs, running it streams behind, falling it lifts; a wave runs down it at speed.
 * The body's own jolts swing it: every change of the anchor's speed (a stride, a landing, a
 * turn) pushes the segments the other way, and the springs, a little underdamped, let them
 * swing back and settle, the tip later than the root. `stiffness` makes it heavier and calmer
 * (a bag on a strap swings at the hip but never streams). It never flips over the body:
 * segments keep to a cone behind and below. The anchor moves once per simulation step, so the
 * root glides between the last two anchors instead of jumping.
 *
 * Drawn as a band of square pixels tapering to its tip, or with a texture: a picture whose rows
 * run along the chain, each texel put where the bent chain carries it (sampled twice per texel
 * each way so bends leave no holes), into a pixel buffer drawn in one go.
 */
import { parseColor, ribbonChain, type LookRibbon } from '../Look.ts';
import { objectGrid, screenPixels, toScreen, type CameraPos } from '../View.ts';

const UNITS = 32;
const SUBSTEP_MS = 8;
/** The anchor moves once per simulation step: the root glides over this long. */
const FOLLOW_MS = 30;
/** How fast the runner's speed is taken in, ms (vertical bobbing is calmed more). */
const SPEED_MS = 110;
const SPEED_Y_MS = 220;
/** Fastest believable speed, px/s (a respawn is not a gust). */
const MAX_SPEED = 600;
/** Each segment's spring (1/s²) and damping (1/s); further segments are softer. */
const SPRING = 110;
const SPRING_SOFTER_PER_SEGMENT = 0.3;
const DAMPING = 9;
/** How strongly the anchor's jolts swing the cloth, and the strongest jolt counted (px/s²). */
const JOLT = 0.6;
const MAX_JOLT = 5000;
/** How much the speed blows the cloth back (with `drag`). */
const WIND = 1.5;
/** The wave down moving cloth: radians at the tip at full speed, cycles per second; and slower
 * gusts on top of it. */
const WAVE = 0.55;
const WAVE_HZ = 1.4;
const GUST = 0.2;
const GUST_HZ = 0.45;
/** Speed (px/s) of a full wave. */
const WAVE_SPEED = 260;
/**
 * The cone a segment keeps to, as angles from straight behind (down positive): up to about 27°
 * above it, down past straight down to a quarter of its length ahead of the body.
 */
const CONE_UP = -Math.asin(0.45);
const CONE_DOWN = Math.acos(-0.25);
/** Largest textured ribbon on screen, in pixels each way (bigger ones are clipped). */
const SCRATCH = 160;

/** An angle in (-π, π]. */
function wrapAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

interface Texture {
  w: number;
  h: number;
  /** RGBA packed for a little-endian `ImageData` (0 transparent). */
  px: Uint32Array;
  /** The column the chain runs through. */
  col: number;
}

let scratch: {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  image: ImageData;
  buf: Uint32Array;
} | null = null;

function scratchBuffer(): typeof scratch {
  if (scratch || typeof document === 'undefined') return scratch;
  const canvas = document.createElement('canvas');
  canvas.width = SCRATCH;
  canvas.height = SCRATCH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(SCRATCH, SCRATCH);
  scratch = { canvas, ctx, image, buf: new Uint32Array(image.data.buffer) };
  return scratch;
}

/** A ribbon's texture from its rows; `color` resolves palette characters to CSS colours. */
function compileTexture(rows: readonly string[], color: (token: string) => string): Texture {
  const grid = rows.map((r) => Array.from(r));
  const w = Math.max(1, ...grid.map((r) => r.length));
  const h = grid.length;
  const px = new Uint32Array(w * h);
  let col = w >> 1;
  const cache = new Map<string, number>();
  grid.forEach((row, y) => {
    row.forEach((ch, x) => {
      if (ch === '+') {
        if (y === 0) col = x;
        return;
      }
      if (ch === '.' || ch === ' ') return;
      let v = cache.get(ch);
      if (v === undefined) {
        const c = parseColor(color(ch));
        v = c ? ((c[3] << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0 : 0;
        cache.set(ch, v);
      }
      px[y * w + x] = v;
    });
  });
  return { w, h, px, col };
}

export class Ribbon {
  readonly spec: LookRibbon;
  /** Points: the root and the end of every segment. */
  private readonly n: number;
  private readonly len: number;
  private readonly xs: Float64Array;
  private readonly ys: Float64Array;
  /** Each segment's angle from straight behind the runner, down positive (radians). */
  private readonly rel: Float64Array;
  /** And how fast it turns (radians per second). */
  private readonly spin: Float64Array;
  /** Screen points and their tangents, for drawing. */
  private readonly sx: Float64Array;
  private readonly sy: Float64Array;
  private readonly tx: Float64Array;
  private readonly ty: Float64Array;
  private readonly colors: string[];
  private readonly texture: Texture | null;
  private placed = false;
  private rootX = 0;
  private rootY = 0;
  /** The root glides from the previous anchor to the latest one. */
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private toY = 0;
  private since = 0;
  /** The runner's speed as the anchor shows it (px/s), and as the cloth has taken it in. */
  private targetVx = 0;
  private targetVy = 0;
  private vx = 0;
  private vy = 0;
  /** The root's own speed last substep (px/s), for its jolts. */
  private rootVx = 0;
  private rootVy = 0;
  private time = 0;
  private behind = -1;

  /** `color` resolves the spec's colours (palette characters, tokens) to CSS. */
  constructor(spec: LookRibbon, color: (token: string) => string) {
    this.spec = spec;
    const chain = ribbonChain(spec);
    this.texture = spec.texture ? compileTexture(spec.texture, color) : null;
    this.n = Math.max(this.texture ? 1 : 2, chain.segments) + 1;
    this.len = chain.length;
    this.xs = new Float64Array(this.n);
    this.ys = new Float64Array(this.n);
    this.rel = new Float64Array(this.n - 1);
    this.spin = new Float64Array(this.n - 1);
    this.sx = new Float64Array(this.n);
    this.sy = new Float64Array(this.n);
    this.tx = new Float64Array(this.n);
    this.ty = new Float64Array(this.n);
    this.colors = (spec.colors ?? ['#ffffff']).map(color);
  }

  /** Where the root is now (world units, the anchor point) and which way the runner faces. */
  follow(anchorX: number, anchorY: number, facingRight: boolean): void {
    const behind = facingRight ? -1 : 1;
    const [ox, oy] = this.spec.offset ?? [0, 0];
    const x = anchorX + ox * behind * UNITS;
    const y = anchorY + oy * UNITS;
    if (!this.placed) {
      this.behind = behind;
      this.fromX = this.toX = this.rootX = x;
      this.fromY = this.toY = this.rootY = y;
      this.rel.fill(Math.PI / 2 - 0.15);
      this.spin.fill(0);
      this.placed = true;
      this.layOut();
      return;
    }
    if (behind !== this.behind) this.turn(behind);
    const s = 1000 / FOLLOW_MS / UNITS;
    let vx = (x - this.toX) * s;
    let vy = (y - this.toY) * s;
    const v = Math.hypot(vx, vy);
    if (v > MAX_SPEED) {
      vx *= MAX_SPEED / v;
      vy *= MAX_SPEED / v;
    }
    this.targetVx = vx;
    this.targetVy = vy;
    // Where the root is now becomes the start of its next glide.
    this.fromX = this.rootX;
    this.fromY = this.rootY;
    this.toX = x;
    this.toY = y;
    this.since = 0;
  }

  /** The runner turned: the cloth keeps where it is and swings under to its new back. */
  private turn(behind: number): void {
    for (let i = 0; i < this.rel.length; i++) {
      const world = this.toWorld(this.rel[i]!);
      this.behind = behind;
      let r = this.toRel(world);
      if (r < -Math.PI / 2) r += 2 * Math.PI;
      this.behind = -behind;
      this.rel[i] = r;
    }
    this.behind = behind;
  }

  /** World angle (screen axes) of an angle from behind. */
  private toWorld(rel: number): number {
    return this.behind < 0 ? Math.PI - rel : rel;
  }

  private toRel(world: number): number {
    return wrapAngle(this.behind < 0 ? Math.PI - world : world);
  }

  /** Simulates `dtMs` of real time. */
  update(dtMs: number): void {
    if (!this.placed || dtMs <= 0) return;
    const gravity = this.spec.gravity ?? 220;
    const drag = this.spec.drag ?? 2.5;
    const stiff = Math.min(1, Math.max(0, this.spec.stiffness ?? 0));
    const segs = this.rel.length;
    const len = this.len;
    // Facing right an angle from behind turns the other way round from a screen angle.
    const turnSign = this.behind < 0 ? -1 : 1;
    let left = Math.min(dtMs, 100);
    while (left > 0) {
      const ms = Math.min(SUBSTEP_MS, left);
      left -= ms;
      const dt = ms / 1000;
      this.time += ms;
      this.since += ms;
      const a = Math.min(1, this.since / FOLLOW_MS);
      const px = this.rootX;
      const py = this.rootY;
      this.rootX = this.fromX + (this.toX - this.fromX) * a;
      this.rootY = this.fromY + (this.toY - this.fromY) * a;
      // The root's jolt: how its speed changed (px/s²), capped.
      const rvx = (this.rootX - px) / UNITS / dt;
      const rvy = (this.rootY - py) / UNITS / dt;
      let jx = (rvx - this.rootVx) / dt;
      let jy = (rvy - this.rootVy) / dt;
      this.rootVx = rvx;
      this.rootVy = rvy;
      const j = Math.hypot(jx, jy);
      if (j > MAX_JOLT) {
        jx *= MAX_JOLT / j;
        jy *= MAX_JOLT / j;
      }
      this.vx += (this.targetVx - this.vx) * (1 - Math.exp(-ms / SPEED_MS));
      this.vy += (this.targetVy - this.vy) * (1 - Math.exp(-ms / SPEED_Y_MS));
      // Where the air lays it: blown back by the speed, pulled down by its weight.
      const catches = drag * WIND * (1 - 0.8 * stiff);
      const base = this.toRel(Math.atan2(gravity - this.vy * catches * 0.5, -this.vx * catches));
      const speed = Math.min(1, Math.hypot(this.vx, this.vy) / WAVE_SPEED);
      const loose = 1 - stiff;
      for (let i = 0; i < segs; i++) {
        const s = segs > 1 ? i / (segs - 1) : 1;
        // The tip hangs a little lower, and waves.
        let target = base + (Math.PI / 2 - base) * 0.25 * s * loose;
        const t = this.time * 0.001 * 2 * Math.PI;
        target +=
          speed *
          s *
          loose *
          (WAVE * Math.sin(t * WAVE_HZ - i * 0.9) + GUST * Math.sin(t * GUST_HZ + 1.7));
        target = Math.min(CONE_DOWN, Math.max(CONE_UP, target));
        const k = (SPRING * (1 + stiff)) / (1 + SPRING_SOFTER_PER_SEGMENT * i);
        let w = this.spin[i]!;
        w += ((target - this.rel[i]!) * k - w * DAMPING) * dt;
        // The jolt pushes the cloth the other way, as one pendulum of its whole length, its tip
        // the most (screen angle θ: a segment's end moves along (-sin θ, cos θ) as θ grows).
        const theta = this.toWorld(this.rel[i]!);
        const push =
          (-(jx * -Math.sin(theta) + jy * Math.cos(theta)) / (len * segs)) * (0.6 + 0.8 * s);
        w += turnSign * push * JOLT * dt * (1 - 0.5 * stiff);
        let r = this.rel[i]! + w * dt;
        if (r < CONE_UP || r > CONE_DOWN) {
          r = Math.min(CONE_DOWN, Math.max(CONE_UP, r));
          w *= -0.3;
        }
        this.rel[i] = r;
        this.spin[i] = w;
      }
    }
    this.layOut();
  }

  /** The points from the root along the segments' angles. */
  private layOut(): void {
    const len = this.len * UNITS;
    this.xs[0] = this.rootX;
    this.ys[0] = this.rootY;
    for (let i = 0; i < this.rel.length; i++) {
      const w = this.toWorld(this.rel[i]!);
      this.xs[i + 1] = this.xs[i]! + Math.cos(w) * len;
      this.ys[i + 1] = this.ys[i]! + Math.sin(w) * len;
    }
  }

  /** The chain's points in world units (for tests and tools). */
  points(): { x: number; y: number }[] {
    return Array.from({ length: this.n }, (_, i) => ({ x: this.xs[i]!, y: this.ys[i]! }));
  }

  draw(ctx: CanvasRenderingContext2D, cam: CameraPos): void {
    if (!this.placed) return;
    // Its root exactly where the camera sees it, to a screen pixel, like the runner's body.
    const grid = objectGrid({ x: this.xs[0]!, y: this.ys[0]! }, cam, screenPixels(ctx));
    ctx.translate(grid.dx, grid.dy);
    if (this.texture) this.drawTexture(ctx, grid.cam, this.texture);
    else this.drawBand(ctx, grid.cam);
    ctx.translate(-grid.dx, -grid.dy);
  }

  private drawBand(ctx: CanvasRenderingContext2D, cam: CameraPos): void {
    const w = this.spec.width ?? 2;
    const w0 = typeof w === 'number' ? w : w[0];
    const w1 = typeof w === 'number' ? w : w[1];
    const segs = this.n - 1;
    for (let i = 0; i < segs; i++) {
      const x0 = toScreen(this.xs[i]!, cam.x);
      const y0 = toScreen(this.ys[i]!, cam.y);
      const x1 = toScreen(this.xs[i + 1]!, cam.x);
      const y1 = toScreen(this.ys[i + 1]!, cam.y);
      const width = Math.max(1, Math.round(w0 + ((w1 - w0) * i) / Math.max(1, segs - 1)));
      ctx.fillStyle =
        this.colors[
          Math.min(this.colors.length - 1, Math.floor((i * this.colors.length) / segs))
        ] ?? '#fff';
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      const half = width >> 1;
      for (let k = 0; k <= steps; k++) {
        const x = Math.round(x0 + ((x1 - x0) * k) / steps);
        const y = Math.round(y0 + ((y1 - y0) * k) / steps);
        ctx.fillRect(x - half, y - half, width, width);
      }
    }
  }

  private drawTexture(ctx: CanvasRenderingContext2D, cam: CameraPos, tex: Texture): void {
    const s = scratchBuffer();
    if (!s) return;
    const { n, sx, sy, tx, ty } = this;
    let minX = Infinity;
    let minY = Infinity;
    for (let i = 0; i < n; i++) {
      sx[i] = (this.xs[i]! - cam.x) / UNITS;
      sy[i] = (this.ys[i]! - cam.y) / UNITS;
    }
    // Tangents at the points: along the segments around them.
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      let dx = sx[b]! - sx[a]!;
      let dy = sy[b]! - sy[a]!;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      tx[i] = dx;
      ty[i] = dy;
    }
    const reach = Math.max(tex.col + 1, tex.w - tex.col) + 1;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, sx[i]! - reach);
      minY = Math.min(minY, sy[i]! - reach);
      maxX = Math.max(maxX, sx[i]! + reach);
      maxY = Math.max(maxY, sy[i]! + reach);
    }
    const ox = Math.floor(minX);
    const oy = Math.floor(minY);
    const bw = Math.min(SCRATCH, Math.ceil(maxX) - ox + 1);
    const bh = Math.min(SCRATCH, Math.ceil(maxY) - oy + 1);
    const buf = s.buf;
    for (let y = 0; y < bh; y++) buf.fill(0, y * SCRATCH, y * SCRATCH + bw);
    // Facing right the picture is seen as drawn; facing left, mirrored.
    const side = this.behind < 0 ? 1 : -1;
    const segs = n - 1;
    for (let r2 = 0; r2 < tex.h * 2; r2++) {
      const along = (r2 + 0.5) / 2;
      const row = r2 >> 1;
      const f = along / this.len;
      const i = Math.min(segs - 1, Math.floor(f));
      const t = f - i;
      const px = sx[i]! + (sx[i + 1]! - sx[i]!) * t;
      const py = sy[i]! + (sy[i + 1]! - sy[i]!) * t;
      let ux = tx[i]! + (tx[i + 1]! - tx[i]!) * Math.min(1, t);
      let uy = ty[i]! + (ty[i + 1]! - ty[i]!) * Math.min(1, t);
      const d = Math.hypot(ux, uy) || 1;
      ux /= d;
      uy /= d;
      // The normal: to the right of hanging straight down.
      const nx = uy * side;
      const ny = -ux * side;
      const base = row * tex.w;
      for (let c2 = 0; c2 < tex.w * 2; c2++) {
        const v = tex.px[base + (c2 >> 1)]!;
        if (v === 0) continue;
        const u = (c2 + 0.5) / 2 - (tex.col + 0.5);
        const X = Math.floor(px + nx * u) - ox;
        const Y = Math.floor(py + ny * u) - oy;
        if (X < 0 || Y < 0 || X >= bw || Y >= bh) continue;
        buf[Y * SCRATCH + X] = v;
      }
    }
    s.ctx.putImageData(s.image, 0, 0, 0, 0, bw, bh);
    ctx.drawImage(s.canvas, 0, 0, bw, bh, ox, oy, bw, bh);
  }
}
