/**
 * Translations as files: one folder per language under `content/i18n`, named by its
 * BCP 47 code, holding `meta.json` (the language's own name and its English name) and any
 * number of area files of flat dotted keys (`ui.json`, `game.json`, …). Adding a language is
 * adding a folder; nothing in the code lists the languages.
 *
 * This module only groups already loaded files (the app gets them from `import.meta.glob`,
 * tests from the file system), so it runs anywhere.
 */
import type { Messages } from './i18n.ts';

export interface LocaleMeta {
  /** The language's name in itself ("Русский"), shown in the options. */
  name: string;
  /** The language's name in English ("Russian"), used for sorting. */
  englishName: string;
}

export interface LocaleBundle {
  code: string;
  meta: LocaleMeta;
  /** All keys of the language. */
  messages: Messages;
  /** The keys of each area file, by file name without `.json`. */
  areas: Record<string, Messages>;
}

/** The language every other one falls back to and is checked against. */
export const REFERENCE_LOCALE = 'en';

const PATH = /([^/\\]+)[/\\]([^/\\]+)\.json$/;

function isMessages(value: unknown): value is Messages {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === 'string');
}

function isMeta(value: unknown): value is LocaleMeta {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['name'] === 'string' && typeof v['englishName'] === 'string';
}

/**
 * Groups `<code>/<area>.json` modules (path → parsed JSON) into languages: the reference
 * language first, then by English name. Throws on a malformed file, so a broken translation
 * fails the tests rather than the game.
 */
export function collectLocales(modules: Record<string, unknown>): LocaleBundle[] {
  const byCode = new Map<string, { meta: LocaleMeta | null; areas: Record<string, Messages> }>();
  for (const path of Object.keys(modules).sort()) {
    const match = PATH.exec(path);
    if (!match) continue;
    const code = match[1]!;
    const area = match[2]!;
    const entry = byCode.get(code) ?? { meta: null, areas: {} };
    byCode.set(code, entry);
    const value = modules[path];
    if (area === 'meta') {
      if (!isMeta(value)) throw new Error(`i18n: ${path} needs "name" and "englishName"`);
      entry.meta = { name: value.name, englishName: value.englishName };
    } else {
      if (!isMessages(value)) throw new Error(`i18n: ${path} must map keys to strings`);
      entry.areas[area] = value;
    }
  }
  const bundles: LocaleBundle[] = [];
  for (const [code, { meta, areas }] of byCode) {
    if (!meta) throw new Error(`i18n: ${code}/meta.json is missing`);
    const messages: Messages = {};
    for (const [area, keys] of Object.entries(areas)) {
      for (const [key, text] of Object.entries(keys)) {
        if (key in messages) throw new Error(`i18n: ${code} defines "${key}" twice (${area})`);
        messages[key] = text;
      }
    }
    bundles.push({ code, meta, messages, areas });
  }
  return bundles.sort((a, b) => {
    if (a.code === REFERENCE_LOCALE) return -1;
    if (b.code === REFERENCE_LOCALE) return 1;
    return a.meta.englishName.localeCompare(b.meta.englishName, 'en');
  });
}
