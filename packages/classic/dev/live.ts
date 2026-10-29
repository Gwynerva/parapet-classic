/**
 * The live scores page (dev server only): renders a live score of the menus or the contests
 * (`content/music`, `LiveScore.ts`) offline exactly as the player plays it — one synthesiser
 * with a voice pool per channel, the tracks' effects (`TrackEffects.ts`) — and measures its
 * loudness. A driver (or the console) calls `window.live.render(name, kind, passes)`; the
 * buttons render one to listen to here. `window.live.measureAll()` returns the table of
 * `content/audio/live-loudness.json`.
 */
import {
  contestPlan,
  liveSong,
  menuPlan,
  type LiveScore,
} from '@parapet/runtime/audio/LiveScore.ts';
import {
  integratedLoudness,
  METER_RATE,
  type LoudnessTable,
} from '@parapet/runtime/audio/LoudnessMeter.ts';
import type { MidiSong } from '@parapet/runtime/audio/MidiFile.ts';
import { LIVE_SCORES } from '@parapet/runtime/audio/MusicDirector.ts';
import { Synth } from '@parapet/runtime/audio/Synth.ts';
import { buildSongEffects } from '@parapet/runtime/audio/TrackEffects.ts';
import { loadLiveScore, type LiveLoudness } from '../src/app/liveMusic.ts';
import mainLoudness from '@content/audio/loudness.json';

type Kind = 'menu' | 'contest';

/** Seconds the effects and the last notes ring after the end. */
const TAIL_S = 3;

/** Seconds of notes scheduled ahead while rendering, as the player's look-ahead. */
const AHEAD_S = 0.25;

/**
 * `passes` passes of a song back to back, at gain 1, as the player's bus plays them: notes are
 * scheduled a little ahead of the rendering (the context suspends for them), so it never holds
 * the nodes of every note of the song at once.
 */
async function renderPasses(song: MidiSong, passes: number): Promise<Float32Array[]> {
  const passS = song.durationMs / 1000;
  const seconds = passS * passes + TAIL_S;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * METER_RATE), METER_RATE);
  const synth = new Synth(ctx, ctx.destination);
  synth.patches = song.patches ?? null;
  synth.voicesPerChannel = song.voicesPerChannel ?? false;
  const fx = song.effects ? buildSongEffects(ctx, song.effects, ctx.destination) : null;
  for (const t of song.effects?.tracks ?? []) {
    const input = fx?.input(t.channel);
    if (input) synth.route(t.channel, input);
  }
  const due: { at: number; note: MidiSong['notes'][number] }[] = [];
  for (let p = 0; p < passes; p++) {
    for (const n of song.notes) due.push({ at: p * passS + n.time / 1000, note: n });
  }
  due.sort((a, b) => a.at - b.at);
  let next = 0;
  let pass = -1;
  const feed = (upto: number): void => {
    while (next < due.length && due[next]!.at < upto) {
      const p = Math.floor(due[next]!.at / passS);
      if (p > pass) {
        pass = p;
        fx?.schedule(p * passS);
      }
      synth.noteAt(due[next]!.note, due[next]!.at);
      next++;
    }
  };
  feed(2 * AHEAD_S);
  for (let t = AHEAD_S; t < seconds - AHEAD_S; t += AHEAD_S) {
    const at = t;
    void ctx.suspend(at).then(() => {
      feed(at + 2 * AHEAD_S);
      void ctx.resume();
    });
  }
  const buffer = await ctx.startRendering();
  return [buffer.getChannelData(0), buffer.getChannelData(1)];
}

async function songOf(name: string, kind: Kind): Promise<MidiSong> {
  const score: LiveScore = await loadLiveScore(name);
  return liveSong(score, kind === 'menu' ? menuPlan(score) : contestPlan(score));
}

/** 16-bit PCM at `gain` (headroom: the synthesiser peaks above 1), interleaved, base64. */
function pcm16(channels: Float32Array[], gain: number): string {
  const [l, r] = channels as [Float32Array, Float32Array];
  const out = new Int16Array(l.length * 2);
  for (let i = 0; i < l.length; i++) {
    out[2 * i] = Math.max(-32768, Math.min(32767, Math.round(l[i]! * gain * 32767)));
    out[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(r[i]! * gain * 32767)));
  }
  const bytes = new Uint8Array(out.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function render(
  name: string,
  kind: Kind,
  passes = 1,
  wav = false,
): Promise<{ lufs: number; seconds: number; peak: number; pcm?: string }> {
  const song = await songOf(name, kind);
  const t0 = performance.now();
  const ch = await renderPasses(song, passes);
  const lufs = integratedLoudness(
    ch.map((c) => c.subarray(0, Math.round((song.durationMs / 1000) * METER_RATE))),
  );
  let peak = 0;
  for (const c of ch) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]!));
  console.log(
    `${name}/${kind}: ${lufs.toFixed(2)} LUFS, ${((performance.now() - t0) / 1000).toFixed(1)} s`,
  );
  return { lufs, seconds: song.durationMs / 1000, peak, ...(wav ? { pcm: pcm16(ch, 0.5) } : {}) };
}

/** Every score and plan measured; the level is the original's game tracks' (`audio/loudness.json`). */
async function measureAll(): Promise<LiveLoudness> {
  const tracks: Record<string, number> = {};
  for (const name of LIVE_SCORES) {
    for (const kind of ['menu', 'contest'] as const) {
      tracks[`${name}/${kind}`] = Math.round((await render(name, kind)).lufs * 100) / 100;
    }
  }
  return { target: (mainLoudness as LoudnessTable).target, tracks };
}

(window as unknown as { live: unknown }).live = { render, measureAll };

const list = document.getElementById('list')!;
const status = document.getElementById('status')!;
let playing: AudioBufferSourceNode | null = null;
for (const name of LIVE_SCORES) {
  for (const kind of ['menu', 'contest'] as const) {
    const button = document.createElement('button');
    button.textContent = `${name} · ${kind}`;
    button.onclick = async () => {
      status.textContent = `Rendering ${name} · ${kind}…`;
      const song = await songOf(name, kind);
      const ch = await renderPasses(song, 1);
      const ctx = new AudioContext({ sampleRate: METER_RATE });
      const buffer = ctx.createBuffer(2, ch[0]!.length, METER_RATE);
      buffer.copyToChannel(ch[0]! as Float32Array<ArrayBuffer>, 0);
      buffer.copyToChannel(ch[1]! as Float32Array<ArrayBuffer>, 1);
      playing?.stop();
      playing = ctx.createBufferSource();
      playing.buffer = buffer;
      playing.connect(ctx.destination);
      playing.start();
      status.textContent = `${name} · ${kind}: ${integratedLoudness(ch).toFixed(2)} LUFS`;
    };
    list.appendChild(button);
  }
}
status.textContent = 'Ready.';
