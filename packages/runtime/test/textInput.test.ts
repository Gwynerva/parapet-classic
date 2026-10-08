import { describe, expect, it } from 'vitest';
import { filterText } from '../src/ui/TextInputOverlay.ts';

/** Letters of Latin and Cyrillic, digits and the joiners: what a runner's name may hold. */
const name = (ch: string): boolean => /^[\p{L}\p{N}]$/u.test(ch) || ' -_.'.includes(ch);

describe('filterText', () => {
  it('keeps letters of any script it is given, spaces and joiners', () => {
    expect(filterText('Вася Пупкин_99', 14, name, true)).toEqual({
      value: 'Вася Пупкин_99',
      caret: 14,
    });
  });

  it('drops what is not allowed, the caret staying among the characters kept', () => {
    // "Ва|ся" with "<b>!" pasted at the caret: the caret ends after what was pasted.
    expect(filterText('Ва<b>!ся', 6, name, true)).toEqual({ value: 'Ваbся', caret: 3 });
    // A pasted emoji (two UTF-16 units) disappears without moving the text after it.
    expect(filterText('Blaise😀 x', 8, name, true)).toEqual({ value: 'Blaise x', caret: 6 });
  });

  it('folds runs of spaces and drops a leading one', () => {
    expect(filterText('  Jean   Luc ', 13, name, true)).toEqual({ value: 'Jean Luc ', caret: 9 });
    // Tabs and line breaks pasted in are spaces too.
    expect(filterText('a\tb\nc', 5, name, true)).toEqual({ value: 'a b c', caret: 5 });
  });

  it('leaves spaces alone without singleSpaces, drops them when they are not allowed', () => {
    expect(filterText('a  b', 4, name, false).value).toBe('a  b');
    expect(filterText('a b', 3, (ch) => ch !== ' ', false)).toEqual({ value: 'ab', caret: 2 });
  });
});
