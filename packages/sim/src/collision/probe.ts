/**
 * A collision probe: the result of sweeping one body point through the tile grid.
 * Port of class `c` of the original. `surface` persists between steps on purpose — the
 * engine uses it to follow the ground and to remember wall contacts.
 */
export class Probe {
  /** Hit something during this step's sweep (`var_boolean_a`). */
  hit = false;
  /** Static: this is the hands probe (`var_boolean_b`, true only for probe index 0). */
  isHands = false;
  /** Contact point in world units (`var_int_a`, `var_int_b`). */
  px = 0;
  py = 0;
  /** Push-out epsilon added when snapping to the contact (`c`, `d`). */
  pushX = 0;
  pushY = 0;
  /** Surface normal ×1024 (`e`, `f`). */
  nx = 0;
  ny = 0;
  /** Squared distance from the probe start to the hit (`g`); the earliest hit wins. */
  distSq = 0;
  /** Tile id hit (`h`) and its cell (`i`, `j`). */
  tile = 0;
  tx = 0;
  ty = 0;
  /** Surface type 0..17 (`k`). Persists between steps. */
  surface = 0;

  constructor(isHands = false) {
    this.isHands = isHands;
  }

  reset(): void {
    this.hit = false;
    this.px = 0;
    this.py = 0;
    this.pushX = 0;
    this.pushY = 0;
    this.nx = 0;
    this.ny = 0;
    this.distSq = 0;
    this.tile = 0;
    this.tx = 0;
    this.ty = 0;
    this.surface = 0;
  }

  copyFrom(o: Probe): void {
    this.hit = o.hit;
    this.isHands = o.isHands;
    this.px = o.px;
    this.py = o.py;
    this.pushX = o.pushX;
    this.pushY = o.pushY;
    this.nx = o.nx;
    this.ny = o.ny;
    this.distSq = o.distSq;
    this.tile = o.tile;
    this.tx = o.tx;
    this.ty = o.ty;
    this.surface = o.surface;
  }
}

/** Surface types written into `Probe.surface`. */
export const Surface = {
  NONE: 0,
  FLOOR: 1,
  SLOPE_UP: 6, // "/" rising to the right
  SLOPE_DOWN: 7, // "\" falling to the right
  WALL_RIGHT: 8, // hit while moving right (wall on the right)
  WALL_LEFT: 9, // hit while moving left
  HALF_FLOOR: 10,
  LEDGE_LEFT: 11,
  LEDGE_RIGHT: 12,
  POST_TOP: 13,
  POST_BOTTOM: 14,
  POLE_RIGHT: 15,
  POLE_LEFT: 16,
  CEILING: 17,
} as const;
