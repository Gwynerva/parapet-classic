/**
 * Level map quirks: when a level loads, its checkpoints are stamped into the tile map, birds are
 * lifted out of it and every column gets a pit row. The stamps never hit a collision tile, but
 * they do land on four birds, which never appear; the columns without a floor are only the
 * maps' outer ones; and ten tile ids the engine knows of are in no map.
 */
import {
  BIRD_TILE,
  erasedBirdsPicture,
  floorlessColumns,
  NO_CASE_TILES,
  stampedCells,
  tileCounts,
  tilesChart,
} from '../experiments/levelMaps.ts';
import type { Facts, Finding } from '../finding.ts';
import type { Lab } from '../lab.ts';

const MISSION_NAMES = ['Sprint', 'Flag hunt', 'Score', 'Challenge', 'Warm-up', 'Warm-up'];

interface MapFacts extends Facts {
  birds: number;
  /** Erased birds, as `level/mission/checkpoint/x/y` words, and where they are in words. */
  erased: string;
  erasedWhere: string;
  /** Stamped cells that held a collision tile. */
  stampedSolid: number;
  stampedCells: number;
  /** Levels with columns without a floor (pit row 0). */
  floorlessLevels: number;
  floorlessInside: number;
  unusedIds: readonly number[];
}

export const levelMapQuirks: Finding<MapFacts> = {
  slug: '12-level-map-quirks',
  title: 'Level map quirks',
  claim:
    'Loading a level stamps its checkpoints into the map: four birds sit where a stamp lands and never appear. Ten tile ids the engine knows are in no map.',

  facts(lab: Lab): MapFacts {
    const levels = lab.src.levels;
    const stamped = stampedCells(levels);
    const birds = stamped.filter((c) => c.tile === BIRD_TILE);
    const floorless = floorlessColumns(levels);
    const counts = tileCounts(levels);
    return {
      birds: counts.get(BIRD_TILE) ?? 0,
      erased: birds
        .map((b) => `${b.level}/${b.missionType}/${b.checkpoint}/${b.x}/${b.y}`)
        .join(' '),
      erasedWhere: birds
        .map(
          (b) =>
            `${lab.levelName(b.level)}, ${MISSION_NAMES[b.missionType]}, checkpoint ${b.checkpoint + 1} (${b.x}, ${b.y})`,
        )
        .join('; '),
      stampedSolid: stamped.filter((c) => c.tile !== 0 && c.tile !== BIRD_TILE).length,
      stampedCells: stamped.length,
      floorlessLevels: floorless.filter((f) => f.columns.length > 0).length,
      floorlessInside: floorless.reduce(
        (n, f) => n + f.columns.filter((x) => x !== 0 && x !== f.width - 1).length,
        0,
      ),
      unusedIds: NO_CASE_TILES.filter((id) => !counts.has(id)),
    };
  },

  measured(f: MapFacts): [string, string][] {
    return [
      ['Birds in the maps', String(f.birds)],
      ['Birds a checkpoint stamp erases', f.erasedWhere],
      [
        'Stamped cells, and those that held a collision tile',
        `${f.stampedCells}, ${f.stampedSolid}`,
      ],
      [
        'Levels with columns without a floor (pit row 0); of those columns inside the map',
        `${f.floorlessLevels}; ${f.floorlessInside}: each is a map’s first or last column`,
      ],
      ['Tile ids without a collision case, used in no map', f.unusedIds.join(', ')],
    ];
  },

  checks(f: MapFacts): string[] {
    const out: string[] = [];
    if (f.erased.split(' ').length !== 4)
      out.push(`${f.erased.split(' ').length} erased birds, not 4`);
    if (f.stampedSolid !== 0) out.push(`${f.stampedSolid} stamps land on collision tiles`);
    if (f.floorlessInside !== 0) out.push('a floorless column inside a level');
    if (f.unusedIds.length !== NO_CASE_TILES.length)
      out.push('a map uses a tile without a collision case');
    return out;
  },

  clips() {
    return [];
  },

  charts(lab: Lab) {
    return [
      {
        name: 'tiles',
        alt: 'How many cells of the twelve maps hold each tile id: floors and walls by the thousand, slopes and posts by the handful, 105 birds, and ten ids with no collision case in no map at all.',
        svg: tilesChart(tileCounts(lab.src.levels)),
      },
    ];
  },

  pictures(lab: Lab) {
    const birds = stampedCells(lab.src.levels).filter((c) => c.tile === BIRD_TILE);
    return [
      {
        name: 'birds',
        alt: 'Four places in the levels’ art: in each, a bird (drawn faint) would perch on a cell that a checkpoint stamp (red) overwrites at load, so the bird never appears.',
        image: erasedBirdsPicture(lab, birds).img,
        scale: 2,
      },
    ];
  },
};
