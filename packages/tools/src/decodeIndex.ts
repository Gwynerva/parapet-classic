/**
 * File `i` - the index (read by `l()`, d.java line 1239):
 *
 *   16 bytes  sound types: byte 2+n is the type of sound n (1 = MIDI); bytes 0-1 unused
 *   593 x i16 S[]  key codes, string groups, sprite slots, sound groups, menus
 *   166 x i32 D[]  string-group offsets, MIDI offsets / durations / lengths, blob directory
 */
import { BinaryReader } from './binary.ts';
import { at } from './util.ts';

export const INDEX_SOUND_TYPE_COUNT = 16;
export const INDEX_SHORT_COUNT = 593;
export const INDEX_INT_COUNT = 166;

/** S[35 + g] = first image slot of sprite file g (10 entries: 9 files plus the end). */
export const FILE_SLOT_BASE = 35;
export const SPRITE_FILE_COUNT = 9;
/** S[45 + id] = image slot of sprite id (the slots after it hold its transformed copies). */
export const SPRITE_SLOT_BASE = 45;
/** S[30 + k] = first string of string group k (5 entries: 4 groups plus the end). */
export const STRING_GROUP_BASE = 30;

/** D[0..3] = byte offsets of the string groups inside `l`. */
export const STRING_GROUP_OFFSET_BASE = 0;
/** D[4 + n] / D[18 + n] / D[32 + n] = offset in `s`, duration in ms, length of MIDI n. */
export const MIDI_OFFSET_BASE = 4;
export const MIDI_DURATION_BASE = 18;
export const MIDI_LENGTH_BASE = 32;
export const MIDI_COUNT = 14;
/** D[46 + 3k .. 48 + 3k] = (b-file, offset, length) of blob k. */
export const BLOB_DIRECTORY_BASE = 46;
export const BLOB_COUNT = 40;

export type BlobFile = 0 | 1 | 2;

export interface BlobLocation {
  id: number;
  file: BlobFile;
  offset: number;
  length: number;
}

export interface GameIndex {
  soundTypes: number[];
  shorts: number[];
  ints: number[];
  blobs: BlobLocation[];
}

export function decodeIndex(bytes: Uint8Array): GameIndex {
  const r = new BinaryReader(bytes, 'i');
  const soundTypes: number[] = [];
  for (let n = 0; n < INDEX_SOUND_TYPE_COUNT; n++) soundTypes.push(r.u8());
  const shorts: number[] = [];
  for (let n = 0; n < INDEX_SHORT_COUNT; n++) shorts.push(r.i16());
  const ints: number[] = [];
  for (let n = 0; n < INDEX_INT_COUNT; n++) ints.push(r.i32());
  r.assertAtEnd();

  const blobs: BlobLocation[] = [];
  for (let k = 0; k < BLOB_COUNT; k++) {
    const file = at(ints, BLOB_DIRECTORY_BASE + 3 * k, 'D');
    const offset = at(ints, BLOB_DIRECTORY_BASE + 3 * k + 1, 'D');
    const length = at(ints, BLOB_DIRECTORY_BASE + 3 * k + 2, 'D');
    if (file !== 0 && file !== 1 && file !== 2) {
      throw new Error(`index: blob ${k} refers to unknown file b${file}`);
    }
    if (offset < 0 || length < 0) throw new Error(`index: blob ${k} has a negative location`);
    blobs.push({ id: k, file, offset, length });
  }
  return { soundTypes, shorts, ints, blobs };
}

/** Image slot of a sprite id. */
export function spriteSlot(index: GameIndex, spriteId: number): number {
  return at(index.shorts, SPRITE_SLOT_BASE + spriteId, 'S');
}

/** First image slot of sprite file `g` (g = 9 gives the end of the last file). */
export function fileFirstSlot(index: GameIndex, file: number): number {
  return at(index.shorts, FILE_SLOT_BASE + file, 'S');
}
