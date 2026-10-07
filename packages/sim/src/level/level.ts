/**
 * Level geometry: a uniform tile grid, 1024 units per tile, plus the mission layout.
 * Mirrors the original loader `m(int,int)` (d.java line 9588) including its load-time
 * modifications: checkpoint markers written into the map and the per-column pit rows.
 */

export interface Point {
  x: number;
  y: number;
}

export interface MissionSection {
  start: Point;
  finish: Point | null;
  npc: Point | null;
  checkpoints: Point[];
}

/** Shape of `packages/content-classic/generated/levels/<n>.json`. */
export interface LevelData {
  id: number;
  nameStringId: number;
  width: number;
  height: number;
  /** Row-major tile ids, unmodified. */
  tiles: number[];
  missions: Record<string, MissionSection | null>;
}

export const TILE = 1024;
export const TILE_SHIFT = 10;

/** Tiles whose top counts as a floor for the pit check (line 9640). */
const PIT_FLOOR_TILES = new Set([1, 3, 5, 6, 7, 8]);

/** First checkpoint marker tile id; checkpoint i uses `CHECKPOINT_TILE_BASE + i`. */
export const CHECKPOINT_TILE_BASE = 49;
/** Decorative bird marker, removed from the collision map at load time. */
export const BIRD_TILE = 63;

export class Level {
  readonly id: number;
  readonly width: number;
  readonly height: number;
  readonly tiles: Int16Array;
  /** Deepest row per column that contains a floor tile, or 0 (`var_short_arr_l`). */
  readonly killRows: Int16Array;
  readonly missionType: number;
  readonly start: Point;
  readonly finish: Point | null;
  readonly npc: Point | null;
  readonly checkpoints: Point[];
  /** World positions of the birds that replaced tile 63 (`aR`, line 9671). */
  readonly birds: Point[] = [];

  constructor(data: LevelData, missionType: number) {
    const section = data.missions[String(missionType)];
    if (!section) {
      throw new Error(`level ${data.id} has no mission section for type ${missionType}`);
    }
    this.id = data.id;
    this.width = data.width;
    this.height = data.height;
    this.missionType = missionType;
    this.tiles = Int16Array.from(data.tiles);
    this.start = section.start;
    this.finish = section.finish;
    this.npc = section.npc;
    this.checkpoints = section.checkpoints.map((p) => ({ x: p.x, y: p.y }));

    // Checkpoint i is stamped into the map as tile 49+i at (x,y) and (x,y-1) (line 9635).
    this.checkpoints.forEach((cp, i) => {
      const tile = CHECKPOINT_TILE_BASE + i;
      this.tiles[cp.y * this.width + cp.x] = tile;
      this.tiles[(cp.y - 1) * this.width + cp.x] = tile;
    });

    // Pit rows are computed after the checkpoints were written (line 9640).
    this.killRows = new Int16Array(this.width);
    for (let row = this.height - 1; row >= 0; row--) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[row * this.width + x]!;
        if (PIT_FLOOR_TILES.has(tile) && row > this.killRows[x]!) {
          this.killRows[x] = row;
        }
      }
    }

    // Birds (tile 63) become decorations and leave an empty cell behind (line 9671).
    for (let row = 0; row < this.height; row++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[row * this.width + x] === BIRD_TILE) {
          this.birds.push({ x: (x << TILE_SHIFT) + 512, y: (row << TILE_SHIFT) + TILE });
          this.tiles[row * this.width + x] = 0;
        }
      }
    }
  }

  /** Tile id at a cell, or -1 outside the map (`int_g(int,int)`, line 9686). */
  tileAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
    return this.tiles[y * this.width + x]!;
  }

  /** Like `tileAt` but marker tiles (ids above 26) read as air (`int_h(int,int)`, line 9693). */
  collisionTileAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
    const t = this.tiles[y * this.width + x]!;
    return t <= 26 ? t : 0;
  }

  /** Spawn position in world units (feet point), see `aJ` line 7592. */
  spawnX(): number {
    return this.start.x * TILE;
  }

  spawnY(): number {
    return this.start.y * TILE + TILE;
  }
}
