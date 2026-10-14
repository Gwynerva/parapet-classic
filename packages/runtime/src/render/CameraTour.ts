/**
 * The Sprint flyover (`aP()` / `Q(int)`, d.java lines 9392-9460): before the race the camera
 * tours the route, centring each checkpoint in turn, then the finish and the start, and
 * repeats until the player starts. Each leg eases with a smoothstep and lasts about 2 ms per
 * pixel of distance plus 625 ms, in game time.
 */
import { cameraMaxY } from './Camera.ts';
import { clamp, smoothstep } from '../math.ts';

export interface TourPoint {
  /** World position in units to centre on screen. */
  x: number;
  y: number;
}

export interface TourView {
  /** Viewport size in units. */
  viewW: number;
  viewH: number;
  /** Level size in units, for clamping like the camera does. */
  levelW: number;
  levelH: number;
  /** Height of the camera's frame (`Camera.frameH`, units; default the whole view). */
  frameH?: number;
}

export const LEG_MS_PER_PX = 2;
export const LEG_BASE_MS = 625;

export class CameraTour {
  private readonly points: readonly TourPoint[];
  private view: TourView;
  private leg = 0;
  private legMs = 1;
  private elapsed = 0;
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private toY = 0;
  /** Current camera corner in units. */
  x = 0;
  y = 0;

  /** `points` in tour order (checkpoints, finish, start); the tour loops over them. */
  constructor(points: readonly TourPoint[], view: TourView) {
    this.points = points;
    this.view = view;
  }

  /** Begin at camera corner `(x, y)`, heading for the first point. */
  start(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.leg = -1;
    this.nextLeg();
  }

  /**
   * The screen changed size: the tour keeps showing the same places, centred in the new view
   * (the leg in progress keeps its timing).
   */
  resize(viewW: number, viewH: number, frameH = viewH): void {
    const dx = (this.view.viewW - viewW) >> 1;
    const dy = (Math.min(this.view.viewH, this.view.frameH ?? this.view.viewH) - frameH) >> 1;
    this.view = { ...this.view, viewW, viewH, frameH };
    this.x += dx;
    this.y += dy;
    this.fromX += dx;
    this.fromY += dy;
    const target = this.corner(this.points[this.leg] ?? { x: this.x, y: this.y });
    this.toX = target.x;
    this.toY = target.y;
  }

  /** Advance by game-time ms and return the corner to show. */
  advance(dtMs: number): { x: number; y: number } {
    if (this.points.length === 0) return { x: this.x, y: this.y };
    this.elapsed += dtMs;
    while (this.elapsed >= this.legMs) {
      this.elapsed -= this.legMs;
      this.x = this.toX;
      this.y = this.toY;
      this.nextLeg();
    }
    const t = smoothstep(this.elapsed / this.legMs);
    this.x = Math.round(this.fromX + (this.toX - this.fromX) * t);
    this.y = Math.round(this.fromY + (this.toY - this.fromY) * t);
    return { x: this.x, y: this.y };
  }

  private corner(p: TourPoint): { x: number; y: number } {
    const { viewW, viewH, levelW, levelH } = this.view;
    const frameH = Math.min(viewH, this.view.frameH ?? viewH);
    return {
      x: clamp(p.x - (viewW >> 1), 0, Math.max(0, levelW - viewW)),
      y: Math.min(p.y - (frameH >> 1), cameraMaxY(levelH, frameH)),
    };
  }

  private nextLeg(): void {
    this.leg = (this.leg + 1) % Math.max(1, this.points.length);
    const target = this.corner(this.points[this.leg] ?? { x: this.x, y: this.y });
    this.fromX = this.x;
    this.fromY = this.y;
    this.toX = target.x;
    this.toY = target.y;
    const dx = (this.toX - this.fromX) / 32;
    const dy = (this.toY - this.fromY) / 32;
    this.legMs = Math.max(1, Math.round(Math.hypot(dx, dy) * LEG_MS_PER_PX + LEG_BASE_MS));
    this.elapsed = 0;
  }
}
