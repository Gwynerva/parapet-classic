/**
 * Snap-on-entry (`a(e,int)` line 7905), per-step root motion (`void_a(e,int,int)` line 8137),
 * impulse initialisation (`a(e,int,int,int,int,int)` line 8167) and phase advance
 * (`b(e,int)` line 8438).
 */
import { iabs } from '../math/int.ts';
import { cellIndex } from '../collision/raymarch.ts';
import { setHandsFloorContact, setHandsWallContact } from '../collision/contacts.ts';
import { testHorizontalLine } from '../collision/shapes.ts';
import { DEFAULT_HANDS_DY, type RunnerState } from './runner.ts';

/** Snap the body when entering a move with snap type `x` (line 7905). */
export function snapOnEntry(r: RunnerState, x: number): void {
  r.snapType = x;
  r.snapY = 0;
  r.rootDeltaX = 0;
  r.rootDeltaY = 0;
  r.handsDeltaX = 0;
  r.handsDeltaY = 0;
  const contactIsHands = r.probes[r.contactProbe]!.isHands;
  let px = r.x + (contactIsHands ? r.handsDx : 0);
  let py = r.y + (contactIsHands ? r.handsDy : 0);
  const contact = contactIsHands ? r.probes[0] : r.probes[2];
  if (contact.surface !== 0) {
    px -= contact.pushX;
    py -= contact.pushY;
  }
  if (x === 25) {
    px += r.handsDx;
    py += r.handsDy;
  }
  let col = cellIndex(px, 10, !r.facingRight);
  let row = py >> 10;
  if (x === 2) {
    col += r.facingRight ? 1 : -1;
    row++;
  } else if (x === 23) {
    col += r.facingRight ? 1 : -1;
  } else if (x === 27) {
    col += r.facingRight ? 1 : 0;
  } else if (x === 25) {
    row++;
  }
  const cx = col << 10;
  const cy = row << 10;
  switch (x) {
    case 18:
      r.handsPinned = true;
      r.handsDx = 0;
      r.handsDy = DEFAULT_HANDS_DY;
      r.x = r.facingRight ? cx - 1 : cx + 1024 + 1;
      r.y = cy + 1536;
      setHandsWallContact(r, r.facingRight, cx, cy);
      return;
    case 9:
      r.handsPinned = true;
      r.handsDx = 0;
      r.handsDy = DEFAULT_HANDS_DY;
      r.x = r.facingRight ? cx + 768 - 1 : cx + 256 + 1;
      r.y = cy + 1536 + 1;
      return;
    case 0:
    case 4:
    case 25:
      r.handsPinned = true;
      if (x === 0) {
        r.handsDx = r.facingRight ? cx - 1 - r.x : cx + 1024 + 1 - r.x;
        r.handsDy = cy + 1 - r.y;
      } else {
        r.handsDx = 0;
        r.handsDy = DEFAULT_HANDS_DY;
        r.x = r.facingRight ? cx - 1 : cx + 1024 + 1;
        r.y = cy + 1536 + 1;
      }
      setHandsWallContact(r, r.facingRight, cx, cy);
      return;
    case 2:
    case 5:
      r.handsPinned = true;
      r.handsDx = 0;
      r.handsDy = DEFAULT_HANDS_DY;
      r.x = r.facingRight ? cx - 1 : cx + 1024 + 1;
      r.y = cy + 1536 + 1;
      setHandsWallContact(r, r.facingRight, cx, cy);
      return;
    case 1:
      r.y += 3;
      r.probes[2].surface = 0;
      r.probes[0].surface = 0;
      return;
    case 8:
      r.snapY = r.y;
      r.handsPinned = true;
      return;
    case 29:
      r.handsDy = DEFAULT_HANDS_DY;
      r.y += 1536;
      r.x = r.x + (r.facingRight ? 1024 : -1024);
      r.handsPinned = false;
      r.probes[2].surface = 0;
      r.probes[0].surface = 0;
      return;
    case 15:
      setHandsWallContact(r, r.facingRight, cx, cy);
      return;
    case 3:
      r.handsPinned = true;
      return;
    case 7:
      r.handsDx = 0;
      r.handsDy = -10;
      return;
    case 13:
      r.y -= 384;
      r.handsDy += 384;
      return;
    case 14:
      r.rootDeltaX = r.facingRight ? 192 : -192;
      r.rootDeltaY = 96;
      r.handsDx = r.handsDx - (r.facingRight ? 192 : -192);
      r.handsDy -= 96;
      return;
    case 11:
      r.x += r.handsDx;
      r.y += r.handsDy + 1536;
      r.handsDx = 0;
      r.handsDy = DEFAULT_HANDS_DY;
      return;
    case 6:
      r.x += r.handsDx;
      r.y += r.handsDy;
      r.handsDx = 0;
      r.handsDy = -10;
      return;
    case 19:
      r.y -= 64;
      return;
    case 21:
    case 22: {
      r.handsPinned = true;
      r.handsDx = 0;
      if (x === 21) {
        r.y += 512;
      } else {
        r.y = cy + 1536;
      }
      const dir = r.facingRight ? 1 : -1;
      const hands = r.probes[0];
      hands.px = r.x;
      hands.py = r.handsDy;
      hands.pushX = 0;
      hands.nx = 1024 * dir;
      hands.ny = 0;
      hands.surface = 9 - (r.facingRight ? 1 : 0);
      return;
    }
    case 20: {
      r.handsPinned = true;
      r.handsDx = 0;
      const inTile = r.x & 0x3ff;
      if (inTile <= 32 || inTile >= 992) {
        setHandsWallContact(r, r.facingRight, cx, cy);
      } else {
        let off = 768;
        if (inTile >= 512) {
          off = 256;
        }
        if (inTile < 512 && !r.facingRight) {
          off = -(1024 - off);
        }
        setHandsWallContact(r, r.facingRight, cx - off, cy);
      }
      return;
    }
    case 23:
      r.handsPinned = true;
      r.handsDx = 0;
      r.x = r.facingRight ? cx - 1 : cx + 1024 + 1;
      setHandsWallContact(r, r.facingRight, cx, cy);
      return;
    case 27:
      r.x = cx;
      r.handsPinned = false;
      r.y = cy;
      testHorizontalLine(r.probes[2], cx, cy, 0, 0, 1024, 0, true);
      r.probes[0].surface = 0;
      return;
    case 26:
      r.handsPinned = false;
      r.y = cy;
      testHorizontalLine(r.probes[2], cx, cy, 0, 0, 1024, 0, true);
      r.probes[0].surface = 0;
      return;
    case 30:
      r.x = cx + (r.facingRight ? 1 : 1023);
      r.handsPinned = false;
      r.y = cy - 2;
      testHorizontalLine(r.probes[2], r.x, cy - 2, 0, 0, 1024, 0, true);
      r.probes[0].surface = 0;
      return;
    case 10:
    case 16:
    case 17:
      return;
    case 24:
      r.handsDy = DEFAULT_HANDS_DY;
      r.y = cy + 1536;
      if (iabs(r.x - cx) >= 1024 || iabs(r.x - cx) === 0) {
        r.x = r.x + (r.facingRight ? 1 : -1);
      }
      setHandsFloorContact(r, false, cx, cy);
      return;
    default:
      break;
  }
  r.handsDx = 0;
  r.handsDy = DEFAULT_HANDS_DY;
  r.handsPinned = false;
}

/**
 * Per-step root motion of snap type `x` (line 8137). `sine` is the 512-entry sine table
 * (`var_short_arr_m`), `dt` the step length.
 */
export function applyRootMotion(r: RunnerState, x: number, dt: number, sine: Int16Array): void {
  const crossesHalf =
    r.phaseTime <= ((r.phaseDuration / 2) | 0) && r.phaseTime + dt > ((r.phaseDuration / 2) | 0);
  switch (x) {
    case 16:
    case 17: {
      if (r.phaseTime < r.phaseDuration) {
        const angle =
          x === 16
            ? ((128 * r.phaseTime) / r.phaseDuration) | 0
            : 128 + (((128 * r.phaseTime) / r.phaseDuration) | 0);
        r.handsDeltaX =
          -r.handsDx + (r.facingRight ? 1 : -1) * ((1536 * sine[angle & 0x1ff]!) >> 10);
        r.handsDeltaY = -r.handsDy - ((1536 * sine[(angle + 128) & 0x1ff]!) >> 10);
      }
      return;
    }
    case 8:
      if (r.phaseTime === r.phaseDuration) {
        r.y = r.snapY - 1536 - 1;
      }
      return;
    case 12:
      if (!crossesHalf) break;
      r.rootDeltaY = -160;
      r.handsDy += 160;
      break;
    default:
      break;
  }
}

/** Initialise the impulse state on entering a move (line 8167). */
export function initImpulse(
  r: RunnerState,
  z: number,
  b: number,
  c: number,
  d: number,
  duration: number,
): void {
  r.impulseType = z;
  r.paramB = b;
  r.paramC = c;
  r.paramD = d;
  r.phaseDuration = duration;
  r.phaseTime = 0;
  r.scratchG = 0;
  switch (z) {
    case 5:
      r.scratchH = 1536;
      return;
    case 19:
      r.phaseDuration = 1000;
      return;
    case 4:
    case 12:
      r.paramC = r.paramC > 0 ? -r.paramC : 0;
      return;
    case 1:
      r.scratchG = r.facingRight ? 100 : -100;
      r.scratchH = (((r.scratchG - r.vx) * 1024) / r.phaseDuration) | 0;
      r.scratchI = r.vx;
      return;
    case 13:
      r.scratchH = r.vx;
      r.scratchI = r.vy;
      return;
    default:
      return;
  }
}

/** `b(e,int)` (line 8438): advance the phase clock, clamped to the phase duration. */
export function advancePhase(r: RunnerState, dt: number): void {
  r.phaseTime = r.phaseTime + dt > r.phaseDuration ? r.phaseDuration : r.phaseTime + dt;
}
