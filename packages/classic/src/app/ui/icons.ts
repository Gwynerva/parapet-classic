/**
 * Menu icons: the original's mission icons (sprites 141-150, cleaned up by the extractor) on
 * light tiles like the cards of the original's menus, plus a lock drawn as pixel art for the
 * levels not yet unlocked (the original showed a placeholder picture instead).
 * Legend of the pixel art: `.` transparent, `#` outline, `o` fill, `+` highlight.
 */
import { MissionType } from '@parapet/sim';
import { PixelIcons, type IconPalette } from '@parapet/runtime/ui/PixelIcons.ts';
import { ANCHOR_TOP_LEFT } from '@parapet/runtime/render/SpriteSheet.ts';
import type { SpriteDrawer } from '@parapet/runtime/ui/widgets.ts';

/** Colours of the original's menu cards (reference/notes/08 §7-9). */
export const CARD_LIGHT = '#dcd4d0';
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

export function missionIconSprite(missionType: number, done: boolean): number {
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

const LOCK_PALETTE: IconPalette = { '#': '#101418', o: '#e8eef4', '+': '#ffffff' };

export const icons = new PixelIcons<'lock', 'plain'>(
  { lock: { rows: LOCK } },
  { plain: LOCK_PALETTE },
  2,
);
