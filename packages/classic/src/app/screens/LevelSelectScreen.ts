/**
 * Level select in the spirit of the original's map of cards (reference/notes/08 §9): the
 * twelve thumbnails of the original on light cards, the row of mission icons by progress and
 * the level description, or the "complete N more missions" note for a locked level (shown
 * dimmed under a lock instead of the original's placeholder picture).
 */
import { LEVEL_COUNT } from '@parapet/protocol';
import { Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import {
  clear,
  heading,
  outlined,
  panel,
  drawBackButton,
  hitBackButton,
  headingCenterY,
} from '@parapet/runtime/ui/draw.ts';
import { inset, safeRect, stack, type Rect } from '@parapet/runtime/ui/layout.ts';
import { ANCHOR_TOP_LEFT } from '@parapet/runtime/render/SpriteSheet.ts';
import {
  completedCount,
  isMissionCompleted,
  loadProgress,
  type Progress,
} from '@parapet/runtime/storage/profile.ts';
import { CARD_BORDER, CARD_WHITE, drawMissionIcon, ICON_TILE, icons } from '../ui/icons.ts';
import { THUMBNAIL_BASE } from '../ui/sprites.ts';
import { MissionSelectScreen } from './MissionSelectScreen.ts';

const THUMBNAIL = 64;
const ICON_PITCH = ICON_TILE + 4;

/** Card arrangements tried in order until twelve cards fit the viewport. */
const VARIANTS = [
  { thumb: 64, margin: 4, gap: 4, infoH: 92 },
  { thumb: 64, margin: 2, gap: 2, infoH: 72 },
  { thumb: 32, margin: 2, gap: 2, infoH: 72 },
];

/** Thumbnails rendered once onto their own canvases (so they can be drawn at any size). */
const thumbnailCache = new Map<number, HTMLCanvasElement>();

export class LevelSelectScreen implements Screen {
  private readonly ctx: GameContext;
  private selected = 0;
  private progress: Progress = { completed: [], prizeSeen: false };
  private cols = 4;
  private margin = 4;
  private gap = 4;
  private cards: Rect[] = [];
  private infoRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private lastTap = -1;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.onResize();
  }

  enter(): void {
    this.progress = loadProgress();
    this.onResize();
  }

  private thumbnail(levelId: number): HTMLCanvasElement {
    const cached = thumbnailCache.get(levelId);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = THUMBNAIL;
    canvas.height = THUMBNAIL;
    const c = canvas.getContext('2d');
    if (c) {
      c.imageSmoothingEnabled = false;
      this.ctx.render.sheet.drawSprite(c, THUMBNAIL_BASE + levelId, 0, 0, 0, ANCHOR_TOP_LEFT);
    }
    thumbnailCache.set(levelId, canvas);
    return canvas;
  }

  onResize(): void {
    const { viewport, fonts } = this.ctx;
    const safe = inset(safeRect(viewport), 8, 0);
    const header = fonts.display.lineHeight + 12;
    for (const [index, v] of VARIANTS.entries()) {
      const [, grid, info] = stack(safe, [header, -1, v.infoH], 4);
      const gridRect = grid ?? safe;
      const cell = v.thumb + 2 * v.margin + 2 * v.gap;
      const cols = Math.max(2, Math.min(6, Math.floor(gridRect.w / cell)));
      const rows = Math.ceil(LEVEL_COUNT / cols);
      const last = index === VARIANTS.length - 1;
      if (!last && (rows * cell > gridRect.h || cols * cell > gridRect.w)) continue;
      this.infoRect = info ?? safe;
      this.cols = cols;
      this.margin = v.margin;
      this.gap = v.gap;
      const originX = gridRect.x + ((gridRect.w - cell * cols) >> 1);
      const originY = gridRect.y + Math.max(0, (gridRect.h - cell * rows) >> 1);
      this.cards = [];
      for (let id = 0; id < LEVEL_COUNT; id++) {
        const col = id % cols;
        const row = Math.floor(id / cols);
        const size = v.thumb + 2 * v.margin;
        this.cards.push({
          x: originX + col * cell + v.gap,
          y: originY + row * cell + v.gap,
          w: size,
          h: size,
        });
      }
      return;
    }
  }

  private isUnlocked(levelId: number): boolean {
    const threshold = this.ctx.content.missions.levels[levelId]?.unlockThreshold ?? 0;
    return completedCount(this.progress) >= threshold;
  }

  private open(): void {
    if (!this.isUnlocked(this.selected)) return;
    this.ctx.screens.push(new MissionSelectScreen(this.ctx, this.selected));
  }

  update(): void {}

  onKey(key: UiKey): void {
    switch (key.action) {
      case 'back':
        this.ctx.screens.pop();
        return;
      case 'left':
        this.selected = (this.selected + LEVEL_COUNT - 1) % LEVEL_COUNT;
        return;
      case 'right':
        this.selected = (this.selected + 1) % LEVEL_COUNT;
        return;
      case 'up':
        this.selected = (this.selected - this.cols + LEVEL_COUNT) % LEVEL_COUNT;
        return;
      case 'down':
        this.selected = (this.selected + this.cols) % LEVEL_COUNT;
        return;
      case 'confirm':
        this.open();
        return;
      default:
        return;
    }
  }

  onPointer(p: UiPointer): void {
    if (p.type !== 'down') return;
    const g = this.gap;
    const hit = this.cards.findIndex(
      (r) => p.x >= r.x - g && p.x < r.x + r.w + g && p.y >= r.y - g && p.y < r.y + r.h + g,
    );
    if (hit < 0) {
      if (hitBackButton(this.ctx.viewport, p.x, p.y)) this.ctx.screens.pop();
      return;
    }
    if (hit === this.selected && this.lastTap === hit) this.open();
    this.selected = hit;
    this.lastTap = hit;
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n } = this.ctx;
    clear(c, viewport.width, viewport.height);
    drawBackButton(c, fonts.text, viewport, headingCenterY(fonts.display, viewport.safeArea.top));
    const safe = safeRect(viewport);
    heading(c, fonts.display, i18n.t('level.select'), safe.x + (safe.w >> 1), safe.y + 8);

    for (let id = 0; id < LEVEL_COUNT; id++) {
      const r = this.cards[id]!;
      const unlocked = this.isUnlocked(id);
      const selected = id === this.selected;
      // A white card with a dark border, the selected one framed in the accent colour.
      if (selected) {
        c.fillStyle = Theme.accent;
        c.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      }
      c.fillStyle = CARD_BORDER;
      c.fillRect(r.x, r.y, r.w, r.h);
      c.fillStyle = CARD_WHITE;
      c.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      const size = r.w - 2 * this.margin;
      c.imageSmoothingEnabled = false;
      c.drawImage(this.thumbnail(id), r.x + this.margin, r.y + this.margin, size, size);
      if (!unlocked) {
        c.fillStyle = 'rgba(16, 20, 24, 0.75)';
        c.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
        const s = icons.size('lock');
        if (r.h >= s.height + 8) {
          icons.draw(
            c,
            'lock',
            'plain',
            r.x + ((r.w - s.width) >> 1),
            r.y + ((r.h - s.height) >> 1),
          );
        }
      }
      outlined(c, fonts.small, String(id + 1), r.x + r.w - 4, r.y + 3, {
        align: 'right',
        color: unlocked ? Theme.text : Theme.muted,
        tabular: true,
      });
    }

    this.drawInfo(c, this.infoRect);
  }

  private drawInfo(c: CanvasRenderingContext2D, r: Rect): void {
    const { fonts, i18n, content, render } = this.ctx;
    const id = this.selected;
    const level = content.missions.levels[id]!;
    const unlocked = this.isUnlocked(id);
    panel(c, r.x, r.y, r.w, r.h);
    const name = `${id + 1}. ${i18n.t(`level.names.${id}`)}`;
    fonts.text.draw(c, name, r.x + 8, r.y + 6, { color: Theme.accent });
    const iconsW = level.missionTypes.length * ICON_PITCH;
    const iconsX = r.x + r.w - 8 - iconsW;
    const iconsFit = unlocked && iconsX > r.x + 8 + fonts.text.measure(name) + 8 && r.h >= 72;
    if (iconsFit) {
      level.missionTypes.forEach((type, m) => {
        const done = isMissionCompleted(this.progress, id, m);
        drawMissionIcon(c, render.sheet, type, done, iconsX + m * ICON_PITCH, r.y + 4);
      });
    }
    const textY = r.y + 6 + fonts.text.lineHeight + 8;
    const text = unlocked
      ? i18n.t(`level.desc.${id}`)
      : i18n.t('level.locked', { n: level.unlockThreshold - completedCount(this.progress) });
    const textW = iconsFit ? iconsX - r.x - 16 : r.w - 16;
    const maxLines = Math.max(1, Math.floor((r.y + r.h - textY - 4) / fonts.small.lineHeight));
    const lines = fonts.small.wrap(text, Math.max(80, textW)).slice(0, maxLines);
    fonts.small.draw(c, lines.join('\n'), r.x + 8, textY, {
      color: unlocked ? Theme.text : Theme.muted,
    });
  }
}
