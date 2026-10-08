/**
 * Screen arrangements as pure functions of the viewport, so every screen size can be checked
 * by tests: what goes where on a phone held upright, a phone on its side, a tablet, a desktop.
 */
import {
  centered,
  fitWidth,
  inset,
  safeRect,
  type Rect,
  type ViewportLike,
} from '@parapet/runtime/ui/layout.ts';

/** Space between the title block and the menu. */
const TITLE_GAP = 16;
/** Narrowest menu column worth putting beside the title. */
const SIDE_MENU_MIN = 180;
/** Rows never get shorter than this to fit; the list scrolls instead. */
const MIN_ROW = 20;

export interface TitleMetrics {
  /** Height and width of the title with its subtitle. */
  titleHeight: number;
  titleWidth: number;
  rowHeight: number;
  rows: number;
}

export interface TitleLayout {
  title: Rect;
  menu: Rect;
  rowHeight: number;
}

/**
 * The title over the menu, centred together a little above the middle; side by side when the
 * screen is too short for both (a phone on its side), the menu scrolling when even that fails.
 */
export function titleLayout(viewport: ViewportLike, m: TitleMetrics): TitleLayout {
  const safe = inset(safeRect(viewport), 8, 4);
  const menuW = Math.min(260, safe.w);
  const stacked = m.titleHeight + TITLE_GAP + m.rows * m.rowHeight;
  if (stacked <= safe.h) {
    const top = safe.y + Math.floor((safe.h - stacked) * 0.45);
    return {
      title: { x: safe.x, y: top, w: safe.w, h: m.titleHeight },
      menu: {
        x: safe.x + ((safe.w - menuW) >> 1),
        y: top + m.titleHeight + TITLE_GAP,
        w: menuW,
        h: m.rows * m.rowHeight,
      },
      rowHeight: m.rowHeight,
    };
  }
  const titleW = m.titleWidth + 16;
  if (safe.w - titleW - TITLE_GAP >= SIDE_MENU_MIN) {
    const rowH = Math.max(MIN_ROW, Math.min(m.rowHeight, Math.floor(safe.h / m.rows)));
    const menuH = Math.min(safe.h, m.rows * rowH);
    // Two halves; the title's half is never narrower than the title.
    const leftW = Math.max(titleW, (safe.w - TITLE_GAP) >> 1);
    const right: Rect = {
      x: safe.x + leftW + TITLE_GAP,
      y: safe.y,
      w: safe.w - leftW - TITLE_GAP,
      h: safe.h,
    };
    const menu = centered(right, Math.min(260, right.w), menuH);
    return {
      title: {
        x: safe.x,
        y: safe.y + ((safe.h - m.titleHeight) >> 1),
        w: leftW,
        h: m.titleHeight,
      },
      menu,
      rowHeight: rowH,
    };
  }
  const menuTop = safe.y + m.titleHeight + 8;
  return {
    title: { x: safe.x, y: safe.y, w: safe.w, h: m.titleHeight },
    menu: {
      x: safe.x + ((safe.w - menuW) >> 1),
      y: menuTop,
      w: menuW,
      h: Math.max(m.rowHeight, safe.y + safe.h - menuTop),
    },
    rowHeight: m.rowHeight,
  };
}

export interface ShowcaseMetrics {
  /** Heights of the box: the least that shows its stage, and the most worth giving it. */
  boxMin: number;
  boxMax: number;
  /** Height the grid needs to show every tile at a given width. */
  gridHeight: (width: number) => number;
  /** Height of one row of tiles (a grid shorter than two rows goes beside the box). */
  gridRow: number;
  maxWidth?: number;
}

export interface ShowcaseLayout {
  box: Rect;
  grid: Rect;
  /** Box and grid side by side (short landscape screens). */
  side: boolean;
}

const SHOWCASE_GAP = 8;

/**
 * The showcase box over its grid of tiles, as one block a little above the middle of `body`;
 * side by side on screens too short for the box and two rows of tiles.
 */
export function showcaseLayout(body: Rect, m: ShowcaseMetrics): ShowcaseLayout {
  const minStacked = m.boxMin + SHOWCASE_GAP + 2 * m.gridRow;
  if (body.h < minStacked && body.w >= 400) {
    const boxW = Math.min(360, (body.w - SHOWCASE_GAP) >> 1);
    const box: Rect = { x: body.x, y: body.y, w: boxW, h: Math.min(body.h, m.boxMax) };
    box.y = body.y + ((body.h - box.h) >> 1);
    const gridX = body.x + boxW + SHOWCASE_GAP;
    const gridW = body.x + body.w - gridX;
    const need = Math.min(body.h, m.gridHeight(gridW));
    return {
      box,
      grid: {
        x: gridX,
        y: body.y + ((body.h - need) >> 1),
        w: gridW,
        h: body.h - ((body.h - need) >> 1),
      },
      side: true,
    };
  }
  const col = fitWidth(body, m.maxWidth ?? 480);
  const need = m.gridHeight(col.w);
  const boxH = Math.max(m.boxMin, Math.min(m.boxMax, body.h - SHOWCASE_GAP - need));
  const gridH = Math.max(0, Math.min(need, body.h - boxH - SHOWCASE_GAP));
  const total = boxH + SHOWCASE_GAP + gridH;
  const top = body.y + Math.floor(Math.max(0, body.h - total) * 0.4);
  const gridTop = top + boxH + SHOWCASE_GAP;
  return {
    box: { x: col.x, y: top, w: col.w, h: boxH },
    grid: { x: col.x, y: gridTop, w: col.w, h: Math.max(0, body.y + body.h - gridTop) },
    side: false,
  };
}

export interface DialogMetrics {
  /** Width of the menu column. */
  width: number;
  /** Space above and below the menu inside the panel (heading, status line). */
  header: number;
  footer: number;
  rows: number;
  rowHeight: number;
}

export interface DialogLayout {
  panel: Rect;
  menu: Rect;
}

/**
 * A dialog over the game (pause, record actions, results): a panel centred in the safe area
 * around a menu that scrolls when the screen is too short for all its rows.
 */
export function dialogLayout(viewport: ViewportLike, m: DialogMetrics): DialogLayout {
  const safe = inset(safeRect(viewport), 8, 6);
  const w = Math.max(80, Math.min(m.width, safe.w - 16));
  const room = safe.h - m.header - m.footer - 16;
  const menuH = Math.min(m.rows * m.rowHeight, Math.max(m.rowHeight, room - (room % m.rowHeight)));
  const panelH = m.header + menuH + m.footer + 16;
  const panel: Rect = {
    x: safe.x + ((safe.w - w - 16) >> 1),
    y: safe.y + Math.max(0, (safe.h - panelH) >> 1),
    w: w + 16,
    h: panelH,
  };
  return { panel, menu: { x: panel.x + 8, y: panel.y + 8 + m.header, w, h: menuH } };
}
