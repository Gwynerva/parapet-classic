/**
 * Bursts of coloured sparks in world space: an echo dissolving at the end of its run. Sparks
 * fly out of a point, fall a little and fade; they live in real time, so they also play while
 * the run is paused.
 */
import type { EchoColor } from './EchoSkin.ts';
import { toScreen, type CameraPos } from './View.ts';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: string;
}

/** Body centre above the feet, in world units (32 per pixel). */
export const BODY_CENTRE_HEIGHT = 900;
const SPARK_COUNT = 28;

function rgbCss(c: readonly [number, number, number]): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** The three tones a burst of `color` is made of. */
export function sparkColors(color: EchoColor): string[] {
  return [color.css, color.light, rgbCss(color.ramp.highlight)];
}

export class Sparks {
  private readonly list: Spark[] = [];

  /** Sparks out of the body of a runner standing at feet point (x, y), in world units. */
  burst(x: number, y: number, colors: readonly string[], count = SPARK_COUNT): void {
    const cy = y - BODY_CENTRE_HEIGHT;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 1.6 + Math.random() * 3.2;
      this.list.push({
        x,
        y: cy + (Math.random() - 0.5) * 1200,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        age: 0,
        life: 550 + Math.random() * 450,
        color: colors[i % colors.length] ?? '#ffffff',
      });
    }
  }

  /** One ember drifting up from a point (world units), e.g. behind a running runner's feet. */
  ember(x: number, y: number, color: string): void {
    this.list.push({
      x: x + (Math.random() - 0.5) * 300,
      y,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -1 - Math.random() * 1.5,
      age: 0,
      life: 250 + Math.random() * 300,
      color,
    });
  }

  get active(): boolean {
    return this.list.length > 0;
  }

  /** Moves the sparks by `dt` ms of real time and draws them. */
  draw(ctx: CanvasRenderingContext2D, cam: CameraPos, dt: number): void {
    let alive = 0;
    for (const s of this.list) {
      s.age += dt;
      if (s.age >= s.life) continue;
      s.vy += 0.008 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      this.list[alive++] = s;
      const size = s.age < s.life * 0.6 ? 2 : 1;
      ctx.fillStyle = s.color;
      ctx.fillRect(toScreen(s.x, cam.x), toScreen(s.y, cam.y), size, size);
    }
    this.list.length = alive;
  }
}
