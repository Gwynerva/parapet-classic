/**
 * Impulse types ("z-types"). Literal port of `a(e,int,int,int)` (d.java line 8206).
 * Writes the pending impulse (`impulseX/Y`) and the acceleration applied this step (`accX/Y`).
 */
import { iabs, imin, isqrt } from '../math/int.ts';
import type { RunnerState } from './runner.ts';

export function applyImpulse(r: RunnerState, z: number, dt: number, stepLen: number): void {
  let rotated = false;
  r.impulseX = 0;
  r.accX = 0;
  r.impulseY = 0;
  r.accY = 0;
  let fire = false;
  switch (z) {
    case 4:
    case 9:
    case 10:
    case 20:
    case 21:
      fire = r.phaseTime === 0;
      break;
    case 11:
    case 12:
    case 13:
      fire = r.phaseTime <= r.paramD && r.phaseTime + stepLen > r.paramD;
      break;
    default:
      break;
  }
  switch (z) {
    case 0:
    case 15: {
      if (r.phaseTime !== 0) break;
      const speedSq = z === 15 ? 1505536 : r.vx * r.vx + r.vy * r.vy;
      let s = (isqrt(speedSq) * r.paramC) >> 10;
      if (s < r.paramB) {
        s = r.paramB;
      }
      s = z === 15 ? (s * r.jumpPowerB) >> 16 : (s * r.jumpPowerA) >> 16;
      if (z === 15) {
        r.jumpPowerB -= 9050;
      }
      if (z === 0 && r.jumpPowerA < 35000) {
        r.jumpPowerA = 35000;
      }
      if (r.paramD === 1) {
        r.impulseX = ((265 * s) >> 10) * (r.facingRight ? 1 : -1);
        r.impulseY = -((989 * s) >> 10);
      } else {
        r.impulseX = ((658 * s) >> 10) * (r.facingRight ? 1 : -1);
        r.impulseY = -((784 * s) >> 10);
      }
      if (z === 15 && r.vy > 0) {
        r.impulseY += (r.vy * 500) >> 10;
        r.impulseY -= 100;
      }
      r.vx = 0;
      r.vy = 0;
      break;
    }
    case 12:
    case 4: {
      if (z === 12 && r.phaseTime < r.paramD) {
        r.impulseY = -(((r.accelY * dt) / 1024) | 0);
      }
      if (!fire) break;
      const vy = r.vy;
      const term = (((r.vy * r.vy) / 1024) | 0) + 17600 * r.paramC;
      r.impulseX = r.facingRight ? r.paramB : -r.paramB;
      r.impulseY = -vy - isqrt(vy * vy - term);
      break;
    }
    case 1: {
      if (r.phaseTime < r.phaseDuration) {
        const from = r.scratchI + r.scratchH * r.phaseTime;
        const to = r.scratchI + r.scratchH * imin(r.phaseTime + dt, r.phaseDuration);
        r.impulseX = ((to - from) / 1024) | 0;
        break;
      }
      r.accX = -r.vx;
      r.accY = -r.vy;
      rotated = true;
      break;
    }
    case 9:
    case 20:
      if (!fire) break;
      if (z === 9) {
        r.vy = 0;
      }
      r.impulseX = r.facingRight ? r.paramB : -r.paramB;
      r.impulseY = r.paramC;
      break;
    case 13:
      if (r.phaseTime < r.paramD && !fire) {
        r.impulseX = -r.vx;
        r.impulseY = -r.vy - (((r.accelY * dt) / 1024) | 0);
        break;
      }
      if (!fire) break;
      r.impulseX = r.facingRight ? r.paramB : -r.paramB;
      r.impulseY = r.paramC;
      break;
    case 10:
    case 11:
      if (!fire) break;
      r.impulseX = (r.facingRight ? r.paramB : -r.paramB) - r.vx;
      r.impulseY = r.paramC - r.vy;
      break;
    case 21: {
      if (!fire) break;
      r.impulseX = r.facingRight ? r.paramB : -r.paramB;
      r.impulseY = r.paramC;
      const c = r.probes[r.contactProbe]!;
      const a1 = ((-c.ny * r.impulseX) / 1024) | 0;
      const a2 = ((c.nx * r.impulseX) / 1024) | 0;
      const a3 = ((c.nx * r.impulseY) / 1024) | 0;
      const a4 = ((c.ny * r.impulseY) / 1024) | 0;
      r.accX = a1 + a3 - r.vx;
      r.accY = a2 + a4 - r.vy;
      rotated = true;
      break;
    }
    case 2:
      if (r.phaseTime !== 0) break;
      r.vy = 0;
      r.vx = 0;
      r.impulseX = r.facingRight ? r.paramB : -r.paramB;
      break;
    case 19: {
      if (r.phaseTime <= 100) break;
      const ticks = (r.phaseTime / 100) | 0;
      r.impulseX = ticks * (r.facingRight ? r.paramB : -r.paramB);
      r.phaseTime -= 100 * ticks;
      break;
    }
    case 3:
      if (r.phaseTime === 0) {
        r.impulseX = ((r.handsDx * 1024) / r.phaseDuration) | 0;
        r.impulseY = (((r.handsDy + 1536) * 1024) / r.phaseDuration) | 0;
        break;
      }
      if (r.phaseTime !== r.phaseDuration) break;
      r.impulseX = -r.vx;
      r.impulseY = -r.vy;
      r.x += r.handsDx;
      r.y += 1536 + r.handsDy;
      r.handsDx = 0;
      r.handsDy = -1536;
      break;
    case 5:
      if (r.phaseTime === 0) {
        r.impulseX = (((r.facingRight ? 1 : -1) * r.paramB * 1024) / r.phaseDuration) | 0;
        r.impulseY = ((-r.scratchH * 1024) / r.phaseDuration) | 0;
        break;
      }
      if (r.phaseTime !== r.phaseDuration) break;
      r.impulseX = -r.vx;
      r.impulseY = -r.vy;
      break;
    case 6:
      if (r.phaseTime !== 0) break;
      r.impulseX = -r.vx;
      r.impulseY = -r.vy;
      break;
    case 18:
      if (r.phaseTime !== 0) break;
      r.impulseX = -r.vx;
      break;
    case 7:
      r.impulseX = -r.vx + (((r.vx * r.paramB) / 1024) | 0);
      break;
    case 8:
      r.impulseX = (iabs(r.vx) - r.paramB) * (r.facingRight ? -1 : 1);
      break;
    case 14:
      if (r.phaseTime !== 0) break;
      r.impulseX = (iabs(r.vx) - ((iabs(r.vx) + r.paramB) >> 1)) * (r.facingRight ? -1 : 1);
      r.impulseY = iabs(r.vy) - ((iabs(r.vy) + r.paramC) >> 1);
      break;
    case 16:
      if (r.phaseTime !== 0) break;
      r.impulseX = (r.facingRight ? 1 : -1) * 256;
      r.impulseY = 0;
      break;
    case 17:
      if (r.phaseTime === 0) {
        r.impulseX = -r.vx;
      }
      if (r.vy <= r.paramC) break;
      r.impulseY = r.paramC - r.vy;
      if (r.impulseY >= -r.paramB) break;
      r.impulseY = -r.paramB;
      break;
    default:
      break;
  }
  if (!rotated) {
    const c = r.probes[r.contactProbe]!;
    if (c.surface !== 0 && z >= 19) {
      const a1 = ((-c.ny * r.impulseX) / 1024) | 0;
      const a2 = ((c.nx * r.impulseX) / 1024) | 0;
      const a3 = ((c.nx * r.impulseY) / 1024) | 0;
      const a4 = ((c.ny * r.impulseY) / 1024) | 0;
      r.accX = a1 + a3;
      r.accY = a2 + a4;
      return;
    }
    if (z < 19) {
      r.accX = r.impulseX;
      r.accY = r.impulseY;
    }
  }
}
