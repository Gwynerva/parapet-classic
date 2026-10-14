/**
 * The Lab page: a card per experiment, each a picture that plays at the original's pace, its
 * controls and what came out. Only the cards on screen play; with reduced motion they wait for
 * their play button.
 */
import { Frame } from '@parapet/lab/frame.ts';
import type { Lab } from '@parapet/lab/lab.ts';
import { STEP_MS, type Scene } from '@parapet/lab/scene.ts';
import { findingsUrl } from '../app/links.ts';
import { CARDS, type CardDef, type ParamSpec, type Values } from './cards.ts';
import { fill, type LabText } from './text.ts';

/** How long a scene's last moment stays before it plays again. */
const HOLD_MS = 1200;
/** The widest the pictures are drawn, in screen pixels per pixel of the original. */
const MAX_SCALE = 2;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

class Card {
  readonly root: HTMLElement;
  private readonly def: CardDef;
  private readonly lab: Lab;
  private readonly text: LabText;
  private readonly values: Values = {};
  private readonly canvas = el('canvas', { class: 'scene' });
  private readonly result = el('p', { class: 'result', 'aria-live': 'polite' });
  private readonly playButton = el('button', { type: 'button', class: 'play' });
  private scene: Scene | null = null;
  private frame: Frame | null = null;
  private t = 0;
  private holding = 0;
  playing: boolean;
  visible = false;
  /** The page's language, for numbers and the words that go with them. */
  private readonly lang = document.documentElement.lang || 'en';

  constructor(def: CardDef, lab: Lab, text: LabText, autoplay: boolean) {
    this.def = def;
    this.lab = lab;
    this.text = text;
    this.playing = autoplay;
    const words = text.cards[def.id];
    const controls = el('div', { class: 'controls' });
    for (const spec of def.params(words.params, lab)) {
      this.values[spec.id] = spec.value;
      controls.append(this.control(spec, words.params[spec.id] ?? spec.id));
    }
    this.playButton.addEventListener('click', () => {
      this.playing = !this.playing;
      this.showPlaying();
    });
    this.showPlaying();
    this.root = el(
      'section',
      { class: 'card', id: def.id },
      el('h2', {}, words.title),
      el('p', {}, words.text),
      el('div', { class: 'stage' }, this.canvas, this.playButton),
      controls,
      this.result,
      el(
        'p',
        { class: 'more' },
        el('a', { href: findingsUrl(def.page), rel: 'noopener' }, `${text.story} →`),
      ),
    );
    this.rebuild();
  }

  private showPlaying(): void {
    this.playButton.textContent = this.playing ? '❚❚' : '▶';
    this.playButton.setAttribute('aria-label', this.playing ? this.text.pause : this.text.play);
  }

  private control(spec: ParamSpec, label: string): HTMLElement {
    const id = `${this.def.id}-${spec.id}`;
    if (spec.kind === 'toggle') {
      const box = el('input', { type: 'checkbox', id });
      box.checked = spec.value;
      box.addEventListener('change', () => {
        this.values[spec.id] = box.checked;
        this.rebuild();
      });
      return el('label', { class: 'toggle', for: id }, box, label);
    }
    if (spec.kind === 'choice') {
      const select = el('select', { id });
      for (const o of spec.options) {
        const option = el('option', { value: String(o.value) }, o.label);
        option.selected = o.value === spec.value;
        select.append(option);
      }
      select.addEventListener('change', () => {
        this.values[spec.id] = Number(select.value);
        this.rebuild();
      });
      return el('label', { class: 'choice', for: id }, `${label} `, select);
    }
    const range = el('input', {
      type: 'range',
      id,
      min: String(spec.min),
      max: String(spec.max),
      step: '1',
      value: String(spec.value),
    });
    const caption = el('span');
    const show = (): void => {
      const v = Number(range.value);
      caption.textContent = fill(label, { n: spec.show ? spec.show(v) : v }, this.lang);
    };
    const set = (v: number): void => {
      range.value = String(Math.max(spec.min, Math.min(spec.max, v)));
      this.values[spec.id] = Number(range.value);
      show();
      this.rebuild();
    };
    range.addEventListener('input', () => set(Number(range.value)));
    const minus = el('button', { type: 'button', 'aria-label': '−' }, '−');
    const plus = el('button', { type: 'button', 'aria-label': '+' }, '+');
    minus.addEventListener('click', () => set(Number(range.value) - 1));
    plus.addEventListener('click', () => set(Number(range.value) + 1));
    show();
    return el('div', { class: 'range' }, el('label', { for: id }, caption), minus, range, plus);
  }

  private rebuild(): void {
    const built = this.def.build(this.lab, this.values);
    this.scene = built.scene;
    this.frame = new Frame(built.scene.width, built.scene.height);
    this.canvas.width = built.scene.width;
    this.canvas.height = built.scene.height;
    this.t = built.scene.from;
    this.holding = 0;
    const words = this.text.cards[this.def.id];
    this.result.textContent = fill(words.results[built.result] ?? '', built.args, this.lang);
    this.fit();
    this.draw();
  }

  /** The largest whole magnification that fits the card. */
  fit(): void {
    if (!this.scene) return;
    // The card's width less its padding; before the card is on the page, the phone's.
    const room = this.root.isConnected ? this.root.clientWidth - 34 : 320;
    const scale = Math.max(1, Math.min(MAX_SCALE, Math.floor(room / this.scene.width)));
    this.canvas.style.width = `${this.scene.width * scale}px`;
  }

  tick(dtMs: number): void {
    if (!this.playing || !this.visible || !this.scene) return;
    if (this.t >= this.scene.to) {
      this.holding += dtMs;
      if (this.holding < HOLD_MS) return;
      this.holding = 0;
      this.t = this.scene.from;
    } else {
      this.t = Math.min(this.scene.to, this.t + dtMs / STEP_MS);
    }
    this.draw();
  }

  private draw(): void {
    if (!this.scene || !this.frame) return;
    this.scene.draw(this.frame, this.t);
    const ctx = this.canvas.getContext('2d');
    const img = this.frame.img;
    ctx?.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  }
}

/** Builds the page's cards into `main` and plays the ones on screen. */
export function mountCards(main: HTMLElement, lab: Lab, text: LabText): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cards = CARDS.map((def) => new Card(def, lab, text, !reduced));
  for (const card of cards) main.append(card.root);
  for (const card of cards) card.fit();
  const watch = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const card = cards.find((c) => c.root === e.target);
      if (card) card.visible = e.isIntersecting;
    }
  });
  for (const card of cards) watch.observe(card.root);
  const onResize = (): void => cards.forEach((c) => c.fit());
  window.addEventListener('resize', onResize);
  let last = performance.now();
  let running = true;
  const loop = (now: number): void => {
    if (!running) return;
    // A tab left in the background must not catch up in one go.
    const dt = Math.min(100, now - last);
    last = now;
    for (const card of cards) card.tick(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return () => {
    running = false;
    watch.disconnect();
    window.removeEventListener('resize', onResize);
    for (const card of cards) card.root.remove();
  };
}
