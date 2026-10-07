/**
 * File `l` - localisation (`void_j`, d.java line 1508): 205 strings, each `u16 len` followed by
 * `len` bytes of modified UTF-8 (Java `readUTF`). Control characters are kept as they are:
 * \x1b<n>: style/colour, \x13<n>: font, \x14 / \x15 column tabs, \x16 centred, \x19<n>: indent.
 */
import { BinaryReader } from './binary.ts';

/**
 * Decodes modified UTF-8 (as written by Java `writeUTF`): 1-3 byte sequences, U+0000 encoded as
 * C0 80, supplementary characters as two 3-byte surrogate sequences. The output is built from
 * UTF-16 code units, so surrogate pairs come out as proper characters.
 */
export function decodeModifiedUtf8(bytes: Uint8Array): string {
  const units: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    const a = bytes[i++] ?? 0;
    if (a < 0x80) {
      units.push(a);
    } else if ((a & 0xe0) === 0xc0) {
      const b = bytes[i++];
      if (b === undefined || (b & 0xc0) !== 0x80)
        throw new Error('modified UTF-8: bad 2-byte sequence');
      units.push(((a & 0x1f) << 6) | (b & 0x3f));
    } else if ((a & 0xf0) === 0xe0) {
      const b = bytes[i++];
      const c = bytes[i++];
      if (b === undefined || c === undefined || (b & 0xc0) !== 0x80 || (c & 0xc0) !== 0x80) {
        throw new Error('modified UTF-8: bad 3-byte sequence');
      }
      units.push(((a & 0x0f) << 12) | ((b & 0x3f) << 6) | (c & 0x3f));
    } else {
      throw new Error(`modified UTF-8: invalid lead byte 0x${a.toString(16)}`);
    }
  }
  let out = '';
  const CHUNK = 4096;
  for (let p = 0; p < units.length; p += CHUNK) {
    out += String.fromCharCode(...units.slice(p, p + CHUNK));
  }
  return out;
}

/** Reads `u16 len` + modified UTF-8 strings from `offset` to the end of the file. */
export function decodeStrings(bytes: Uint8Array, offset = 0): string[] {
  const r = new BinaryReader(bytes, 'l');
  r.skip(offset);
  const strings: string[] = [];
  while (!r.atEnd) {
    const length = r.u16();
    strings.push(decodeModifiedUtf8(r.take(length)));
  }
  r.assertAtEnd();
  return strings;
}
