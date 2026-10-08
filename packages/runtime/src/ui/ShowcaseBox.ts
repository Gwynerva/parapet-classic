/**
 * The box on top of the character select and the Moves screen: a name and a counter in its
 * header, a stage where the screen draws its demo, and the description in a band at the
 * bottom that scrolls by itself when it is long. `<` and `>` at the sides of the stage step
 * through the list; a tap in the middle chooses.
 */
import type { UiPointer, UiWheel } from '../app/Screen.ts';
import type { BitmapFont } from '../text/BitmapFont.ts';
import { Button } from './Button.ts';
import { contains, type Rect } from './layout.ts';
import { panel } from './draw.ts';
import { PressTracker } from './press.ts';
import { TextScroller } from './TextScroller.ts';
import { Theme } from './theme.ts';

export interface ShowcaseFonts {
  /** Name in the header. */
  text: BitmapFont;
  /** Counter and description. */
  small: BitmapFont;
}

export interface ShowcaseActions {
  previous: () => void;
  next: () => void;
  choose: () => void;
}

/** Integer zoom of a demo on a stage of this height: runners are about 60 px tall. */
export function demoZoom(stageHeight: number): number {
  return stageHeight >= 170 ? 2 : 1;
}

/** Width of the `<` / `>` zones at the stage's sides. */
const NAV_WIDTH = 22;
/** Description band behind the text. */
const BAND = '#151a21';

export class ShowcaseBox {
  rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** Where the screen draws its demo. */
  stage: Rect = { x: 0, y: 0, w: 0, h: 0 };
  readonly description = new TextScroller();
  private band: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly fonts: ShowcaseFonts;
  private readonly prev = new Button();
  private readonly next = new Button();
  private readonly centre = new PressTracker<true>();
  private name = '';
  private nameColor: string = Theme.accent;
  private counter = '';

  constructor(fonts: ShowcaseFonts) {
    this.fonts = fonts;
    this.description.fade = BAND;
  }

  /** Smallest height that still shows a stage of `stage` px and `lines` of description. */
  static heightFor(fonts: ShowcaseFonts, stage: number, lines: number): number {
    return fonts.text.lineHeight + 10 + stage + lines * fonts.small.lineHeight + 10;
  }

  /** Places the box; the description band gets `lines` lines (it scrolls beyond them). */
  layout(rect: Rect, lines = 3): void {
    const { text, small } = this.fonts;
    this.rect = rect;
    const header = text.lineHeight + 10;
    const bandH = Math.min(lines * small.lineHeight + 10, Math.max(0, rect.h - header - 40));
    this.band = { x: rect.x + 1, y: rect.y + rect.h - 1 - bandH, w: rect.w - 2, h: bandH };
    this.stage = {
      x: rect.x + 1,
      y: rect.y + header,
      w: rect.w - 2,
      h: Math.max(0, this.band.y - rect.y - header),
    };
    const navH = Math.min(this.stage.h, 40);
    const navY = this.stage.y + ((this.stage.h - navH) >> 1);
    this.prev.rect = { x: this.stage.x + 2, y: navY, w: NAV_WIDTH, h: navH };
    this.next.rect = {
      x: this.stage.x + this.stage.w - 2 - NAV_WIDTH,
      y: navY,
      w: NAV_WIDTH,
      h: navH,
    };
    this.description.setRect({
      x: this.band.x + 7,
      y: this.band.y + 5,
      w: this.band.w - 14,
      h: Math.max(0, this.band.h - 10),
    });
  }

  /** What the box says; the description restarts from the top when it changes. */
  setContent(
    name: string,
    counter: string,
    description: string,
    nameColor: string = Theme.accent,
  ): void {
    this.name = name;
    this.counter = counter;
    this.nameColor = nameColor;
    this.description.setText([{ text: description, font: this.fonts.small, color: Theme.text }]);
  }

  update(dt: number): void {
    this.description.update(dt);
  }

  /** Arrows step, a tap on the stage chooses, a drag on the text scrolls it. */
  onPointer(p: UiPointer, actions: ShowcaseActions): boolean {
    if (this.prev.onPointer(p, actions.previous)) return true;
    if (this.next.onPointer(p, actions.next)) return true;
    if (this.description.onPointer(p)) return true;
    switch (p.type) {
      case 'down':
        if (!contains(this.rect, p.x, p.y)) return false;
        this.centre.press(contains(this.band, p.x, p.y) ? null : true, p);
        return true;
      case 'move':
        if (!this.centre.down) return false;
        this.centre.move(p, contains(this.stage, p.x, p.y) ? true : null);
        return true;
      case 'up':
        if (!this.centre.down) return false;
        if (this.centre.release(contains(this.rect, p.x, p.y) ? true : null)) actions.choose();
        return true;
      case 'cancel':
        this.centre.reset();
        return false;
    }
  }

  onWheel(w: UiWheel): boolean {
    return this.description.onWheel(w);
  }

  /** Panel and header; draw the stage's contents after this (clip to `stage`). */
  drawFrame(c: CanvasRenderingContext2D): void {
    const r = this.rect;
    const { text, small } = this.fonts;
    panel(c, r.x, r.y, r.w, r.h);
    const counterW = this.counter ? small.measure(this.counter) + 12 : 0;
    text.draw(c, text.fit(this.name, r.w - 16 - counterW), r.x + 8, r.y + 5, {
      color: this.nameColor,
    });
    if (this.counter) {
      small.draw(c, this.counter, r.x + r.w - 8, r.y + 7, {
        align: 'right',
        color: Theme.muted,
        tabular: true,
      });
    }
    c.fillStyle = Theme.panelBorder;
    c.fillRect(r.x + 1, this.stage.y - 1, r.w - 2, 1);
  }

  /** Arrows, the pressed highlight and the description band, over the stage. */
  drawOverlay(c: CanvasRenderingContext2D): void {
    const { small } = this.fonts;
    if (this.centre.pressed) {
      c.fillStyle = Theme.accent;
      const s = this.stage;
      c.fillRect(s.x, s.y, s.w, 1);
      c.fillRect(s.x, s.y + s.h - 1, s.w, 1);
      c.fillRect(s.x, s.y, 1, s.h);
      c.fillRect(s.x + s.w - 1, s.y, 1, s.h);
    }
    for (const [button, label] of [
      [this.prev, '<'],
      [this.next, '>'],
    ] as const) {
      const r = button.rect;
      if (button.pressed) {
        c.fillStyle = Theme.accentDark;
        c.fillRect(r.x, r.y, r.w, r.h);
      }
      small.draw(c, label, r.x + (r.w >> 1), r.y + ((r.h - small.lineHeight) >> 1), {
        align: 'center',
        color: Theme.accent,
      });
    }
    const b = this.band;
    c.fillStyle = BAND;
    c.fillRect(b.x, b.y, b.w, b.h);
    c.fillStyle = Theme.panelBorder;
    c.fillRect(b.x, b.y, b.w, 1);
    this.description.draw(c);
  }
}
