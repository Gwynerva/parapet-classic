/**
 * Records: the local bests of a level next to the online board of one of its modes, with the
 * player's own position when a public name is claimed. Left/right change the level, up/down
 * the mode, confirm watches the best run as a replay. Wide viewports show the two panels side
 * by side, narrow ones stack them.
 */
import {
  defaultLeaderboardSort,
  isLeaderboardMode,
  LEVEL_COUNT,
  type RunMode,
  type RunRecord,
} from '@parapet/protocol';
import { modeForMissionType } from '@parapet/sim';
import { formatTime, Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import {
  clear,
  heading,
  panel,
  drawBackButton,
  hitBackButton,
  headingCenterY,
} from '@parapet/runtime/ui/draw.ts';
import {
  classify,
  columns,
  inset,
  safeRect,
  stack,
  type Rect,
} from '@parapet/runtime/ui/layout.ts';
import { listRecords, loadIdentity } from '@parapet/runtime/storage/profile.ts';
import { ApiError, fetchLeaderboard, fetchPlayer, fetchReplay } from '@parapet/runtime/net/api.ts';
import { PlayScreen } from './PlayScreen.ts';

export class RecordsScreen implements Screen {
  private levelId = 0;
  private modeIndex = 0;
  private online: RunRecord[] | null = null;
  private onlineError: string | null = null;
  private personal: RunRecord | null = null;
  private loading = false;
  private loadingReplay = false;
  private requestId = 0;
  private localRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private onlineRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private headerBottom = 0;

  private readonly ctx: GameContext;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.onResize();
  }

  /** Leaderboard modes of the current level, in the original's mission order. */
  private modes(): RunMode[] {
    const level = this.ctx.content.missions.levels[this.levelId];
    const out: RunMode[] = [];
    for (const type of level?.missionTypes ?? []) {
      const mode = modeForMissionType(type);
      if (mode && isLeaderboardMode(mode)) out.push(mode);
    }
    return out.length > 0 ? out : ['sprint'];
  }

  private get mode(): RunMode {
    const modes = this.modes();
    return modes[this.modeIndex % modes.length] ?? 'sprint';
  }

  enter(): void {
    this.load();
  }

  private load(): void {
    const id = ++this.requestId;
    const mode = this.mode;
    const sort = defaultLeaderboardSort(mode, this.levelId);
    this.loading = true;
    this.online = null;
    this.onlineError = null;
    this.personal = null;
    fetchLeaderboard(this.levelId, mode, sort, { limit: 10, timeoutMs: 5000 })
      .then((res) => {
        if (id !== this.requestId) return;
        this.online = res.entries;
        const identity = loadIdentity();
        if (!identity) return;
        return fetchPlayer(identity.name, { timeoutMs: 5000 }).then((player) => {
          if (id !== this.requestId) return;
          this.personal =
            player.bests.find((r) => r.levelId === this.levelId && r.mode === mode) ?? null;
        });
      })
      .catch((err: unknown) => {
        if (id !== this.requestId) return;
        if (err instanceof ApiError && err.code === 'not-found') return;
        this.onlineError =
          err instanceof ApiError ? this.ctx.i18n.t('net.offline') : this.ctx.i18n.t('net.error');
      })
      .finally(() => {
        if (id === this.requestId) this.loading = false;
      });
  }

  private watchBest(): void {
    const best = this.online?.[0];
    if (!best || this.loadingReplay) return;
    this.loadingReplay = true;
    fetchReplay(best.id, { timeoutMs: 8000 })
      .then((replay) => {
        this.ctx.screens.push(
          new PlayScreen(this.ctx, {
            levelId: replay.levelId,
            mode: replay.mode,
            withRival: replay.withRival,
            playerName: best.playerName,
            character: best.character,
            script: replay.input,
          }),
        );
      })
      .catch(() => {
        this.onlineError = this.ctx.i18n.t('net.error');
      })
      .finally(() => {
        this.loadingReplay = false;
      });
  }

  onResize(): void {
    const { viewport, fonts } = this.ctx;
    const safe = inset(safeRect(viewport), 8, 0);
    const header = fonts.display.lineHeight + fonts.small.lineHeight + 20;
    const [, body] = stack(safe, [header, -1], 4);
    const area = body ?? safe;
    this.headerBottom = safe.y + header;
    const wide = classify(viewport.width, viewport.height) === 'regular' && area.w >= 480;
    if (wide) {
      const [left, right] = columns(area, [-1, -1], 8);
      this.localRect = left ?? area;
      this.onlineRect = right ?? area;
    } else {
      const localH = Math.min(96, Math.max(60, area.h >> 2));
      const [top, bottom] = stack(area, [localH, -1], 6);
      this.localRect = top ?? area;
      this.onlineRect = bottom ?? area;
    }
  }

  update(): void {}

  onKey(key: UiKey): void {
    switch (key.action) {
      case 'back':
        this.ctx.screens.pop();
        return;
      case 'left':
        this.levelId = (this.levelId + LEVEL_COUNT - 1) % LEVEL_COUNT;
        this.modeIndex = 0;
        this.load();
        return;
      case 'right':
        this.levelId = (this.levelId + 1) % LEVEL_COUNT;
        this.modeIndex = 0;
        this.load();
        return;
      case 'up':
        this.modeIndex = (this.modeIndex + this.modes().length - 1) % this.modes().length;
        this.load();
        return;
      case 'down':
        this.modeIndex = (this.modeIndex + 1) % this.modes().length;
        this.load();
        return;
      case 'confirm':
        this.watchBest();
        return;
      default:
        return;
    }
  }

  onPointer(p: UiPointer): void {
    if (p.type !== 'down') return;
    const { width } = this.ctx.viewport;
    if (hitBackButton(this.ctx.viewport, p.x, p.y)) {
      this.ctx.screens.pop();
      return;
    }
    if (p.y < this.headerBottom) {
      this.onKey({ action: p.x < width / 2 ? 'left' : 'right' });
      return;
    }
    const r = this.onlineRect;
    if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) {
      if (p.y < r.y + 24) this.onKey({ action: 'down' });
      else this.watchBest();
    }
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n } = this.ctx;
    clear(c, viewport.width, viewport.height);
    drawBackButton(c, fonts.text, viewport, headingCenterY(fonts.display, viewport.safeArea.top));
    const safe = safeRect(viewport);
    const cx = safe.x + (safe.w >> 1);
    heading(
      c,
      fonts.display,
      `${i18n.t('records.title')}: ${i18n.t(`level.names.${this.levelId}`)}`,
      cx,
      safe.y + 8,
    );
    fonts.small.draw(
      c,
      `< ${this.levelId + 1} / ${LEVEL_COUNT} >`,
      cx,
      this.headerBottom - fonts.small.lineHeight - 4,
      { align: 'center', color: Theme.muted, tabular: true },
    );

    this.drawLocal(c, this.localRect);
    this.drawOnline(c, this.onlineRect);
  }

  private valueOf(
    record: { time: number; score: number; finished?: boolean },
    mode: RunMode,
  ): string {
    if (defaultLeaderboardSort(mode, this.levelId) === 'score') return String(record.score);
    return record.finished === false ? '-' : formatTime(record.time);
  }

  private drawLocal(c: CanvasRenderingContext2D, r: Rect): void {
    const { fonts, i18n } = this.ctx;
    panel(c, r.x, r.y, r.w, r.h);
    fonts.text.draw(c, i18n.t('records.local'), r.x + 8, r.y + 6, { color: Theme.accent });
    const local = listRecords().filter((rec) => rec.levelId === this.levelId);
    let rowY = r.y + 6 + fonts.text.lineHeight + 4;
    if (local.length === 0) {
      fonts.small.draw(c, i18n.t('records.empty'), r.x + 8, rowY, { color: Theme.muted });
    }
    for (const rec of local) {
      if (rowY + fonts.small.lineHeight > r.y + r.h - 4) break;
      fonts.small.draw(c, i18n.t(`mode.${rec.mode}`), r.x + 8, rowY, { color: Theme.text });
      fonts.small.draw(
        c,
        `${this.valueOf(rec.entry, rec.mode)}   ${rec.entry.score}`,
        r.x + r.w - 8,
        rowY,
        {
          align: 'right',
          color: Theme.text,
          tabular: true,
        },
      );
      rowY += fonts.small.lineHeight + 2;
    }
  }

  private drawOnline(c: CanvasRenderingContext2D, r: Rect): void {
    const { fonts, i18n } = this.ctx;
    const mode = this.mode;
    panel(c, r.x, r.y, r.w, r.h);
    fonts.text.draw(c, i18n.t('records.online'), r.x + 8, r.y + 6, { color: Theme.accent });
    fonts.small.draw(c, `^ ${i18n.t(`mode.${mode}`)} v`, r.x + r.w - 8, r.y + 8, {
      align: 'right',
      color: Theme.muted,
    });
    let rowY = r.y + 6 + fonts.text.lineHeight + 4;
    if (this.loading || this.loadingReplay) {
      const text = this.loadingReplay ? i18n.t('records.loadingReplay') : i18n.t('records.loading');
      fonts.small.draw(c, text, r.x + 8, rowY, { color: Theme.muted });
      return;
    }
    if (this.onlineError) {
      fonts.small.draw(c, this.onlineError, r.x + 8, rowY, { color: Theme.muted });
      return;
    }
    if (!this.online || this.online.length === 0) {
      fonts.small.draw(c, i18n.t('records.empty'), r.x + 8, rowY, { color: Theme.muted });
      rowY += fonts.small.lineHeight + 2;
    } else {
      for (const [i, rec] of this.online.entries()) {
        if (rowY + 2 * fonts.small.lineHeight > r.y + r.h - 4) break;
        fonts.small.draw(c, `${i + 1}. ${rec.playerName}`, r.x + 8, rowY, { color: Theme.text });
        fonts.small.draw(c, `${this.valueOf(rec, mode)}   ${rec.score}`, r.x + r.w - 8, rowY, {
          align: 'right',
          color: Theme.text,
          tabular: true,
        });
        rowY += fonts.small.lineHeight + 2;
      }
    }
    const identity = loadIdentity();
    const footerY = r.y + r.h - fonts.small.lineHeight - 4;
    if (!identity) {
      const lines = fonts.small.wrap(i18n.t('records.noName'), r.w - 16).slice(0, 1);
      fonts.small.draw(c, lines.join('\n'), r.x + 8, footerY, { color: Theme.muted });
    } else if (this.personal) {
      const rank = this.online ? this.online.findIndex((e) => e.id === this.personal?.id) + 1 : 0;
      fonts.small.draw(
        c,
        i18n.t('records.personalBest', {
          value: this.valueOf(this.personal, mode),
          rank: rank > 0 ? String(rank) : '>10',
        }),
        r.x + 8,
        footerY,
        { color: Theme.success },
      );
    }
  }
}
