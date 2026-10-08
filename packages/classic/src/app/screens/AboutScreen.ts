/**
 * About the game, in three tabs instead of one wall of text: what the game is, how to play
 * (the original's rules and the controls) and who made it, with a button to the source code.
 * Long pages scroll by themselves and by hand.
 */
import { Theme, type GameContext } from '../Context.ts';
import type { Screen, UiGesture, UiKey, UiPointer, UiWheel } from '@parapet/runtime/app/Screen.ts';
import { Button } from '@parapet/runtime/ui/Button.ts';
import { fitWidth, rowHeight, type Rect } from '@parapet/runtime/ui/layout.ts';
import { TextScroller, type TextBlock } from '@parapet/runtime/ui/TextScroller.ts';
import { ScreenFrame } from '../ui/ScreenFrame.ts';

export const SOURCE_URL = 'https://github.com/Gwynerva/parapet-classic';

const TABS = ['game', 'howTo', 'credits'] as const;
type Tab = (typeof TABS)[number];

/** Keyboard focus: the tab row or the source-code button. */
type Focus = 'tabs' | 'source';

const COLUMN = 440;
/** Text at 16 px needs about 30 characters per line; narrower columns use the 12 px font. */
const LARGE_TEXT_COLUMN = 30 * 8;

export class AboutScreen implements Screen {
  readonly chrome = { fullscreenButton: true };
  private readonly ctx: GameContext;
  private readonly frame: ScreenFrame;
  private readonly tabs = TABS.map(() => new Button());
  private readonly source = new Button();
  private readonly text = new TextScroller();
  private tab: Tab = 'game';
  private focus: Focus = 'tabs';
  private sourceUrlY = 0;
  private pageRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.frame = new ScreenFrame(ctx);
    this.text.fade = Theme.panel;
    this.onResize();
  }

  enter(): void {
    this.onResize();
  }

  private get hasSource(): boolean {
    return this.tab === 'credits';
  }

  onResize(): void {
    const { viewport, fonts } = this.ctx;
    this.frame.layout();
    const col = fitWidth(this.frame.body, COLUMN);
    const tabH = rowHeight(20, viewport.isCoarsePointer);
    const tabW = Math.floor((col.w - 2 * 4) / TABS.length);
    this.tabs.forEach((b, i) => {
      b.rect = { x: col.x + i * (tabW + 4), y: col.y, w: tabW, h: tabH };
    });
    const buttonH = rowHeight(22, viewport.isCoarsePointer);
    // Room under the page for the source-code button and its address.
    const footer = this.hasSource ? 8 + buttonH + 4 + fonts.small.lineHeight : 0;
    const top = col.y + tabH + 6;
    const page: Rect = { x: col.x, y: top, w: col.w, h: Math.max(0, col.y + col.h - footer - top) };
    // The text sits in a panel with an 8 px margin; a short text gets a short panel.
    const textRect = (h: number): Rect => ({
      x: page.x + 8,
      y: page.y + 6,
      w: page.w - 16,
      h: Math.max(0, h - 12),
    });
    this.text.setRect(textRect(page.h));
    this.text.setText(this.blocks());
    if (!this.text.overflows) {
      page.h = Math.min(page.h, this.text.height + 12);
      this.text.setRect(textRect(page.h));
    }
    this.pageRect = page;
    if (this.hasSource) {
      const buttonW = Math.min(
        col.w,
        Math.max(160, fonts.text.measure(this.ctx.i18n.t('about.github')) + 24),
      );
      this.source.rect = {
        x: col.x + ((col.w - buttonW) >> 1),
        y: page.y + page.h + 8,
        w: buttonW,
        h: buttonH,
      };
      this.sourceUrlY = this.source.rect.y + buttonH + 4;
    }
  }

  /** The current tab's text as headed blocks. */
  private blocks(): TextBlock[] {
    const { i18n, fonts } = this.ctx;
    const body = this.text.rect.w >= LARGE_TEXT_COLUMN ? fonts.text : fonts.small;
    const para = (text: string, gap = 8): TextBlock => ({
      text,
      font: body,
      color: Theme.text,
      gapBefore: gap,
    });
    const head = (text: string, gap = 14): TextBlock => ({
      text,
      font: fonts.display,
      color: Theme.accent,
      gapBefore: gap,
    });
    switch (this.tab) {
      case 'game':
        return [para(i18n.t('about.text'), 0), para(i18n.t('about.features'))];
      case 'howTo':
        return [
          para(i18n.t('rules.text'), 0),
          head(i18n.t('controls.title')),
          para(i18n.t('controls.keyboard'), 4),
          para(i18n.t('controls.gamepad'), 4),
          para(i18n.t('controls.touch'), 4),
        ];
      case 'credits':
        return [
          head(i18n.t('about.original.title'), 0),
          para(i18n.t('about.original'), 4),
          head(i18n.t('about.remake.title')),
          para(i18n.t('about.remake', { name: i18n.t('gwynerva.name') }), 4),
          head(i18n.t('about.fonts.title')),
          para(i18n.t('about.fonts'), 4),
        ];
    }
  }

  private setTab(index: number): void {
    const n = TABS.length;
    const next = TABS[((index % n) + n) % n]!;
    if (next === this.tab) return;
    this.tab = next;
    if (!this.hasSource) this.focus = 'tabs';
    this.onResize();
    this.text.restart();
  }

  private openSource(): void {
    // A new tab; the game stays where it is.
    window.open(SOURCE_URL, '_blank', 'noopener,noreferrer');
  }

  update(dt: number): void {
    this.text.update(dt);
  }

  onKey(key: UiKey): void {
    const index = TABS.indexOf(this.tab);
    switch (key.action) {
      case 'back':
        this.ctx.screens.pop();
        return;
      case 'left':
        this.setTab(index - 1);
        return;
      case 'right':
        this.setTab(index + 1);
        return;
      case 'up':
      case 'down':
        this.text.onKey(key);
        return;
      case 'next':
      case 'prev':
        if (this.hasSource) this.focus = this.focus === 'tabs' ? 'source' : 'tabs';
        else this.setTab(index + (key.action === 'next' ? 1 : -1));
        return;
      case 'confirm':
        if (this.focus === 'tabs') this.setTab(index + 1);
        return;
      default:
        return;
    }
  }

  onGesture(g: UiGesture): boolean {
    if (!this.hasSource) return false;
    if (g.kind === 'key') {
      if (g.action !== 'confirm' || this.focus !== 'source') return false;
      this.openSource();
      return true;
    }
    return this.source.onGesture(g, () => this.openSource());
  }

  onPointer(p: UiPointer): void {
    if (this.frame.onPointer(p)) return;
    for (let i = 0; i < this.tabs.length; i++) {
      if (this.tabs[i]!.onPointer(p, () => this.setTab(i))) return;
    }
    this.text.onPointer(p);
  }

  onWheel(w: UiWheel): void {
    this.text.onWheel(w);
  }

  render(c: CanvasRenderingContext2D): void {
    const { fonts, i18n } = this.ctx;
    this.frame.draw(c, i18n.t('about.title'));
    TABS.forEach((t, i) => {
      const selected = t === this.tab;
      this.tabs[i]!.draw(c, fonts.text, i18n.t(`about.tab.${t}`), {
        focused: selected,
        color: selected ? Theme.text : Theme.muted,
      });
      if (selected && this.focus === 'tabs') {
        // The keyboard focus: a bar under the chosen tab.
        const r = this.tabs[i]!.rect;
        c.fillStyle = Theme.accent;
        c.fillRect(r.x + 4, r.y + r.h + 1, r.w - 8, 2);
      }
    });
    const page = this.pageRect;
    c.fillStyle = Theme.panel;
    c.fillRect(page.x, page.y, page.w, page.h);
    c.fillStyle = Theme.panelBorder;
    c.fillRect(page.x, page.y, page.w, 1);
    c.fillRect(page.x, page.y + page.h - 1, page.w, 1);
    c.fillRect(page.x, page.y, 1, page.h);
    c.fillRect(page.x + page.w - 1, page.y, 1, page.h);
    this.text.draw(c);
    if (this.hasSource) {
      this.source.draw(c, fonts.text, i18n.t('about.github'), {
        focused: this.focus === 'source',
        color: Theme.accent,
      });
      const r = this.source.rect;
      fonts.small.draw(c, SOURCE_URL.replace('https://', ''), r.x + (r.w >> 1), this.sourceUrlY, {
        align: 'center',
        color: Theme.muted,
      });
    }
  }
}
