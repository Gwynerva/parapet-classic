import { describe, expect, it } from 'vitest';
import { decodeModifiedUtf8, decodeStrings } from '../src/decodeStrings.ts';
import { index, jar } from './helpers.ts';

describe('localisation strings (file l)', () => {
  it('decodes 205 strings and consumes the file', () => {
    const strings = decodeStrings(jar().read('l'), index().ints[0]);
    expect(strings.length).toBe(205);
    expect(strings[97]).toBe('Mill Brook');
    expect(strings[141]).toContain('RLI_HELPTEXT');
    for (const s of strings) expect(typeof s).toBe('string');
  });

  it('decodes modified UTF-8 including the C0 80 null and surrogate pairs', () => {
    expect(decodeModifiedUtf8(Uint8Array.of(0x41, 0xc0, 0x80, 0x42))).toBe('A\u0000B');
    expect(decodeModifiedUtf8(Uint8Array.of(0xd0, 0x91, 0xd0, 0xb5, 0xd0, 0xb3))).toBe('Бег');
    // U+1F600 as two 3-byte surrogate sequences (CESU-8)
    expect(decodeModifiedUtf8(Uint8Array.of(0xed, 0xa0, 0xbd, 0xed, 0xb8, 0x80))).toBe('\u{1F600}');
    expect(() => decodeModifiedUtf8(Uint8Array.of(0xf0, 0x9f, 0x98, 0x80))).toThrow();
  });
});
