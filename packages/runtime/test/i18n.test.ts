import { describe, expect, it } from 'vitest';
import en from '../../content-classic/i18n/en.json';
import ru from '../../content-classic/i18n/ru.json';
import {
  I18n,
  fallbackPluralCategory,
  flattenMessages,
  formatMessage,
  pluralCategory,
  resolveLocale,
} from '../src/i18n/i18n.ts';

const RU_CASES: [number, string][] = [
  [1, 'one'],
  [2, 'few'],
  [5, 'many'],
  [11, 'many'],
  [21, 'one'],
  [22, 'few'],
  [0, 'many'],
  [100, 'many'],
  [101, 'one'],
  [112, 'many'],
  [1.5, 'other'],
];

const EN_CASES: [number, string][] = [
  [1, 'one'],
  [2, 'other'],
  [0, 'other'],
  [21, 'other'],
];

describe('plural categories', () => {
  it('ru via Intl.PluralRules', () => {
    for (const [n, category] of RU_CASES) expect(pluralCategory('ru', n), String(n)).toBe(category);
  });

  it('en via Intl.PluralRules', () => {
    for (const [n, category] of EN_CASES) expect(pluralCategory('en', n), String(n)).toBe(category);
  });

  it('built-in fallback agrees with Intl for ru and en', () => {
    for (const [n, category] of RU_CASES) {
      expect(fallbackPluralCategory('ru', n), String(n)).toBe(category);
      expect(fallbackPluralCategory('ru-RU', n), String(n)).toBe(category);
    }
    for (const [n, category] of EN_CASES) expect(fallbackPluralCategory('en', n)).toBe(category);
  });
});

describe('message format', () => {
  it('interpolates named arguments', () => {
    expect(formatMessage('Hello {name}, you have {n} apples', { name: 'Ann', n: 3 })).toBe(
      'Hello Ann, you have 3 apples',
    );
    expect(formatMessage('{missing}', {})).toBe('{missing}');
  });

  it('selects plural branches, exact matches and offsets', () => {
    const pattern = '{n, plural, =0 {no apples} one {# apple} other {# apples}}';
    expect(formatMessage(pattern, { n: 0 })).toBe('no apples');
    expect(formatMessage(pattern, { n: 1 })).toBe('1 apple');
    expect(formatMessage(pattern, { n: 7 })).toBe('7 apples');
    const offset =
      '{n, plural, offset:1 =0 {nobody} =1 {you} one {you and # other} other {you and # others}}';
    expect(formatMessage(offset, { n: 2 })).toBe('you and 1 other');
    expect(formatMessage(offset, { n: 5 })).toBe('you and 4 others');
    expect(formatMessage(offset, { n: 1 })).toBe('you');
  });

  it('selects by key', () => {
    const pattern = '{g, select, female {her} male {his} other {their}} bag';
    expect(formatMessage(pattern, { g: 'female' })).toBe('her bag');
    expect(formatMessage(pattern, { g: 'robot' })).toBe('their bag');
    expect(formatMessage(pattern, {})).toBe('their bag');
  });

  it('keeps apostrophes literal and honours ICU quoting of braces', () => {
    expect(formatMessage("Don't stop", {})).toBe("Don't stop");
    expect(formatMessage("'{'literal'}' and ''quoted''", {})).toBe("{literal} and 'quoted'");
    expect(formatMessage("{n, plural, other {'#' is #}}", { n: 4 })).toBe('# is 4');
  });

  it('rejects malformed patterns', () => {
    expect(() => formatMessage('{n, plural, one {x}}', { n: 1 })).toThrow(/other/);
    expect(() => formatMessage('{open', {})).toThrow();
    expect(() => formatMessage('close}', {})).toThrow();
  });
});

describe('I18n', () => {
  const i18n = new I18n({ en, ru }, { locale: 'en' });

  it('exposes locales and resolves region tags', () => {
    expect(i18n.availableLocales).toEqual(['en', 'ru']);
    expect(i18n.locale).toBe('en');
    expect(i18n.setLocale('ru-RU')).toBe(true);
    expect(i18n.locale).toBe('ru');
    expect(i18n.setLocale('xx')).toBe(false);
    expect(i18n.locale).toBe('ru');
    expect(resolveLocale(['en', 'ru'], ['de-DE', 'ru-UA'])).toBe('ru');
    expect(resolveLocale(['en', 'ru'], ['de'])).toBeUndefined();
    i18n.setLocale('en');
  });

  it('formats Russian plurals used by the results screen', () => {
    i18n.setLocale('ru');
    const flags = [
      [1, '1 флаг'],
      [2, '2 флага'],
      [5, '5 флагов'],
      [11, '11 флагов'],
      [21, '21 флаг'],
      [22, '22 флага'],
    ] as const;
    for (const [n, text] of flags) expect(i18n.t('results.flags', { n })).toBe(text);
    const attempts = [
      [1, '1 попытка'],
      [2, '2 попытки'],
      [5, '5 попыток'],
      [11, '11 попыток'],
      [21, '21 попытка'],
      [22, '22 попытки'],
    ] as const;
    for (const [n, text] of attempts) expect(i18n.t('results.attempts', { n })).toBe(text);
    expect(i18n.t('hud.flagsLeft', { n: 3 })).toBe('Осталось 3 флага');
    expect(i18n.t('level.locked', { n: 1 })).toBe(
      'Чтобы открыть этот уровень, выполни еще 1 миссию.',
    );
    i18n.setLocale('en');
  });

  it('formats English plurals', () => {
    expect(i18n.t('results.flags', { n: 1 })).toBe('1 flag');
    expect(i18n.t('results.flags', { n: 2 })).toBe('2 flags');
    expect(i18n.t('results.attempts', { n: 1 })).toBe('1 attempt');
    expect(i18n.t('results.attempts', { n: 2 })).toBe('2 attempts');
    expect(i18n.t('player.numbered', { n: 3 })).toBe('Player 3');
  });

  it('falls back to English for missing keys and to the key for unknown ones', () => {
    const partial = new I18n({ en: { 'a.b': 'AB', only: 'EN' }, ru: { 'a.b': 'АБ' } });
    partial.setLocale('ru');
    expect(partial.t('a.b')).toBe('АБ');
    expect(partial.t('only')).toBe('EN');
    expect(partial.t('nope')).toBe('nope');
    expect(partial.has('only')).toBe(false);
  });

  it('accepts nested dictionaries', () => {
    expect(flattenMessages({ menu: { start: 'Start', sub: { x: 'X' } }, top: 'T' })).toEqual({
      'menu.start': 'Start',
      'menu.sub.x': 'X',
      top: 'T',
    });
    const nested = new I18n({ en: { menu: { start: 'Start' } } });
    expect(nested.t('menu.start')).toBe('Start');
  });

  it('notifies listeners on locale change', () => {
    const seen: string[] = [];
    const off = i18n.onChange((locale) => seen.push(locale));
    i18n.setLocale('ru');
    i18n.setLocale('ru');
    i18n.setLocale('en');
    off();
    i18n.setLocale('ru');
    i18n.setLocale('en');
    expect(seen).toEqual(['ru', 'en']);
  });
});

describe('bundled dictionaries', () => {
  it('have the same keys in en and ru', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(en).length).toBeGreaterThan(150);
  });

  it('contain the keys the UI relies on', () => {
    for (const key of [
      'menu.start',
      'menu.records',
      'mode.sprint',
      'mode.flags',
      'mode.score',
      'mode.free',
      'level.names.0',
      'level.names.11',
      'hud.time',
      'results.newRecord',
      'results.flags',
      'results.attempts',
      'moves.run',
      'moves.poleSpin.desc',
      'hints.wallTurn',
      'hints.landing',
    ]) {
      expect(en[key as keyof typeof en], key).toBeTypeOf('string');
    }
  });

  it('parse and format in both locales', () => {
    const params = { n: 2, name: 'x', value: 'v', rank: 1 };
    for (const [locale, messages] of [
      ['en', en],
      ['ru', ru],
    ] as const) {
      for (const [key, pattern] of Object.entries(messages)) {
        expect(() => formatMessage(pattern, params, locale), `${locale}:${key}`).not.toThrow();
        // Newlines are fine (multi-line texts); other control characters are not.
        expect(formatMessage(pattern, params, locale), `${locale}:${key}`).not.toMatch(
          /[\x00-\x09\x0b-\x1f]/,
        );
      }
    }
  });

  it('kept no control codes from the original strings', () => {
    for (const value of Object.values(ru)) expect(value).not.toMatch(/[\x13-\x1c]/);
  });
});
