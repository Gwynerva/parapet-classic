/**
 * Menu icons: the original's mission icons (sprites 141-150, cleaned up by the extractor) on
 * light tiles like the cards of the original's menus, plus pixel art of ours: a lock for the
 * levels not yet unlocked (the original showed a placeholder picture instead), the game's own
 * icon for the free run (a mode the original did not have) and the small mode glyphs on the
 * bosses' tiles.
 * Legend of the pixel art: `.` transparent, `#` outline, `o` fill, `+` highlight.
 */
import { MissionType } from '@parapet/sim';
import type { ContestKind } from '@parapet/runtime/storage/profile.ts';
import { PixelIcons, type IconPalette } from '@parapet/runtime/ui/PixelIcons.ts';
import { APP_ICON_ART } from '@parapet/runtime/ui/appIcon.ts';
import { ANCHOR_TOP_LEFT } from '@parapet/runtime/render/SpriteSheet.ts';
import type { SpriteDrawer } from '@parapet/runtime/ui/widgets.ts';

/** Colours of the original's menu cards (reference/notes/08 §7-9). */
const CARD_LIGHT = '#dcd4d0';
export const CARD_BORDER = '#2a1815';
export const CARD_WHITE = '#ffffff';

/** Mission icons by mission type (odd = not done, even = done). */
const MISSION_ICON: Record<number, number> = {
  [MissionType.SPRINT]: 145,
  [MissionType.FLAG_HUNT]: 147,
  [MissionType.SCORE_RUN]: 149,
  [MissionType.CHALLENGE]: 143,
  [MissionType.WARM_UP_1]: 141,
  [MissionType.WARM_UP_2]: 141,
};

function missionIconSprite(missionType: number, done: boolean): number {
  return (MISSION_ICON[missionType] ?? 145) + (done ? 1 : 0);
}

/** Size of the light tile a mission icon sits on. */
export const ICON_TILE = 38;

/** A light tile with a dark border, the card look of the original's menus. */
export function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  border: string = CARD_BORDER,
  fill: string = CARD_LIGHT,
): void {
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
}

/** Draws the mission icon of `missionType` (done or not) on its tile at (x, y). */
export function drawMissionIcon(
  ctx: CanvasRenderingContext2D,
  sheet: SpriteDrawer,
  missionType: number,
  done: boolean,
  x: number,
  y: number,
): void {
  drawCard(ctx, x, y, ICON_TILE, ICON_TILE);
  const id = missionIconSprite(missionType, done);
  const w = sheet.width(id);
  const h = sheet.height(id);
  sheet.drawSprite(
    ctx,
    id,
    x + ((ICON_TILE - w) >> 1),
    y + ((ICON_TILE - h) >> 1),
    0,
    ANCHOR_TOP_LEFT,
  );
}

const LOCK = [
  '.....######.....',
  '....#......#....',
  '...#..####..#...',
  '...#.#....#.#...',
  '...#.#....#.#...',
  '...#.#....#.#...',
  '.##############.',
  '.#oooooooooooo#.',
  '.#oooooo+ooooo#.',
  '.#ooooo#o#oooo#.',
  '.#ooooo#o#oooo#.',
  '.#oooooo#ooooo#.',
  '.#oooooo#ooooo#.',
  '.#oooooooooooo#.',
  '.##############.',
  '................',
];

const PALETTE: IconPalette = { '#': '#101418', o: '#e8eef4', '+': '#ffffff' };

export const icons = new PixelIcons<'lock', 'plain'>(
  { lock: { rows: LOCK } },
  { plain: PALETTE },
  2,
);

/**
 * The free run's icon: the game's own icon (the runner leaping off the parapet) inked like the
 * card sketches of the original's missions, the parapet's bricks left to the card.
 */
const appIcon = new PixelIcons<'app', 'card'>(
  { app: { rows: APP_ICON_ART } },
  { card: { a: CARD_BORDER, A: '#8a5f45', d: '#7d7470', G: CARD_BORDER } },
  1,
);

/** The free run's icon on its tile at (x, y). */
export function drawFreeRunIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  drawCard(ctx, x, y, ICON_TILE, ICON_TILE);
  const s = appIcon.size('app');
  appIcon.draw(
    ctx,
    'app',
    'card',
    x + ((ICON_TILE - s.width) >> 1),
    y + ((ICON_TILE - s.height) >> 1),
  );
}

/**
 * A small finish flag, the sign at the screen's edge towards an unseen finish: a leaning pole
 * and a chequered cloth in the game's oranges, waving (its fold in shade).
 */
const FINISH_FLAG = [
  '.....#o##...###..',
  '.....#|aa###aAA#.',
  '.....#|aaBBbaAA#.',
  '.....#|AABBbAaa#.',
  '.....#|AAbbBAaa#.',
  '....#|AaabbBaAA#.',
  '....#|AaaBBbaAA#.',
  '....#|###BBb###..',
  '....#|#..###.....',
  '...#|#...........',
  '...#|#...........',
  '...#|#...........',
  '...#|#...........',
  '..#|#............',
  '..#|#............',
  '...#.............',
];

const finishFlag = new PixelIcons<'flag', 'plain'>(
  { flag: { rows: FINISH_FLAG } },
  {
    plain: {
      '#': '#000000',
      '|': '#d6dbe0',
      o: '#ffffff',
      a: '#ffb000',
      A: '#c46200',
      b: '#d98f00',
      B: '#8f4500',
    },
  },
  1,
);

/** The finish flag centred on (x, y). */
export function drawFinishFlag(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const s = finishFlag.size('flag');
  finishFlag.draw(ctx, 'flag', 'plain', x - (s.width >> 1), y - (s.height >> 1));
}

/** The mode of a boss's contest in a corner of its tile: a pennant, a stopwatch. */
const MODE_GLYPHS: Record<ContestKind, readonly string[]> = {
  flags: ['o.....', 'oooo..', 'oooooo', 'oooo..', 'o.....', 'o.....', 'o.....', 'o.....'],
  sprint: ['..ooo..', '...o...', '.ooooo.', 'o..o..o', 'o..o..o', 'o..oo.o', 'o.....o', '.ooooo.'],
};

/** Size of a mode glyph with its shadow. */
export function modeGlyphSize(kind: ContestKind): { width: number; height: number } {
  const rows = MODE_GLYPHS[kind];
  return { width: (rows[0]?.length ?? 0) + 1, height: rows.length + 1 };
}

/** A contest's mode glyph in `color` with a black shadow, top-left corner at (x, y). */
export function drawModeGlyph(
  ctx: CanvasRenderingContext2D,
  kind: ContestKind,
  x: number,
  y: number,
  color: string,
): void {
  const rows = MODE_GLYPHS[kind];
  for (const [dx, fill] of [
    [1, '#000000'],
    [0, color],
  ] as const) {
    ctx.fillStyle = fill;
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] === 'o') ctx.fillRect(x + rx + dx, y + ry + dx, 1, 1);
      }
    });
  }
}
