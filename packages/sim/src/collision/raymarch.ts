/**
 * Grid ray march and surface following. Literal port of d.java lines 8520–8730 and 8974–8987.
 */
import { iabs } from '../math/int.ts';
import type { Level } from '../level/level.ts';
import type { PhysicsTables } from '../tables.ts';
import type { Probe } from './probe.ts';
import { testHorizontalLine, testSlope, testTileShape } from './shapes.ts';

/** `b(int,int,boolean)` (line 8974): next grid line in the direction of travel. */
function nextGridLine(v: number, shift: number, positive: boolean): number {
  if (positive) {
    return (((v - 1) >> shift) + 1) << shift;
  }
  return (v >> shift) << shift;
}

/**
 * `c(int,int,boolean)` (line 8981): cell index of a coordinate, rounding toward the cell the
 * point is coming from when moving in the positive direction.
 */
export function cellIndex(v: number, shift: number, positive: boolean): number {
  if (positive) {
    return (v - 1) >> shift;
  }
  return v >> shift;
}

/**
 * Contact following (line 8628). Runs before the tile test when the probe already carries a
 * surface. In feet mode it uses the A/B tables to decide whether the runner keeps the floor,
 * walks off an edge or hands over to the wall test; in hands mode it keeps wall/ceiling
 * contacts only on ladder and bar tiles.
 *
 * Returns true when the probe state was decided here (hit or contact dropped).
 */
export function followSurface(
  level: Level,
  tables: PhysicsTables,
  p: Probe,
  localX: number,
  col: number,
  row: number,
  dx: number,
  feetMode: boolean,
  facingRight: boolean,
): boolean {
  if (feetMode) {
    let rowBase = 0;
    const k = p.surface;
    if (
      k !== 0 &&
      k !== 17 &&
      k !== 11 &&
      k !== 12 &&
      k !== 13 &&
      k !== 14 &&
      k !== 15 &&
      k !== 16
    ) {
      rowBase = 22 * k;
    }
    let upper = level.tileAt(col, row);
    let lower = level.tileAt(col, row + 1);
    if (upper < 0) upper = 0;
    if (lower < 0) lower = 0;
    const A = tables.A;
    const B = tables.B;
    const upperFlags = B[rowBase + A[upper]!]!;
    const lowerFlags = B[rowBase + A[lower]!]!;
    let upperK = 0;
    if ((upperFlags & (dx > 0 ? 1 : 4)) !== 0) {
      upperK = B[rowBase + A[upper]! + 1]!;
    }
    // CFR lost the initialiser of this local (line 8659); it is zero unless assigned.
    let lowerK = 0;
    if ((lowerFlags & (dx > 0 ? 2 : 8)) !== 0) {
      lowerK = B[rowBase + A[lower]! + 1]!;
    }
    let newK: number;
    let tile: number;
    if ((dx > 0 && upperK === 8) || (dx < 0 && upperK === 9) || lowerK === 0) {
      newK = upperK;
      tile = upper;
    } else {
      newK = lowerK;
      tile = lower;
      row++;
    }
    // Narrow posts: standing on the post part of the tile keeps a floor contact.
    // (The original tests `26` twice here — one of them was most likely 25.)
    if (
      ((tile === 14 || tile === 26) && localX > 768) ||
      ((tile === 13 || tile === 26) && localX < 256)
    ) {
      p.px = (col << 10) + localX;
      p.py = (row << 10) + 1024;
      p.pushX = 0;
      p.pushY = -1;
      p.nx = 0;
      p.ny = -1024;
      p.surface = 1;
      p.tile = tile;
      p.tx = col;
      p.ty = row;
      return true;
    }
    if (p.surface !== newK || (upperFlags !== 0 && lowerFlags !== 0)) {
      const cx = col << 10;
      const cy = row << 10;
      const lean = dx > 0 ? 4 : -4;
      switch (newK) {
        case 0:
          p.surface = 0;
          break;
        case 1:
          testHorizontalLine(p, cx, cy, localX, 0, 1024, 0, true);
          break;
        case 10:
          testHorizontalLine(p, cx, cy, localX, 0, 1024, 512, true);
          break;
        case 6:
          testSlope(p, cx, cy, localX + lean, 0, localX + lean, 1024, 1024, false);
          break;
        case 7:
          testSlope(p, cx, cy, localX + lean, 0, localX + lean, 1024, 1024, true);
          break;
        default:
          break;
      }
      if (newK !== 8 && newK !== 9) {
        p.tile = tile;
        p.tx = col;
        p.ty = row;
        return true;
      }
    }
    return false;
  }

  // Hands mode: keep wall or bar contacts only while the neighbouring tile still is a ladder/bar.
  let ahead = 0;
  let aheadBelow = 0;
  if (p.surface === 8 || p.surface === 9) {
    ahead = level.tileAt(col + (facingRight ? 1 : -1), row);
    aheadBelow = level.tileAt(col + (facingRight ? 1 : -1), row + 1);
  } else if (p.surface === 17) {
    ahead = level.tileAt(col, row);
  }
  const keep =
    (((ahead === 5 && aheadBelow === 17) || ahead === 17) && p.surface === 8) ||
    (((ahead === 6 && aheadBelow === 18) || ahead === 18) && p.surface === 9) ||
    (ahead === 19 && p.surface === 17);
  if (!keep) {
    p.surface = 0;
    return true;
  }
  return false;
}

/**
 * Ray march from (x0,y0) to (x1,y1) through the grid (line 8520). Returns true and fills the
 * probe on the first hit. `contact` marks the contact probe, `feet`/`body` the probe kind,
 * `facingRight` the runner's facing (used by surface following).
 */
export function rayMarch(
  level: Level,
  tables: PhysicsTables,
  p: Probe,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  contact: boolean,
  feet: boolean,
  body: boolean,
  facingRight: boolean,
): boolean {
  let segX0 = x0;
  let segY0 = y0;
  let curX = segX0;
  let curY = segY0;
  // Next crossing of a horizontal grid line (ny) along the ray, and of a vertical one (nx).
  let crossYx = segX0;
  let crossYy = segY0;
  let crossXx = segX0;
  let crossXy = segY0;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const stepX = dx >= 0 ? 1024 : -1024;
  const stepY = dy >= 0 ? 1024 : -1024;
  let subEndY = 0;
  let prevCol = cellIndex(segX0, 10, dx > 0);
  let col = 0;
  let row = 0;
  if (dy !== 0) {
    crossYy = nextGridLine(y0, 10, dy > 0);
    crossYx = ((((x1 - x0) * (crossYy - y0)) / (y1 - y0)) | 0) + x0;
  }
  if (dx !== 0) {
    crossXx = nextGridLine(x0, 10, dx > 0);
    crossXy = ((((y1 - y0) * (crossXx - x0)) / (x1 - x0)) | 0) + y0;
  }
  while (curX !== x1 || curY !== y1) {
    let tookY = false;
    let tookX = false;
    segX0 = curX;
    segY0 = curY;
    if (
      dx === 0 ||
      (dy !== 0 &&
        iabs(x0 - crossYx) <= iabs(x0 - crossXx) &&
        iabs(y0 - crossYy) <= iabs(y0 - crossXy))
    ) {
      curX = crossYx;
      curY = crossYy;
      tookY = true;
    }
    if (
      dy === 0 ||
      (dx !== 0 &&
        iabs(x0 - crossYx) >= iabs(x0 - crossXx) &&
        iabs(y0 - crossYy) >= iabs(y0 - crossXy))
    ) {
      curX = crossXx;
      curY = crossXy;
      tookX = true;
    }
    crossYy = tookY ? crossYy + stepY : crossYy;
    crossYx = tookY ? ((((x1 - x0) * (crossYy - y0)) / (y1 - y0)) | 0) + x0 : crossYx;
    crossXx = tookX ? crossXx + stepX : crossXx;
    crossXy = tookX ? ((((y1 - y0) * (crossXx - x0)) / (x1 - x0)) | 0) + y0 : crossXy;
    if (iabs(curX - x0) > iabs(x1 - x0) || iabs(curY - y0) > iabs(y1 - y0)) {
      curX = x1;
      curY = y1;
    }
    subEndY = tookY && tookX ? segY0 : curY;
    let hit = false;
    let followed = false;
    col = cellIndex(curX, 10, dx > 0);
    row = cellIndex(curY, 10, dy > 0);
    let cx = col << 10;
    if (
      contact &&
      ((feet && (col !== prevCol || p.tile === 13 || p.tile === 14)) || !feet) &&
      p.surface !== 0
    ) {
      followed = followSurface(level, tables, p, curX - cx, col, row, dx, feet, facingRight);
    }
    if (!followed || p.surface === 0) {
      for (;;) {
        col = cellIndex(curX, 10, dx > 0);
        row = cellIndex(subEndY, 10, dy > 0);
        cx = col << 10;
        const cy = row << 10;
        const tile = level.tileAt(col, row);
        if (
          testTileShape(
            p,
            cx,
            cy,
            segX0 - cx,
            segY0 - cy,
            curX - cx,
            subEndY - cy,
            tile,
            contact,
            feet,
            body,
          )
        ) {
          p.tile = tile;
          p.tx = col;
          p.ty = row;
          hit = true;
        }
        if (hit || subEndY === curY) break;
        subEndY = curY;
      }
    }
    if (hit || followed) {
      return true;
    }
    prevCol = col;
  }
  return false;
}
