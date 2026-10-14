/**
 * The levels' tile maps as shipped and as loaded: at load the checkpoints are stamped into the
 * map (tile 49 + i in two cells), birds (tile 63) become decorations, and every column gets the
 * row of its pit (the deepest floor tile; 0 when it has none). What that does to the data.
 */
import { Level, type LevelData } from '@parapet/sim';
import { blitSprite, sheetFrame } from '@parapet/runtime/render/Raster.ts';
import { Frame } from '../frame.ts';
import type { Lab } from '../lab.ts';
import { INK, RGB, rgb, SERIES } from '../palette.ts';
import { Svg } from '../svg.ts';

export const BIRD_TILE = 63;
export const BIRD_SPRITE = 296;
/** Tile ids the collision code has no case for (`a(c, 7 ints, 3 bools)`, d.java 8731–8972). */
export const NO_CASE_TILES = [9, 10, 11, 12, 15, 16, 23, 24, 25, 26];

/** What the collision code makes of each tile id (reference/notes/01-formats.md). */
export const TILE_NAMES: Record<number, string> = {
  1: 'solid block',
  2: 'wall',
  3: 'floor',
  4: 'wall',
  5: 'building corner',
  6: 'building corner',
  7: 'slope',
  8: 'slope',
  13: 'post',
  14: 'post',
  17: 'wall-run face',
  18: 'wall-run face',
  19: 'overhead bar',
  20: 'plank',
  21: 'low slab',
  22: 'pole',
  63: 'bird',
};

export interface ErasedBird {
  level: number;
  missionType: number;
  checkpoint: number;
  x: number;
  y: number;
}

/** Every mission section of every level, with its checkpoints. */
function sections(levels: readonly LevelData[]): { data: LevelData; type: number }[] {
  return levels.flatMap((data) =>
    Object.entries(data.missions)
      .filter(([, s]) => s !== null)
      .map(([type]) => ({ data, type: Number(type) })),
  );
}

/** The cells the checkpoints are stamped into, with the tile they had. */
export function stampedCells(levels: readonly LevelData[]): (ErasedBird & { tile: number })[] {
  return sections(levels).flatMap(({ data, type }) =>
    data.missions[String(type)]!.checkpoints.flatMap((cp, i) =>
      [cp.y, cp.y - 1].map((y) => ({
        level: data.id,
        missionType: type,
        checkpoint: i,
        x: cp.x,
        y,
        tile: data.tiles[y * data.width + cp.x]!,
      })),
    ),
  );
}

/** The columns without a floor tile (pit row 0), by level, the same for every mission. */
export function floorlessColumns(
  levels: readonly LevelData[],
): { level: number; columns: number[]; width: number }[] {
  return levels.map((data) => {
    const type = Number(Object.entries(data.missions).find(([, s]) => s !== null)![0]);
    const level = new Level(data, type);
    const columns: number[] = [];
    for (let x = 0; x < level.width; x++) if (level.killRows[x] === 0) columns.push(x);
    return { level: data.id, columns, width: level.width };
  });
}

/** How often each tile id occurs in the twelve maps (air left out). */
export function tileCounts(levels: readonly LevelData[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const data of levels)
    for (const t of data.tiles) if (t !== 0) out.set(t, (out.get(t) ?? 0) + 1);
  return out;
}

/** Each erased bird: the level's art around it, the bird where it would have sat, the stamp. */
export function erasedBirdsPicture(lab: Lab, birds: readonly ErasedBird[]): Frame {
  const w = 144;
  const h = 112;
  const gap = 6;
  const frame = new Frame(birds.length * (w + gap) - gap, h);
  frame.clear(RGB.line);
  birds.forEach((b, i) => {
    const art = lab.levelArt(b.level);
    const cell = new Frame(w, h);
    cell.clear(RGB.card);
    // The cell's middle in the middle of the panel.
    const cx = b.x * 32 + 16;
    const cy = b.y * 32 + 16;
    cell.blit(art.image, cx - w / 2 + art.pivotX, cy - h / 2 + art.pivotY, w, h, 0, 0);
    const ox = w / 2 - cx;
    const oy = h / 2 - cy;
    // The two stamped cells.
    const red = rgb(SERIES[6]);
    cell.box(b.x * 32 + ox, (b.y - 1) * 32 + oy + (b.y > 0 ? 0 : 32), 32, b.y > 0 ? 64 : 32, red);
    // The bird that would have perched on the bird cell (its feet at the cell's bottom).
    const bird = sheetFrame(lab.atlas, BIRD_SPRITE)?.frame;
    if (bird) {
      const bx = Math.round(cx + ox - bird.w / 2);
      const by = Math.round(b.y * 32 + 32 + oy - bird.h);
      blitSprite(cell.img, lab.atlas, BIRD_SPRITE, bx, by, 0, 0.6);
    }
    frame.blit(cell.img, 0, 0, w, h, i * (w + gap), 0);
  });
  return frame;
}

/** Tile ids by how often the maps use them, with the ids the engine knows but no map has. */
export function tilesChart(counts: ReadonlyMap<number, number>): string {
  const ids = [...new Set([...counts.keys(), ...NO_CASE_TILES])].sort((a, b) => a - b);
  const x0 = 170;
  const plotW = 440;
  const top = 70;
  const rowH = 18;
  const max = Math.max(...counts.values());
  const width = x0 + plotW + 70;
  const height = top + ids.length * rowH + 40;
  const svg = new Svg(
    width,
    height,
    'The tiles of the twelve maps',
    'Cells of each tile id (air left out); log scale',
  );
  const xOf = (n: number): number =>
    n <= 0 ? 0 : (Math.log10(n + 1) / Math.log10(max + 1)) * plotW;
  ids.forEach((id, i) => {
    const y = top + i * rowH;
    const n = counts.get(id) ?? 0;
    const name = TILE_NAMES[id] ?? 'no collision case';
    svg.text(x0 - 8, y + 12, `${id} ${name}`, {
      size: 11,
      fill: n === 0 ? INK.muted : INK.text,
      anchor: 'end',
    });
    if (n > 0) {
      const color = id === BIRD_TILE ? SERIES[3] : SERIES[0];
      svg.rect(x0, y + 3, Math.max(2, xOf(n)), rowH - 6, color, {
        rx: 2,
        tip: `tile ${id}, ${name}: ${n} cells`,
      });
      svg.text(x0 + xOf(n) + 6, y + 12, String(n), { size: 11, fill: INK.muted });
    } else {
      svg.text(x0 + 4, y + 12, 'in no map', { size: 11, fill: INK.muted });
    }
  });
  return svg.toString();
}
