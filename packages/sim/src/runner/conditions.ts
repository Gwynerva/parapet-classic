/**
 * Transition conditions 0–80 (`boolean_d(int)`, d.java line 3612) and their helpers:
 * relative tile lookup (`int_n`, line 8988) and the lookahead ray (`boolean_a(e,int,int)`,
 * line 9069). See reference/notes/02-moves.md for the meaning of each id.
 */
import { iabs } from '../math/int.ts';
import type { Level } from '../level/level.ts';
import { cellIndex, rayMarch } from '../collision/raymarch.ts';
import { bitIn, tileHasFlag, type PhysicsTables } from '../tables.ts';
import type { RunnerState } from './runner.ts';

export const Input = {
  UP: 1,
  DOWN: 2,
  RIGHT: 4,
  LEFT: 8,
  FORWARD: 16,
  BACK: 32,
} as const;

export interface ConditionContext {
  level: Level;
  tables: PhysicsTables;
}

/** `int_n(int)`: tile id relative to the runner, see 03-physics.md for the bit layout. */
export function tileRelative(r: RunnerState, level: Level, q: number): number {
  const useFeet = (q & 0x10) !== 0;
  const useHands = (q & 0x20) !== 0;
  const useLookahead = (q & 0x40) !== 0;
  const fromHands = (r.handsAnchored && !useFeet) || useHands;
  let px = r.x + (fromHands ? r.handsDx : 0);
  let py = r.y + (fromHands ? r.handsDy : 0);
  if ((q & 0x200) !== 0) {
    px += 5 * (r.facingRight ? 1 : -1);
  }
  if ((q & 0x400) !== 0) {
    px += 512 * (r.facingRight ? 1 : -1);
  }
  let dxTiles = 1;
  if ((q & 1) === 0) {
    dxTiles = ((q & 2) === 0 ? 1 : 0) - 1;
  }
  let dyTiles = 1;
  if ((q & 4) === 0) {
    dyTiles = ((q & 8) === 0 ? 1 : 0) - 1;
  }
  dyTiles = r.vy > 0 ? dyTiles : -dyTiles;
  if ((q & 0x80) !== 0) {
    dyTiles = -1;
  } else if ((q & 0x100) !== 0) {
    dyTiles = 1;
  } else if ((q & 0x800) !== 0) {
    dyTiles -= 2;
  }
  if (useLookahead) {
    return level.collisionTileAt(r.lookahead.tx + dxTiles, r.lookahead.ty + dyTiles);
  }
  const contact = r.handsAnchored ? r.probes[0] : r.probes[2];
  if (contact.surface !== 0) {
    px -= contact.pushX;
    py -= contact.pushY;
  }
  const col = cellIndex(px, 10, !r.facingRight) + (r.facingRight ? dxTiles : -dxTiles);
  const row = cellIndex(py, 10, r.vy > 0) + dyTiles;
  if (col < 0 || col > level.width || row < 0 || row > level.height) {
    return -1;
  }
  return level.tileAt(col, row);
}

/** `boolean_a(e,int,int)`: cast a ray from the runner along `(vx * scale / 1024, dy)`. */
export function lookaheadRay(
  r: RunnerState,
  ctx: ConditionContext,
  dy: number,
  scale: number,
): boolean {
  r.lookahead.surface = 0;
  let x0 = r.x;
  let y0 = r.y;
  let x1 = x0 + (((r.vx * scale) / 1024) | 0);
  let y1 = y0 + dy;
  if (r.handsAnchored) {
    x0 += r.handsDx;
    y0 += r.handsDy;
    x1 += r.handsDx;
    y1 += r.handsDy;
  }
  return rayMarch(
    ctx.level,
    ctx.tables,
    r.lookahead,
    x0,
    y0,
    x1,
    y1,
    true,
    r.handsAnchored,
    false,
    r.facingRight,
  );
}

/** `boolean_a(e)` (line 8442): is the runner supported by a surface? */
export function isOnSurface(r: RunnerState): boolean {
  if (r.handsAnchored) {
    const k = r.probes[0].surface;
    return k === 12 || k === 11 || k === 9 || k === 8 || k === 17;
  }
  const k = r.probes[2].surface;
  return k !== 0 && k !== 17 && k !== 9 && k !== 8;
}

/** `boolean_g(int)`: buffered press that has not been superseded by a new press this step. */
function bufferedPress(r: RunnerState, mask: number): boolean {
  return (r.inputBuffer & mask) !== 0 && r.pressedBits === 0;
}

function wallAheadMask(r: RunnerState): number {
  return r.facingRight ? 2304 : 4608;
}

/** Evaluate condition `id` for runner `r`. */
export function evalCondition(r: RunnerState, ctx: ConditionContext, id: number): boolean {
  const level = ctx.level;
  const tables = ctx.tables;
  const hands = r.probes[0];
  const feet = r.probes[2];
  const contact = r.probes[r.contactProbe]!;
  switch (id) {
    case 0:
      return true;
    case 1:
      return isOnSurface(r);
    case 2:
      return feet.hit && isOnSurface(r);
    case 3:
      return hands.hit && (hands.tile === 1 || hands.tile === 21);
    case 4:
      return hands.hit;
    case 5:
      return !feet.hit;
    case 6:
      return (r.pressedBits & 0x20) !== 0;
    case 7:
      return (r.pressedBits & 0x10) !== 0;
    case 8:
      return (r.pressedBits & 1) !== 0;
    case 9:
      return (r.pressedBits & 2) !== 0;
    case 10:
      return bufferedPress(r, 32);
    case 11:
      return bufferedPress(r, 16);
    case 12:
      return bufferedPress(r, 1);
    case 13:
      return bufferedPress(r, 2);
    case 14:
      return (
        tileHasFlag(tables, tileRelative(r, level, 0), 1) &&
        tileHasFlag(tables, tileRelative(r, level, 32), 3)
      );
    case 15:
      return tileHasFlag(tables, tileRelative(r, level, 0), r.facingRight ? 128 : 64);
    case 16:
      return !tileHasFlag(tables, tileRelative(r, level, 0), r.facingRight ? 128 : 64);
    case 17:
      return tileHasFlag(tables, tileRelative(r, level, 0), r.facingRight ? 64 : 128);
    case 18:
      return !tileHasFlag(tables, tileRelative(r, level, 0), r.facingRight ? 64 : 128);
    case 19:
      return tileHasFlag(tables, tileRelative(r, level, 0), 252);
    case 20:
      return (feet.hit && !bitIn(feet.surface, 1)) || (hands.hit && !bitIn(hands.surface, 1));
    case 21:
      return (
        (feet.hit && !bitIn(feet.surface, 98305)) || (hands.hit && !bitIn(hands.surface, 98305))
      );
    case 22: {
      const head = tileRelative(r, level, 32);
      const inRow = (r.handsDy + r.y) % 1024;
      return !(
        (head !== 5 && head !== 6 && head !== 23 && head !== 13 && head !== 14) ||
        (inRow >= 2 && inRow <= 1022)
      );
    }
    case 23:
      return !tileHasFlag(tables, tileRelative(r, level, 160), wallAheadMask(r));
    case 24: {
      const above = tileRelative(r, level, 160);
      return above === 17 || above === 18 || !tileHasFlag(tables, above, wallAheadMask(r));
    }
    case 25:
      return (
        hands.hit &&
        ((!r.facingRight && hands.surface === 12 && (hands.tile === 6 || hands.tile === 23)) ||
          (r.facingRight && hands.surface === 11 && (hands.tile === 5 || hands.tile === 23)))
      );
    case 26:
      return (
        hands.hit &&
        ((!r.facingRight && hands.surface === 12 && hands.tile === 14) ||
          (r.facingRight && hands.surface === 11 && hands.tile === 13))
      );
    case 27:
      return (
        hands.hit &&
        ((!r.facingRight && hands.surface === 12 && hands.tile === 13) ||
          (r.facingRight && hands.surface === 11 && hands.tile === 14))
      );
    case 28:
      return !(
        hands.hit &&
        ((!r.facingRight && hands.surface === 12 && (hands.tile === 6 || hands.tile === 23)) ||
          (r.facingRight && hands.surface === 11 && (hands.tile === 5 || hands.tile === 23)))
      );
    case 29: {
      if (!feet.hit) return false;
      const head = tileRelative(r, level, 32);
      return r.facingRight
        ? feet.tile === 17 && (head === 17 || head === 5)
        : feet.tile === 18 && (head === 18 || head === 6);
    }
    case 30:
      return tileRelative(r, level, 33) === 18 - (r.facingRight ? 1 : 0);
    case 31:
      return (
        hands.hit && ((r.facingRight && hands.tile === 17) || (!r.facingRight && hands.tile === 18))
      );
    case 32:
      return contact.hit && bitIn(contact.surface, wallAheadMask(r));
    case 33:
      return contact.hit && bitIn(contact.surface, 6912);
    case 34: {
      const under = tileRelative(r, level, 0);
      return contact.surface === 1 && (under === 15 || under === 16);
    }
    case 35: {
      const under = tileRelative(r, level, 0);
      return (!r.facingRight && under === 5) || (r.facingRight && under === 6);
    }
    case 36:
      return feet.hit;
    case 37:
      return hands.hit && hands.surface >= 1 && hands.surface <= 7;
    case 38:
      return !contact.isHands && isOnSurface(r);
    case 39: {
      const inTile = r.x & 0x3ff;
      return r.facingRight ? inTile > 174 && inTile < 1023 : inTile < 850 && inTile > 0;
    }
    case 40: {
      const t = tileRelative(r, level, 16);
      return t !== 17 && t !== 18;
    }
    case 41: {
      const t = tileRelative(r, level, 16);
      return t === 17 || t === 18;
    }
    case 42: {
      const t = tileRelative(r, level, 32);
      return t === 17 || t === 18;
    }
    case 43: {
      const t = tileRelative(r, level, 0);
      return t !== 17 && t !== 5 && t !== 18 && t !== 6;
    }
    case 44: {
      const t = tileRelative(r, level, 0);
      const ahead = tileRelative(r, level, 9);
      return t !== 5 && t !== 6 && t !== 17 && t !== 18 && (ahead === 5 || ahead === 6);
    }
    case 45:
      return lookaheadRay(r, ctx, 2000, 400);
    case 46:
      return contact.hit;
    case 47:
      return feet.hit && feet.tile === 20;
    case 48:
      return tileRelative(r, level, 0) === 20;
    case 49:
      return !contact.isHands && isOnSurface(r) && tileRelative(r, level, 0) !== 20;
    case 50:
      return hands.hit && hands.tile === 19;
    case 51:
      return tileRelative(r, level, 32) !== 19;
    case 52:
      return iabs(r.prevVx) > 2560;
    case 53:
      return r.moveTimer < 300;
    case 54:
      return r.moveTimer > 325 && r.moveId === 56;
    case 55:
      return tileRelative(r, level, 290) === 1;
    case 56:
      return iabs(r.prevVy) > 6750;
    case 57:
      return iabs(r.prevVy) > 10200;
    case 58:
      return iabs(r.prevVy) > 9500;
    case 59:
      return iabs(r.prevVy) > 15000;
    case 60:
      return iabs(r.prevVy) > 6400;
    case 61:
      return tileRelative(r, level, 0) !== 22 && tileRelative(r, level, 1) !== 22;
    case 62: {
      if (tileRelative(r, level, 1) === 22) return true;
      if (tileRelative(r, level, 0) !== 22) return false;
      const inTile = r.x & 0x3ff;
      return r.facingRight ? inTile <= 512 : inTile > 512;
    }
    case 63:
      return hands.hit && (hands.surface === 15 || hands.surface === 16);
    case 64:
      return contact.tile === 13 || contact.tile === 14;
    case 65:
      return !(
        tileHasFlag(tables, tileRelative(r, level, 1), 2) ||
        tileHasFlag(tables, tileRelative(r, level, 5), 2)
      );
    case 66:
      return (
        feet.hit &&
        (feet.surface === 9 - (r.facingRight ? 1 : 0) || feet.surface === 21) &&
        tileHasFlag(tables, tileRelative(r, level, 128), 98305) &&
        tileHasFlag(tables, tileRelative(r, level, 129), 98305)
      );
    case 67: {
      const t = tileRelative(r, level, 0);
      return t === 13 || t === 14 || t === 25 || t === 26;
    }
    case 68: {
      const mask = wallAheadMask(r);
      if (
        lookaheadRay(r, ctx, ((r.vy * 400) / 1024) | 0, 400) &&
        bitIn(r.lookahead.surface, 6912) &&
        tileHasFlag(tables, tileRelative(r, level, 192), mask)
      ) {
        return true;
      }
      return (
        contact.hit &&
        bitIn(contact.surface, mask) &&
        (tileHasFlag(tables, tileRelative(r, level, 128), mask) ||
          tileHasFlag(tables, tileRelative(r, level, 129), mask))
      );
    }
    case 69: {
      const mask = wallAheadMask(r);
      return !(
        !contact.hit ||
        (contact.surface !== 8 && contact.surface !== 9) ||
        tileHasFlag(tables, tileRelative(r, level, 129), mask) ||
        tileHasFlag(tables, tileRelative(r, level, 128), mask)
      );
    }
    case 70:
      return r.vy > 1250;
    case 71:
      return iabs(r.vx) > 1750;
    case 72: {
      const t = tileRelative(r, level, 528);
      return tileHasFlag(tables, t, wallAheadMask(r)) && !tileHasFlag(tables, t, 6144);
    }
    case 73:
      return tileHasFlag(tables, tileRelative(r, level, 544), wallAheadMask(r));
    case 74: {
      const mask = wallAheadMask(r);
      return (
        tileHasFlag(tables, tileRelative(r, level, 129), mask) ||
        tileHasFlag(tables, tileRelative(r, level, 2049), mask)
      );
    }
    case 75:
      return (
        tileHasFlag(tables, tileRelative(r, level, 1), 1) &&
        tileHasFlag(tables, tileRelative(r, level, 129), 1)
      );
    case 76:
      return tileHasFlag(tables, tileRelative(r, level, 288), 1);
    case 77:
      return (r.x + r.handsDx + r.vx) >> 10 !== (r.x + r.handsDx) >> 10;
    case 78:
      return false;
    case 79:
      return r.vy > 0;
    case 80:
      return r.vx !== 0;
    default:
      return false;
  }
}
