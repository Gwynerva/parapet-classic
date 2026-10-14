/**
 * The translation files and the code that shows them, read from disk for `npm run i18n` and the
 * tests.
 *
 * Which dictionary keys the game's code uses: a key counts as used when a source file names it
 * in a string literal, or in a template literal whose `${…}` parts may stand for anything
 * (`` `mode.${mode}` `` uses every `mode.*` key), or in a literal ending with a dot that the
 * code completes (`'level.names.' + id`). Plural forms (`key.one`, `key.other`…) belong to
 * their key.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { collectLocales, type LocaleBundle } from '@parapet/runtime/i18n/locales.ts';
import type { FontCoverage } from './i18nCheck.ts';
import { CONTENT_DIR, FONTS_DIR, PACKAGES_DIR, readJson } from './files.ts';

export const I18N_DIR = join(CONTENT_DIR, 'i18n');

/** Every language's dictionaries (`i18n/<code>/*.json`), English first. */
export function loadLocales(): LocaleBundle[] {
  const modules: Record<string, unknown> = {};
  for (const code of readdirSync(I18N_DIR, { withFileTypes: true })) {
    if (!code.isDirectory()) continue;
    for (const file of readdirSync(join(I18N_DIR, code.name))) {
      if (!file.endsWith('.json')) continue;
      const path = join(I18N_DIR, code.name, file);
      try {
        modules[`${code.name}/${file}`] = JSON.parse(readFileSync(path, 'utf8'));
      } catch (error) {
        throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return collectLocales(modules);
}

/** The code points the game's bitmap fonts can draw. */
export function fontCoverage(): FontCoverage {
  const points = (font: string): Set<number> => {
    const data = readJson<{ glyphs: Record<string, unknown> }>(join(FONTS_DIR, `${font}.json`));
    return new Set(Object.keys(data.glyphs).map(Number));
  };
  return {
    text: [points('text-12'), points('text-16')],
    display: [points('display-16'), points('display-24')],
  };
}

const PLURAL = /\.(zero|one|two|few|many|other)$/;

/** The patterns a source text names keys with. */
export function keyPatterns(source: string): { exact: Set<string>; patterns: RegExp[] } {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];
  for (const m of source.matchAll(/'([A-Za-z][\w.-]*)'|"([A-Za-z][\w.-]*)"/g)) {
    const text = m[1] ?? m[2]!;
    if (text.endsWith('.')) patterns.push(new RegExp(`^${escape(text)}.+$`));
    else exact.add(text);
  }
  for (const m of source.matchAll(/`([^`]*)`/g)) {
    const body = m[1]!;
    if (!body.includes('${') || !/^[A-Za-z]/.test(body)) continue;
    const parts = body.split(/\$\{[^}]*\}/);
    if (!parts.every((p) => /^[\w.-]*$/.test(p))) continue;
    patterns.push(new RegExp(`^${parts.map(escape).join('.+?')}$`));
  }
  return { exact, patterns };
}

/** The keys of `keys` no source names. */
export function unusedKeys(keys: readonly string[], sources: readonly string[]): string[] {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];
  for (const source of sources) {
    const found = keyPatterns(source);
    for (const k of found.exact) exact.add(k);
    patterns.push(...found.patterns);
  }
  return keys.filter((key) => {
    const base = key.replace(PLURAL, '');
    return !exact.has(base) && !patterns.some((p) => p.test(base));
  });
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Every TypeScript source of the code that shows the texts (the game and its runtime). */
export function gameSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.ts')) out.push(readFileSync(path, 'utf8'));
    }
  };
  for (const pkg of ['classic', 'runtime']) walk(join(PACKAGES_DIR, pkg, 'src'));
  return out;
}
