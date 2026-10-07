/**
 * File `s` - 14 standard MIDI files back to back. Offsets, lengths and durations come from the
 * index: D[4 + n], D[32 + n] and D[18 + n] (`void_e`, d.java line 866).
 */
import type { GameIndex } from './decodeIndex.ts';
import {
  MIDI_COUNT,
  MIDI_DURATION_BASE,
  MIDI_LENGTH_BASE,
  MIDI_OFFSET_BASE,
} from './decodeIndex.ts';
import { at } from './util.ts';

export interface MidiTrack {
  id: number;
  offset: number;
  length: number;
  /** Duration in milliseconds as stored in the index (0 for the splash jingle). */
  duration: number;
  data: Uint8Array;
}

const MTHD = [0x4d, 0x54, 0x68, 0x64]; // "MThd"

export function splitMidi(bytes: Uint8Array, index: GameIndex): MidiTrack[] {
  const tracks: MidiTrack[] = [];
  for (let n = 0; n < MIDI_COUNT; n++) {
    const offset = at(index.ints, MIDI_OFFSET_BASE + n, 'D');
    const length = at(index.ints, MIDI_LENGTH_BASE + n, 'D');
    const duration = at(index.ints, MIDI_DURATION_BASE + n, 'D');
    if (offset < 0 || length < 0 || offset + length > bytes.length) {
      throw new RangeError(
        `s: MIDI ${n} at ${offset}+${length} overruns the ${bytes.length}-byte file`,
      );
    }
    const data = bytes.subarray(offset, offset + length);
    for (let i = 0; i < MTHD.length; i++) {
      if (data[i] !== MTHD[i])
        throw new Error(`s: MIDI ${n} at ${offset} does not start with MThd`);
    }
    tracks.push({ id: n, offset, length, duration, data });
  }
  return tracks;
}
