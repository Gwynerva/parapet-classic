/**
 * Level select in the spirit of the original's map of cards (reference/notes/08 §9): the
 * twelve thumbnails of the original on light cards, the row of mission icons by progress and
 * the level description, or the "complete N more missions" note for a locked level (shown
 * dimmed under a lock instead of the original's placeholder picture).
 */
import { LEVEL_COUNT } from '@parapet/sim';
import { Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer, UiWheel } from '@parapet/runtime/app/Screen.ts';
import { outlined, panel } from '@parapet/runtime/ui/draw.ts';
import { contains, type Rect } from '@parapet/runtime/ui/layout.ts';
import { PressTracker } from '@parapet/runtime/ui/press.ts';
import { TextScroller } from '@parapet/runtime/ui/TextScroller.ts';
import { ScreenFrame } from '../ui/ScreenFrame.ts';
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
  readonly chrome = { fullscreenButton: true };
  private readonly ctx: GameContext;
  private readonly frame: ScreenFrame;
  private readonly press = new PressTracker<number>();
  private readonly text = new TextScroller();
  private selected = 0;
  private progress: Progress = { completed: [], prizeSeen: false };
  private cols = 4;
  private margin = 4;
  private gap = 4;
  private cards: Rect[] = [];
  private infoRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.frame = new ScreenFrame(ctx);
    this.text.fade = Theme.panel;
    this.onResize();
  }

  enter(): void {
    this.progress = loadProgress();
    this.onResize();
    this.layoutText();
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
    this.frame.layout();
    const body = this.frame.body;
    for (const [index, v] of VARIANTS.entries()) {
      const cell = v.thumb + 2 * v.margin + 2 * v.gap;
      const gridSpace = body.h - v.infoH - 8;
      const cols = Math.max(2, Math.min(6, Math.floor(body.w / cell)));
      const rows = Math.ceil(LEVEL_COUNT / cols);
      const last = index === VARIANTS.length - 1;
      if (!last && (rows * cell > gridSpace || cols * cell > body.w)) continue;
      this.cols = cols;
      this.margin = v.margin;
      this.gap = v.gap;
      // The cards and the panel under them as one block, a little above the middle; the
      // panel as wide as the cards (or a readable minimum).
      const gridW = cell * cols;
      const gridH = cell * rows;
      const block = gridH + 8 + v.infoH;
      const top = body.y + Math.floor(Math.max(0, body.h - block) * 0.4);
      const infoW = Math.min(body.w, Math.max(gridW, 320));
      this.infoRect = {
        x: body.x + ((body.w - infoW) >> 1),
        y: top + gridH + 8,
        w: infoW,
        h: Math.min(v.infoH, Math.max(40, body.y + body.h - (top + gridH + 8))),
      };
      const originX = body.x + ((body.w - gridW) >> 1);
      const originY = top;
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
      this.layoutText();
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

  update(dt: number): void {
    this.text.update(dt);
  }

  onKey(key: UiKey): void {
    switch (key.action) {
      case 'back':
        this.ctx.screens.pop();
        return;
      case 'left':
      case 'prev':
        this.select((this.selected + LEVEL_COUNT - 1) % LEVEL_COUNT);
        return;
      case 'right':
      case 'next':
        this.select((this.selected + 1) % LEVEL_COUNT);
        return;
      case 'up':
        this.select((this.selected - this.cols + LEVEL_COUNT) % LEVEL_COUNT);
        return;
      case 'down':
        this.select((this.selected + this.cols) % LEVEL_COUNT);
        return;
      case 'confirm':
        this.open();
        return;
      default:
        return;
    }
  }

  private select(id: number): void {
    this.selected = id;
    this.layoutText();
  }

  /** The card under a point (the gaps count to the nearest card), or -1. */
  private cardAt(x: number, y: number): number {
    const g = this.gap;
    return this.cards.findIndex(
      (r) => x >= r.x - g && x < r.x + r.w + g && y >= r.y - g && y < r.y + r.h + g,
    );
  }

  onPointer(p: UiPointer): void {
    if (this.frame.onPointer(p)) return;
    if (this.text.onPointer(p)) return;
    const hit = this.cardAt(p.x, p.y);
    switch (p.type) {
      case 'down':
        this.press.press(hit >= 0 ? hit : null, p);
        return;
      case 'move':
        this.press.move(p, hit >= 0 ? hit : null);
        return;
      case 'up': {
        // A tap selects a card; a tap on the selected card opens it.
        const fired = this.press.release(hit >= 0 ? hit : null);
        if (fired === null) return;
        if (fired === this.selected) this.open();
        else this.select(fired);
        return;
      }
      case 'cancel':
        this.press.reset();
        return;
    }
  }

  onWheel(w: UiWheel): void {
    this.text.onWheel(w);
  }

  render(c: CanvasRenderingContext2D): void {
    const { fonts, i18n } = this.ctx;
    this.frame.draw(c, i18n.t('level.select'));

    for (let id = 0; id < LEVEL_COUNT; id++) {
      const r = this.cards[id]!;
      const unlocked = this.isUnlocked(id);
      const selected = id === this.selected;
      // A white card with a dark border, the selected one framed in the accent colour; a
      // pressed one sinks by a pixel.
      if (selected || this.press.pressed === id) {
        c.fillStyle = this.press.pressed === id ? Theme.text : Theme.accent;
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
    this.text.draw(c);
  }

  /** The panel's text: the description, scrolling when it is long, or how to unlock. */
  private layoutText(): void {
    const { fonts, i18n, content } = this.ctx;
    const r = this.infoRect;
    const id = this.selected;
    const level = content.missions.levels[id]!;
    const unlocked = this.isUnlocked(id);
    const iconsW = level.missionTypes.length * ICON_PITCH;
    const name = `${id + 1}. ${i18n.t(`level.names.${id}`)}`;
    const iconsX = r.x + r.w - 8 - iconsW;
    const iconsFit = unlocked && iconsX > r.x + 8 + fonts.text.measure(name) + 8 && r.h >= 72;
    const textY = r.y + 6 + fonts.text.lineHeight + 8;
    const textW = iconsFit ? iconsX - r.x - 16 : r.w - 16;
    this.text.setRect({
      x: r.x + 8,
      y: textY,
      w: Math.max(80, textW),
      h: Math.max(fonts.small.lineHeight, r.y + r.h - textY - 4),
    });
    const text = unlocked
      ? i18n.t(`level.desc.${id}`)
      : i18n.t('level.locked', { n: level.unlockThreshold - completedCount(this.progress) });
    this.text.setText([{ text, font: fonts.small, color: unlocked ? Theme.text : Theme.muted }]);
  }
}
