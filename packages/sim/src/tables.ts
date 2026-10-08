/**
 * Physics tables from blobs 18–26 of `b1` (see reference/notes/03-physics.md). Loaded from
 * `packages/content/playman/extracted/tables.json`.
 */
export interface PhysicsTables {
  /** Acceleration falloff by speed bucket (12 entries). */
  F: number[];
  /** Tile id → column in B. */
  A: number[];
  /** Contact-following pairs (flags, newSurface), 11 rows × 11 pairs. */
  B: number[];
  /** Slope dy/dx ×1024 by surface type. */
  G: number[];
  /** Surface type → speed class. */
  C: number[];
  /** Over-speed brake by class >> 1. */
  D: number[];
  /** Soft-cap scale by class (+1 when moving up the slope). */
  E: number[];
  /** Tile flag masks. */
  H: number[];
  /** Background theme colours and sprites (rendering only). */
  M: number[];
}

/** `boolean_c(int,int)` (line 9186): does the tile carry any of the flag bits in `mask`? */
export function tileHasFlag(tables: PhysicsTables, tile: number, mask: number): boolean {
  const flags = tile < 0 || tile >= tables.H.length ? 1 : tables.H[tile]!;
  return (flags & mask) !== 0;
}

/** `boolean_d(int,int)` (line 9196): is bit `bit` set in `mask`? */
export function bitIn(bit: number, mask: number): boolean {
  return ((1 << bit) & mask) !== 0;
}

/** Tile flag bits of table H. */
export const TileFlag = {
  AIR: 1 << 0,
  WALKABLE_TOP: 1 << 1,
  SLOPE_UP: 1 << 6,
  SLOPE_DOWN: 1 << 7,
  WALL_FACING_LEFT: 1 << 8,
  WALL_FACING_RIGHT: 1 << 9,
  HALF_FLOOR: 1 << 10,
  LEDGE_LEFT: 1 << 11,
  LEDGE_RIGHT: 1 << 12,
  POLE_A: 1 << 15,
  POLE_B: 1 << 16,
  SOLID_UNDERSIDE: 1 << 17,
} as const;

/** Wall or ledge ahead when facing right / left (masks 2304 / 4608 in the original). */
export const WALL_AHEAD_RIGHT = 2304;
export const WALL_AHEAD_LEFT = 4608;
/** Any slope (bits 2..7). */
export const ANY_SLOPE = 252;
/** Air or pole (bits 0, 15, 16). */
export const AIR_OR_POLE = 98305;
