/**
 * The race page (`r/?<code>`) as search engines and screen readers see it. The page is one for
 * every race (`vite.config.ts`, `racePage`), and chat previews only ever read that: a static
 * host cannot serve a picture per run. Engines that run the page's script do see more: once a
 * link's replay has been re-run, the title, the description and the canonical address become
 * the race's own, and a line of text over the canvas (visible to screen readers only) says
 * who challenges, where and with what. A race page with nothing it can run asks to stay out of
 * the index.
 */
import { RACE_FOLDER } from '@parapet/runtime/app/replayFile.ts';

const SUMMARY_ID = 'race-summary';

/** Whether this page is the race page (the game one folder down). */
export function isRacePage(): boolean {
  return location.pathname.endsWith(`/${RACE_FOLDER}`);
}

/** The race of the link (`code`) becomes what the page is about. */
export function describeRace(code: string, title: string, description: string): void {
  if (!isRacePage()) return;
  document.title = title;
  headElement('meta', 'name', 'description').setAttribute('content', description);
  headElement('link', 'rel', 'canonical').setAttribute(
    'href',
    `${location.origin}${location.pathname}?${code}`,
  );
  let summary = document.getElementById(SUMMARY_ID);
  if (!summary) {
    summary = document.createElement('p');
    summary.id = SUMMARY_ID;
    // Read by screen readers and search engines, never drawn over the game.
    const s = summary.style;
    s.position = 'absolute';
    s.width = '1px';
    s.height = '1px';
    s.overflow = 'hidden';
    s.clipPath = 'inset(50%)';
    s.whiteSpace = 'nowrap';
    document.body.appendChild(summary);
  }
  summary.textContent = description;
}

/** A race page without a race it can run (no code, or a broken one) stays out of the index. */
export function keepOutOfSearch(): void {
  if (isRacePage()) headElement('meta', 'name', 'robots').setAttribute('content', 'noindex');
}

/** The head's `<tag attr="value">`, made when the page has none. */
function headElement(tag: 'meta' | 'link', attr: string, value: string): Element {
  const found = document.head.querySelector(`${tag}[${attr}="${value}"]`);
  if (found) return found;
  const el = document.createElement(tag);
  el.setAttribute(attr, value);
  document.head.appendChild(el);
  return el;
}
