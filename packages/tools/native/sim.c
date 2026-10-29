/*
 * Bit-exact port of stepRunner (packages/sim/src/runner/step.ts) and MissionRules.check
 * (packages/sim/src/rules.ts, SPRINT and FLAG_HUNT only) with everything they call, wrapped in
 * the expansion of packages/tools/src/optimal/engine.ts.
 *
 * Arithmetic: the TypeScript reference computes with doubles and truncates only where it says
 * so (`| 0`, `>>`, `<<`, `&`, typed-array stores). Here every value is an int64_t (`num`) that
 * holds what the double holds (all values are integers far below 2^53), and the truncations
 * are explicit:
 *   (a / b) | 0  ->  tdiv(a, b)   truncation toward zero, then ToInt32; b == 0 gives 0
 *   a >> n       ->  shr(a, n)    ToInt32(a) >> n
 *   a << n       ->  shl(a, n)    ToInt32(ToInt32(a) << n)
 *   a & m        ->  i32(a) & m
 * Values reach int32 again only when a row is written (Int32Array store = ToInt32).
 */
#include "sim.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef int64_t num;

static inline num i32(num v) { return (num)(int32_t)(uint32_t)(uint64_t)v; }
static inline num shr(num a, int n) { return (num)((int32_t)i32(a) >> n); }
static inline num shl(num a, int n) { return (num)(int32_t)((uint32_t)(int32_t)i32(a) << n); }
static inline num tdiv(num a, num b) { return b == 0 ? 0 : i32(a / b); }
static inline num iabs_(num n) { return n < 0 ? -n : n; }
static inline num imin_(num a, num b) { return b < a ? b : a; }

/* ---- data ---------------------------------------------------------------------------- */

enum { IN_UP = 1, IN_DOWN = 2, IN_FORWARD = 16, IN_BACK = 32, MARK = 64 };

enum {
  F_HANDS = 0x1,
  F_FORCE_GRAVITY = 0x2,
  F_NO_COLLISION = 0x8,
  F_LOCK_FACING = 0x10,
  F_KEEP_BUFFER = 0x40,
  F_SINGLE_PROBE = 0x80,
  F_LEDGE_PROBE = 0x100,
  F_FACE_AGAINST_VELOCITY = 0x800,
  F_STORE_SPEED = 0x8000,
};

enum { WALL_AHEAD_RIGHT = 2304, WALL_AHEAD_LEFT = 4608, ANY_SLOPE = 252, AIR_OR_POLE = 98305,
       WALL_OR_LEDGE = 6912 };

#define BLOB_MAGIC 0x50415243 /* 'PARC' */
#define BLOB_VERSION 1
#define CHECKPOINT_TILE_BASE 49

typedef struct {
  int32_t target, ncond, condOff;
} Trans;

typedef struct {
  int32_t duration, next, impulseType, paramB, paramC, paramD, flags, snapType, parent;
  int32_t ntrans, transOff;
} Move;

typedef struct {
  int32_t n;
  int32_t *v;
} Table;

struct SimData {
  int32_t missionType, flagCount, flagBits, hasFinish, finishX, finishY;
  int32_t width, height;
  int32_t *tiles;
  int32_t *killRows;
  Table F, A, B, G, C, D, E, H;
  int32_t sine[512];
  int32_t nmoves;
  Move *moves;
  Trans *trans;
  int32_t *conds;
  int32_t *live;
  int32_t start[SIM_STATE_INTS];
  void *mem; /* one allocation holding the arrays */
};

const int32_t SIM_PRESSES[16] = {
    0,  1,  2,  3,  16, 17, 18, 19, 32, 33, 34, 35, 48, 49, 50, 51,
};

/* ---- runner state -------------------------------------------------------------------- */

typedef struct {
  int hit;
  num px, py, pushX, pushY, nx, ny, distSq, tile, tx, ty, surface;
} Probe;

typedef struct {
  num x, y, handsDx, handsDy, handsDeltaX, handsDeltaY, rootDeltaX, rootDeltaY, vx, vy;
  num prevVx, prevVy, tangentSpeed, renderHandsDx, renderHandsDy, renderX, renderY;
  num subStepAcc, contactProbe, accelX, accelY;
  int handsPinned, facingRight, handsAnchored, facingLocked;
  num snapType, snapY, impulseType, paramA, paramB, paramC, paramD, phaseTime, phaseDuration;
  num scratchG, scratchH, scratchI, scratchJ, impulseX, impulseY, accX, accY;
  num jumpPowerA, jumpPowerB, inputBuffer, storedSpeed, moveId, moveTimer, pressedBits;
  Probe probes[3]; /* 0 hands, 1 body, 2 feet */
  Probe lookahead;
  /* Rules. */
  num remainingMask;
  num flagsLeft;
  /* `inputReads.mask`. */
  int reads;
  /* Lookahead rays cast so far in the memoized first transition check. */
  int rays;
  /* Tile lookups shared by the press groups of one expansion, or NULL (see stepPost). */
  struct Memo *memo;
} Runner;

/*
 * tileRelative results of the first transition check of a step, keyed by the query. That check
 * runs on the same state for every press group (only the presses and the buffer differ, and
 * tileRelative reads neither), and nothing a condition does changes what it reads, except the
 * lookahead ray for queries with bit 0x40, which are never memoized.
 */
typedef struct Memo {
  int n;
  int q[48];
  num v[48];
  /*
   * Condition results of that first check: -1 unknown, else 0/1. Every condition but the
   * input ones (6-13) and the two that cast the lookahead ray (45, 68) is a pure function of
   * the shared state, which no condition changes (only the ray writes, to the lookahead probe,
   * and only condition 68 reads it back).
   */
  int8_t cond[96];
  /*
   * Transitions (by index into SimData.trans, up to 256) known to fail in that check without
   * a side effect: a cached false condition with only cacheable ones before it.
   */
  uint64_t dead[4];
  /*
   * Conditions 45 and 68 when they cast the first ray of the check: the ray reads the shared
   * state and the lookahead probe as the step left it, so its outcome (the condition and the
   * probe afterwards) is the same in every group. A later ray starts from another probe.
   */
  int rayKnown[2];
  int rayValue[2];
  Probe rayProbe[2];
  /* The transitions the later groups walk (buildLiveList), or nlist = -1 before it is built. */
  int nlist;
  int16_t list[64];
} Memo;

/* ---- level --------------------------------------------------------------------------- */

static inline num tileAt(const SimData *d, num x, num y) {
  if (x < 0 || y < 0 || x >= d->width || y >= d->height) return -1;
  return d->tiles[y * d->width + x];
}

static inline num collisionTileAt(const SimData *d, num x, num y) {
  if (x < 0 || y < 0 || x >= d->width || y >= d->height) return -1;
  num t = d->tiles[y * d->width + x];
  return t <= 26 ? t : 0;
}

static inline int tileHasFlag(const SimData *d, num tile, num mask) {
  num flags = (tile < 0 || tile >= d->H.n) ? 1 : d->H.v[tile];
  return (i32(flags) & i32(mask)) != 0;
}

static inline int bitIn(num bit, num mask) {
  return ((int32_t)(1u << (i32(bit) & 31)) & (int32_t)i32(mask)) != 0;
}

/* ---- math ---------------------------------------------------------------------------- */

static num isqrt_(num n) {
  num root = 0;
  num bit = 0x10000000;
  while (bit != 0) {
    num t = root + bit;
    root = shr(root, 1);
    if (t <= n) {
      n -= t;
      root += bit;
    }
    bit = shr(bit, 2);
  }
  return root;
}

static num approxLength(num a, num b) {
  if (a < 0) a = -a;
  if (b < 0) b = -b;
  num small, big;
  if (a < b) {
    small = a;
    big = b;
  } else {
    small = b;
    big = a;
  }
  num n = small * 441 + big * 1007;
  if (big < shl(small, 4)) n -= big * 40;
  return shr(n, 10);
}

/* ---- collision: shapes --------------------------------------------------------------- */

static inline num cellIndex(num v, int positive) { return positive ? shr(v - 1, 10) : shr(v, 10); }

static inline num nextGridLine(num v, int positive) {
  if (positive) return shl(shr(v - 1, 10) + 1, 10);
  return shl(shr(v, 10), 10);
}

static int testHorizontalLine(Probe *p, num cx, num cy, num x0, num y0, num y1, num lineY,
                              int floor) {
  num dir = floor ? 1 : -1;
  if (y0 == y1 && y1 == lineY && lineY == 0 && floor) return 0;
  if (y0 != y1 && dir * y0 <= dir * lineY && dir * y1 >= dir * lineY) {
    p->px = cx + x0;
    p->py = cy + lineY;
    p->pushX = 0;
    p->pushY = -dir;
    p->nx = 0;
    p->ny = -dir * 1024;
    p->surface = floor ? (lineY == 0 ? 1 : 10) : 17;
    return 1;
  }
  return 0;
}

static int testVerticalLine(Probe *p, num cx, num cy, num x0, num y0, num x1, num lineX,
                            int facingRight) {
  num dir = facingRight ? 1 : -1;
  if (x0 != x1 && dir * x0 <= dir * lineX && dir * x1 >= dir * lineX) {
    p->px = cx + lineX;
    p->py = cy + y0;
    p->pushX = -dir;
    p->pushY = 0;
    p->nx = -dir * 1024;
    p->ny = 0;
    p->surface = 9 - (facingRight ? 1 : 0);
    return 1;
  }
  return 0;
}

static int testSlope(Probe *p, num cx, num cy, num x0, num y0, num x1, num y1, num size,
                     int falling) {
  num s = falling ? -1 : 1;
  num base = falling ? 1024 : 0;
  if (y0 <= size && s * x0 <= s * base + (size - y0) &&
      (y1 >= size || s * x1 >= s * base + (size - y1))) {
    p->px = cx + tdiv(x1 + x0, 2);
    p->py = cy - tdiv(x1 + x0, 2) * s - (base - size);
    p->pushX = 0;
    p->pushY = -2;
    p->nx = tdiv(-102400 * s, 141);
    p->ny = -726;
    p->surface = (falling ? 1 : 0) + 6;
    return 1;
  }
  return 0;
}

static int testLedgeCorner(Probe *p, num cx, num cy, num x0, num y0, num x1, num y1,
                           num halfHeight, num topReach, int right) {
  num s = right ? -1 : 1;
  if (y0 < topReach && x0 != x1 && ((!right && x0 == 0) || (right && x0 == 1024))) {
    p->px = cx + (right ? 1024 : 0);
    p->py = cy + y0;
    p->pushX = -s;
    p->pushY = -1;
    p->nx = -s * 1024;
    p->ny = 0;
    p->surface = (right ? 1 : 0) + 11;
    return 1;
  }
  if (y0 == 0 && y0 != y1 && ((!right && x0 < halfHeight) || (right && x0 > 1024 - halfHeight))) {
    p->px = cx + (right ? 1024 : 0);
    p->py = cy;
    p->pushX = -s;
    p->pushY = -1;
    p->nx = 0;
    p->ny = -1024;
    p->surface = (right ? 1 : 0) + 11;
    return 1;
  }
  return 0;
}

static int testPole(Probe *p, num cx, num cy, num x0, num y0, num x1, num y1) {
  if (x0 <= 512 && x1 >= 512) {
    p->px = cx + 512;
    p->py = cy + tdiv(y0 + y1, 2);
    p->pushX = 1;
    p->pushY = 0;
    p->nx = -1024;
    p->ny = 0;
    p->surface = 15;
    return 1;
  }
  if (x0 >= 512 && x1 <= 512) {
    p->px = cx + 512;
    p->py = cy + tdiv(y0 + y1, 2);
    p->pushX = -1;
    p->pushY = 0;
    p->nx = 1024;
    p->ny = 0;
    p->surface = 16;
    return 1;
  }
  return 0;
}

static int testPostCap(Probe *p, num cx, num cy, num x0, num y0, num y1, num width, num xOffset,
                       int top) {
  num dir = top ? 1 : -1;
  num lineY = top ? 0 : 1024;
  if (y0 != y1 && dir * y0 <= dir * lineY && dir * y1 >= dir * lineY && x0 >= xOffset &&
      x0 <= width + xOffset) {
    p->px = cx + x0;
    p->py = cy + lineY;
    p->pushX = 0;
    p->pushY = -dir;
    p->nx = 0;
    p->ny = -dir * 1024;
    p->surface = 14 - (top ? 1 : 0);
    return 1;
  }
  return 0;
}

static int testSlabSide(Probe *p, num cx, num cy, num x0, num y0, num x1, num maxY,
                        int facingRight) {
  num dir = facingRight ? 1 : -1;
  num lineX = facingRight ? 0 : 1024;
  if (y0 <= maxY && x0 != x1 && dir * x0 <= dir * lineX && dir * x1 >= dir * lineX) {
    p->px = cx + lineX;
    p->py = cy + y0;
    p->pushX = -dir;
    p->pushY = 0;
    p->nx = -dir * 1024;
    p->ny = 0;
    p->surface = 9 - (facingRight ? 1 : 0);
    return 1;
  }
  return 0;
}

static int testPostLedge(Probe *p, num cx, num cy, num x0, num y0, num x1, num y1, num width,
                         num maxY, num inset, int right) {
  num s = right ? -1 : 1;
  if (y0 == 0 && ((!right && x0 >= inset && x0 < width + inset) ||
                  (right && x0 > 1024 - width - inset && x0 <= 1024 - inset))) {
    p->px = cx + (right ? 1024 - inset : inset);
    p->py = cy + 1;
    p->pushX = -s;
    p->pushY = 0;
    p->nx = 0;
    p->ny = -1024;
    p->surface = (right ? 1 : 0) + 11;
    return 1;
  }
  if (((!right && x0 <= inset && x1 >= inset) ||
       (right && x0 >= 1024 - inset && x1 <= 1024 - inset))) {
    num at = x0 == x1 ? y0 : tdiv(y1 - y0, x1 - x0) * (right ? 1024 - inset - x0 : inset - x0) + y0;
    if (at < maxY) {
      p->px = cx + (right ? 1024 - inset : inset);
      p->py = cy + y0 + (y0 < 1024 ? 1 : 0);
      p->pushX = -s;
      p->pushY = 0;
      p->nx = -s * 1024;
      p->ny = 0;
      p->surface = (right ? 1 : 0) + 11;
      return 1;
    }
  }
  return 0;
}

static int testTileShape(Probe *p, num cx, num cy, num x0, num y0, num x1, num y1, num tile,
                         int contact, int feet, int body) {
  switch (tile) {
    case 1:
      return testHorizontalLine(p, cx, cy, x0, y0, y1, 0, 1) ||
             testHorizontalLine(p, cx, cy, x0, y0, y1, 1024, 0) ||
             testVerticalLine(p, cx, cy, x0, y0, x1, 0, 1) ||
             testVerticalLine(p, cx, cy, x0, y0, x1, 1024, 0);
    case 2:
      return (contact || body) && testVerticalLine(p, cx, cy, x0, y0, x1, 0, 1);
    case 3:
      return (contact || feet) && testHorizontalLine(p, cx, cy, x0, y0, y1, 0, 1);
    case 4:
      return (contact || body) && testVerticalLine(p, cx, cy, x0, y0, x1, 1024, 0);
    case 5:
      return (contact && testHorizontalLine(p, cx, cy, x0, y0, y1, 0, 1)) ||
             (!feet && !body && testLedgeCorner(p, cx, cy, x0, y0, x1, y1, 512, 511, 0)) ||
             (contact && testVerticalLine(p, cx, cy, x0, y0, x1, 0, 1));
    case 6:
      return (contact && testHorizontalLine(p, cx, cy, x0, y0, y1, 0, 1)) ||
             (!feet && !body && testLedgeCorner(p, cx, cy, x0, y0, x1, y1, 512, 511, 1)) ||
             (contact && testVerticalLine(p, cx, cy, x0, y0, x1, 1024, 0));
    case 7:
      return contact && testSlope(p, cx, cy, x0, y0, x1, y1, 1024, 0);
    case 8:
      return contact && testSlope(p, cx, cy, x0, y0, x1, y1, 1024, 1);
    case 13:
      if (!feet && !body &&
          (testLedgeCorner(p, cx, cy, x0, y0, x1, y1, 256, 511, 0) ||
           testPostLedge(p, cx, cy, x0, y0, x1, y1, 256, 511, 768, 1)))
        return 1;
      return testVerticalLine(p, cx, cy, x0, y0, x1, 0, 1) ||
             testVerticalLine(p, cx, cy, x0, y0, x1, 256, 0) ||
             testPostCap(p, cx, cy, x0, y0, y1, 256, 0, 1) ||
             testPostCap(p, cx, cy, x0, y0, y1, 256, 0, 0);
    case 14:
      if (!feet && !body &&
          (testLedgeCorner(p, cx, cy, x0, y0, x1, y1, 256, 511, 1) ||
           testPostLedge(p, cx, cy, x0, y0, x1, y1, 256, 511, 768, 0)))
        return 1;
      return testVerticalLine(p, cx, cy, x0, y0, x1, 1024, 0) ||
             testVerticalLine(p, cx, cy, x0, y0, x1, 768, 1) ||
             testPostCap(p, cx, cy, x0, y0, y1, 256, 768, 1) ||
             testPostCap(p, cx, cy, x0, y0, y1, 256, 768, 0);
    case 17:
      return contact && testVerticalLine(p, cx, cy, x0, y0, x1, 0, 1);
    case 18:
      return contact && testVerticalLine(p, cx, cy, x0, y0, x1, 1024, 0);
    case 19:
      return (!feet && !body && testHorizontalLine(p, cx, cy, x0, y0, y1, 0, 0)) ||
             (!feet && !body && testHorizontalLine(p, cx, cy, x0, y0, y1, 0, 1)) ||
             (contact && testHorizontalLine(p, cx, cy, x0, y0, y1, 0, 1));
    case 20:
      return contact && feet && testHorizontalLine(p, cx, cy, x0, y0, y1, 0, 1);
    case 21:
      return testHorizontalLine(p, cx, cy, x0, y0, y1, 256, 0) ||
             testHorizontalLine(p, cx, cy, x0, y0, y1, 0, 1) ||
             testSlabSide(p, cx, cy, x0, y0, x1, 256, 1) ||
             testSlabSide(p, cx, cy, x0, y0, x1, 256, 0);
    case 22:
      return !feet && !body && testPole(p, cx, cy, x0, y0, x1, y1);
    default:
      return 0;
  }
}

/* ---- collision: ray march ------------------------------------------------------------ */

static int followSurface(const SimData *d, Probe *p, num localX, num col, num row, num dx,
                         int feetMode, int facingRight) {
  if (feetMode) {
    num rowBase = 0;
    num k = p->surface;
    if (k != 0 && k != 17 && k != 11 && k != 12 && k != 13 && k != 14 && k != 15 && k != 16)
      rowBase = 22 * k;
    num upper = tileAt(d, col, row);
    num lower = tileAt(d, col, row + 1);
    if (upper < 0) upper = 0;
    if (lower < 0) lower = 0;
    const int32_t *A = d->A.v, *B = d->B.v;
    num upperFlags = B[rowBase + A[upper]];
    num lowerFlags = B[rowBase + A[lower]];
    num upperK = 0;
    if ((i32(upperFlags) & (dx > 0 ? 1 : 4)) != 0) upperK = B[rowBase + A[upper] + 1];
    num lowerK = 0;
    if ((i32(lowerFlags) & (dx > 0 ? 2 : 8)) != 0) lowerK = B[rowBase + A[lower] + 1];
    num newK, tile;
    if ((dx > 0 && upperK == 8) || (dx < 0 && upperK == 9) || lowerK == 0) {
      newK = upperK;
      tile = upper;
    } else {
      newK = lowerK;
      tile = lower;
      row++;
    }
    if (((tile == 14 || tile == 26) && localX > 768) ||
        ((tile == 13 || tile == 26) && localX < 256)) {
      p->px = shl(col, 10) + localX;
      p->py = shl(row, 10) + 1024;
      p->pushX = 0;
      p->pushY = -1;
      p->nx = 0;
      p->ny = -1024;
      p->surface = 1;
      p->tile = tile;
      p->tx = col;
      p->ty = row;
      return 1;
    }
    if (p->surface != newK || (upperFlags != 0 && lowerFlags != 0)) {
      num cx = shl(col, 10);
      num cy = shl(row, 10);
      num lean = dx > 0 ? 4 : -4;
      switch (newK) {
        case 0:
          p->surface = 0;
          break;
        case 1:
          testHorizontalLine(p, cx, cy, localX, 0, 1024, 0, 1);
          break;
        case 10:
          testHorizontalLine(p, cx, cy, localX, 0, 1024, 512, 1);
          break;
        case 6:
          testSlope(p, cx, cy, localX + lean, 0, localX + lean, 1024, 1024, 0);
          break;
        case 7:
          testSlope(p, cx, cy, localX + lean, 0, localX + lean, 1024, 1024, 1);
          break;
        default:
          break;
      }
      if (newK != 8 && newK != 9) {
        p->tile = tile;
        p->tx = col;
        p->ty = row;
        return 1;
      }
    }
    return 0;
  }

  num ahead = 0, aheadBelow = 0;
  if (p->surface == 8 || p->surface == 9) {
    ahead = tileAt(d, col + (facingRight ? 1 : -1), row);
    aheadBelow = tileAt(d, col + (facingRight ? 1 : -1), row + 1);
  } else if (p->surface == 17) {
    ahead = tileAt(d, col, row);
  }
  int keep = (((ahead == 5 && aheadBelow == 17) || ahead == 17) && p->surface == 8) ||
             (((ahead == 6 && aheadBelow == 18) || ahead == 18) && p->surface == 9) ||
             (ahead == 19 && p->surface == 17);
  if (!keep) {
    p->surface = 0;
    return 1;
  }
  return 0;
}

static int rayMarch(const SimData *d, Probe *p, num x0, num y0, num x1, num y1, int contact,
                    int feet, int body, int facingRight) {
  num segX0 = x0, segY0 = y0, curX = x0, curY = y0;
  num crossYx = x0, crossYy = y0, crossXx = x0, crossXy = y0;
  num dx = x1 - x0, dy = y1 - y0;
  num stepX = dx >= 0 ? 1024 : -1024;
  num stepY = dy >= 0 ? 1024 : -1024;
  num subEndY = 0;
  num prevCol = cellIndex(segX0, dx > 0);
  num col = 0, row = 0;
  if (dy != 0) {
    crossYy = nextGridLine(y0, dy > 0);
    crossYx = tdiv((x1 - x0) * (crossYy - y0), y1 - y0) + x0;
  }
  if (dx != 0) {
    crossXx = nextGridLine(x0, dx > 0);
    crossXy = tdiv((y1 - y0) * (crossXx - x0), x1 - x0) + y0;
  }
  while (curX != x1 || curY != y1) {
    int tookY = 0, tookX = 0;
    segX0 = curX;
    segY0 = curY;
    if (dx == 0 || (dy != 0 && iabs_(x0 - crossYx) <= iabs_(x0 - crossXx) &&
                    iabs_(y0 - crossYy) <= iabs_(y0 - crossXy))) {
      curX = crossYx;
      curY = crossYy;
      tookY = 1;
    }
    if (dy == 0 || (dx != 0 && iabs_(x0 - crossYx) >= iabs_(x0 - crossXx) &&
                    iabs_(y0 - crossYy) >= iabs_(y0 - crossXy))) {
      curX = crossXx;
      curY = crossXy;
      tookX = 1;
    }
    if (tookY) {
      crossYy += stepY;
      crossYx = tdiv((x1 - x0) * (crossYy - y0), y1 - y0) + x0;
    }
    if (tookX) {
      crossXx += stepX;
      crossXy = tdiv((y1 - y0) * (crossXx - x0), x1 - x0) + y0;
    }
    if (iabs_(curX - x0) > iabs_(x1 - x0) || iabs_(curY - y0) > iabs_(y1 - y0)) {
      curX = x1;
      curY = y1;
    }
    subEndY = tookY && tookX ? segY0 : curY;
    int hit = 0, followed = 0;
    col = cellIndex(curX, dx > 0);
    row = cellIndex(curY, dy > 0);
    num cx = shl(col, 10);
    if (contact && ((feet && (col != prevCol || p->tile == 13 || p->tile == 14)) || !feet) &&
        p->surface != 0) {
      followed = followSurface(d, p, curX - cx, col, row, dx, feet, facingRight);
    }
    if (!followed || p->surface == 0) {
      for (;;) {
        col = cellIndex(curX, dx > 0);
        row = cellIndex(subEndY, dy > 0);
        cx = shl(col, 10);
        num cy = shl(row, 10);
        num tile = tileAt(d, col, row);
        if (testTileShape(p, cx, cy, segX0 - cx, segY0 - cy, curX - cx, subEndY - cy, tile,
                          contact, feet, body)) {
          p->tile = tile;
          p->tx = col;
          p->ty = row;
          hit = 1;
        }
        if (hit || subEndY == curY) break;
        subEndY = curY;
      }
    }
    if (hit || followed) return 1;
    prevCol = col;
  }
  return 0;
}

/* ---- conditions ---------------------------------------------------------------------- */

static int isOnSurface(const Runner *r) {
  if (r->handsAnchored) {
    num k = r->probes[0].surface;
    return k == 12 || k == 11 || k == 9 || k == 8 || k == 17;
  }
  num k = r->probes[2].surface;
  return k != 0 && k != 17 && k != 9 && k != 8;
}

static num tileRelative(const SimData *d, const Runner *r, int q) {
  int useFeet = (q & 0x10) != 0;
  int useHands = (q & 0x20) != 0;
  int useLookahead = (q & 0x40) != 0;
  int fromHands = (r->handsAnchored && !useFeet) || useHands;
  num px = r->x + (fromHands ? r->handsDx : 0);
  num py = r->y + (fromHands ? r->handsDy : 0);
  if (q & 0x200) px += 5 * (r->facingRight ? 1 : -1);
  if (q & 0x400) px += 512 * (r->facingRight ? 1 : -1);
  num dxTiles = 1;
  if ((q & 1) == 0) dxTiles = ((q & 2) == 0 ? 1 : 0) - 1;
  num dyTiles = 1;
  if ((q & 4) == 0) dyTiles = ((q & 8) == 0 ? 1 : 0) - 1;
  dyTiles = r->vy > 0 ? dyTiles : -dyTiles;
  if (q & 0x80)
    dyTiles = -1;
  else if (q & 0x100)
    dyTiles = 1;
  else if (q & 0x800)
    dyTiles -= 2;
  if (useLookahead)
    return collisionTileAt(d, r->lookahead.tx + dxTiles, r->lookahead.ty + dyTiles);
  const Probe *contact = r->handsAnchored ? &r->probes[0] : &r->probes[2];
  if (contact->surface != 0) {
    px -= contact->pushX;
    py -= contact->pushY;
  }
  num col = cellIndex(px, !r->facingRight) + (r->facingRight ? dxTiles : -dxTiles);
  num row = cellIndex(py, r->vy > 0) + dyTiles;
  if (col < 0 || col > d->width || row < 0 || row > d->height) return -1;
  return tileAt(d, col, row);
}

static int lookaheadRay(const SimData *d, Runner *r, num dy, num scale) {
  r->lookahead.surface = 0;
  num x0 = r->x, y0 = r->y;
  num x1 = x0 + tdiv(r->vx * scale, 1024);
  num y1 = y0 + dy;
  if (r->handsAnchored) {
    x0 += r->handsDx;
    y0 += r->handsDy;
    x1 += r->handsDx;
    y1 += r->handsDy;
  }
  return rayMarch(d, &r->lookahead, x0, y0, x1, y1, 1, r->handsAnchored, 0, r->facingRight);
}

static inline int bufferedPress(const Runner *r, int mask) {
  return (i32(r->inputBuffer) & mask) != 0 && r->pressedBits == 0;
}

static inline num wallAheadMask(const Runner *r) {
  return r->facingRight ? WALL_AHEAD_RIGHT : WALL_AHEAD_LEFT;
}

static num tileRelativeMemo(const SimData *d, const Runner *r, int q) {
  Memo *m = r->memo;
  if (!m || (q & 0x40)) return tileRelative(d, r, q);
  for (int i = 0; i < m->n; i++)
    if (m->q[i] == q) return m->v[i];
  num v = tileRelative(d, r, q);
  if (m->n < 48) {
    m->q[m->n] = q;
    m->v[m->n] = v;
    m->n++;
  }
  return v;
}

#define TR(q) tileRelativeMemo(d, r, (q))
#define HAS(t, m) tileHasFlag(d, (t), (m))

static int evalCondition(const SimData *d, Runner *r, int id) {
  const Probe *hands = &r->probes[0];
  const Probe *feet = &r->probes[2];
  const Probe *contact = &r->probes[r->contactProbe];
  const int fr = r->facingRight;
  switch (id) {
    case 0:
      return 1;
    case 1:
      return isOnSurface(r);
    case 2:
      return feet->hit && isOnSurface(r);
    case 3:
      return hands->hit && (hands->tile == 1 || hands->tile == 21);
    case 4:
      return hands->hit;
    case 5:
      return !feet->hit;
    case 6:
      r->reads |= 1;
      return (i32(r->pressedBits) & IN_BACK) != 0;
    case 7:
      r->reads |= 2;
      return (i32(r->pressedBits) & IN_FORWARD) != 0;
    case 8:
      r->reads |= 4;
      return (i32(r->pressedBits) & IN_UP) != 0;
    case 9:
      r->reads |= 8;
      return (i32(r->pressedBits) & IN_DOWN) != 0;
    case 10:
      r->reads |= 16;
      return bufferedPress(r, IN_BACK);
    case 11:
      r->reads |= 32;
      return bufferedPress(r, IN_FORWARD);
    case 12:
      r->reads |= 64;
      return bufferedPress(r, IN_UP);
    case 13:
      r->reads |= 128;
      return bufferedPress(r, IN_DOWN);
    case 14:
      return HAS(TR(0), 1) && HAS(TR(32), 3);
    case 15:
      return HAS(TR(0), fr ? 128 : 64);
    case 16:
      return !HAS(TR(0), fr ? 128 : 64);
    case 17:
      return HAS(TR(0), fr ? 64 : 128);
    case 18:
      return !HAS(TR(0), fr ? 64 : 128);
    case 19:
      return HAS(TR(0), ANY_SLOPE);
    case 20:
      return (feet->hit && !bitIn(feet->surface, 1)) || (hands->hit && !bitIn(hands->surface, 1));
    case 21:
      return (feet->hit && !bitIn(feet->surface, AIR_OR_POLE)) ||
             (hands->hit && !bitIn(hands->surface, AIR_OR_POLE));
    case 22: {
      num head = TR(32);
      num inRow = (r->handsDy + r->y) % 1024;
      return !((head != 5 && head != 6 && head != 23 && head != 13 && head != 14) ||
               (inRow >= 2 && inRow <= 1022));
    }
    case 23:
      return !HAS(TR(160), wallAheadMask(r));
    case 24: {
      num above = TR(160);
      return above == 17 || above == 18 || !HAS(above, wallAheadMask(r));
    }
    case 25:
      return hands->hit &&
             ((!fr && hands->surface == 12 && (hands->tile == 6 || hands->tile == 23)) ||
              (fr && hands->surface == 11 && (hands->tile == 5 || hands->tile == 23)));
    case 26:
      return hands->hit && ((!fr && hands->surface == 12 && hands->tile == 14) ||
                            (fr && hands->surface == 11 && hands->tile == 13));
    case 27:
      return hands->hit && ((!fr && hands->surface == 12 && hands->tile == 13) ||
                            (fr && hands->surface == 11 && hands->tile == 14));
    case 28:
      return !(hands->hit &&
               ((!fr && hands->surface == 12 && (hands->tile == 6 || hands->tile == 23)) ||
                (fr && hands->surface == 11 && (hands->tile == 5 || hands->tile == 23))));
    case 29: {
      if (!feet->hit) return 0;
      num head = TR(32);
      return fr ? feet->tile == 17 && (head == 17 || head == 5)
                : feet->tile == 18 && (head == 18 || head == 6);
    }
    case 30:
      return TR(33) == 18 - (fr ? 1 : 0);
    case 31:
      return hands->hit && ((fr && hands->tile == 17) || (!fr && hands->tile == 18));
    case 32:
      return contact->hit && bitIn(contact->surface, wallAheadMask(r));
    case 33:
      return contact->hit && bitIn(contact->surface, WALL_OR_LEDGE);
    case 34: {
      num under = TR(0);
      return contact->surface == 1 && (under == 15 || under == 16);
    }
    case 35: {
      num under = TR(0);
      return (!fr && under == 5) || (fr && under == 6);
    }
    case 36:
      return feet->hit;
    case 37:
      return hands->hit && hands->surface >= 1 && hands->surface <= 7;
    case 38:
      return r->contactProbe != 0 && isOnSurface(r);
    case 39: {
      num inTile = i32(r->x) & 0x3ff;
      return fr ? inTile > 174 && inTile < 1023 : inTile < 850 && inTile > 0;
    }
    case 40: {
      num t = TR(16);
      return t != 17 && t != 18;
    }
    case 41: {
      num t = TR(16);
      return t == 17 || t == 18;
    }
    case 42: {
      num t = TR(32);
      return t == 17 || t == 18;
    }
    case 43: {
      num t = TR(0);
      return t != 17 && t != 5 && t != 18 && t != 6;
    }
    case 44: {
      num t = TR(0);
      num ahead = TR(9);
      return t != 5 && t != 6 && t != 17 && t != 18 && (ahead == 5 || ahead == 6);
    }
    case 45:
      return lookaheadRay(d, r, 2000, 400);
    case 46:
      return contact->hit;
    case 47:
      return feet->hit && feet->tile == 20;
    case 48:
      return TR(0) == 20;
    case 49:
      return r->contactProbe != 0 && isOnSurface(r) && TR(0) != 20;
    case 50:
      return hands->hit && hands->tile == 19;
    case 51:
      return TR(32) != 19;
    case 52:
      return iabs_(r->prevVx) > 2560;
    case 53:
      return r->moveTimer < 300;
    case 54:
      return r->moveTimer > 325 && r->moveId == 56;
    case 55:
      return TR(290) == 1;
    case 56:
      return iabs_(r->prevVy) > 6750;
    case 57:
      return iabs_(r->prevVy) > 10200;
    case 58:
      return iabs_(r->prevVy) > 9500;
    case 59:
      return iabs_(r->prevVy) > 15000;
    case 60:
      return iabs_(r->prevVy) > 6400;
    case 61:
      return TR(0) != 22 && TR(1) != 22;
    case 62: {
      if (TR(1) == 22) return 1;
      if (TR(0) != 22) return 0;
      num inTile = i32(r->x) & 0x3ff;
      return fr ? inTile <= 512 : inTile > 512;
    }
    case 63:
      return hands->hit && (hands->surface == 15 || hands->surface == 16);
    case 64:
      return contact->tile == 13 || contact->tile == 14;
    case 65:
      return !(HAS(TR(1), 2) || HAS(TR(5), 2));
    case 66:
      return feet->hit && (feet->surface == 9 - (fr ? 1 : 0) || feet->surface == 21) &&
             HAS(TR(128), AIR_OR_POLE) && HAS(TR(129), AIR_OR_POLE);
    case 67: {
      num t = TR(0);
      return t == 13 || t == 14 || t == 25 || t == 26;
    }
    case 68: {
      num mask = wallAheadMask(r);
      if (lookaheadRay(d, r, tdiv(r->vy * 400, 1024), 400) &&
          bitIn(r->lookahead.surface, WALL_OR_LEDGE) && HAS(TR(192), mask))
        return 1;
      /* `contact` points into r->probes; the lookahead ray does not touch them. */
      return contact->hit && bitIn(contact->surface, mask) &&
             (HAS(TR(128), mask) || HAS(TR(129), mask));
    }
    case 69: {
      num mask = wallAheadMask(r);
      return !(!contact->hit || (contact->surface != 8 && contact->surface != 9) ||
               HAS(TR(129), mask) || HAS(TR(128), mask));
    }
    case 70:
      return r->vy > 1250;
    case 71:
      return iabs_(r->vx) > 1750;
    case 72: {
      num t = TR(528);
      return HAS(t, wallAheadMask(r)) && !HAS(t, 6144);
    }
    case 73:
      return HAS(TR(544), wallAheadMask(r));
    case 74: {
      num mask = wallAheadMask(r);
      return HAS(TR(129), mask) || HAS(TR(2049), mask);
    }
    case 75:
      return HAS(TR(1), 1) && HAS(TR(129), 1);
    case 76:
      return HAS(TR(288), 1);
    case 77:
      return shr(r->x + r->handsDx + r->vx, 10) != shr(r->x + r->handsDx, 10);
    case 78:
      return 0;
    case 79:
      return r->vy > 0;
    case 80:
      return r->vx != 0;
    default:
      return 0;
  }
}

/* ---- root motion and impulses -------------------------------------------------------- */

#define DEFAULT_HANDS_DY (-1536)

static void setHandsWallContact(Runner *r, int facingRight, num cx, num cy) {
  Probe *hands = &r->probes[0];
  if (facingRight)
    testVerticalLine(hands, cx, cy, 0, 0, 1024, 0, 1);
  else
    testVerticalLine(hands, cx, cy, 1024, 0, 0, 1024, 0);
  r->probes[2].surface = 0;
}

static void setHandsFloorContact(Runner *r, int floor, num cx, num cy) {
  Probe *hands = &r->probes[0];
  if (floor)
    testHorizontalLine(hands, cx, cy, 0, 0, 1024, 0, 1);
  else
    testHorizontalLine(hands, cx, cy, 0, 1024, 0, 0, 0);
  r->probes[2].surface = 0;
}

static void snapOnEntry(Runner *r, num x) {
  r->snapType = x;
  r->snapY = 0;
  r->rootDeltaX = 0;
  r->rootDeltaY = 0;
  r->handsDeltaX = 0;
  r->handsDeltaY = 0;
  int contactIsHands = r->contactProbe == 0;
  num px = r->x + (contactIsHands ? r->handsDx : 0);
  num py = r->y + (contactIsHands ? r->handsDy : 0);
  const Probe *contact = contactIsHands ? &r->probes[0] : &r->probes[2];
  if (contact->surface != 0) {
    px -= contact->pushX;
    py -= contact->pushY;
  }
  if (x == 25) {
    px += r->handsDx;
    py += r->handsDy;
  }
  num col = cellIndex(px, !r->facingRight);
  num row = shr(py, 10);
  if (x == 2) {
    col += r->facingRight ? 1 : -1;
    row++;
  } else if (x == 23) {
    col += r->facingRight ? 1 : -1;
  } else if (x == 27) {
    col += r->facingRight ? 1 : 0;
  } else if (x == 25) {
    row++;
  }
  num cx = shl(col, 10);
  num cy = shl(row, 10);
  switch (x) {
    case 18:
      r->handsPinned = 1;
      r->handsDx = 0;
      r->handsDy = DEFAULT_HANDS_DY;
      r->x = r->facingRight ? cx - 1 : cx + 1024 + 1;
      r->y = cy + 1536;
      setHandsWallContact(r, r->facingRight, cx, cy);
      return;
    case 9:
      r->handsPinned = 1;
      r->handsDx = 0;
      r->handsDy = DEFAULT_HANDS_DY;
      r->x = r->facingRight ? cx + 768 - 1 : cx + 256 + 1;
      r->y = cy + 1536 + 1;
      return;
    case 0:
    case 4:
    case 25:
      r->handsPinned = 1;
      if (x == 0) {
        r->handsDx = r->facingRight ? cx - 1 - r->x : cx + 1024 + 1 - r->x;
        r->handsDy = cy + 1 - r->y;
      } else {
        r->handsDx = 0;
        r->handsDy = DEFAULT_HANDS_DY;
        r->x = r->facingRight ? cx - 1 : cx + 1024 + 1;
        r->y = cy + 1536 + 1;
      }
      setHandsWallContact(r, r->facingRight, cx, cy);
      return;
    case 2:
    case 5:
      r->handsPinned = 1;
      r->handsDx = 0;
      r->handsDy = DEFAULT_HANDS_DY;
      r->x = r->facingRight ? cx - 1 : cx + 1024 + 1;
      r->y = cy + 1536 + 1;
      setHandsWallContact(r, r->facingRight, cx, cy);
      return;
    case 1:
      r->y += 3;
      r->probes[2].surface = 0;
      r->probes[0].surface = 0;
      return;
    case 8:
      r->snapY = r->y;
      r->handsPinned = 1;
      return;
    case 29:
      r->handsDy = DEFAULT_HANDS_DY;
      r->y += 1536;
      r->x = r->x + (r->facingRight ? 1024 : -1024);
      r->handsPinned = 0;
      r->probes[2].surface = 0;
      r->probes[0].surface = 0;
      return;
    case 15:
      setHandsWallContact(r, r->facingRight, cx, cy);
      return;
    case 3:
      r->handsPinned = 1;
      return;
    case 7:
      r->handsDx = 0;
      r->handsDy = -10;
      return;
    case 13:
      r->y -= 384;
      r->handsDy += 384;
      return;
    case 14:
      r->rootDeltaX = r->facingRight ? 192 : -192;
      r->rootDeltaY = 96;
      r->handsDx = r->handsDx - (r->facingRight ? 192 : -192);
      r->handsDy -= 96;
      return;
    case 11:
      r->x += r->handsDx;
      r->y += r->handsDy + 1536;
      r->handsDx = 0;
      r->handsDy = DEFAULT_HANDS_DY;
      return;
    case 6:
      r->x += r->handsDx;
      r->y += r->handsDy;
      r->handsDx = 0;
      r->handsDy = -10;
      return;
    case 19:
      r->y -= 64;
      return;
    case 21:
    case 22: {
      r->handsPinned = 1;
      r->handsDx = 0;
      if (x == 21)
        r->y += 512;
      else
        r->y = cy + 1536;
      num dir = r->facingRight ? 1 : -1;
      Probe *hands = &r->probes[0];
      hands->px = r->x;
      hands->py = r->handsDy;
      hands->pushX = 0;
      hands->nx = 1024 * dir;
      hands->ny = 0;
      hands->surface = 9 - (r->facingRight ? 1 : 0);
      return;
    }
    case 20: {
      r->handsPinned = 1;
      r->handsDx = 0;
      num inTile = i32(r->x) & 0x3ff;
      if (inTile <= 32 || inTile >= 992) {
        setHandsWallContact(r, r->facingRight, cx, cy);
      } else {
        num off = 768;
        if (inTile >= 512) off = 256;
        if (inTile < 512 && !r->facingRight) off = -(1024 - off);
        setHandsWallContact(r, r->facingRight, cx - off, cy);
      }
      return;
    }
    case 23:
      r->handsPinned = 1;
      r->handsDx = 0;
      r->x = r->facingRight ? cx - 1 : cx + 1024 + 1;
      setHandsWallContact(r, r->facingRight, cx, cy);
      return;
    case 27:
      r->x = cx;
      r->handsPinned = 0;
      r->y = cy;
      testHorizontalLine(&r->probes[2], cx, cy, 0, 0, 1024, 0, 1);
      r->probes[0].surface = 0;
      return;
    case 26:
      r->handsPinned = 0;
      r->y = cy;
      testHorizontalLine(&r->probes[2], cx, cy, 0, 0, 1024, 0, 1);
      r->probes[0].surface = 0;
      return;
    case 30:
      r->x = cx + (r->facingRight ? 1 : 1023);
      r->handsPinned = 0;
      r->y = cy - 2;
      testHorizontalLine(&r->probes[2], r->x, cy - 2, 0, 0, 1024, 0, 1);
      r->probes[0].surface = 0;
      return;
    case 10:
    case 16:
    case 17:
      return;
    case 24:
      r->handsDy = DEFAULT_HANDS_DY;
      r->y = cy + 1536;
      if (iabs_(r->x - cx) >= 1024 || iabs_(r->x - cx) == 0)
        r->x = r->x + (r->facingRight ? 1 : -1);
      setHandsFloorContact(r, 0, cx, cy);
      return;
    default:
      break;
  }
  r->handsDx = 0;
  r->handsDy = DEFAULT_HANDS_DY;
  r->handsPinned = 0;
}

static void applyRootMotion(Runner *r, num x, num dt, const int32_t *sine) {
  num half = tdiv(r->phaseDuration, 2);
  int crossesHalf = r->phaseTime <= half && r->phaseTime + dt > half;
  switch (x) {
    case 16:
    case 17: {
      if (r->phaseTime < r->phaseDuration) {
        num angle = x == 16 ? tdiv(128 * r->phaseTime, r->phaseDuration)
                            : 128 + tdiv(128 * r->phaseTime, r->phaseDuration);
        r->handsDeltaX = -r->handsDx + (r->facingRight ? 1 : -1) *
                                           shr(1536 * (num)sine[i32(angle) & 0x1ff], 10);
        r->handsDeltaY = -r->handsDy - shr(1536 * (num)sine[i32(angle + 128) & 0x1ff], 10);
      }
      return;
    }
    case 8:
      if (r->phaseTime == r->phaseDuration) r->y = r->snapY - 1536 - 1;
      return;
    case 12:
      if (!crossesHalf) break;
      r->rootDeltaY = -160;
      r->handsDy += 160;
      break;
    default:
      break;
  }
}

static void initImpulse(Runner *r, num z, num b, num c, num dd, num duration) {
  r->impulseType = z;
  r->paramB = b;
  r->paramC = c;
  r->paramD = dd;
  r->phaseDuration = duration;
  r->phaseTime = 0;
  r->scratchG = 0;
  switch (z) {
    case 5:
      r->scratchH = 1536;
      return;
    case 19:
      r->phaseDuration = 1000;
      return;
    case 4:
    case 12:
      r->paramC = r->paramC > 0 ? -r->paramC : 0;
      return;
    case 1:
      r->scratchG = r->facingRight ? 100 : -100;
      r->scratchH = tdiv((r->scratchG - r->vx) * 1024, r->phaseDuration);
      r->scratchI = r->vx;
      return;
    case 13:
      r->scratchH = r->vx;
      r->scratchI = r->vy;
      return;
    default:
      return;
  }
}

static inline void advancePhase(Runner *r, num dt) {
  r->phaseTime = r->phaseTime + dt > r->phaseDuration ? r->phaseDuration : r->phaseTime + dt;
}

static void applyImpulse(Runner *r, num z, num dt, num stepLen) {
  int rotated = 0;
  r->impulseX = 0;
  r->accX = 0;
  r->impulseY = 0;
  r->accY = 0;
  int fire = 0;
  switch (z) {
    case 4:
    case 9:
    case 10:
    case 20:
    case 21:
      fire = r->phaseTime == 0;
      break;
    case 11:
    case 12:
    case 13:
      fire = r->phaseTime <= r->paramD && r->phaseTime + stepLen > r->paramD;
      break;
    default:
      break;
  }
  const num dir = r->facingRight ? 1 : -1;
  switch (z) {
    case 0:
    case 15: {
      if (r->phaseTime != 0) break;
      num speedSq = z == 15 ? 1505536 : r->vx * r->vx + r->vy * r->vy;
      num s = shr(isqrt_(speedSq) * r->paramC, 10);
      if (s < r->paramB) s = r->paramB;
      s = z == 15 ? shr(s * r->jumpPowerB, 16) : shr(s * r->jumpPowerA, 16);
      if (z == 15) r->jumpPowerB -= 9050;
      if (z == 0 && r->jumpPowerA < 35000) r->jumpPowerA = 35000;
      if (r->paramD == 1) {
        r->impulseX = shr(265 * s, 10) * dir;
        r->impulseY = -shr(989 * s, 10);
      } else {
        r->impulseX = shr(658 * s, 10) * dir;
        r->impulseY = -shr(784 * s, 10);
      }
      if (z == 15 && r->vy > 0) {
        r->impulseY += shr(r->vy * 500, 10);
        r->impulseY -= 100;
      }
      r->vx = 0;
      r->vy = 0;
      break;
    }
    case 12:
    case 4: {
      if (z == 12 && r->phaseTime < r->paramD) r->impulseY = -tdiv(r->accelY * dt, 1024);
      if (!fire) break;
      num vy = r->vy;
      num term = tdiv(r->vy * r->vy, 1024) + 17600 * r->paramC;
      r->impulseX = r->facingRight ? r->paramB : -r->paramB;
      r->impulseY = -vy - isqrt_(vy * vy - term);
      break;
    }
    case 1: {
      if (r->phaseTime < r->phaseDuration) {
        num from = r->scratchI + r->scratchH * r->phaseTime;
        num to = r->scratchI + r->scratchH * imin_(r->phaseTime + dt, r->phaseDuration);
        r->impulseX = tdiv(to - from, 1024);
        break;
      }
      r->accX = -r->vx;
      r->accY = -r->vy;
      rotated = 1;
      break;
    }
    case 9:
    case 20:
      if (!fire) break;
      if (z == 9) r->vy = 0;
      r->impulseX = r->facingRight ? r->paramB : -r->paramB;
      r->impulseY = r->paramC;
      break;
    case 13:
      if (r->phaseTime < r->paramD && !fire) {
        r->impulseX = -r->vx;
        r->impulseY = -r->vy - tdiv(r->accelY * dt, 1024);
        break;
      }
      if (!fire) break;
      r->impulseX = r->facingRight ? r->paramB : -r->paramB;
      r->impulseY = r->paramC;
      break;
    case 10:
    case 11:
      if (!fire) break;
      r->impulseX = (r->facingRight ? r->paramB : -r->paramB) - r->vx;
      r->impulseY = r->paramC - r->vy;
      break;
    case 21: {
      if (!fire) break;
      r->impulseX = r->facingRight ? r->paramB : -r->paramB;
      r->impulseY = r->paramC;
      const Probe *c = &r->probes[r->contactProbe];
      num a1 = tdiv(-c->ny * r->impulseX, 1024);
      num a2 = tdiv(c->nx * r->impulseX, 1024);
      num a3 = tdiv(c->nx * r->impulseY, 1024);
      num a4 = tdiv(c->ny * r->impulseY, 1024);
      r->accX = a1 + a3 - r->vx;
      r->accY = a2 + a4 - r->vy;
      rotated = 1;
      break;
    }
    case 2:
      if (r->phaseTime != 0) break;
      r->vy = 0;
      r->vx = 0;
      r->impulseX = r->facingRight ? r->paramB : -r->paramB;
      break;
    case 19: {
      if (r->phaseTime <= 100) break;
      num ticks = tdiv(r->phaseTime, 100);
      r->impulseX = ticks * (r->facingRight ? r->paramB : -r->paramB);
      r->phaseTime -= 100 * ticks;
      break;
    }
    case 3:
      if (r->phaseTime == 0) {
        r->impulseX = tdiv(r->handsDx * 1024, r->phaseDuration);
        r->impulseY = tdiv((r->handsDy + 1536) * 1024, r->phaseDuration);
        break;
      }
      if (r->phaseTime != r->phaseDuration) break;
      r->impulseX = -r->vx;
      r->impulseY = -r->vy;
      r->x += r->handsDx;
      r->y += 1536 + r->handsDy;
      r->handsDx = 0;
      r->handsDy = DEFAULT_HANDS_DY;
      break;
    case 5:
      if (r->phaseTime == 0) {
        r->impulseX = tdiv(dir * r->paramB * 1024, r->phaseDuration);
        r->impulseY = tdiv(-r->scratchH * 1024, r->phaseDuration);
        break;
      }
      if (r->phaseTime != r->phaseDuration) break;
      r->impulseX = -r->vx;
      r->impulseY = -r->vy;
      break;
    case 6:
      if (r->phaseTime != 0) break;
      r->impulseX = -r->vx;
      r->impulseY = -r->vy;
      break;
    case 18:
      if (r->phaseTime != 0) break;
      r->impulseX = -r->vx;
      break;
    case 7:
      r->impulseX = -r->vx + tdiv(r->vx * r->paramB, 1024);
      break;
    case 8:
      r->impulseX = (iabs_(r->vx) - r->paramB) * (r->facingRight ? -1 : 1);
      break;
    case 14:
      if (r->phaseTime != 0) break;
      r->impulseX =
          (iabs_(r->vx) - shr(iabs_(r->vx) + r->paramB, 1)) * (r->facingRight ? -1 : 1);
      r->impulseY = iabs_(r->vy) - shr(iabs_(r->vy) + r->paramC, 1);
      break;
    case 16:
      if (r->phaseTime != 0) break;
      r->impulseX = dir * 256;
      r->impulseY = 0;
      break;
    case 17:
      if (r->phaseTime == 0) r->impulseX = -r->vx;
      if (r->vy <= r->paramC) break;
      r->impulseY = r->paramC - r->vy;
      if (r->impulseY >= -r->paramB) break;
      r->impulseY = -r->paramB;
      break;
    default:
      break;
  }
  if (!rotated) {
    const Probe *c = &r->probes[r->contactProbe];
    if (c->surface != 0 && z >= 19) {
      num a1 = tdiv(-c->ny * r->impulseX, 1024);
      num a2 = tdiv(c->nx * r->impulseX, 1024);
      num a3 = tdiv(c->nx * r->impulseY, 1024);
      num a4 = tdiv(c->ny * r->impulseY, 1024);
      r->accX = a1 + a3;
      r->accY = a2 + a4;
      return;
    }
    if (z < 19) {
      r->accX = r->impulseX;
      r->accY = r->impulseY;
    }
  }
}

/* ---- step ---------------------------------------------------------------------------- */

static inline int isWallLike(num k) {
  return k == 17 || k == 14 || k == 9 || k == 8 || k == 12 || k == 11;
}

static inline num moveDuration(const Runner *r, const Move *m) {
  return m->duration >= 0 ? m->duration : 100 + shr(r->storedSpeed, 3);
}

static void enterMove(const SimData *d, Runner *r, num id) {
  r->moveId = id;
  const Move *m = &d->moves[id];
  r->moveTimer = moveDuration(r, m);
  if ((m->flags & F_STORE_SPEED) != 0) r->storedSpeed = r->prevVy;
}

static inline int cacheable(int id) {
  return id >= 0 && id < 96 && !(id >= 6 && id <= 13) && id != 45 && id != 68;
}

/** Does transition `t` hold? Through the shared cache of the first check (see Memo). */
static int transitionHolds(const SimData *d, Runner *r, const Trans *t) {
  const int32_t *c = d->conds + t->condOff;
  Memo *m = r->memo;
  if (!m) {
    for (int j = 0; j < t->ncond; j++)
      if (!evalCondition(d, r, c[j])) return 0;
    return 1;
  }
  size_t ti = (size_t)(t - d->trans);
  if (ti < 256 && (m->dead[ti >> 6] >> (ti & 63) & 1)) return 0;
  int pure = 1; /* only cacheable conditions so far */
  for (int j = 0; j < t->ncond; j++) {
    int id = c[j];
    int v;
    if (cacheable(id)) {
      if (m->cond[id] < 0) m->cond[id] = (int8_t)evalCondition(d, r, id);
      v = m->cond[id];
    } else if ((id == 45 || id == 68) && r->rays == 0) {
      pure = 0;
      int k = id == 68;
      if (m->rayKnown[k]) {
        r->lookahead = m->rayProbe[k];
        v = m->rayValue[k];
      } else {
        v = evalCondition(d, r, id);
        m->rayKnown[k] = 1;
        m->rayValue[k] = v;
        m->rayProbe[k] = r->lookahead;
      }
      r->rays++;
    } else {
      pure = 0;
      if (id == 45 || id == 68) r->rays++;
      v = evalCondition(d, r, id);
    }
    if (!v) {
      if (pure && ti < 256) m->dead[ti >> 6] |= 1ull << (ti & 63);
      return 0;
    }
  }
  return 1;
}

/** After the first group's check: the chain's transitions not known dead, in order. */
static void buildLiveList(const SimData *d, num id, Memo *m) {
  int n = 0;
  for (; id != -1; id = d->moves[id].parent) {
    const Move *mv = &d->moves[id];
    for (int i = 0; i < mv->ntrans; i++) {
      int ti = mv->transOff + i;
      if (ti < 256 && (m->dead[ti >> 6] >> (ti & 63) & 1)) continue;
      if (n == 64) return; /* too long: keep walking the chain */
      m->list[n++] = (int16_t)ti;
    }
  }
  m->nlist = n;
}

static int updateTransitions(const SimData *d, Runner *r, num dt) {
  Memo *memo = r->memo;
  if (memo && memo->nlist >= 0) {
    for (int i = 0; i < memo->nlist; i++) {
      const Trans *t = d->trans + memo->list[i];
      if (transitionHolds(d, r, t)) {
        enterMove(d, r, t->target);
        return 1;
      }
    }
  } else {
    const num start = r->moveId;
    num id = start;
    while (id != -1) {
      const Move *m = &d->moves[id];
      const Trans *t = d->trans + m->transOff;
      for (int i = 0; i < m->ntrans; i++, t++) {
        if (transitionHolds(d, r, t)) {
          if (memo) buildLiveList(d, start, memo);
          enterMove(d, r, t->target);
          return 1;
        }
      }
      id = m->parent;
    }
    if (memo) buildLiveList(d, start, memo);
  }
  if (r->moveTimer != -1) {
    r->moveTimer = r->moveTimer - dt >= 0 ? r->moveTimer - dt : -2;
    const Move *m = &d->moves[r->moveId];
    if (r->moveTimer == -2 && m->next != -1) {
      enterMove(d, r, m->next);
      return 1;
    }
  }
  return 0;
}

static void sweepProbes(const SimData *d, Runner *r, num dt) {
  Probe *hands = &r->probes[0], *body = &r->probes[1], *feet = &r->probes[2];
  int flags = d->moves[r->moveId].flags;
  num endX = r->x + r->rootDeltaX + tdiv(r->vx * dt, 1024);
  num endY = r->y + r->rootDeltaY + tdiv(r->vy * dt, 1024);
  if ((flags & F_NO_COLLISION) == 0) {
    num hdx = r->handsDx + r->handsDeltaX;
    num hdy = r->handsDy + r->handsDeltaY;
    num bdx = tdiv(hdx, 2);
    num bdy = tdiv(hdy, 2);
    int allProbes = 1;
    if ((flags & F_SINGLE_PROBE) == 0) {
      feet->hit = rayMarch(d, feet, r->x, r->y, endX, endY, !r->handsAnchored, 1, 0,
                           r->facingRight);
      body->hit = rayMarch(d, body, r->x + tdiv(r->handsDx, 2), r->y + tdiv(r->handsDy, 2),
                           endX + bdx, endY + bdy, 0, 0, 1, r->facingRight);
      hands->hit = !r->handsPinned &&
                   rayMarch(d, hands, r->x + r->handsDx, r->y + r->handsDy, endX + hdx,
                            endY + hdy, r->handsAnchored, 0, 0, r->facingRight);
    } else if (r->handsAnchored) {
      feet->hit = 0;
      body->hit = 0;
      hands->hit = !r->handsPinned && rayMarch(d, hands, r->x + r->handsDx, r->y + r->handsDy,
                                               endX + hdx, endY + hdy, 1, 0, 0, r->facingRight);
    } else {
      feet->hit = rayMarch(d, feet, r->x, r->y, endX, endY, 1, 1, 0, r->facingRight);
      body->hit = 0;
      hands->hit = 0;
      allProbes = 0;
    }
    if ((flags & F_LEDGE_PROBE) != 0 && !hands->hit && !r->handsPinned && allProbes) {
      hands->hit = rayMarch(d, hands, r->x + r->handsDx, r->y + r->handsDy,
                            endX + hdx + (r->facingRight ? 32 : -32), endY + hdy,
                            r->handsAnchored, 0, 0, r->facingRight);
      if ((hands->hit && hands->surface != 11 && hands->surface != 12) || hands->tile == 1)
        hands->hit = 0;
    }
  } else {
    feet->hit = 0;
    body->hit = 0;
    hands->hit = 0;
  }
  if (feet->hit) {
    num dx = r->x - feet->px, dy = r->y - feet->py;
    feet->distSq = dx * dx + dy * dy;
  }
  if (body->hit) {
    num dx = r->x + tdiv(r->handsDx, 2) - body->px;
    num dy = r->y + tdiv(r->handsDy, 2) - body->py;
    body->distSq = dx * dx + dy * dy;
  }
  if (hands->hit) {
    num dx = r->x + r->handsDx - hands->px;
    num dy = r->y + r->handsDy - hands->py;
    hands->distSq = dx * dx + dy * dy;
  }
}

/*
 * stepRunner, split where the presses first matter. Everything before the transition loop
 * (the sweep, the collision response, the jump power) never reads `pressedBits` or
 * `inputBuffer`, so an expansion runs it once and then the rest once per press group. The TS
 * starts with `inputBuffer |= pressedBits`; nothing reads the buffer before the transitions,
 * so stepPost does that instead.
 */
typedef struct {
  int fullStep;
  num sub, dt;
} StepPre;

static void stepPre(const SimData *d, Runner *r, num dt, StepPre *pre) {
  Probe *hands = &r->probes[0], *body = &r->probes[1], *feet = &r->probes[2];
  int fullStep = 0;
  r->prevVx = r->vx;
  r->prevVy = r->vy;
  r->subStepAcc += dt;
  num sub;
  if (r->subStepAcc >= 30) {
    sub = 30;
    r->subStepAcc -= 30;
    fullStep = 1;
  } else {
    sub = r->subStepAcc;
    fullStep = 0;
  }
  sweepProbes(d, r, sub);
  int freeMove = 0;
  num oldX = r->x, oldY = r->y;
  if (hands->hit || body->hit || feet->hit) {
    int respond = 1;
    if (hands->hit && (!feet->hit || hands->distSq < feet->distSq ||
                       (!r->handsAnchored && hands->distSq == feet->distSq))) {
      if (hands->surface != 0) {
        if (hands->surface != 15 && hands->surface != 16) {
          r->contactProbe = 0;
          r->x = hands->px + hands->pushX - r->handsDx;
          r->y = hands->py + hands->pushY - r->handsDy;
          feet->surface = 0;
        } else {
          r->x = hands->px + hands->pushX - r->handsDx;
          r->y = hands->py + hands->pushY - r->handsDy;
          respond = 0;
        }
      } else {
        freeMove = 1;
        respond = 0;
      }
    } else if (feet->hit && ((isOnSurface(r) && (!body->hit || feet->distSq < body->distSq)) ||
                             !isOnSurface(r))) {
      if (feet->surface != 0) {
        r->contactProbe = 2;
        r->x = feet->px + feet->pushX;
        r->y = feet->py + feet->pushY;
        hands->surface = 0;
      } else {
        freeMove = 1;
        respond = 0;
      }
    } else {
      r->contactProbe = 1;
      r->x = body->px + body->pushX - tdiv(r->handsDx, 2);
      r->y = body->py + body->pushY - tdiv(r->handsDy, 2);
      feet->surface = 0;
      hands->surface = 0;
    }
    if (respond) {
      const Probe *c = &r->probes[r->contactProbe];
      if (isWallLike(c->surface)) {
        num along = tdiv(r->vx * -c->ny + r->vy * c->nx, 1024);
        r->vx = tdiv(-along * c->ny, 1024);
        r->vy = tdiv(along * c->nx, 1024);
        r->tangentSpeed = -r->tangentSpeed;
      } else {
        r->vx = tdiv(r->tangentSpeed * -c->ny + 0, 1024);
        r->vy = tdiv(0 + r->tangentSpeed * c->nx, 1024);
      }
    }
    fullStep = 1;
  } else if (fullStep && !r->handsPinned && isOnSurface(r)) {
    const Probe *c = r->handsAnchored ? hands : feet;
    num slope = d->G.v[c->surface];
    num baseX = r->handsAnchored ? c->px + c->pushX - r->handsDx - r->handsDeltaX
                                 : c->px + c->pushX;
    num baseY = r->handsAnchored ? c->py + c->pushY - r->handsDy - r->handsDeltaY
                                 : c->py + c->pushY;
    const Probe *cc = &r->probes[r->contactProbe];
    if (r->handsAnchored && (cc->surface == 11 || cc->surface == 12 || hands->surface == 8 ||
                             hands->surface == 9)) {
      r->y += r->rootDeltaY + tdiv(r->vy * sub, 1024);
      r->x = baseX;
    } else {
      r->x += r->rootDeltaX + tdiv(r->vx * sub, 1024);
      r->y = tdiv(slope * (r->x - baseX), 1024) + baseY;
    }
    r->handsDx += r->handsDeltaX;
    r->handsDy += r->handsDeltaY;
    r->contactProbe = r->handsAnchored ? 0 : 2;
  } else if (fullStep) {
    freeMove = 1;
  }
  if (freeMove) {
    r->x += r->rootDeltaX + tdiv(r->vx * sub, 1024);
    r->y += r->rootDeltaY + tdiv(r->vy * sub, 1024);
    r->handsDx += r->handsDeltaX;
    r->handsDy += r->handsDeltaY;
  }
  if (fullStep) {
    if (r->handsPinned) {
      r->handsDx -= r->x - oldX;
      r->handsDy -= r->y - oldY;
    }
    r->rootDeltaX = 0;
    r->rootDeltaY = 0;
    r->handsDeltaX = 0;
    r->handsDeltaY = 0;
  }
  if (isOnSurface(r)) r->jumpPowerB = 65536;
  pre->fullStep = fullStep;
  pre->sub = sub;
  pre->dt = dt;
}

static void stepPost(const SimData *d, Runner *r, const StepPre *pre, Memo *memo) {
  Probe *hands = &r->probes[0], *feet = &r->probes[2];
  int fullStep = pre->fullStep;
  const num sub = pre->sub, dt = pre->dt;
  int detached = 0;
  r->inputBuffer = i32(r->inputBuffer) | i32(r->pressedBits);
  int flags = d->moves[r->moveId].flags;
  num timerDt = r->moveTimer > 0 && r->moveTimer < dt ? r->moveTimer : dt;
  const Move *cur;
  /* The first transition check sees the state every press group shares. */
  r->memo = memo;
  r->rays = 0;
  do {
    int entered = updateTransitions(d, r, timerDt);
    r->memo = NULL;
    if (entered) {
      const Move *m = &d->moves[r->moveId];
      flags = m->flags;
      if (r->facingLocked && (flags & F_FACE_AGAINST_VELOCITY) == 0)
        r->facingRight = !r->facingRight;
      r->facingLocked = (flags & F_LOCK_FACING) != 0;
      r->inputBuffer = (flags & F_KEEP_BUFFER) != 0 ? r->inputBuffer : 0;
      snapOnEntry(r, m->snapType);
      initImpulse(r, m->impulseType, m->paramB, m->paramC, m->paramD, moveDuration(r, m));
      r->handsAnchored = (flags & F_HANDS) != 0;
      fullStep = 1;
    }
    r->jumpPowerA += 20 * dt;
    if (r->jumpPowerA > 65536) r->jumpPowerA = 65536;
    r->jumpPowerB += 11 * dt;
    if (r->jumpPowerB > 65536) r->jumpPowerB = 65536;
    if (r->moveTimer == 0 || fullStep) {
      applyRootMotion(r, r->snapType, 30, d->sine);
      applyImpulse(r, r->impulseType, 30, 30);
      advancePhase(r, 30);
      if ((flags & F_FORCE_GRAVITY) != 0 || !isOnSurface(r)) {
        hands->surface = 0;
        feet->surface = 0;
        detached = 1;
      }
      num ax = r->accX + (detached ? tdiv(r->accelX * 30, 1024) : 0);
      num ay = r->accY + (detached ? tdiv(r->accelY * 30, 1024) : 0);
      if (isOnSurface(r)) {
        num speed = approxLength(r->vx, r->vy);
        const Probe *c = &r->probes[r->contactProbe];
        num cls = d->C.v[c->surface];
        num down = r->vy > 0 ? 1 : 0;
        num scale = d->E.v[cls + (1 - down)];
        num cap = tdiv(3400 * scale, 1024);
        if (tdiv(r->vx * r->accX + r->vy * r->accY, 1024) > 0) {
          if (speed > cap) {
            num brake = d->D.v[shr(cls, 1)];
            ax -= tdiv(brake * r->vx, speed);
            ay -= tdiv(brake * r->vy, speed);
          } else {
            num bucket = tdiv(cap, 12);
            num idx = imin_(tdiv(speed, bucket), 11);
            ax = tdiv(ax * d->F.v[idx], 1024);
            ay = tdiv(ay * d->F.v[idx], 1024);
          }
        }
      }
      r->vx += ax;
      r->vy += ay;
      if (isOnSurface(r)) {
        num sq = r->vx * r->vx + r->vy * r->vy;
        const Probe *c = &r->probes[r->contactProbe];
        num limit = c->ny == -1024 ? 3400 : iabs_(c->nx) == 1024 ? 5250 : 4000;
        if (sq > limit * limit) {
          num len = isqrt_(sq);
          r->vx = tdiv(r->vx * limit, len);
          r->vy = tdiv(r->vy * limit, len);
        }
      } else if (r->vy > 17300) {
        r->vy = 17300;
      }
      r->tangentSpeed = r->vx;
      if (!r->facingLocked) {
        if (!r->handsPinned) {
          if (r->vx > 0)
            r->facingRight = 1;
          else if (r->vx < 0)
            r->facingRight = 0;
        }
      }
      if ((flags & F_FACE_AGAINST_VELOCITY) != 0 && !r->facingLocked)
        r->facingRight = !r->facingRight;
    }
    if (fullStep) {
      r->renderHandsDx = r->handsDx;
      r->renderHandsDy = r->handsDy;
      r->renderX = r->x;
      r->renderY = r->y;
    } else {
      r->renderHandsDx = r->handsDx + tdiv(r->handsDeltaX * sub, 30);
      r->renderHandsDy = r->handsDy + tdiv(r->handsDeltaY * sub, 30);
      r->renderX = r->x + tdiv(r->rootDeltaX * sub, 30) + tdiv(r->vx * sub, 1024);
      r->renderY = r->y + tdiv(r->rootDeltaY * sub, 30) + tdiv(r->vy * sub, 1024);
    }
    /* killRows[i] outside the map is undefined in TS, and `undefined << 10` is 0. */
    num col = shr(r->renderX, 10);
    num killRow = (col >= 0 && col < d->width) ? d->killRows[col] : 0;
    num killY = shl(killRow, 10);
    if (r->renderY + r->renderHandsDy > killY + 2048) {
      r->y = killY - 2048;
      r->renderY = killY - 2048;
      enterMove(d, r, 11);
    }
    cur = &d->moves[r->moveId];
  } while (moveDuration(r, cur) == 0 && cur->next != -1);
}

/* ---- rules --------------------------------------------------------------------------- */

/** MissionRules.check for SPRINT (0) and FLAG_HUNT (1); true when the run finished. */
static int rulesCheck(const SimData *d, Runner *r) {
  num cx = shr(r->x + shr(r->handsDx, 1), 10);
  num cy = shr(r->y + shr(r->handsDy, 1), 10);
  num fx = shr(r->x, 10);
  num fy = shr(r->y, 10);
  num atCentre = tileAt(d, cx, cy) - CHECKPOINT_TILE_BASE;
  num atFeet = tileAt(d, fx, fy) - CHECKPOINT_TILE_BASE;
  num marker = atFeet >= 0 ? atFeet : atCentre;
  int atFinish = d->hasFinish && cx == d->finishX && (cy == d->finishY || cy == d->finishY - 1);
  int32_t mask = (int32_t)i32(r->remainingMask);
  int32_t bit = marker >= 0 ? (int32_t)(1u << (i32(marker) & 31)) : 0;
  if (d->missionType == 0) {
    if (atFinish && (mask & 0x10) == 0) return 1;
    if (marker >= 0 && (mask & bit) != 0 &&
        (marker == 0 || (mask & (int32_t)(1u << (i32(marker - 1) & 31))) == 0)) {
      r->remainingMask = mask ^ bit;
    }
    return 0;
  }
  /* FLAG_HUNT */
  if (marker >= 0 && (mask & bit) != 0) {
    r->remainingMask = mask ^ bit;
    r->flagsLeft--;
    if (r->flagsLeft == 0) return 1;
  }
  return 0;
}

/* ---- rows ---------------------------------------------------------------------------- */

#define RUNNER_INTS 44
#define PROBE_INTS 12
#define ROW_BUFFER 39
#define ROW_MOVE 41

static inline void readProbe(Probe *p, const int32_t *a) {
  p->hit = 0;
  p->px = a[1];
  p->py = a[2];
  p->pushX = a[3];
  p->pushY = a[4];
  p->nx = a[5];
  p->ny = a[6];
  p->distSq = 0;
  p->tile = a[8];
  p->tx = a[9];
  p->ty = a[10];
  p->surface = a[11];
}

static inline void writeProbe(const Probe *p, int32_t *a) {
  a[0] = 0;
  a[1] = (int32_t)i32(p->px);
  a[2] = (int32_t)i32(p->py);
  a[3] = (int32_t)i32(p->pushX);
  a[4] = (int32_t)i32(p->pushY);
  a[5] = (int32_t)i32(p->nx);
  a[6] = (int32_t)i32(p->ny);
  a[7] = 0;
  a[8] = (int32_t)i32(p->tile);
  a[9] = (int32_t)i32(p->tx);
  a[10] = (int32_t)i32(p->ty);
  a[11] = (int32_t)i32(p->surface);
}

static void readState(Runner *r, const int32_t *a) {
  r->x = a[0];
  r->y = a[1];
  r->handsDx = a[2];
  r->handsDy = a[3];
  r->handsDeltaX = a[4];
  r->handsDeltaY = a[5];
  r->rootDeltaX = a[6];
  r->rootDeltaY = a[7];
  r->vx = a[8];
  r->vy = a[9];
  r->prevVx = 0;
  r->prevVy = 0;
  r->tangentSpeed = a[10];
  r->renderHandsDx = a[11];
  r->renderHandsDy = a[12];
  r->renderX = a[13];
  r->renderY = a[14];
  r->subStepAcc = a[15];
  r->contactProbe = a[16];
  r->accelX = a[17];
  r->accelY = a[18];
  int32_t f = a[19];
  r->handsPinned = (f & 1) != 0;
  r->facingRight = (f & 2) != 0;
  r->handsAnchored = (f & 4) != 0;
  r->facingLocked = (f & 8) != 0;
  r->snapType = a[20];
  r->snapY = a[21];
  r->impulseType = a[22];
  r->paramA = a[23];
  r->paramB = a[24];
  r->paramC = a[25];
  r->paramD = a[26];
  r->phaseTime = a[27];
  r->phaseDuration = a[28];
  r->scratchG = a[29];
  r->scratchH = a[30];
  r->scratchI = a[31];
  r->scratchJ = a[32];
  r->impulseX = a[33];
  r->impulseY = a[34];
  r->accX = a[35];
  r->accY = a[36];
  r->jumpPowerA = a[37];
  r->jumpPowerB = a[38];
  r->inputBuffer = a[39];
  r->storedSpeed = a[40];
  r->moveId = a[41];
  r->moveTimer = a[42];
  r->pressedBits = 0;
  const int32_t *p = a + RUNNER_INTS;
  for (int i = 0; i < 3; i++, p += PROBE_INTS) readProbe(&r->probes[i], p);
  readProbe(&r->lookahead, p);
  r->remainingMask = p[PROBE_INTS];
}

#define W(i, v) a[i] = (int32_t)i32(v)

static void writeState(const Runner *r, int32_t *a) {
  W(0, r->x);
  W(1, r->y);
  W(2, r->handsDx);
  W(3, r->handsDy);
  W(4, r->handsDeltaX);
  W(5, r->handsDeltaY);
  W(6, r->rootDeltaX);
  W(7, r->rootDeltaY);
  W(8, r->vx);
  W(9, r->vy);
  W(10, r->tangentSpeed);
  W(11, r->renderHandsDx);
  W(12, r->renderHandsDy);
  W(13, r->renderX);
  W(14, r->renderY);
  W(15, r->subStepAcc);
  W(16, r->contactProbe);
  W(17, r->accelX);
  W(18, r->accelY);
  a[19] = (r->handsPinned ? 1 : 0) | (r->facingRight ? 2 : 0) | (r->handsAnchored ? 4 : 0) |
          (r->facingLocked ? 8 : 0);
  W(20, r->snapType);
  W(21, r->snapY);
  W(22, r->impulseType);
  W(23, r->paramA);
  W(24, r->paramB);
  W(25, r->paramC);
  W(26, r->paramD);
  W(27, r->phaseTime);
  W(28, r->phaseDuration);
  W(29, r->scratchG);
  W(30, r->scratchH);
  W(31, r->scratchI);
  W(32, r->scratchJ);
  W(33, r->impulseX);
  W(34, r->impulseY);
  W(35, r->accX);
  W(36, r->accY);
  W(37, r->jumpPowerA);
  W(38, r->jumpPowerB);
  W(39, r->inputBuffer);
  W(40, r->storedSpeed);
  W(41, r->moveId);
  W(42, r->moveTimer);
  a[43] = 0;
  int32_t *p = a + RUNNER_INTS;
  for (int i = 0; i < 3; i++, p += PROBE_INTS) writeProbe(&r->probes[i], p);
  writeProbe(&r->lookahead, p);
  p[PROBE_INTS] = (int32_t)i32(r->remainingMask);
}

#undef W

/* ---- expansion ----------------------------------------------------------------------- */

void sim_start(const SimData *d, int32_t *row) { memcpy(row, d->start, sizeof d->start); }

void sim_canon(const SimData *d, int32_t *row) {
  row[ROW_BUFFER] &= d->live[row[ROW_MOVE]];
}

static inline int conditionHolds(int c, int32_t bits, int32_t buffer) {
  switch (c) {
    case 0:
      return (bits & IN_BACK) != 0;
    case 1:
      return (bits & IN_FORWARD) != 0;
    case 2:
      return (bits & IN_UP) != 0;
    case 3:
      return (bits & IN_DOWN) != 0;
    default: {
      static const int32_t masks[4] = {IN_BACK, IN_FORWARD, IN_UP, IN_DOWN};
      return bits == 0 && ((buffer | bits) & masks[c - 4]) != 0;
    }
  }
}

int sim_expand(const SimData *d, const int32_t *row, int32_t *out, uint8_t *press,
               uint8_t *finished, uint64_t *steps) {
  const int32_t buffer = row[ROW_BUFFER];
  /* Engine.load: the flags left follow from the mask. */
  num flagsLeft = __builtin_popcount((uint32_t)(row[SIM_STATE_INTS - 1] & d->flagBits));
  uint32_t pending = 0xffff;
  int n = 0;
  uint64_t simulated = 0;
  /* Engine.load, `inputBuffer |= MARK`, then the press-independent start of the step. */
  Runner base, r;
  readState(&base, row);
  base.flagsLeft = flagsLeft;
  base.inputBuffer = i32(base.inputBuffer) | MARK;
  base.reads = 0;
  base.memo = NULL;
  StepPre pre;
  stepPre(d, &base, 30, &pre);
  Memo memo;
  memo.n = 0;
  memset(memo.cond, -1, sizeof memo.cond);
  memset(memo.dead, 0, sizeof memo.dead);
  memo.rayKnown[0] = memo.rayKnown[1] = 0;
  memo.nlist = -1;
  /*
   * Per input condition (bit c of `reads`), the presses (bit i = SIM_PRESSES[i]) for which it
   * holds, as Engine's conditionHolds decides: 0-3 test BACK, FORWARD, UP, DOWN in the press;
   * 4-7 hold for the empty press only, when the row's buffer has BACK, FORWARD, UP, DOWN.
   */
  uint32_t holds[8] = {
      0xff00, /* BACK is press bit 3 */
      0xf0f0, /* FORWARD is press bit 2 */
      0xaaaa, /* UP is press bit 0 */
      0xcccc, /* DOWN is press bit 1 */
      (buffer & IN_BACK) ? 1u : 0u,
      (buffer & IN_FORWARD) ? 1u : 0u,
      (buffer & IN_UP) ? 1u : 0u,
      (buffer & IN_DOWN) ? 1u : 0u,
  };
  while (pending != 0) {
    int lead = __builtin_ctz(pending);
    int32_t bits = SIM_PRESSES[lead];
    r = base;
    r.pressedBits = bits;
    stepPost(d, &r, &pre, &memo);
    r.pressedBits = 0;
    simulated++;
    int fin = rulesCheck(d, &r);
    int read = r.reads;
    int kept = (i32(r.inputBuffer) & MARK) != 0;
    r.inputBuffer = i32(r.inputBuffer) & ~MARK;
    /* The group of `lead`: presses agreeing with it on every condition the step read. */
    uint32_t group = pending;
    for (int c = 0; c < 8; c++) {
      if ((read & (1 << c)) == 0) continue;
      group &= (holds[c] >> lead) & 1 ? holds[c] : ~holds[c];
    }
    pending &= ~group;
    if (!kept) {
      int32_t *o = out + n * SIM_STATE_INTS;
      writeState(&r, o);
      sim_canon(d, o);
      press[n] = (uint8_t)lead;
      finished[n] = (uint8_t)fin;
      n++;
      continue;
    }
    /* The buffer was kept (it is `buffer | press`): one row per distinct buffer value. */
    int32_t live = d->live[r.moveId];
    int32_t seen[16];
    int nseen = 0;
    for (int i = 0; i < 16; i++) {
      if ((group & (1u << i)) == 0) continue;
      int32_t b = (buffer | SIM_PRESSES[i]) & live;
      int dup = 0;
      for (int k = 0; k < nseen; k++)
        if (seen[k] == b) {
          dup = 1;
          break;
        }
      if (dup) continue;
      seen[nseen++] = b;
      r.inputBuffer = b;
      writeState(&r, out + n * SIM_STATE_INTS);
      press[n] = (uint8_t)i;
      finished[n] = (uint8_t)fin;
      n++;
    }
  }
  if (steps) *steps += simulated;
  return n;
}

/* ---- loading ------------------------------------------------------------------------- */

typedef struct {
  const int32_t *p, *end;
  int bad;
} Reader;

static int32_t rd(Reader *R) {
  if (R->p >= R->end) {
    R->bad = 1;
    return 0;
  }
  return *R->p++;
}

static void fail(char *err, size_t errlen, const char *msg) {
  if (err && errlen) snprintf(err, errlen, "%s", msg);
}

SimData *sim_load(const int32_t *blob, size_t count, char *err, size_t errlen) {
  Reader R = {blob, blob + count, 0};
  if (rd(&R) != BLOB_MAGIC) return fail(err, errlen, "bad magic"), NULL;
  if (rd(&R) != BLOB_VERSION) return fail(err, errlen, "bad version"), NULL;
  if (rd(&R) != SIM_STATE_INTS) return fail(err, errlen, "STATE_INTS differs"), NULL;
  SimData *d = calloc(1, sizeof *d);
  if (!d) return fail(err, errlen, "out of memory"), NULL;
  /* The blob outlives nothing: copy it once and point into the copy. */
  int32_t *mem = malloc(count * sizeof(int32_t));
  if (!mem) {
    free(d);
    return fail(err, errlen, "out of memory"), NULL;
  }
  memcpy(mem, blob, count * sizeof(int32_t));
  d->mem = mem;
  R.p = mem + 3;
  R.end = mem + count;
  d->missionType = rd(&R);
  d->flagCount = rd(&R);
  d->flagBits = (int32_t)((1u << (d->flagCount & 31)) - 1u);
  d->hasFinish = rd(&R);
  d->finishX = rd(&R);
  d->finishY = rd(&R);
  d->width = rd(&R);
  d->height = rd(&R);
  if (d->missionType != 0 && d->missionType != 1) {
    sim_free(d);
    return fail(err, errlen, "only mission types 0 and 1 are supported"), NULL;
  }
  size_t cells = (size_t)d->width * (size_t)d->height;
  if (R.p + cells + d->width > R.end) {
    sim_free(d);
    return fail(err, errlen, "truncated level"), NULL;
  }
  d->tiles = (int32_t *)R.p;
  R.p += cells;
  d->killRows = (int32_t *)R.p;
  R.p += d->width;
  Table *tabs[8] = {&d->F, &d->A, &d->B, &d->G, &d->C, &d->D, &d->E, &d->H};
  for (int i = 0; i < 8; i++) {
    tabs[i]->n = rd(&R);
    if (R.bad || tabs[i]->n < 0 || R.p + tabs[i]->n > R.end) {
      sim_free(d);
      return fail(err, errlen, "truncated tables"), NULL;
    }
    tabs[i]->v = (int32_t *)R.p;
    R.p += tabs[i]->n;
  }
  for (int i = 0; i < 512; i++) d->sine[i] = rd(&R);
  d->nmoves = rd(&R);
  if (R.bad || d->nmoves <= 0) {
    sim_free(d);
    return fail(err, errlen, "bad move table"), NULL;
  }
  /* Count the transitions and conditions first. */
  const int32_t *mark = R.p;
  size_t ntrans = 0, nconds = 0;
  for (int i = 0; i < d->nmoves && !R.bad; i++) {
    for (int k = 0; k < 9; k++) rd(&R);
    int32_t nt = rd(&R);
    for (int t = 0; t < nt && !R.bad; t++) {
      rd(&R);
      int32_t nc = rd(&R);
      for (int c = 0; c < nc; c++) rd(&R);
      ntrans++;
      nconds += (size_t)nc;
    }
  }
  if (R.bad) {
    sim_free(d);
    return fail(err, errlen, "truncated move table"), NULL;
  }
  d->moves = calloc((size_t)d->nmoves, sizeof(Move));
  d->trans = calloc(ntrans + 1, sizeof(Trans));
  d->conds = calloc(nconds + 1, sizeof(int32_t));
  R.p = mark;
  size_t ti = 0, ci = 0;
  for (int i = 0; i < d->nmoves; i++) {
    Move *m = &d->moves[i];
    m->duration = rd(&R);
    m->next = rd(&R);
    m->impulseType = rd(&R);
    m->paramB = rd(&R);
    m->paramC = rd(&R);
    m->paramD = rd(&R);
    m->flags = rd(&R);
    m->snapType = rd(&R);
    m->parent = rd(&R);
    m->ntrans = rd(&R);
    m->transOff = (int32_t)ti;
    for (int t = 0; t < m->ntrans; t++) {
      Trans *tr = &d->trans[ti++];
      tr->target = rd(&R);
      tr->ncond = rd(&R);
      tr->condOff = (int32_t)ci;
      for (int c = 0; c < tr->ncond; c++) d->conds[ci++] = rd(&R);
    }
  }
  if (R.p + d->nmoves + SIM_STATE_INTS + 1 > R.end) {
    sim_free(d);
    return fail(err, errlen, "truncated tail"), NULL;
  }
  d->live = (int32_t *)R.p;
  R.p += d->nmoves;
  for (int i = 0; i < SIM_STATE_INTS; i++) d->start[i] = rd(&R);
  if (rd(&R) != BLOB_MAGIC || R.p != R.end) {
    sim_free(d);
    return fail(err, errlen, "bad trailer"), NULL;
  }

  /*
   * The TS reads some tables without bounds checks (an out-of-range read is `undefined`).
   * The port relies on the data never doing that; check it here once.
   */
  int maxTile = 0;
  for (size_t i = 0; i < cells; i++)
    if (d->tiles[i] > maxTile) maxTile = d->tiles[i];
  int ok = d->A.n > maxTile && d->G.n >= 18 && d->C.n >= 18 && d->F.n >= 12;
  int maxA = 0;
  for (int i = 0; i < d->A.n; i++)
    if (d->A.v[i] > maxA) maxA = d->A.v[i];
  /* Surfaces are 0..17: the shape tests write those, followSurface writes values of B. */
  for (int i = 1; i < d->B.n; i += 2)
    if (d->B.v[i] < 0 || d->B.v[i] > 17) ok = 0;
  if (22 * 10 + maxA + 1 >= d->B.n) ok = 0;
  for (int i = 0; i < 18 && ok; i++) {
    int cls = d->C.v[i];
    if (cls < 0 || cls + 1 >= d->E.n || (cls >> 1) >= d->D.n) ok = 0;
  }
  for (int i = 0; i < d->nmoves && ok; i++) {
    const Move *m = &d->moves[i];
    if (m->next < -1 || m->next >= d->nmoves || m->parent < -1 || m->parent >= d->nmoves)
      ok = 0;
    for (int t = 0; t < m->ntrans; t++) {
      int tg = d->trans[m->transOff + t].target;
      if (tg < 0 || tg >= d->nmoves) ok = 0;
    }
  }
  if (d->nmoves <= 11) ok = 0;
  /* sim_expand's press masks must say what conditionHolds says, for every buffer. */
  for (int32_t buffer = 0; buffer < 64; buffer++) {
    const uint32_t fixed[4] = {0xff00, 0xf0f0, 0xaaaa, 0xcccc};
    const int32_t inBuffer[4] = {IN_BACK, IN_FORWARD, IN_UP, IN_DOWN};
    for (int c = 0; c < 8; c++) {
      uint32_t want = 0;
      for (int i = 0; i < 16; i++)
        if (conditionHolds(c, SIM_PRESSES[i], buffer)) want |= 1u << i;
      uint32_t have = c < 4 ? fixed[c] : (buffer & inBuffer[c - 4]) ? 1u : 0u;
      if (want != have) ok = 0;
    }
  }
  if (!ok) {
    sim_free(d);
    return fail(err, errlen, "data outside what the port supports"), NULL;
  }
  return d;
}

SimData *sim_load_file(const char *path, char *err, size_t errlen) {
  FILE *f = fopen(path, "rb");
  if (!f) return fail(err, errlen, "cannot open data file"), NULL;
  fseek(f, 0, SEEK_END);
  long size = ftell(f);
  fseek(f, 0, SEEK_SET);
  if (size <= 0 || size % 4 != 0) {
    fclose(f);
    return fail(err, errlen, "bad data file size"), NULL;
  }
  int32_t *buf = malloc((size_t)size);
  size_t got = buf ? fread(buf, 1, (size_t)size, f) : 0;
  fclose(f);
  if (got != (size_t)size) {
    free(buf);
    return fail(err, errlen, "cannot read data file"), NULL;
  }
  SimData *d = sim_load(buf, (size_t)size / 4, err, errlen);
  free(buf);
  return d;
}

void sim_free(SimData *d) {
  if (!d) return;
  free(d->moves);
  free(d->trans);
  free(d->conds);
  free(d->mem);
  free(d);
}
