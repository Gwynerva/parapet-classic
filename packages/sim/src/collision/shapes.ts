/**
 * Tile shape tests. Literal port of d.java lines 8731–8972.
 *
 * All tests work in the local coordinate system of one cell (0..1024, y down) on a sub-segment
 * (x0,y0)→(x1,y1) that has already been clipped to that cell. `cx`/`cy` are the cell's world
 * origin (col << 10, row << 10). On a hit the probe's contact point, push-out, normal and
 * surface type are written; `hit`, `tile` and the cell indices are set by the caller.
 *
 * A quirk worth keeping: contact points are not interpolated — the tests take the sub-segment's
 * START coordinate on the axis parallel to the surface.
 */
import type { Probe } from './probe.ts';

/**
 * Horizontal line (floor top / ceiling) at local `lineY` (line 8807).
 * `floor` = true: crossing downward gives surface 1 (or 10 when lineY != 0); false: crossing
 * upward gives surface 17.
 */
export function testHorizontalLine(
  p: Probe,
  cx: number,
  cy: number,
  x0: number,
  y0: number,
  y1: number,
  lineY: number,
  floor: boolean,
): boolean {
  const dir = floor ? 1 : -1;
  if (y0 === y1 && y1 === lineY && lineY === 0 && floor) {
    return false;
  }
  if (y0 !== y1 && dir * y0 <= dir * lineY && dir * y1 >= dir * lineY) {
    p.px = cx + x0;
    p.py = cy + lineY;
    p.pushX = 0;
    p.pushY = -dir;
    p.nx = 0;
    p.ny = -dir * 1024;
    p.surface = floor ? (lineY === 0 ? 1 : 10) : 17;
    return true;
  }
  return false;
}

/**
 * Vertical line (wall face) at local `lineX` (line 8826). `facingRight` = true means the face
 * blocks movement to the right (surface 8); false blocks movement to the left (surface 9).
 */
export function testVerticalLine(
  p: Probe,
  cx: number,
  cy: number,
  x0: number,
  y0: number,
  x1: number,
  lineX: number,
  facingRight: boolean,
): boolean {
  const dir = facingRight ? 1 : -1;
  if (x0 !== x1 && dir * x0 <= dir * lineX && dir * x1 >= dir * lineX) {
    p.px = cx + lineX;
    p.py = cy + y0;
    p.pushX = -dir;
    p.pushY = 0;
    p.nx = -dir * 1024;
    p.ny = 0;
    p.surface = 9 - (facingRight ? 1 : 0);
    return true;
  }
  return false;
}

/**
 * 45° slope (line 8842). `falling` = false: "/" line y = size - x (surface 6);
 * true: "\" line y = x (surface 7). `size` is 1024 for full tiles.
 */
export function testSlope(
  p: Probe,
  cx: number,
  cy: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  size: number,
  falling: boolean,
): boolean {
  const s = falling ? -1 : 1;
  const base = falling ? 1024 : 0;
  if (
    y0 <= size &&
    s * x0 <= s * base + (size - y0) &&
    (y1 >= size || s * x1 >= s * base + (size - y1))
  ) {
    p.px = cx + (((x1 + x0) / 2) | 0);
    p.py = cy - (((x1 + x0) / 2) | 0) * s - (base - size);
    p.pushX = 0;
    p.pushY = -2;
    p.nx = ((-102400 * s) / 141) | 0;
    p.ny = -726;
    p.surface = (falling ? 1 : 0) + 6;
    return true;
  }
  return false;
}

/**
 * Grabbable ledge corner of a building edge (line 8859). `right` selects the right side of the
 * tile (surface 12) instead of the left (surface 11). `halfHeight` is the part of the side face
 * that can be grabbed (512), `topReach` how far along the top the hands may land (511).
 */
export function testLedgeCorner(
  p: Probe,
  cx: number,
  cy: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  halfHeight: number,
  topReach: number,
  right: boolean,
): boolean {
  const s = right ? -1 : 1;
  if (y0 < topReach && x0 !== x1 && ((!right && x0 === 0) || (right && x0 === 1024))) {
    p.px = cx + (right ? 1024 : 0);
    p.py = cy + y0;
    p.pushX = -s;
    p.pushY = -1;
    p.nx = -s * 1024;
    p.ny = 0;
    p.surface = (right ? 1 : 0) + 11;
    return true;
  }
  if (y0 === 0 && y0 !== y1 && ((!right && x0 < halfHeight) || (right && x0 > 1024 - halfHeight))) {
    p.px = cx + (right ? 1024 : 0);
    p.py = cy;
    p.pushX = -s;
    p.pushY = -1;
    p.nx = 0;
    p.ny = -1024;
    p.surface = (right ? 1 : 0) + 11;
    return true;
  }
  return false;
}

/** Vertical pole at local x = 512 (line 8885). */
export function testPole(
  p: Probe,
  cx: number,
  cy: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  if (x0 <= 512 && x1 >= 512) {
    p.px = cx + 512;
    p.py = cy + (((y0 + y1) / 2) | 0);
    p.pushX = 1;
    p.pushY = 0;
    p.nx = -1024;
    p.ny = 0;
    p.surface = 15;
    return true;
  }
  if (x0 >= 512 && x1 <= 512) {
    p.px = cx + 512;
    p.py = cy + (((y0 + y1) / 2) | 0);
    p.pushX = -1;
    p.pushY = 0;
    p.nx = 1024;
    p.ny = 0;
    p.surface = 16;
    return true;
  }
  return false;
}

/**
 * Top (`top` = true, surface 13) or bottom (surface 14) of a narrow post that spans local x
 * `xOffset .. xOffset + width` (line 8909).
 */
export function testPostCap(
  p: Probe,
  cx: number,
  cy: number,
  x0: number,
  y0: number,
  y1: number,
  width: number,
  xOffset: number,
  top: boolean,
): boolean {
  const dir = top ? 1 : -1;
  const lineY = top ? 0 : 1024;
  if (
    y0 !== y1 &&
    dir * y0 <= dir * lineY &&
    dir * y1 >= dir * lineY &&
    x0 >= xOffset &&
    x0 <= width + xOffset
  ) {
    p.px = cx + x0;
    p.py = cy + lineY;
    p.pushX = 0;
    p.pushY = -dir;
    p.nx = 0;
    p.ny = -dir * 1024;
    p.surface = 14 - (top ? 1 : 0);
    return true;
  }
  return false;
}

/** Side face of a low slab, only for y0 <= `maxY` (line 8926). */
export function testSlabSide(
  p: Probe,
  cx: number,
  cy: number,
  x0: number,
  y0: number,
  x1: number,
  maxY: number,
  facingRight: boolean,
): boolean {
  const dir = facingRight ? 1 : -1;
  const lineX = facingRight ? 0 : 1024;
  if (y0 <= maxY && x0 !== x1 && dir * x0 <= dir * lineX && dir * x1 >= dir * lineX) {
    p.px = cx + lineX;
    p.py = cy + y0;
    p.pushX = -dir;
    p.pushY = 0;
    p.nx = -dir * 1024;
    p.ny = 0;
    p.surface = 9 - (facingRight ? 1 : 0);
    return true;
  }
  return false;
}

/**
 * Grabbable corner of a narrow post (line 8943). The post occupies `inset .. inset + width`
 * from the tile's left (or right when `right`) edge; `maxY` limits how far down the side can be
 * grabbed.
 */
export function testPostLedge(
  p: Probe,
  cx: number,
  cy: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  maxY: number,
  inset: number,
  right: boolean,
): boolean {
  const s = right ? -1 : 1;
  if (
    y0 === 0 &&
    ((!right && x0 >= inset && x0 < width + inset) ||
      (right && x0 > 1024 - width - inset && x0 <= 1024 - inset))
  ) {
    p.px = cx + (right ? 1024 - inset : inset);
    p.py = cy + 1;
    p.pushX = -s;
    p.pushY = 0;
    p.nx = 0;
    p.ny = -1024;
    p.surface = (right ? 1 : 0) + 11;
    return true;
  }
  if (
    ((!right && x0 <= inset && x1 >= inset) ||
      (right && x0 >= 1024 - inset && x1 <= 1024 - inset)) &&
    (x0 === x1
      ? y0
      : (((y1 - y0) / (x1 - x0)) | 0) * (right ? 1024 - inset - x0 : inset - x0) + y0) < maxY
  ) {
    p.px = cx + (right ? 1024 - inset : inset);
    p.py = cy + y0 + (y0 < 1024 ? 1 : 0);
    p.pushX = -s;
    p.pushY = 0;
    p.nx = -s * 1024;
    p.ny = 0;
    p.surface = (right ? 1 : 0) + 11;
    return true;
  }
  return false;
}

/**
 * Dispatch on the tile id (line 8731). `contact` = this is the contact probe, `feet`/`body`
 * identify the probe kind. Hands-only tests are those gated by `!feet && !body`.
 */
export function testTileShape(
  p: Probe,
  cx: number,
  cy: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tile: number,
  contact: boolean,
  feet: boolean,
  body: boolean,
): boolean {
  switch (tile) {
    case 1:
      return (
        testHorizontalLine(p, cx, cy, x0, y0, y1, 0, true) ||
        testHorizontalLine(p, cx, cy, x0, y0, y1, 1024, false) ||
        testVerticalLine(p, cx, cy, x0, y0, x1, 0, true) ||
        testVerticalLine(p, cx, cy, x0, y0, x1, 1024, false)
      );
    case 2:
      return (contact || body) && testVerticalLine(p, cx, cy, x0, y0, x1, 0, true);
    case 3:
      return (contact || feet) && testHorizontalLine(p, cx, cy, x0, y0, y1, 0, true);
    case 4:
      return (contact || body) && testVerticalLine(p, cx, cy, x0, y0, x1, 1024, false);
    case 5:
      return (
        (contact && testHorizontalLine(p, cx, cy, x0, y0, y1, 0, true)) ||
        (!feet && !body && testLedgeCorner(p, cx, cy, x0, y0, x1, y1, 512, 511, false)) ||
        (contact && testVerticalLine(p, cx, cy, x0, y0, x1, 0, true))
      );
    case 6:
      return (
        (contact && testHorizontalLine(p, cx, cy, x0, y0, y1, 0, true)) ||
        (!feet && !body && testLedgeCorner(p, cx, cy, x0, y0, x1, y1, 512, 511, true)) ||
        (contact && testVerticalLine(p, cx, cy, x0, y0, x1, 1024, false))
      );
    case 7:
      return contact && testSlope(p, cx, cy, x0, y0, x1, y1, 1024, false);
    case 8:
      return contact && testSlope(p, cx, cy, x0, y0, x1, y1, 1024, true);
    case 13:
      if (
        !feet &&
        !body &&
        (testLedgeCorner(p, cx, cy, x0, y0, x1, y1, 256, 511, false) ||
          testPostLedge(p, cx, cy, x0, y0, x1, y1, 256, 511, 768, true))
      ) {
        return true;
      }
      return (
        testVerticalLine(p, cx, cy, x0, y0, x1, 0, true) ||
        testVerticalLine(p, cx, cy, x0, y0, x1, 256, false) ||
        testPostCap(p, cx, cy, x0, y0, y1, 256, 0, true) ||
        testPostCap(p, cx, cy, x0, y0, y1, 256, 0, false)
      );
    case 14:
      if (
        !feet &&
        !body &&
        (testLedgeCorner(p, cx, cy, x0, y0, x1, y1, 256, 511, true) ||
          testPostLedge(p, cx, cy, x0, y0, x1, y1, 256, 511, 768, false))
      ) {
        return true;
      }
      return (
        testVerticalLine(p, cx, cy, x0, y0, x1, 1024, false) ||
        testVerticalLine(p, cx, cy, x0, y0, x1, 768, true) ||
        testPostCap(p, cx, cy, x0, y0, y1, 256, 768, true) ||
        testPostCap(p, cx, cy, x0, y0, y1, 256, 768, false)
      );
    case 17:
      return contact && testVerticalLine(p, cx, cy, x0, y0, x1, 0, true);
    case 18:
      return contact && testVerticalLine(p, cx, cy, x0, y0, x1, 1024, false);
    case 19:
      return (
        (!feet && !body && testHorizontalLine(p, cx, cy, x0, y0, y1, 0, false)) ||
        (!feet && !body && testHorizontalLine(p, cx, cy, x0, y0, y1, 0, true)) ||
        (contact && testHorizontalLine(p, cx, cy, x0, y0, y1, 0, true))
      );
    case 20:
      return contact && feet && testHorizontalLine(p, cx, cy, x0, y0, y1, 0, true);
    case 21:
      return (
        testHorizontalLine(p, cx, cy, x0, y0, y1, 256, false) ||
        testHorizontalLine(p, cx, cy, x0, y0, y1, 0, true) ||
        testSlabSide(p, cx, cy, x0, y0, x1, 256, true) ||
        testSlabSide(p, cx, cy, x0, y0, x1, 256, false)
      );
    case 22:
      return !feet && !body && testPole(p, cx, cy, x0, y0, x1, y1);
    default:
      return false;
  }
}
