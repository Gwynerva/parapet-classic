/**
 * The little levels of the Moves screen, written as text: one character per tile, the same
 * collision tiles as the real levels. Building interiors have no collision in the original
 * (only their surfaces do), so `x` marks cells that are drawn as stone but are air.
 *
 * | char | tile | meaning                         | char | tile | meaning                   |
 * | ---- | ---- | ------------------------------- | ---- | ---- | ------------------------- |
 * | `.`  | 0    | air                             | `n`  | 13   | post (left side)          |
 * | `#`  | 1    | solid block                     | `m`  | 14   | post (right side)         |
 * | `=`  | 3    | floor surface                   | `-`  | 19   | overhead bar              |
 * | `[`  | 5    | left building corner (ledge)    | `_`  | 20   | plank                     |
 * | `]`  | 6    | right building corner (ledge)   | `s`  | 21   | low slab                  |
 * | `\|` | 2    | wall (faces left)               | `/`  | 7    | slope up to the right     |
 * | `!`  | 4    | wall (faces right)              | `\`  | 8    | slope down to the right   |
 * | `H`  | 17   | ladder / wall-run face (left)   | `P`  | 22   | pole                      |
 * | `h`  | 18   | ladder / wall-run face (right)  | `x`  | 0    | stone without collision   |
 * | `S`  | 0    | the runner's start (feet below) |      |      |                           |
 */
import type { LevelData } from '@parapet/sim';

const TILES: Readonly<Record<string, number>> = {
  '.': 0,
  x: 0,
  S: 0,
  '#': 1,
  '|': 2,
  '=': 3,
  '!': 4,
  '[': 5,
  ']': 6,
  '/': 7,
  '\\': 8,
  n: 13,
  m: 14,
  H: 17,
  h: 18,
  '-': 19,
  _: 20,
  s: 21,
  P: 22,
};

export interface DemoLevel {
  data: LevelData;
  /** 1 where an `x` cell is drawn as stone. */
  fill: Uint8Array;
  width: number;
  height: number;
  start: { x: number; y: number };
}

/** Parses the rows of a demo level; throws on unknown characters, ragged rows or no start. */
export function parseDemoLevel(rows: readonly string[]): DemoLevel {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (height === 0 || width === 0) throw new Error('demo level: no rows');
  const tiles: number[] = [];
  const fill = new Uint8Array(width * height);
  let start: { x: number; y: number } | null = null;
  rows.forEach((row, y) => {
    if (row.length !== width)
      throw new Error(`demo level: row ${y} is ${row.length} wide, not ${width}`);
    for (let x = 0; x < width; x++) {
      const ch = row[x]!;
      const tile = TILES[ch];
      if (tile === undefined) throw new Error(`demo level: unknown tile '${ch}' at ${x},${y}`);
      tiles.push(tile);
      if (ch === 'x') fill[y * width + x] = 1;
      if (ch === 'S') {
        if (start) throw new Error('demo level: two starts');
        start = { x, y };
      }
    }
  });
  if (!start) throw new Error('demo level: no start (S)');
  const s = start as { x: number; y: number };
  return {
    data: {
      id: -1,
      nameStringId: -1,
      width,
      height,
      tiles,
      missions: {
        '0': { start: s, finish: null, npc: null, checkpoints: [] },
        '1': null,
        '2': null,
        '3': null,
        '4': null,
        '5': null,
      },
    },
    fill,
    width,
    height,
    start: s,
  };
}

/** The tile id behind a demo character (for drawing). */
export function demoTileAt(level: DemoLevel, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return 0;
  return level.data.tiles[y * level.width + x] ?? 0;
}
