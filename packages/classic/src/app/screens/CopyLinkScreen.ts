/**
 * Shown when the browser refused to copy a challenge link (no clipboard permission, a gamepad
 * press, an old browser): the link sits selected in a real text field, ready for the system's
 * own copy. Any key, a tap outside the field or Enter in it closes the screen.
 */
import { Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import { heading, panel } from '@parapet/runtime/ui/draw.ts';
import { fitWidth, inset, safeRect, type Rect } from '@parapet/runtime/ui/layout.ts';
import { TextInputOverlay } from '@parapet/runtime/ui/TextInputOverlay.ts';

export class CopyLinkScreen implements Screen {
  readonly translucent = true;
  private readonly ctx: GameContext;
  private readonly field: TextInputOverlay;
  private box: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private fieldRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private hint: string[] = [];

  constructor(ctx: GameContext, link: string) {
    this.ctx = ctx;
    this.field = new TextInputOverlay(ctx.viewport, {
      maxLength: link.length,
      initial: link,
      readOnly: true,
      fontFamily: 'Terminus',
      onCommit: () => this.close(),
      onCancel: () => this.close(),
    });
    this.onResize();
  }

  enter(): void {
    this.field.open(this.fieldRect);
  }

  exit(): void {
    this.field.close();
  }

  private close(): void {
    if (this.ctx.screens.top === this) this.ctx.screens.pop();
  }

  onResize(): void {
    const { viewport, fonts, i18n } = this.ctx;
    const safe = safeRect(viewport);
    const col = fitWidth(inset(safe, 8, 0), 360);
    this.hint = fonts.small.wrap(i18n.t('share.copyByHand'), col.w - 16);
    const h =
      8 +
      fonts.display.lineHeight +
      6 +
      this.hint.length * (fonts.small.lineHeight + 2) +
      8 +
      fonts.text.lineHeight +
      6 +
      12;
    this.box = { x: col.x, y: safe.y + ((safe.h - h) >> 1), w: col.w, h };
    this.fieldRect = {
      x: col.x + 8,
      y: this.box.y + h - 12 - fonts.text.lineHeight - 6,
      w: col.w - 16,
      h: fonts.text.lineHeight + 6,
    };
    this.field.reposition(this.fieldRect);
  }

  update(): void {}

  onKey(key: UiKey): void {
    if (key.action === 'back' || key.action === 'confirm' || key.action === 'pause') this.close();
  }

  onPointer(p: UiPointer): void {
    if (p.type !== 'down') return;
    const b = this.box;
    if (p.x < b.x || p.x >= b.x + b.w || p.y < b.y || p.y >= b.y + b.h) this.close();
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n } = this.ctx;
    c.fillStyle = Theme.overlay;
    c.fillRect(0, 0, viewport.width, viewport.height);
    const b = this.box;
    panel(c, b.x, b.y, b.w, b.h);
    heading(c, fonts.display, i18n.t('share.title'), b.x + (b.w >> 1), b.y + 8);
    let y = b.y + 8 + fonts.display.lineHeight + 6;
    for (const line of this.hint) {
      fonts.small.draw(c, line, b.x + 8, y, { color: Theme.text });
      y += fonts.small.lineHeight + 2;
    }
  }
}
