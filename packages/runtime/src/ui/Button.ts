/**
 * Buttons with the same feel as menu rows: highlighted under the keyboard focus, sunk while a
 * pointer holds them, fired on release over them. `BackButton` is the `<` at the top-left of
 * every sub-screen (Esc and the phone's Back do the same).
 */
import type { UiGesture, UiPointer } from '../app/Screen.ts';
import type { BitmapFont } from '../text/BitmapFont.ts';
import { BACK_BUTTON_HIT, BACK_BUTTON_SIZE } from './draw.ts';
import { contains, type Rect } from './layout.ts';
import { PressTracker } from './press.ts';
import { Theme } from './theme.ts';

export interface ButtonLook {
  focused?: boolean;
  disabled?: boolean;
  /** Label colour when idle (default: the text colour). */
  color?: string;
}

export class Button {
  rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** Touch area around the drawn rectangle (logical px on each side). */
  slop = 0;
  private readonly press = new PressTracker<true>();
  /** A finger pressed a gesture button; it fires on release. */
  private armed = false;

  get pressed(): boolean {
    return this.press.pressed === true;
  }

  hit(x: number, y: number): boolean {
    const r = this.rect;
    const s = this.slop;
    return x >= r.x - s && x < r.x + r.w + s && y >= r.y - s && y < r.y + r.h + s;
  }

  /** Feeds a pointer event; calls `fire` on a release over the button. Returns true if used. */
  onPointer(p: UiPointer, fire: () => void): boolean {
    const over = this.hit(p.x, p.y);
    switch (p.type) {
      case 'down':
        if (!over) return false;
        this.press.press(true, p);
        return true;
      case 'move':
        if (!this.press.down) return false;
        this.press.move(p, over ? true : null);
        return true;
      case 'up': {
        if (!this.press.down) return false;
        if (this.press.release(over ? true : null)) fire();
        return true;
      }
      case 'cancel': {
        const was = this.press.down;
        this.press.reset();
        return was;
      }
    }
  }

  /**
   * For actions that need user activation (opening a link): a mouse press fires at once, a
   * finger on release over the button, both inside the browser's event handler.
   */
  onGesture(g: UiGesture, fire: () => void): boolean {
    if (g.kind !== 'pointer') return false;
    const over = this.hit(g.x, g.y);
    if (g.type === 'down') {
      this.armed = false;
      if (!over) return false;
      if (g.pointerType === 'mouse') fire();
      else this.armed = true;
      return true;
    }
    const armed = this.armed;
    this.armed = false;
    if (!armed) return false;
    if (over) fire();
    return true;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    font: BitmapFont,
    label: string,
    look: ButtonLook = {},
  ): void {
    drawButtonFace(ctx, font, label, this.rect, {
      ...look,
      pressed: this.pressed || this.armed,
    });
  }
}

/** A flat button: panel colours, accent outline when focused, accent fill while pressed. */
export function drawButtonFace(
  ctx: CanvasRenderingContext2D,
  font: BitmapFont,
  label: string,
  r: Rect,
  look: ButtonLook & { pressed?: boolean },
): void {
  const pressed = look.pressed === true && !look.disabled;
  ctx.fillStyle = pressed ? Theme.accent : look.focused ? Theme.accentDark : Theme.panel;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = look.focused || pressed ? Theme.accent : Theme.panelBorder;
  ctx.fillRect(r.x, r.y, r.w, 1);
  ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
  ctx.fillRect(r.x, r.y, 1, r.h);
  ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
  const color = look.disabled
    ? Theme.muted
    : pressed
      ? Theme.background
      : (look.color ?? Theme.text);
  const text = font.fit(label, r.w - 8);
  font.draw(ctx, text, r.x + (r.w >> 1), r.y + ((r.h - font.lineHeight) >> 1) + (pressed ? 1 : 0), {
    align: 'center',
    color,
  });
}

interface BackViewport {
  safeArea: { top: number; left: number };
}

/** The `<` of a sub-screen, aligned with the heading's vertical centre. */
export class BackButton {
  private readonly button = new Button();

  /** Places the button; `centerY` is the heading's vertical centre. */
  place(viewport: BackViewport, centerY: number): void {
    const x = viewport.safeArea.left + 6;
    const y = Math.round(centerY - BACK_BUTTON_SIZE / 2);
    this.button.rect = { x, y, w: BACK_BUTTON_SIZE, h: BACK_BUTTON_SIZE };
    // The touch target reaches the corner of the safe area.
    this.button.slop = (BACK_BUTTON_HIT - BACK_BUTTON_SIZE) >> 1;
  }

  get rect(): Rect {
    return this.button.rect;
  }

  contains(x: number, y: number): boolean {
    return this.button.hit(x, y) || contains(this.button.rect, x, y);
  }

  onPointer(p: UiPointer, back: () => void): boolean {
    return this.button.onPointer(p, back);
  }

  draw(ctx: CanvasRenderingContext2D, font: BitmapFont): void {
    this.button.draw(ctx, font, '<', { color: Theme.accent });
  }
}
