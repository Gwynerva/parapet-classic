/**
 * Checks of the translation files against the reference language (`en`), shared by the tests
 * and `npm run i18n -- check`:
 *
 * - a key the reference does not have, or that sits in another area file than in the
 *   reference, is an error (it would never be shown, or the files drift apart);
 * - a pattern must parse and use the same arguments as the reference (a translation that drops
 *   `{name}` loses the name, one that adds `{foo}` prints it literally);
 * - every character must exist in the bitmap fonts the game draws with: all of them in the
 *   text fonts, and the letters in the display fonts (headings and names);
 * - missing keys are allowed (they fall back to English) but reported.
 */
import { messageArguments, messageText } from './i18n.ts';
import { REFERENCE_LOCALE, type LocaleBundle } from './locales.ts';

export interface FontCoverage {
  /** Code points of the text fonts (every character must be in all of them). */
  text: readonly ReadonlySet<number>[];
  /** Code points of the display fonts (letters must be in all of them). */
  display: readonly ReadonlySet<number>[];
}

export interface LocaleReport {
  code: string;
  /** Reference keys the language lacks (shown in English). */
  missing: string[];
  /** Keys the reference does not have. */
  unknown: string[];
  /** Keys in another area file than in the reference: `key (file, expected file)`. */
  misplaced: string[];
  /** Keys whose arguments differ from the reference: `key: {a} {b}`. */
  argumentMismatch: string[];
  /** Keys whose pattern does not parse, with the error. */
  broken: string[];
  /** Characters the fonts cannot draw, with a key that uses them. */
  missingGlyphs: string[];
}

export function hasErrors(report: LocaleReport): boolean {
  return (
    report.unknown.length > 0 ||
    report.misplaced.length > 0 ||
    report.argumentMismatch.length > 0 ||
    report.broken.length > 0 ||
    report.missingGlyphs.length > 0
  );
}

function areaOf(bundle: LocaleBundle): Map<string, string> {
  const out = new Map<string, string>();
  for (const [area, keys] of Object.entries(bundle.areas)) {
    for (const key of Object.keys(keys)) out.set(key, area);
  }
  return out;
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

const LETTER = /\p{L}/u;

export function checkLocale(
  bundle: LocaleBundle,
  reference: LocaleBundle,
  fonts: FontCoverage,
): LocaleReport {
  const report: LocaleReport = {
    code: bundle.code,
    missing: [],
    unknown: [],
    misplaced: [],
    argumentMismatch: [],
    broken: [],
    missingGlyphs: [],
  };
  const refArea = areaOf(reference);
  const ownArea = areaOf(bundle);
  for (const key of refArea.keys()) if (!ownArea.has(key)) report.missing.push(key);
  const glyphs = new Map<string, string>();
  for (const [key, area] of ownArea) {
    const expected = refArea.get(key);
    if (expected === undefined) {
      report.unknown.push(key);
      continue;
    }
    if (expected !== area)
      report.misplaced.push(`${key} (${area}.json, expected ${expected}.json)`);
    const pattern = bundle.messages[key]!;
    let args: Set<string>;
    let text: string;
    try {
      args = messageArguments(pattern);
      text = messageText(pattern);
    } catch (error) {
      report.broken.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (bundle !== reference) {
      const refArgs = messageArguments(reference.messages[key]!);
      if (!sameSet(args, refArgs)) {
        report.argumentMismatch.push(`${key}: ${[...args].map((a) => `{${a}}`).join(' ')}`);
      }
    }
    for (const ch of text) {
      if (ch === '\n' || glyphs.has(ch)) continue;
      const cp = ch.codePointAt(0)!;
      const inText = fonts.text.every((f) => f.has(cp));
      const inDisplay = !LETTER.test(ch) || fonts.display.every((f) => f.has(cp));
      if (!inText || !inDisplay) glyphs.set(ch, key);
    }
  }
  for (const [ch, key] of glyphs) {
    const cp = ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
    report.missingGlyphs.push(`"${ch}" U+${cp} (${key})`);
  }
  return report;
}

/** Reports for every language, the reference first. */
export function checkLocales(
  bundles: readonly LocaleBundle[],
  fonts: FontCoverage,
): LocaleReport[] {
  const reference = bundles.find((b) => b.code === REFERENCE_LOCALE);
  if (!reference) throw new Error(`i18n: the reference language ${REFERENCE_LOCALE} is missing`);
  return bundles.map((b) => checkLocale(b, reference, fonts));
}
