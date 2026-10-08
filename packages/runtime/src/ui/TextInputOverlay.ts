/**
 * A real `<input>` floated over the canvas for text entry (player names): it gives mobile
 * keyboards, IME and paste for free, which a canvas-drawn keyboard would not. The element is
 * positioned from a logical rectangle and follows the canvas when the viewport changes.
 * Keyboard events inside the input never reach the game (`InputManager` ignores editable
 * targets); Enter commits, Escape cancels.
 */
import type { Viewport } from '../render/Viewport.ts';
import type { Rect } from './layout.ts';

export interface TextInputOptions {
  maxLength: number;
  /**
   * Characters allowed, tested one by one: others are dropped as they are typed or pasted, the
   * caret staying where it was among the characters kept.
   */
  allowed?: (ch: string) => boolean;
  /** No space at the start, none twice in a row (pasted runs of them fold into one). */
  singleSpaces?: boolean;
  initial?: string;
  placeholder?: string;
  /** CSS font family of the field (a locally bundled face registered with `installWebFont`). */
  fontFamily?: string;
  /** Show `initial` for copying only (selected, not editable). */
  readOnly?: boolean;
  onCommit: (value: string) => void;
  onCancel: () => void;
  /** Every change of the text (typed, pasted, cut). */
  onInput?: (value: string) => void;
}

/**
 * `value` with the characters `allowed` refuses dropped (and with `singleSpaces` no leading
 * space and no two in a row), and where the caret at `caret` (UTF-16 index) lands in it.
 */
export function filterText(
  value: string,
  caret: number,
  allowed: (ch: string) => boolean,
  singleSpaces: boolean,
): { value: string; caret: number } {
  let out = '';
  let at = 0;
  let index = 0;
  for (const ch of value) {
    const space = /\s/.test(ch);
    let keep = space ? !singleSpaces || (out.length > 0 && !out.endsWith(' ')) : allowed(ch);
    if (keep && space && !allowed(' ')) keep = false;
    if (keep) out += space ? ' ' : ch;
    index += ch.length;
    if (index <= caret) at = out.length;
  }
  return { value: out, caret: Math.min(at, out.length) };
}

export class TextInputOverlay {
  private readonly viewport: Viewport;
  private readonly opts: TextInputOptions;
  private input: HTMLInputElement | null = null;
  private rect: Rect = { x: 0, y: 0, w: 100, h: 20 };
  private unsubscribe: (() => void) | null = null;

  constructor(viewport: Viewport, opts: TextInputOptions) {
    this.viewport = viewport;
    this.opts = opts;
  }

  get isOpen(): boolean {
    return this.input !== null;
  }

  get value(): string {
    return this.input?.value ?? this.opts.initial ?? '';
  }

  /** Create the field over `rect` (logical px) and focus it. */
  open(rect: Rect): void {
    if (this.input) {
      this.reposition(rect);
      return;
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = this.opts.maxLength;
    input.value = this.opts.initial ?? '';
    input.placeholder = this.opts.placeholder ?? '';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.setAttribute('enterkeyhint', 'done');
    input.readOnly = this.opts.readOnly ?? false;
    const s = input.style;
    s.position = 'fixed';
    s.boxSizing = 'border-box';
    s.margin = '0';
    s.border = '1px solid #ffffff';
    s.borderRadius = '0';
    s.outline = 'none';
    s.background = '#2a1815';
    s.color = '#ffffff';
    s.fontFamily = this.opts.fontFamily ?? 'monospace';
    s.zIndex = '10';
    input.addEventListener('input', this.onInput);
    input.addEventListener('keydown', this.onKeyDown);
    document.body.appendChild(input);
    this.input = input;
    this.rect = rect;
    this.place();
    this.unsubscribe = this.viewport.onResize(() => this.place());
    input.focus();
    if (this.opts.readOnly) input.setSelectionRange(0, input.value.length);
    else input.setSelectionRange(input.value.length, input.value.length);
  }

  reposition(rect: Rect): void {
    this.rect = rect;
    this.place();
  }

  close(): void {
    const input = this.input;
    if (!input) return;
    this.input = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    input.removeEventListener('input', this.onInput);
    input.removeEventListener('keydown', this.onKeyDown);
    input.remove();
  }

  private place(): void {
    const input = this.input;
    if (!input) return;
    const bounds = this.viewport.canvas.getBoundingClientRect();
    const cssPerLogical = bounds.width > 0 ? bounds.width / this.viewport.width : 1;
    const s = input.style;
    s.left = `${bounds.left + this.rect.x * cssPerLogical}px`;
    s.top = `${bounds.top + this.rect.y * cssPerLogical}px`;
    s.width = `${this.rect.w * cssPerLogical}px`;
    s.height = `${this.rect.h * cssPerLogical}px`;
    // iOS zooms into fields with a font under 16 px; keep the text readable at any scale.
    s.fontSize = `${Math.max(16, Math.round(12 * cssPerLogical))}px`;
    s.padding = `0 ${Math.round(4 * cssPerLogical)}px`;
  }

  private readonly onInput = (): void => {
    const input = this.input;
    if (!input) return;
    const { allowed, singleSpaces } = this.opts;
    if (allowed || singleSpaces) {
      const caret = input.selectionStart ?? input.value.length;
      const kept = filterText(input.value, caret, allowed ?? (() => true), singleSpaces ?? false);
      if (kept.value !== input.value) {
        input.value = kept.value;
        input.setSelectionRange(kept.caret, kept.caret);
      }
    }
    this.opts.onInput?.(input.value);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const value = this.value;
      this.close();
      this.opts.onCommit(value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      this.opts.onCancel();
    }
    event.stopPropagation();
  };
}

/** Registers a locally bundled font file under `family` for HTML overlays (no network). */
export function installWebFont(family: string, url: string): void {
  if (typeof document === 'undefined') return;
  const id = `parapet-font-${family.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `@font-face { font-family: "${family}"; src: url("${url}"); font-display: block; }`;
  document.head.appendChild(style);
}
