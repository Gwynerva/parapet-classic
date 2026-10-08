/**
 * The frame of a sub-screen: the menu backdrop, the heading centred at the top of the safe
 * area, the `<` back button left of it, and the body rectangle below for the screen's content.
 */
import type { UiPointer } from '@parapet/runtime/app/Screen.ts';
import { BackButton } from '@parapet/runtime/ui/Button.ts';
import { heading, headingCenterY, HEADING_TOP } from '@parapet/runtime/ui/draw.ts';
import { inset, safeRect, type Rect } from '@parapet/runtime/ui/layout.ts';
import type { GameContext } from '../Context.ts';

/** Space between the heading and the body. */
const HEADING_GAP = 8;

export class ScreenFrame {
  private readonly ctx: GameContext;
  private readonly back = new BackButton();
  /** Where the screen's content goes: the safe area under the heading, 8 px from the sides. */
  body: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.layout();
  }

  /** Recomputes the rectangles (call from `onResize`). */
  layout(): void {
    const { viewport, fonts } = this.ctx;
    const safe = safeRect(viewport);
    this.back.place(viewport, headingCenterY(fonts.display, viewport.safeArea.top));
    const top = safe.y + HEADING_TOP + fonts.display.lineHeight + HEADING_GAP;
    const body = inset(safe, 8, 0);
    this.body = { x: body.x, y: top, w: body.w, h: Math.max(0, safe.y + safe.h - 6 - top) };
  }

  /** The back button; returns true when the event was its own. */
  onPointer(p: UiPointer, back: () => void = () => this.ctx.screens.pop()): boolean {
    return this.back.onPointer(p, back);
  }

  /** Backdrop, back button and heading. */
  draw(c: CanvasRenderingContext2D, title: string): void {
    const { viewport, fonts } = this.ctx;
    this.ctx.backdrop.draw(c);
    this.back.draw(c, fonts.text);
    const safe = safeRect(viewport);
    // Room between the back button and the full-screen button.
    const room = Math.max(40, safe.w - 2 * 40);
    heading(
      c,
      fonts.display,
      fonts.display.fit(title, room),
      safe.x + (safe.w >> 1),
      safe.y + HEADING_TOP,
    );
  }
}
