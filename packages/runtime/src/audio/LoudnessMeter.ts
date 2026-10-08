/**
 * Measuring how loud a track really sounds on our synthesiser: the song is rendered offline
 * (OfflineAudioContext, in a browser) and its integrated loudness computed as broadcast
 * meters do (ITU-R BS.1770: K-weighting, 400 ms blocks, absolute and relative gates). The
 * dev page `packages/classic/dev/loudness.html` measures every track and stores the table the
 * player levels the tracks with (`packages/content/audio/loudness.json`).
 */
import { drumFor, PATCH_COUNT, patchFor } from './Instruments.ts';
import { songEvents, type MidiSong } from './MidiFile.ts';
import { Synth, SYNTH_VERSION } from './Synth.ts';

/** Sample rate the K-weighting coefficients below are given for. */
export const METER_RATE = 48000;

/** Pre-filter (high shelf) and RLB high-pass of BS.1770 at 48 kHz: [b0, b1, b2, a1, a2]. */
const SHELF = [
  1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585,
];
const HIGHPASS = [1, -2, 1, -1.99004745483398, 0.99007225036621];

function biquad(input: Float32Array, c: readonly number[]): Float32Array {
  const [b0, b1, b2, a1, a2] = c as [number, number, number, number, number];
  const out = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i]!;
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

/**
 * Integrated loudness (LUFS) of 48 kHz audio, one array per channel (left and right count
 * equally). Returns -Infinity for silence.
 */
export function integratedLoudness(channels: readonly Float32Array[]): number {
  const weighted = channels.map((ch) => biquad(biquad(ch, SHELF), HIGHPASS));
  const length = weighted[0]?.length ?? 0;
  const block = Math.round(0.4 * METER_RATE);
  const hop = Math.round(0.1 * METER_RATE);
  const energies: number[] = [];
  for (let start = 0; start + block <= length; start += hop) {
    let sum = 0;
    for (const ch of weighted) {
      let s = 0;
      for (let i = start; i < start + block; i++) s += ch[i]! * ch[i]!;
      sum += s / block;
    }
    energies.push(sum);
  }
  const lufs = (e: number): number => -0.691 + 10 * Math.log10(e);
  const mean = (list: number[]): number => list.reduce((a, b) => a + b, 0) / list.length;
  const audible = energies.filter((e) => e > 0 && lufs(e) > -70);
  if (audible.length === 0) return -Infinity;
  const relative = lufs(mean(audible)) - 10;
  const gated = audible.filter((e) => lufs(e) > relative);
  return lufs(mean(gated));
}

/** A stable fingerprint of the synthesiser's sound: version and every patch. */
export function synthFingerprint(): string {
  const patches = Array.from({ length: PATCH_COUNT }, (_, i) => patchFor(i));
  const drums = Array.from({ length: 128 }, (_, k) => drumFor(k));
  const text = JSON.stringify([patches, drums]);
  // FNV-1a, 32 bits.
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${SYNTH_VERSION}-${hash.toString(16).padStart(8, '0')}`;
}

/** Length of a rendered piece, seconds (a whole song at once is slow: every note's nodes live
 * until the end of the rendering). */
const PIECE_S = 3;

/**
 * Renders one pass of a song at 48 kHz, stereo, at gain 1 (browsers only), in short pieces.
 * Each piece starts early enough to hear the notes still ringing into it (the longest note),
 * with the channel volumes the song has by then; that lead-in is cut away.
 */
export async function renderSong(song: MidiSong, tailSeconds = 1.5): Promise<Float32Array[]> {
  const total = song.durationMs / 1000 + tailSeconds;
  const frames = Math.ceil(total * METER_RATE);
  const out = [new Float32Array(frames), new Float32Array(frames)];
  const events = songEvents(song);
  const controlled = (song.controls?.length ?? 0) > 0;
  for (let start = 0; start < total; start += PIECE_S) {
    // Start early enough for the notes still sounding at `start` (and their release).
    let from = start;
    for (const n of song.notes) {
      const t = n.time / 1000;
      if (t >= start) break;
      if (t + n.duration / 1000 + 0.5 > start) from = Math.min(from, t);
    }
    from = Math.max(0, from - 0.05);
    const to = Math.min(total, start + PIECE_S);
    const ctx = new OfflineAudioContext(2, Math.ceil((to - from) * METER_RATE), METER_RATE);
    const synth = new Synth(ctx, ctx.destination);
    synth.channelVolumes = controlled;
    synth.resetChannels(0);
    // The channel volumes as the song has set them by `from`.
    const volumes = new Map<number, number>();
    for (const e of events) {
      if (e.time / 1000 >= from) break;
      if (e.control) volumes.set(e.control.channel, e.control.volume);
    }
    for (const [channel, volume] of volumes) synth.controlAt({ time: 0, channel, volume }, 0);
    for (const e of events) {
      const at = e.time / 1000 - from;
      if (at < 0) continue;
      if (at >= to - from) break;
      if (e.note) synth.noteAt(e.note, at);
      else if (e.control) synth.controlAt(e.control, at);
    }
    const buffer = await ctx.startRendering();
    const skip = Math.round((start - from) * METER_RATE);
    const offset = Math.round(start * METER_RATE);
    for (let c = 0; c < 2; c++) {
      const piece = buffer.getChannelData(c).subarray(skip);
      out[c]!.set(piece.subarray(0, Math.max(0, frames - offset)), offset);
    }
  }
  return out;
}

/** The measured loudness of the tracks: what `loudness.json` holds. */
export interface LoudnessTable {
  /** `synthFingerprint()` at the time of measuring. */
  synth: string;
  /** Loudness every track is levelled to (LUFS). */
  target: number;
  /** Track id → integrated loudness (LUFS) at gain 1. */
  tracks: Record<string, number>;
}

export const MIN_TRACK_GAIN = 0.25;
export const MAX_TRACK_GAIN = 8;

/** Gain that brings a measured track to the table's target. */
export function tableGain(table: LoudnessTable, trackId: number): number | null {
  const lufs = table.tracks[String(trackId)];
  if (lufs === undefined || !Number.isFinite(lufs)) return null;
  const gain = Math.pow(10, (table.target - lufs) / 20);
  return Math.max(MIN_TRACK_GAIN, Math.min(MAX_TRACK_GAIN, gain));
}
