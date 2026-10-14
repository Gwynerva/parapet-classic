/**
 * The Lab (`lab/index.html`): the findings about the original as experiments to play with. The
 * language is the game's (its saved choice, else the browser's), and choosing one here chooses
 * it for the game too.
 */
import { detectLocale } from '@parapet/runtime/i18n/i18n.ts';
import { loadOptions, saveOptions } from '@parapet/runtime/storage/profile.ts';
import { findingsUrl } from '../app/links.ts';
import type { Lab } from '@parapet/lab/lab.ts';
import { loadLab } from './content.ts';
import { mountCards } from './page.ts';
import { LANGUAGES, type LabText } from './text.ts';
import './lab.css';

const CODES = LANGUAGES.map(([code]) => code);

function startLanguage(): string {
  const saved = loadOptions().locale;
  return CODES.includes(saved) ? saved : detectLocale(CODES, 'en');
}

function textOf(code: string): LabText {
  return (LANGUAGES.find(([c]) => c === code) ?? LANGUAGES[0]!)[1];
}

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

async function start(): Promise<void> {
  const root = document.getElementById('lab');
  if (!root) return;
  let code = startLanguage();
  const status = el('p', { class: 'status' }, textOf(code).loading);
  root.replaceChildren(status);
  // A Lab per language: the levels' names are in it.
  const labs = new Map<string, Promise<Lab>>();
  const labIn = (c: string): Promise<Lab> => {
    let lab = labs.get(c);
    if (!lab) {
      lab = loadLab(c);
      labs.set(c, lab);
    }
    return lab;
  };
  let unmount = (): void => {};
  const render = async (): Promise<void> => {
    let lab: Lab;
    try {
      lab = await labIn(code);
    } catch (err) {
      status.textContent = textOf(code).failed;
      console.error(err);
      return;
    }
    unmount();
    const text = textOf(code);
    document.documentElement.lang = code;
    document.title = `${text.title}. ${text.subtitle} · Parapet Classic`;
    const languages = el('nav', { class: 'languages', 'aria-label': 'Language' });
    for (const [c, t] of LANGUAGES) {
      const b = el('button', { type: 'button', lang: c }, t.lang);
      b.setAttribute('aria-pressed', String(c === code));
      b.addEventListener('click', () => {
        if (c === code) return;
        code = c;
        saveOptions({ locale: c });
        void render();
      });
      languages.append(b);
    }
    const header = el(
      'header',
      {},
      languages,
      el('h1', {}, text.title),
      el('p', { class: 'subtitle' }, text.subtitle),
      el('p', {}, text.intro),
      el(
        'p',
        { class: 'links' },
        el('a', { href: '../' }, text.backToGame),
        ' · ',
        el('a', { href: findingsUrl(), rel: 'noopener' }, text.allFindings),
      ),
    );
    const main = el('main');
    const footer = el('footer', {}, el('p', {}, text.rights));
    root.replaceChildren(header, main, footer);
    unmount = mountCards(main, lab, text);
  };
  await render();
  // The cards come after the page has loaded: a link to one (`#vault`) is followed by hand.
  const target = location.hash ? document.getElementById(location.hash.slice(1)) : null;
  target?.scrollIntoView();
}

void start();
