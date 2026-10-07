/**
 * Follow camera: port of `void_a(e)` (target, d.java line 9351), `b(int,boolean)` (spring,
 * line 9436), `k` / `l` (reset / set target, lines 9370 / 9380).
 *
 * The original constants are for a 240×320 screen (7680×10240 units); here they are derived
 * from the viewport size so the behaviour scales:
 *
 * - target = player − (half width, 0.575 height ± 0.125 height by the player's height in the level)
 * - look-ahead x = vx · 3840 / 4143 clamped to ±half width, zeroed when a wall faces the runner
 *   within 4 tiles; look-ahead y = vy · 5120 / 4143 clamped to ±(the y offset above)
 * - spring per step: vel += dx · 200 / 65536, clamped to ±dx · 0.117 (y: 240 / 65536 and half
 *   the clamp)
 * - hard leash of ±¼ width around (player − half width) and ±¼ height around
 *   (player − half height − height/20)
 * - clamp x to [0, levelW − viewW], y ≤ levelH − viewH; the camera may go above the map.
 */
import type { Level } from '@parapet/sim';

export interface CameraTarget {
  /** Feet position in units (`k`, `l`). */
  x: number;
  y: number;
  /** Render position in units (`o`, `p`). */
  renderX: number;
  renderY: number;
  /** Velocity (`q`, `r`). */
  vx: number;
  vy: number;
}

/** Tiles that face a runner moving with velocity `vx` (`boolean_b(int,int)`, line 9154). */
export function tileFacesRunner(vx: number, tile: number): boolean {
  switch (tile) {
    case 13:
    case 14:
      return vx !== 0;
    case 2:
    case 5:
    case 17:
      return vx > 0;
    case 4:
    case 6:
    case 18:
      return vx < 0;
    default:
      return false;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/** Per-step camera displacement treated as a cut rather than a pan (see `update`). */
export const CAMERA_CUT_UNITS = 900;

export class Camera {
  /** Top-left corner in units (`bD`, `bE`). */
  x = 0;
  y = 0;
  /** Target corner (`bF`, `bG`) and spring velocity (`bH`, `bI`). */
  targetX = 0;
  targetY = 0;
  velX = 0;
  velY = 0;
  /** Position before the last update, for frame interpolation. */
  prevX = 0;
  prevY = 0;
  /** Viewport size in units. */
  viewW = 240 << 5;
  viewH = 320 << 5;

  constructor(viewWidthPx = 240, viewHeightPx = 320) {
    this.setViewport(viewWidthPx, viewHeightPx);
  }

  setViewport(widthPx: number, heightPx: number): void {
    this.viewW = widthPx << 5;
    this.viewH = heightPx << 5;
  }

  /** `k(int,int)`: snap to the player (`bk`, line 10654) and clear the spring. */
  reset(player: CameraTarget, level: Level): void {
    this.x = this.targetX = player.x - (this.viewW >> 1);
    this.y = this.targetY = player.y - (this.viewH >> 1);
    this.velX = 0;
    this.velY = 0;
    this.clampToLevel(level);
    this.targetX = this.x;
    this.targetY = this.y;
    this.prevX = this.x;
    this.prevY = this.y;
  }

  /** Once per simulation step, after the player moved: `void_a(e)` then `b(30720, true)`. */
  update(player: CameraTarget, level: Level): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.aim(player, level);
    this.spring(30 << 10);
    this.leash(player);
    this.clampToLevel(level);
    this.cutIfJumped();
  }

  /**
   * `l(int,int)` from the menus and message boxes: aim at an explicit corner, for example the
   * coach view `(coachX - 512, coachY - viewH + 1536)` or a flag centred on screen.
   */
  aimAt(x: number, y: number, level: Level): void {
    this.setTarget(x, y, level);
  }

  /** Aim so that the world point `(x, y)` sits at the screen fractions `(fx, fy)`. */
  aimAtPoint(x: number, y: number, fx: number, fy: number, level: Level): void {
    this.setTarget(x - Math.round(this.viewW * fx), y - Math.round(this.viewH * fy), level);
  }

  /**
   * `b(n, false)`: one step of the spring towards the target without the player leash. The
   * original runs this instead of `update` while a briefing or a message box is up.
   */
  settle(level: Level, dtUnits = 30 << 10): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.spring(dtUnits);
    this.clampToLevel(level);
    this.cutIfJumped();
  }

  /** Place the corner directly (camera tours); the frame interpolation still eases into it. */
  moveTo(x: number, y: number, level: Level): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x = x;
    this.y = y;
    this.velX = 0;
    this.velY = 0;
    this.clampToLevel(level);
    this.targetX = this.x;
    this.targetY = this.y;
    this.cutIfJumped();
  }

  /**
   * The leash can yank the camera when the runner is snapped; the original cuts instantly,
   * so do not interpolate across such jumps.
   */
  private cutIfJumped(): void {
    if (Math.abs(this.x - this.prevX) > CAMERA_CUT_UNITS) this.prevX = this.x;
    if (Math.abs(this.y - this.prevY) > CAMERA_CUT_UNITS) this.prevY = this.y;
  }

  /** `void_a(e)`: set the target from the player's position and velocity. */
  private aim(player: CameraTarget, level: Level): void {
    const halfW = this.viewW >> 1;
    const halfH = this.viewH >> 1;
    // 5888 + ((p * 10240 / (H << 10) - 5120) * 256 >> 10) on the original screen.
    const baseY = Math.trunc((this.viewH * 23) / 40);
    const levelH = level.height << 10;
    const n = baseY + (((Math.trunc((player.renderY * this.viewH) / levelH) - halfH) * 256) >> 10);
    let lookX = Math.trunc((player.vx * 3840) / 4143);
    let lookY = Math.trunc((player.vy * 5120) / 4143);
    lookX = clamp(lookX, -halfW, halfW);
    lookY = clamp(lookY, -n, n);
    const dir = player.vx > 0 ? 1 : -1;
    const cx = player.renderX >> 10;
    const cy = player.renderY >> 10;
    for (let i = 0; i < 4; i++) {
      const tx = cx + i * dir;
      if (
        tileFacesRunner(player.vx, level.tileAt(tx, cy)) &&
        tileFacesRunner(player.vx, level.tileAt(tx, cy - 1))
      ) {
        lookX = 0;
      }
    }
    this.setTarget(player.renderX - halfW + lookX, player.renderY - n + lookY, level);
  }

  /** `l(int,int)`: clamp and store the target. */
  private setTarget(x: number, y: number, level: Level): void {
    const maxX = (level.width << 10) - this.viewW;
    const maxY = (level.height << 10) - this.viewH;
    this.targetX = clamp(x, 0, maxX);
    this.targetY = y > maxY ? maxY : y;
  }

  /** `b(int,boolean)`, first half: spring towards the target. */
  private spring(n: number): void {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const maxVx = ((dx >> 3) * n) >> 15;
    const maxVy = ((dy >> 3) * n) >> 15;
    const sx = dx < 0 ? -1 : 1;
    const sy = dy < 0 ? -1 : 1;
    this.velX = clamp(this.velX + ((dx * 200) >> 16), -maxVx * sx, maxVx * sx);
    this.velY = clamp(this.velY + ((dy * 240) >> 16), (-maxVy * sy) >> 1, (maxVy * sy) >> 1);
    this.x += this.velX;
    this.y += this.velY;
  }

  /** `b(int,boolean)` with `bl = true`: the hard leash around the player. */
  private leash(player: CameraTarget): void {
    const halfW = this.viewW >> 1;
    const halfH = this.viewH >> 1;
    const leashX = this.viewW >> 2;
    const leashY = this.viewH >> 2;
    const dropY = Math.trunc(this.viewH / 20);
    this.x = clamp(this.x, player.x - halfW - leashX, player.x - halfW + leashX);
    this.y = clamp(this.y, player.y - halfH - dropY - leashY, player.y - halfH - dropY + leashY);
  }

  private clampToLevel(level: Level): void {
    const maxX = (level.width << 10) - this.viewW;
    const maxY = (level.height << 10) - this.viewH;
    this.x = clamp(this.x, 0, maxX);
    if (this.y > maxY) this.y = maxY;
  }

  /** Interpolated corner for rendering, `alpha` = fraction of the pending step. */
  renderX(alpha: number): number {
    return Math.round(this.prevX + (this.x - this.prevX) * alpha);
  }

  renderY(alpha: number): number {
    return Math.round(this.prevY + (this.y - this.prevY) * alpha);
  }
}
