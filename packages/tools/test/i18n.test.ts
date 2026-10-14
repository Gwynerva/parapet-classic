/** The translation files against English, the fonts and the game's code (`npm run i18n`). */
import { describe, expect, it } from 'vitest';
import { collectLocales } from '@parapet/runtime/i18n/locales.ts';
import { checkLocales, hasErrors } from '../src/i18nCheck.ts';
import { fontCoverage, gameSources, loadLocales, unusedKeys } from '../src/i18nFiles.ts';

const locales = loadLocales();

describe('bundled dictionaries', () => {
  it('pass the translation checks (keys, files, arguments, glyphs)', () => {
    for (const report of checkLocales(locales, fontCoverage())) {
      expect(hasErrors(report), JSON.stringify(report, null, 2)).toBe(false);
    }
  });

  it('are complete in the maintained languages', () => {
    const reports = checkLocales(locales, fontCoverage());
    for (const code of ['en', 'ru']) {
      expect(reports.find((r) => r.code === code)?.missing, code).toEqual([]);
    }
  });

  it('hold no key the game never shows', () => {
    expect(unusedKeys(Object.keys(locales[0]!.messages), gameSources())).toEqual([]);
  });
});

describe('checks', () => {
  it('reports unknown, misplaced and argument-changing keys', () => {
    const [en, xx] = collectLocales({
      'en/meta.json': { name: 'English', englishName: 'English' },
      'en/ui.json': { 'a.one': 'Hi {name}', 'a.two': 'Two' },
      'xx/meta.json': { name: 'Xx', englishName: 'Xx' },
      'xx/game.json': { 'a.two': 'Zwei' },
      'xx/ui.json': { 'a.one': 'Hallo', 'a.three': 'Drei' },
    });
    const all = new Set(Array.from({ length: 0x500 }, (_, i) => i));
    const report = checkLocales([en!, xx!], { text: [all], display: [all] })[1]!;
    expect(report.unknown).toEqual(['a.three']);
    expect(report.misplaced).toEqual(['a.two (game.json, expected ui.json)']);
    expect(report.argumentMismatch).toEqual(['a.one: ']);
    expect(hasErrors(report)).toBe(true);
  });

  it('find keys in literals, templates and completed prefixes', () => {
    const keys = [
      'menu.ok',
      'mode.sprint',
      'boss.grove.name',
      'level.names.3',
      'hud.gone',
      'x.one',
    ];
    const source = "t('menu.ok'); t(`mode.${m}`); t(`boss.${id}.name`); 'level.names.' + n; 'x'";
    expect(unusedKeys(keys, [source])).toEqual(['hud.gone']);
  });
});
