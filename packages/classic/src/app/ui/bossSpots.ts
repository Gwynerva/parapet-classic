/**
 * Where a boss stands on its level (pure, tested): by the start while the player gets ready,
 * and once its time is up where the player's run will end. In a sprint that is the goal; in a
 * flag hunt the flag the player still has to take nearest to them, so the boss moves on with
 * every flag and waits at the last one, where the run ends.
 *
 * A boss waiting by a flag stands on the nearest floor within a few tiles, never over the flag
 * and never where its own glimpse (the hologram of what it did around that flag) passes: first
 * clear of the whole glimpse, else clear of what the glimpse does after the flag, which is
 * where it ends up. Flags may hang in the air; with no floor near enough, the boss floats
 * beside the flag, on the side away from where its glimpse goes.
 */
import { type Level, type PhysicsTables, tileCentre, TileFlag, tileHasFlag } from '@parapet/sim';

/** Where the boss stands: feet point in world units and facing; `floating` in the air. */
export interface PresenceSpot {
  x: number;
  y: number;
  facingRight: boolean;
  floating?: boolean;
}

/** The cells a boss can stand in or float in. */
export interface SpotGrid {
  air(x: number, y: number): boolean;
  floor(x: number, y: number): boolean;
}

export function levelGrid(level: Level, tables: PhysicsTables): SpotGrid {
  return {
    air: (x, y) => tileHasFlag(tables, level.collisionTileAt(x, y), TileFlag.AIR),
    floor: (x, y) => tileHasFlag(tables, level.collisionTileAt(x, y), TileFlag.WALKABLE_TOP),
  };
}

/** The feet point of a boss standing in cell (`cx`, `cy`), facing `faceX`. */
function spotIn(cx: number, cy: number, faceX: number, floating = false): PresenceSpot {
  const x = tileCentre(cx);
  const spot: PresenceSpot = { x, y: (cy << 10) + 1024, facingRight: faceX > x };
  if (floating) spot.floating = true;
  return spot;
}

/**
 * A floor cell for the boss near cell (`cx`, `cy`) (the cell its feet stand in): air in the
 * cell and the one above, a walkable top below. Two or three cells towards `towardsRight` are
 * tried first, then the other side, then the next cells; without one it stands right at the
 * point, half a tile to that side.
 */
export function standingSpot(
  grid: SpotGrid,
  cx: number,
  cy: number,
  towardsRight: boolean,
  facePointX: number,
): PresenceSpot {
  const side = towardsRight ? 1 : -1;
  for (const d of [2, 3, -2, -3, 1, -1]) {
    const x = cx + d * side;
    if (grid.air(x, cy) && grid.air(x, cy - 1) && grid.floor(x, cy + 1)) {
      return spotIn(x, cy, facePointX);
    }
  }
  const px = tileCentre(cx) + side * 512;
  return { x: px, y: (cy << 10) + 1024, facingRight: facePointX > px };
}

function cellKey(x: number, y: number): number {
  return x * 65536 + (y + 32768);
}

/**
 * The cells a runner's body covers along a glimpse: its column, three rows up from the feet
 * (or down from the hands while it hangs).
 */
export function glimpseCells(
  poses: readonly { x: number; y: number; anchored: boolean }[],
): Set<number> {
  const cells = new Set<number>();
  for (const p of poses) {
    const cx = p.x >> 10;
    const top = p.anchored ? p.y >> 10 : ((p.y - 1) >> 10) - 2;
    for (let cy = top; cy < top + 3; cy++) cells.add(cellKey(cx, cy));
  }
  return cells;
}

/** The flag still up (`remainingMask` bit) nearest to (`x`, `y`) in units, or -1. */
export function nearestFlag(
  flags: readonly { x: number; y: number }[],
  remainingMask: number,
  x: number,
  y: number,
): number {
  let best = -1;
  let bestDistance = Infinity;
  flags.forEach((f, i) => {
    if ((remainingMask & (1 << i)) === 0) return;
    const dx = tileCentre(f.x) - x;
    const dy = tileCentre(f.y) - y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}

export interface WaitRequest {
  /** The flag's (or goal's) lower cell. */
  cx: number;
  cy: number;
  /** The boss faces this x (units). */
  faceX: number;
  /** Which side to try first when two are as good. */
  preferRight: boolean;
  /** Cells of the whole glimpse at this flag, and of its part after the flag. */
  clip: ReadonlySet<number>;
  after: ReadonlySet<number>;
}

/** Farthest a floor may be from the flag, in tiles, before the boss floats instead. */
export const MAX_STAND_TILES = 3.7;
const SEARCH_LEFT = -6;
const SEARCH_RIGHT = 6;
const SEARCH_UP = -3;
const SEARCH_DOWN = 8;

interface Candidate {
  dx: number;
  dy: number;
  cost: number;
  floating: boolean;
  /** Cells of the body that the after-flag part of the glimpse passes through. */
  afterHits: number;
  clipHits: number;
}

/** Where the boss waits by a flag (see the module comment). */
export function waitingSpot(grid: SpotGrid, req: WaitRequest): PresenceSpot {
  const { cx, cy, preferRight } = req;
  const candidates: Candidate[] = [];
  for (let dy = SEARCH_UP; dy <= SEARCH_DOWN; dy++) {
    for (let dx = SEARCH_LEFT; dx <= SEARCH_RIGHT; dx++) {
      // Never over the flag: the body (three columns, three rows) would cover it.
      if (Math.abs(dx) <= 1 && dy >= -1 && dy <= 2) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (!grid.air(x, y) || !grid.air(x, y - 1)) continue;
      const distance = Math.hypot(dx, dy);
      let floating: boolean;
      if (grid.floor(x, y + 1)) {
        if (distance > MAX_STAND_TILES) continue;
        floating = false;
      } else {
        const beside = Math.abs(dx) >= 2 && Math.abs(dx) <= 4 && dy >= SEARCH_UP && dy <= 0;
        const above = Math.abs(dx) <= 1 && dy === SEARCH_UP;
        if (!beside && !above) continue;
        floating = true;
      }
      let afterHits = 0;
      let clipHits = 0;
      for (let bx = x - 1; bx <= x + 1; bx++) {
        for (let by = y - 2; by <= y; by++) {
          const key = cellKey(bx, by);
          if (req.after.has(key)) afterHits++;
          if (req.clip.has(key)) clipHits++;
        }
      }
      candidates.push({
        dx,
        dy,
        cost: distance + (Math.abs(dx) < 2 ? 0.5 : 0),
        floating,
        afterHits,
        clipHits,
      });
    }
  }
  const better = (a: Candidate, b: Candidate): number => {
    if (a.cost !== b.cost) return a.cost - b.cost;
    const aSide = a.dx > 0 === preferRight ? 0 : 1;
    const bSide = b.dx > 0 === preferRight ? 0 : 1;
    if (aSide !== bSide) return aSide - bSide;
    return Math.abs(a.dy) - Math.abs(b.dy);
  };
  const tiers: ((c: Candidate) => boolean)[] = [
    (c) => !c.floating && c.clipHits === 0,
    (c) => !c.floating && c.afterHits === 0,
    (c) => c.floating && c.clipHits === 0,
    (c) => c.floating && c.afterHits === 0,
  ];
  for (const fits of tiers) {
    const found = candidates.filter(fits).sort(better)[0];
    if (found) return spotIn(cx + found.dx, cy + found.dy, req.faceX, found.floating);
  }
  const least = candidates.sort((a, b) => a.afterHits - b.afterHits || better(a, b))[0];
  if (least) return spotIn(cx + least.dx, cy + least.dy, req.faceX, least.floating);
  return spotIn(cx + (preferRight ? 2 : -2), cy, req.faceX, true);
}
