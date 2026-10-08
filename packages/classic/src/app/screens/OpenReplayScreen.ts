/**
 * Opening a replay from the menus: a real text field to paste a challenge link or a bare replay
 * code into (so the system's own paste works on phones, where there is no Ctrl+V), the
 * clipboard read at a press where the browser allows it, and the file dialog. Whatever comes in
 * is re-run at once and shown as a card: who challenges, on which level and mission, as which
 * character, with what time (the result this device computed, not one the link claims). The
 * race starts from the card; this screen then gives way to it (`closesOnReplay`). Replays
 * dropped or pasted onto the window while it is up land here too (`takeReplayText`).
 */
import { rankingSort } from '@parapet/sim';
import { IDLE_CLIP_OFFSET } from '@parapet/runtime/anim/Animator.ts';
import type { Screen, UiGesture, UiKey, UiPointer, UiWheel } from '@parapet/runtime/app/Screen.ts';
import { drawPose } from '@parapet/runtime/render/CharacterRenderer.ts';
import { Menu, type MenuItem } from '@parapet/runtime/ui/Menu.ts';
import { heading, panel } from '@parapet/runtime/ui/draw.ts';
import { rowHeight, type Rect } from '@parapet/runtime/ui/layout.ts';
import { TextInputOverlay } from '@parapet/runtime/ui/TextInputOverlay.ts';
import { formatTime, Theme, type GameContext } from '../Context.ts';
import { bossOfCharacter } from '../bosses.ts';
import {
  checkReplayText,
  pickReplayFile,
  runnerName,
  startRace,
  type ReplayCheck,
} from '../ghosts.ts';
import { dialogLayout } from '../layouts.ts';

/** Longer than any link a long run makes (about a kilobyte a minute). */
const MAX_TEXT = 65536;
const WIDTH = 300;
/** The card's figure: a column for the character standing in it. */
const FIGURE_W = 40;
const CARD_BACKGROUND = '#12171d';
const UNITS = 32;

export class OpenReplayScreen implements Screen {
  readonly translucent = true;
  /** Gives way to the race it opens. */
  readonly closesOnReplay = true;
  private readonly ctx: GameContext;
  private readonly menu: Menu;
  private field: TextInputOverlay | null = null;
  /** What the field holds (kept while a message or the race covers it). */
  private text = '';
  /** The last text checked and what it holds. */
  private checked: { text: string; check: ReplayCheck } | null = null;
  private hint: string[] = [];
  private panelRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private fieldRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private cardRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.menu = new Menu(ctx.fonts.text, ctx.fonts.small);
    this.buildMenu();
    this.onResize();
  }

  private buildMenu(): void {
    const { i18n } = this.ctx;
    const items: MenuItem[] = [
      {
        label: i18n.t('replayOpen.race'),
        disabled: this.check().kind !== 'ok',
        onSelect: () => this.race(),
      },
    ];
    // Reading the clipboard needs the browser's leave, asked at the press; not everywhere.
    if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function') {
      items.push({
        label: i18n.t('replayOpen.paste'),
        gesture: true,
        onSelect: () => this.paste(),
      });
    }
    items.push(
      {
        label: i18n.t('replayOpen.file'),
        gesture: true,
        onSelect: () =>
          pickReplayFile((text) => {
            if (text === null) this.show('', { kind: 'problem', problem: 'invalid' });
            else this.takeReplayText(text);
          }),
      },
      { label: i18n.t('menu.back'), onSelect: () => this.close() },
    );
    const cursor = this.menu.cursor;
    this.menu.setItems(items);
    this.menu.setCursor(Math.min(cursor, items.length - 1));
  }

  enter(): void {
    this.openField();
  }

  exit(): void {
    this.text = this.field?.value ?? this.text;
    this.field?.close();
    this.field = null;
  }

  /** A replay dropped, pasted, picked or read from the clipboard: into the field and the card. */
  takeReplayText(text: string): void {
    const check = checkReplayText(this.ctx, text);
    // A file's whole text is not for the field: its code is.
    const shown = check.kind === 'ok' ? check.code : text.trim();
    this.show(shown, check);
    if (this.ctx.screens.top === this) this.openField();
  }

  private show(text: string, check: ReplayCheck): void {
    this.text = text;
    this.checked = { text, check };
    this.buildMenu();
    // The race is the obvious next step once there is one.
    if (check.kind === 'ok') this.menu.setCursor(0);
  }

  /** What the field's text holds, checked once per text. */
  private check(): ReplayCheck {
    const text = this.field?.value ?? this.text;
    if (this.checked?.text !== text) {
      this.checked = { text, check: checkReplayText(this.ctx, text) };
    }
    return this.checked.check;
  }

  /** A fresh field holding `this.text` (an overlay keeps the text it was made with). */
  private openField(): void {
    this.field?.close();
    this.field = new TextInputOverlay(this.ctx.viewport, {
      maxLength: MAX_TEXT,
      initial: this.text,
      placeholder: this.ctx.i18n.t('replayOpen.placeholder'),
      fontFamily: 'Terminus',
      onInput: (value) => {
        this.text = value;
        this.clipboardRefused = false;
        this.check();
        this.buildMenu();
      },
      onCommit: (value) => {
        this.field = null;
        this.text = value;
        if (!this.race()) this.openField();
      },
      onCancel: () => {
        this.field = null;
        this.close();
      },
    });
    this.field.open(this.fieldRect);
  }

  /** Starts the race on the card; false when there is none. */
  private race(): boolean {
    const check = this.check();
    if (check.kind !== 'ok') return false;
    startRace(this.ctx, check.ghost);
    return true;
  }

  /** Called from a gesture: browsers ask for (or show) their paste permission only there. */
  private paste(): void {
    navigator.clipboard.readText().then(
      (text) => {
        this.clipboardRefused = false;
        this.takeReplayText(text);
      },
      () => {
        this.clipboardRefused = true;
      },
    );
  }

  /** The browser did not share the clipboard (said on the card until the text changes). */
  private clipboardRefused = false;

  private close(): void {
    if (this.ctx.screens.top === this) this.ctx.screens.pop();
  }

  onResize(): void {
    const { viewport, fonts, i18n } = this.ctx;
    const row = rowHeight(24, viewport.isCoarsePointer);
    const fieldH = Math.max(fonts.text.lineHeight + 6, row - 4);
    const lineH = fonts.small.lineHeight + 2;
    const cardH = Math.max(52, 4 * lineH + 8);
    const measure = (header: number) =>
      dialogLayout(viewport, {
        width: WIDTH,
        header,
        footer: 0,
        rows: this.menu.items.length,
        rowHeight: row,
      });
    // The width first, then the hint wrapped to it, then the real header.
    const width = measure(0).menu.w;
    this.hint = fonts.small.wrap(i18n.t('replayOpen.hint'), width);
    const header =
      fonts.display.lineHeight + 4 + this.hint.length * lineH + 6 + fieldH + 6 + cardH + 2;
    const d = measure(header);
    this.panelRect = d.panel;
    const fieldY = d.panel.y + 8 + fonts.display.lineHeight + 4 + this.hint.length * lineH + 6;
    this.fieldRect = { x: d.menu.x, y: fieldY, w: d.menu.w, h: fieldH };
    this.cardRect = { x: d.menu.x, y: fieldY + fieldH + 6, w: d.menu.w, h: cardH };
    this.field?.reposition(this.fieldRect);
    Object.assign(this.menu.layout, {
      x: d.menu.x,
      y: d.menu.y,
      width: d.menu.w,
      rowHeight: row,
      align: 'center',
    });
    this.menu.fit(d.menu.h);
  }

  update(): void {}

  onKey(key: UiKey): void {
    if (key.action === 'back') {
      this.close();
      return;
    }
    this.menu.onKey(key);
  }

  onPointer(p: UiPointer): void {
    this.menu.onPointer(p);
  }

  onWheel(w: UiWheel): void {
    this.menu.onWheel(w);
  }

  onGesture(g: UiGesture): boolean {
    return this.menu.onGesture(g);
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n } = this.ctx;
    c.fillStyle = Theme.overlay;
    c.fillRect(0, 0, viewport.width, viewport.height);
    const r = this.panelRect;
    panel(c, r.x, r.y, r.w, r.h);
    heading(c, fonts.display, i18n.t('replayFile.open'), r.x + (r.w >> 1), r.y + 8);
    const f = this.fieldRect;
    let y = r.y + 8 + fonts.display.lineHeight + 4;
    for (const line of this.hint) {
      fonts.small.draw(c, line, f.x, y, { color: Theme.muted });
      y += fonts.small.lineHeight + 2;
    }
    // Under the HTML field, and in its place while a message covers it.
    c.fillStyle = '#2a1815';
    c.fillRect(f.x, f.y, f.w, f.h);
    if (!this.field) {
      const shown = this.text || i18n.t('replayOpen.placeholder');
      const clipped = shown.length > 40 ? `${shown.slice(0, 39)}…` : shown;
      fonts.small.draw(c, clipped, f.x + 4, f.y + ((f.h - fonts.small.lineHeight) >> 1), {
        color: this.text ? Theme.text : Theme.muted,
      });
    }
    this.drawCard(c);
    this.menu.draw(c);
  }

  /** The challenger's card, or what is wrong with the text, or how to start. */
  private drawCard(c: CanvasRenderingContext2D): void {
    const { fonts, i18n } = this.ctx;
    const small = fonts.small;
    const lineH = small.lineHeight + 2;
    const k = this.cardRect;
    const check = this.check();
    c.fillStyle = CARD_BACKGROUND;
    c.fillRect(k.x, k.y, k.w, k.h);
    if (check.kind !== 'ok') {
      let message = i18n.t('replayOpen.empty');
      let color: string = Theme.muted;
      if (this.clipboardRefused) {
        message = i18n.t('replayOpen.noClipboard');
      } else if (check.kind === 'problem') {
        message = i18n.t(`ghost.problem.${check.problem}`);
        color = Theme.danger;
      } else if (this.text.trim()) {
        message = i18n.t('replayOpen.none');
        color = Theme.danger;
      }
      let y = k.y + 4;
      for (const line of small.wrap(message, k.w - 12).slice(0, 4)) {
        small.draw(c, line, k.x + 6, y, { color });
        y += lineH;
      }
      return;
    }
    const { replay, outcome } = check.ghost;
    c.fillStyle = Theme.accent;
    c.fillRect(k.x, k.y, 2, k.h);
    this.drawFigure(c, replay.character, k.x + 2 + (FIGURE_W >> 1), k.y + k.h - 5);
    const x = k.x + 2 + FIGURE_W;
    const w = k.w - 2 - FIGURE_W - 6;
    const level = i18n.t(`level.names.${replay.levelId}`);
    const mode = i18n.t(`mode.${replay.mode}`);
    const byScore = rankingSort(replay.mode, replay.levelId) === 'score';
    let result = i18n.t('replayOpen.unfinished');
    if (byScore) result = i18n.t('replayOpen.score', { value: String(outcome.score) });
    else if (outcome.finished)
      result = i18n.t('replayOpen.time', { value: formatTime(outcome.time) });
    const lines: [string, string][] = [
      [i18n.t('replayOpen.who', { name: runnerName(this.ctx, replay) }), Theme.accent],
      [`${level} · ${mode}`, Theme.text],
      [i18n.t('replayOpen.character', { name: this.characterName(replay.character) }), Theme.text],
      [result, Theme.success],
    ];
    let y = k.y + ((k.h - lines.length * lineH) >> 1) + 1;
    for (const [text, color] of lines) {
      const fitted = small.wrap(text, w)[0] ?? '';
      small.draw(c, fitted, x, y, { color, tabular: true });
      y += lineH;
    }
  }

  private characterName(character: number): string {
    const found = bossOfCharacter(character);
    if (found) return this.ctx.i18n.t(`boss.${found.boss.id}.name`);
    return this.ctx.skins.find((s) => s.character === character)?.name ?? '';
  }

  /** The character standing, its feet at (x, y). */
  private drawFigure(c: CanvasRenderingContext2D, character: number, x: number, y: number): void {
    const { render, viewport } = this.ctx;
    const skins = render.skins;
    const scene = skins.sceneFor(character, 0);
    const swap = skins.swapFor(character, -1, 0);
    const idle = render.clips[IDLE_CLIP_OFFSET + 1] ?? 0;
    const savedW = scene.viewWidth;
    const savedH = scene.viewHeight;
    scene.setViewport(viewport.width, viewport.height);
    drawPose(
      c,
      scene,
      { x: x * UNITS, y: y * UNITS, a: idle, b: idle, t: 0, flipX: false, anchored: false },
      { x: 0, y: 0 },
      swap,
    );
    scene.setViewport(savedW, savedH);
  }
}
