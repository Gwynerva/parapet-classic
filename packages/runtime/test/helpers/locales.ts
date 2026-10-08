/** Reads the bundled translations and the bitmap fonts' code points from disk (Node only). */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FontCoverage } from '../../src/i18n/check.ts';
import { collectLocales, type LocaleBundle } from '../../src/i18n/locales.ts';

const here = dirname(fileURLToPath(import.meta.url));
const CONTENT_ROOT = join(here, '..', '..', '..', 'content');
export const I18N_DIR = join(CONTENT_ROOT, 'i18n');
const FONTS_DIR = join(CONTENT_ROOT, 'fonts');

export function loadLocales(): LocaleBundle[] {
  const modules: Record<string, unknown> = {};
  for (const code of readdirSync(I18N_DIR, { withFileTypes: true })) {
    if (!code.isDirectory()) continue;
    for (const file of readdirSync(join(I18N_DIR, code.name))) {
      if (!file.endsWith('.json')) continue;
      modules[`${code.name}/${file}`] = JSON.parse(
        readFileSync(join(I18N_DIR, code.name, file), 'utf8'),
      );
    }
  }
  return collectLocales(modules);
}

function codePoints(font: string): Set<number> {
  const data = JSON.parse(readFileSync(join(FONTS_DIR, `${font}.json`), 'utf8')) as {
    glyphs: Record<string, unknown>;
  };
  return new Set(Object.keys(data.glyphs).map(Number));
}

export function loadFontCoverage(): FontCoverage {
  return {
    text: [codePoints('text-12'), codePoints('text-16')],
    display: [codePoints('display-16'), codePoints('display-24')],
  };
}
