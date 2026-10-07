/**
 * Visual particles: 40 slots like the original (`void_d(4 ints)` spawn at d.java line 4213,
 * `void_q(int)` update at line 4249, `void_r(int)` draw at line 4280). Only the types the
 * simulation can trigger are implemented: dust puffs (type 1, on `dust` events) and the
 * decorative birds (type 2) that replaced tile 63 and fly off when the player comes close.
 */
import { approxLength, idiv, type Level, type Point, type WorldEvent } from '@parapet/sim';
import { ANCHOR_BOTTOM_CENTER, ANCHOR_CENTER, type SpriteSheet } from './SpriteSheet.ts';
import { toScreen, type CameraPos, type ViewSize } from './View.ts';

export const SLOT_COUNT = 40;
const TYPE_NONE = 0;
const TYPE_DUST = 1;
const TYPE_BIRD = 2;
/** Prize fireworks: a rocket climbing, then the sparks of its burst (types 4 and 5 there). */
const TYPE_ROCKET = 3;
const TYPE_SPARK = 4;

const ROCKET_SPRITE = 179;
/** Rocket climb in units per ms (about two tiles per second). */
const ROCKET_SPEED = 2;
const ROCKET_LIFE_MIN = 1800;
const ROCKET_LIFE_SPREAD = 1000;
const SPARK_COUNT = 12;
const SPARK_LIFE = 700;
const SPARK_COLOURS = ['#ffd34d', '#ff5a4a', '#5ad27a', '#7fd3ff', '#ffffff'];
/** Draw in the foreground pass (`0x20000`); screen-space particles (`0x10000`) are unused. */
const FOREGROUND = 0x20000;

const DUST_SPRITE = 178;
const BIRD_RESTING = 296;
const BIRD_FLYING = 297;
const DUST_LIFE = 400;
/** Birds fly off when the player is within this distance in units (about two tiles). */
const BIRD_SCARE_DISTANCE = 2000;

/** Integer hash `int_h(int)` (line 3476) in 32-bit arithmetic. */
export function hash(n: number): number {
  n = (n << 13) ^ n;
  const inner = (Math.imul(Math.imul(n, n), 15731) + 789221) | 0;
  return (Math.imul(n, inner) + 1376312589) & 0x7fffffff;
}

/** `int_b(int,int,int,int)` (line 4711): `a + (b - a) * t / max` in one expression. */
function lerp(a: number, b: number, t: number, max: number): number {
  return idiv((max - t) * a + b * t, max);
}

export class Particles {
  private readonly sheet: SpriteSheet;
  private readonly sine: Int16Array;
  private readonly type = new Int32Array(SLOT_COUNT);
  private readonly x = new Int32Array(SLOT_COUNT);
  private readonly y = new Int32Array(SLOT_COUNT);
  /** Life (counting down) or age (birds), in ms. */
  private readonly life = new Int32Array(SLOT_COUNT);
  /** Per-type extra (birds: 0 resting, 1 flying). */
  private readonly extra = new Int32Array(SLOT_COUNT);
  /** Spark velocity in units per ms × 256 (sparks only). */
  private readonly vx = new Int32Array(SLOT_COUNT);
  private readonly vy = new Int32Array(SLOT_COUNT);
  private next = 0;
  private levelW = 0;
  private levelH = 0;
  /** Game-clock ms of the last firework burst and its colour, for sky flashes. */
  lastBurstAt = -1;
  lastBurstColour = SPARK_COLOURS[0]!;
  private clockMs = 0;

  constructor(sheet: SpriteSheet, sine: Int16Array) {
    this.sheet = sheet;
    this.sine = sine;
  }

  /** Forget every particle (`K()`, line 4206). */
  clear(): void {
    this.type.fill(TYPE_NONE);
    this.next = 0;
  }

  /** Register the level bounds (birds leaving the map die) and place its birds (`aR`). */
  setLevel(level: Level): void {
    this.clear();
    this.levelW = level.width << 10;
    this.levelH = level.height << 10;
    this.addBirds(level.birds);
  }

  addBirds(points: readonly Point[]): void {
    for (const p of points) this.spawn(TYPE_BIRD, p.x, p.y, 0);
  }

  /** Dust puff at a feet position in units (`void_d(1, k, l, 0)`). */
  spawnDust(x: number, y: number): void {
    this.spawn(TYPE_DUST, x, y, 0);
  }

  /** React to the events of a simulation step. */
  onEvents(events: readonly WorldEvent[]): void {
    for (const e of events) {
      if (e.type === 'dust') this.spawnDust(e.x, e.y);
    }
  }

  /** Launch a firework rocket from `(x, y)` (units); it bursts after 1.8-2.8 s (`M()`, line 4425). */
  spawnFirework(x: number, y: number): void {
    const i = this.spawn(TYPE_ROCKET | FOREGROUND, x, y, hash(x + y * 7 + this.next) % 5);
    this.life[i] = ROCKET_LIFE_MIN + (hash(this.next * 977 + x) % ROCKET_LIFE_SPREAD);
  }

  /** Make `count` resting birds take off (the Prize scene, where no runner scares them). */
  scareBirds(count: number): void {
    for (let i = 0; i < SLOT_COUNT && count > 0; i++) {
      if ((this.type[i]! & 0xff) === TYPE_BIRD && this.extra[i] === 0) {
        this.extra[i] = 1;
        this.life[i] = 0;
        count--;
      }
    }
  }

  /** `void_q(int)`: advance by `dtUnits` (30 per step). `player` scares the birds. */
  update(dtUnits: number, player?: { x: number; y: number }): void {
    this.clockMs += dtUnits;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const t = this.type[i]! & 0xff;
      if (t === TYPE_ROCKET) {
        this.y[i] = this.y[i]! - ROCKET_SPEED * dtUnits;
        this.life[i] = this.life[i]! - dtUnits;
        if (this.life[i]! < 0) {
          this.type[i] = TYPE_NONE;
          this.burst(this.x[i]!, this.y[i]!, this.extra[i]!);
        }
      } else if (t === TYPE_SPARK) {
        this.x[i] = this.x[i]! + ((this.vx[i]! * dtUnits) >> 8);
        this.y[i] = this.y[i]! + ((this.vy[i]! * dtUnits) >> 8);
        this.vy[i] = this.vy[i]! + dtUnits; // gentle gravity
        this.life[i] = this.life[i]! - dtUnits;
        if (this.life[i]! < 0) this.type[i] = TYPE_NONE;
      } else if (t === TYPE_BIRD) {
        this.life[i] = this.life[i]! + dtUnits;
        if (this.extra[i] === 0) {
          if (
            player &&
            approxLength(player.x - this.x[i]!, player.y - this.y[i]!) < BIRD_SCARE_DISTANCE
          ) {
            this.extra[i] = 1;
            this.life[i] = 0;
          }
        } else {
          const step = (dtUnits * 300) >> 8;
          this.x[i] = this.x[i]! + ((i & 1) * 2 - 1) * step;
          const flap = this.sine[(this.life[i]! >> 3) & 0x1ff]!;
          this.y[i] = this.y[i]! - (step + ((idiv(flap * dtUnits, 30) * 300) >> 14));
        }
        if (
          this.x[i]! < 0 ||
          this.x[i]! > this.levelW ||
          this.y[i]! < 0 ||
          this.y[i]! > this.levelH
        ) {
          this.type[i] = TYPE_NONE;
        }
      } else if (t !== TYPE_NONE) {
        this.life[i] = this.life[i]! - dtUnits;
        if (this.life[i]! < 0) this.type[i] = TYPE_NONE;
      }
    }
  }

  /**
   * `void_r(int)`: draw the background (`foreground = false`) or foreground pass.
   * `clock` is the game clock in ms (bird wing flaps).
   */
  draw(
    ctx: CanvasRenderingContext2D,
    cam: CameraPos,
    _view: ViewSize,
    clock: number,
    foreground = false,
  ): void {
    const pass = foreground ? FOREGROUND : 0;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const flags = this.type[i]!;
      if ((flags & FOREGROUND) !== pass) continue;
      const t = flags & 0xff;
      if (t === TYPE_NONE) continue;
      const sx = toScreen(this.x[i]!, cam.x);
      const sy = toScreen(this.y[i]!, cam.y);
      if (t === TYPE_DUST) {
        this.drawDust(ctx, i, sx, sy, DUST_LIFE - this.life[i]!);
      } else if (t === TYPE_ROCKET) {
        this.sheet.drawSprite(ctx, ROCKET_SPRITE, sx, sy, 0, ANCHOR_CENTER);
      } else if (t === TYPE_SPARK) {
        const fade = this.life[i]! / SPARK_LIFE;
        ctx.fillStyle = SPARK_COLOURS[this.extra[i]! % SPARK_COLOURS.length]!;
        const size = fade > 0.5 ? 2 : 1;
        ctx.fillRect(sx, sy, size, size);
      } else if (t === TYPE_BIRD) {
        if (this.extra[i] === 0) {
          this.sheet.drawSprite(ctx, BIRD_RESTING, sx, sy, 0, ANCHOR_BOTTOM_CENTER);
        } else {
          const frame = (clock >> 7) & 1;
          const transform = (i & 1) === 1 ? 0 : 4;
          this.sheet.drawSprite(ctx, BIRD_FLYING + frame, sx, sy, transform, ANCHOR_BOTTOM_CENTER);
        }
      }
    }
  }

  /** Four puffs drifting up and sideways, shrinking through sprites 178 → 177 → 176. */
  private drawDust(
    ctx: CanvasRenderingContext2D,
    slot: number,
    x: number,
    y: number,
    age: number,
  ): void {
    for (let k = 0; k < 4; k++) {
      const rise = lerp(0, age, age, 48);
      const driftX = (hash(k * 533 + slot * 2342 + 5332) % 48) - 24;
      const driftY = -(hash(k * 745 + slot * 2341 + 3453) % 48);
      const px = x + lerp(0, driftX, age, DUST_LIFE);
      const span = DUST_LIFE + (hash(k * 232 + 422) % 200) - 100;
      const py = y + idiv(lerp(0, driftY * 200 + rise, age, span), 200);
      const shrink = idiv(age * 2, DUST_LIFE);
      this.sheet.drawSprite(ctx, DUST_SPRITE - shrink, px, py, 0, ANCHOR_CENTER);
    }
  }

  /** Sparks flying out in a ring, with the colour index `colour`. */
  private burst(x: number, y: number, colour: number): void {
    this.lastBurstAt = this.clockMs;
    this.lastBurstColour = SPARK_COLOURS[colour % SPARK_COLOURS.length]!;
    for (let k = 0; k < SPARK_COUNT; k++) {
      const angle = Math.floor((k * 512) / SPARK_COUNT);
      const speed = 160 + (hash(k * 131 + x) % 96);
      const i = this.spawn(TYPE_SPARK | FOREGROUND, x, y, colour);
      this.vx[i] = (this.sine[(angle + 128) & 0x1ff]! * speed) >> 10;
      this.vy[i] = (this.sine[angle & 0x1ff]! * speed) >> 10;
    }
  }

  private spawn(type: number, x: number, y: number, extra: number): number {
    const i = this.next++;
    if (this.next >= SLOT_COUNT) this.next = 0;
    this.type[i] = type;
    this.x[i] = x;
    this.y[i] = y;
    this.extra[i] = extra;
    this.vx[i] = 0;
    this.vy[i] = 0;
    switch (type & 0xff) {
      case TYPE_DUST:
        this.life[i] = DUST_LIFE;
        break;
      case TYPE_SPARK:
        this.life[i] = SPARK_LIFE;
        break;
      default:
        this.life[i] = 0;
        break;
    }
    return i;
  }
}
