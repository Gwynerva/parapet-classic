/**
 * Per-song loudness normalisation. The original's tracks were authored for a phone
 * synthesiser and set their channel volumes very differently: the menu pad (track 1) sits
 * at a tenth of the game tracks' level, which on our synthesiser makes it inaudible. The
 * player estimates each song's loudness from its notes and the instrument gains and scales
 * the song so every track lands near the same level.
 */
import { drumFor, patchFor } from './Instruments.ts';
import type { MidiSong } from './MidiFile.ts';

/** Loudness the songs are scaled towards (the figure of a typical game track). */
export const TARGET_LOUDNESS = 700;
export const MIN_SONG_GAIN = 0.5;
export const MAX_SONG_GAIN = 4;
/** Drum hits count for at most this long, whatever their note length. */
const DRUM_DURATION_CAP_MS = 200;

/** Estimated loudness: output level × duration of every note, per second of song. */
export function estimateLoudness(song: MidiSong): number {
  if (song.durationMs <= 0) return 0;
  let energy = 0;
  for (const n of song.notes) {
    const gain = n.channel === 9 ? drumFor(n.note).gain : patchFor(n.program).gain;
    const level = (n.velocity / 127) * n.volume * gain;
    const duration = n.channel === 9 ? Math.min(n.duration, DRUM_DURATION_CAP_MS) : n.duration;
    energy += level * duration;
  }
  return energy / (song.durationMs / 1000);
}

/** Gain that brings `song` to the target loudness, within sane bounds. */
export function normalisationGain(song: MidiSong, target = TARGET_LOUDNESS): number {
  const loudness = estimateLoudness(song);
  if (loudness <= 0) return 1;
  return Math.max(MIN_SONG_GAIN, Math.min(MAX_SONG_GAIN, target / loudness));
}
