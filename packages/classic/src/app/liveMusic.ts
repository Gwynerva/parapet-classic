/**
 * Our scores in the game (`content/music`, `LiveScore.ts`): each score is its own chunk,
 * fetched the first time it plays, and levelled with the loudness measured on the dev page
 * `dev/live.html` (`content/audio/live-loudness.json`).
 */
import { liveSong, planFor, type LiveScore } from '@parapet/runtime/audio/LiveScore.ts';
import { tableGain, type LoudnessTable } from '@parapet/runtime/audio/LoudnessMeter.ts';
import type { MidiSong } from '@parapet/runtime/audio/MidiFile.ts';
import { liveTrackOf } from '@parapet/runtime/audio/MusicDirector.ts';
import loudnessJson from '@content/audio/live-loudness.json';

const scores = import.meta.glob<LiveScore>('@content/music/*.json', { import: 'default' });

/** The score of a track. */
export async function loadLiveScore(name: string): Promise<LiveScore> {
  const load = Object.entries(scores).find(([path]) => path.endsWith(`/${name}.json`))?.[1];
  if (!load) throw new Error(`score ${name} is not bundled`);
  return load();
}

/** The song of a live track id, levelled; null for the original's tracks. */
export async function loadLiveSong(id: number): Promise<MidiSong | null> {
  const track = liveTrackOf(id);
  if (!track) return null;
  const score = await loadLiveScore(track.name);
  const song = liveSong(score, planFor(score, track.kind));
  song.gain = tableGain(loudnessJson as LoudnessTable, `${track.name}/${track.kind}`) ?? 1;
  return song;
}
