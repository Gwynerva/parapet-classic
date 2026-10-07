import { Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import {
  clear,
  column,
  heading,
  drawBackButton,
  headingCenterY,
  HEADING_TOP,
} from '@parapet/runtime/ui/draw.ts';

export class AboutScreen implements Screen {
  private scroll = 0;

  private readonly ctx: GameContext;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
  }

  update(): void {}

  onKey(key: UiKey): void {
    if (key.action === 'back' || key.action === 'confirm') {
      this.ctx.screens.pop();
    } else if (key.action === 'down') {
      this.scroll += 1;
    } else if (key.action === 'up') {
      this.scroll = Math.max(0, this.scroll - 1);
    }
  }

  onPointer(p: UiPointer): void {
    if (p.type === 'down') this.ctx.screens.pop();
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n } = this.ctx;
    clear(c, viewport.width, viewport.height);
    drawBackButton(c, fonts.text, viewport, headingCenterY(fonts.display, viewport.safeArea.top));
    heading(
      c,
      fonts.display,
      i18n.t('about.title'),
      viewport.width >> 1,
      viewport.safeArea.top + HEADING_TOP,
    );
    const col = column(viewport.width, 420);
    const text = [i18n.t('about.text'), '', i18n.t('about.fonts'), '', i18n.t('rules.text')].join(
      '\n',
    );
    const lines = fonts.small.wrap(text, col.w);
    const lineH = fonts.small.lineHeight + 1;
    const maxLines = Math.floor((viewport.height - 70) / lineH);
    this.scroll = Math.min(this.scroll, Math.max(0, lines.length - maxLines));
    fonts.small.draw(c, lines.slice(this.scroll, this.scroll + maxLines).join('\n'), col.x, 40, {
      color: Theme.text,
    });
  }
}
