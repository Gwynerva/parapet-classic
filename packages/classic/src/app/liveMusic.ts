/**
 * The promo video's layered scores in the game (`content/music`, `LiveScore.ts`): each score is
 * its own chunk, fetched the first time it plays, and levelled with the loudness measured on the
 * dev page `dev/loudness.html` (`content/audio/live-loudness.json`).
 */
import {
  contestPlan,
  liveSong,
  menuPlan,
  type LiveScore,
} from '@parapet/runtime/audio/LiveScore.ts';
import type { MidiSong } from '@parapet/runtime/audio/MidiFile.ts';
import { liveTrack } from '@parapet/runtime/audio/MusicDirector.ts';
import loudnessJson from '@content/audio/live-loudness.json';

const scores = import.meta.glob<LiveScore>('@content/music/*.json', { import: 'default' });

/** Measured loudness of every score and plan, `<name>/<menu|contest>` → LUFS, and the common level. */
export interface LiveLoudness {
  target: number;
  tracks: Record<string, number>;
}

/** The score a live track plays. */
export async function loadLiveScore(name: string): Promise<LiveScore> {
  const load = Object.entries(scores).find(([path]) => path.endsWith(`/${name}.json`))?.[1];
  if (!load) throw new Error(`live score ${name} is not bundled`);
  return load();
}

/** The song of a live track id, levelled; null for the other tracks. */
export async function loadLiveSong(id: number): Promise<MidiSong | null> {
  const track = liveTrack(id);
  if (!track) return null;
  const score = await loadLiveScore(track.name);
  const song = liveSong(score, track.kind === 'menu' ? menuPlan(score) : contestPlan(score));
  const table = loudnessJson as LiveLoudness;
  const lufs = table.tracks[`${track.name}/${track.kind}`];
  song.gain = lufs === undefined ? 1 : Math.pow(10, (table.target - lufs) / 20);
  return song;
}
