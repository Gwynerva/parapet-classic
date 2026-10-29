/**
 * Our layered scores (`content/music/*.json`, written for the videos about the game) played
 * live by the synthesiser. They are in the text format of `Score.ts`, with a few fields of
 * their own (`packages/content/music/README.md` tells how to write one):
 *
 * - `patches`: GM program → patch, sounds of the score's own (as `MidiSong.patches`);
 * - `layers`: every track belongs to one layer of fullness, `base` (the motif alone), `more`
 *   and `max`; a section played with some layers only leaves the others' tracks out;
 * - a track's `echo`: the chip way of an echo, every note repeated later and softer;
 * - a track's `fx`: effects on its sound (`TrackEffects.ts`), and `events` at places in
 *   sections. For the videos these were applied to rendered samples; here the tape stops,
 *   reversed slices, stutters and fast-forwards become notes (the closest a synthesiser
 *   gets), and mutes stay with the effects.
 *
 * A score's sections are modules of a few bars (`intro1`, `build1`, `peak2`, …), any of which
 * may follow any other; a plan picks the sections to loop and the layers to play.
 */
import type { Patch, PatchSet } from './Instruments.ts';
import type { MidiNote, MidiSong } from './MidiFile.ts';
import { scoreToSong, type Score, type ScoreTrack } from './Score.ts';

/**
 * Every note again `delay` steps later, `repeats` times, each `feedback` times softer; a
 * repeat that would start past the end of the pass is left out.
 */
export interface Echo {
  delay: number;
  repeats: number;
  feedback: number;
  /** The repeats thrown hard left and right in turn. */
  pingpong?: boolean;
}

/** A place in a section: `at` steps from its start, `steps` long. */
export interface FxEvent {
  section: string;
  at: number;
  steps: number;
  /**
   * `tape`: slows down to a stop; `flip`: the slice backwards; `stutter`: its first `slice`
   * steps over and over; `mute`: silence; `fast`: the slice twice over at double speed, an
   * octave up.
   */
  kind: 'tape' | 'flip' | 'stutter' | 'mute' | 'fast';
  slice?: number;
}

export interface TrackFx {
  /** Gain into a soft clipper (1 = gentle, 4 = hot); the level is kept. */
  drive?: number;
  /** A resonant filter; `sweep` moves it from one cut-off to another across a section. */
  filter?: {
    hz: number;
    q?: number;
    type?: 'lowpass' | 'highpass';
    sweep?: Record<string, [number, number]>;
  };
  /** A feedback delay `steps` long; `pingpong` throws the repeats from side to side. */
  delay?: { steps: number; feedback: number; mix: number; pingpong?: boolean };
  /** A plate-like reverb (Freeverb): `size` 0..1, `damp` 0..1. */
  reverb?: { mix: number; size?: number; damp?: number };
  /** The track ducks by `depth` every `every` steps (from `offset`) and recovers over `release` s. */
  duck?: { every: number; offset?: number; depth: number; release: number };
  events?: FxEvent[];
}

export interface LiveTrack extends ScoreTrack {
  echo?: Echo;
  fx?: TrackFx;
}

export type Layer = 'base' | 'more' | 'max';
export const LAYERS: readonly Layer[] = ['base', 'more', 'max'];

export interface LiveScore extends Omit<Score, 'tracks'> {
  tracks: Record<string, LiveTrack>;
  patches?: Record<string, Patch>;
  layers: Record<Layer, string[]>;
}

/** Which modules loop, in order, and which layers play. */
export interface LivePlan {
  sections: string[];
  layers: readonly Layer[];
}

/** Where a module of a pass starts, seconds from the pass's start, and its length in steps. */
export interface PassSection {
  name: string;
  start: number;
  steps: number;
}

/** A track's effects in a song: its channel, the effects, and the pass they follow. */
export interface SongEffects {
  stepS: number;
  sections: PassSection[];
  tracks: { channel: number; fx: TrackFx }[];
}

/** The first of `names` the score has, so `build1` falls back to `build` (a one-variant score). */
function pick(score: LiveScore, ...names: string[]): string | null {
  return names.find((n) => score.sections[n]) ?? null;
}

/** Where a score plays: the main menus, or a run with a boss. */
export type LiveKind = 'menu' | 'boss';

/**
 * The sections of a plan: for each [module, variant] pair the section `<module><variant>`, or
 * the module's only section when it has no variants (then once, not again for variant 2).
 * Every plan plays every layer; the director keeps the menus' softer.
 */
function pickSections(score: LiveScore, pairs: readonly [string, string][]): LivePlan {
  const out: string[] = [];
  for (const [m, v] of pairs) {
    const name = pick(score, m + v, m);
    if (name && !(v === '2' && name === m)) out.push(name);
  }
  return { sections: out, layers: LAYERS };
}

/**
 * A run with a boss: the score's energetic sections round and round, build-up A, peak A,
 * wind-down A, then the B variants (whatever the score has).
 */
export function bossPlan(score: LiveScore): LivePlan {
  const pairs: [string, string][] = [];
  for (const v of ['1', '2']) for (const m of ['build', 'peak', 'fall']) pairs.push([m, v]);
  return pickSections(score, pairs);
}

/** The main menus: the calm opening and middle sections, both variants of each. */
export function menuPlan(score: LiveScore): LivePlan {
  const pairs: [string, string][] = [];
  for (const m of ['intro', 'mid']) for (const v of ['1', '2']) pairs.push([m, v]);
  return pickSections(score, pairs);
}

/** The plan of a kind of track. */
export function planFor(score: LiveScore, kind: LiveKind): LivePlan {
  return kind === 'menu' ? menuPlan(score) : bossPlan(score);
}

/** What is wrong with a score for the game, or an empty list. */
export function liveScoreProblems(score: LiveScore): string[] {
  const out: string[] = [];
  const layered = new Set<string>();
  for (const layer of LAYERS) for (const t of score.layers?.[layer] ?? []) layered.add(t);
  const channels = new Map<number, string>();
  for (const [name, track] of Object.entries(score.tracks)) {
    if (!layered.has(name)) out.push(`track ${name} is in no layer`);
    const other = channels.get(track.channel);
    if (other) out.push(`tracks ${other} and ${name} share channel ${track.channel}`);
    channels.set(track.channel, name);
  }
  for (const plan of [bossPlan(score), menuPlan(score)]) {
    if (plan.sections.length === 0) out.push('no modules for a plan');
  }
  return out;
}

/** Notes of `channel` starting in [from, to) ms, taken out of `notes`. */
function takeSpan(notes: MidiNote[], channel: number, from: number, to: number): MidiNote[] {
  const taken: MidiNote[] = [];
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i]!;
    if (n.channel === channel && n.time >= from && n.time < to) {
      taken.push(n);
      notes.splice(i, 1);
    }
  }
  return taken.reverse();
}

/** A sample-level event of the video, done with the notes it touches. */
function noteEvent(
  notes: MidiNote[],
  channel: number,
  e: FxEvent,
  from: number,
  stepMs: number,
): void {
  const len = e.steps * stepMs;
  const to = from + len;
  const drums = channel === 9;
  switch (e.kind) {
    case 'stutter': {
      // The slice's notes over and over.
      const slice = Math.max(1, e.slice ?? 1) * stepMs;
      takeSpan(notes, channel, from + slice, to);
      const head = takeSpan(notes, channel, from, from + slice);
      for (let at = 0; at < len; at += slice) {
        for (const n of head) {
          notes.push({ ...n, time: n.time + at, duration: Math.min(n.duration, slice) });
        }
      }
      break;
    }
    case 'fast': {
      // Twice over at double speed, an octave up.
      for (const n of takeSpan(notes, channel, from, to)) {
        const t = (n.time - from) / 2;
        const note = drums ? n.note : Math.min(127, n.note + 12);
        for (const half of [0, len / 2]) {
          notes.push({ ...n, note, time: from + half + t, duration: n.duration / 2 });
        }
      }
      break;
    }
    case 'flip':
      // Backwards: a note ends where it began.
      for (const n of takeSpan(notes, channel, from, to)) {
        const d = Math.min(n.duration, to - n.time);
        notes.push({ ...n, time: Math.max(from, to - (n.time - from) - d), duration: d });
      }
      break;
    case 'tape':
      // The tape runs slower and slower to a stop: a note at p is reached later, lower and
      // fainter, and what lies past half the slice is never reached.
      for (const n of takeSpan(notes, channel, from, to)) {
        const p = (n.time - from) / len;
        if (p >= 0.5) continue;
        const t = 1 - Math.sqrt(1 - 2 * p);
        const speed = Math.max(0.05, 1 - t);
        const shift = drums ? 0 : Math.round(12 * Math.log2(Math.max(0.25, speed)));
        notes.push({
          ...n,
          time: from + t * len,
          note: Math.max(0, n.note + shift),
          duration: Math.min(n.duration / speed, (1 - t) * len),
          velocity: Math.max(1, Math.round(n.velocity * Math.min(1, speed * 4))),
        });
      }
      break;
    default:
      // `mute` is a gain of the track's effects; the rest are not used in the game.
      break;
  }
}

/** The song of one pass of `plan`: its notes, patches and the tracks' effects. */
export function liveSong(score: LiveScore, plan: LivePlan): MidiSong {
  const song = scoreToSong({ ...score, song: plan.sections } as Score);
  const stepMs = 60000 / score.bpm / 4;
  const playing = new Set(plan.layers.flatMap((l) => score.layers[l] ?? []));
  const byChannel = new Map<number, [string, LiveTrack]>();
  for (const [name, track] of Object.entries(score.tracks))
    byChannel.set(track.channel, [name, track]);

  const notes: MidiNote[] = [];
  for (const n of song.notes) {
    const [name, track] = byChannel.get(n.channel) ?? ['', undefined];
    if (!track || !playing.has(name)) continue;
    notes.push(n);
    const echo = track.echo;
    for (let k = 1; echo && k <= echo.repeats; k++) {
      // A repeat past the end of the pass is dropped: the next pass starts on time.
      const time = n.time + k * echo.delay * stepMs;
      if (time >= song.durationMs) break;
      notes.push({
        ...n,
        time,
        volume: n.volume * Math.pow(echo.feedback, k),
        ...(echo.pingpong ? { pan: k % 2 ? -0.8 : 0.8 } : {}),
      });
    }
  }

  const sections: PassSection[] = [];
  let at = 0;
  for (const name of plan.sections) {
    const steps = (score.sections[name]?.bars ?? 0) * score.stepsPerBar;
    sections.push({ name, start: (at * stepMs) / 1000, steps });
    at += steps;
  }
  const tracks: SongEffects['tracks'] = [];
  for (const [name, track] of Object.entries(score.tracks)) {
    if (!playing.has(name) || !track.fx) continue;
    tracks.push({ channel: track.channel, fx: track.fx });
    for (const e of track.fx.events ?? []) {
      for (const s of sections) {
        if (s.name === e.section)
          noteEvent(notes, track.channel, e, s.start * 1000 + e.at * stepMs, stepMs);
      }
    }
  }
  notes.sort((a, b) => a.time - b.time || a.channel - b.channel);

  const patches: Record<number, Patch> = {};
  for (const [program, patch] of Object.entries(score.patches ?? {}))
    patches[Number(program)] = patch;
  return {
    durationMs: song.durationMs,
    ticksPerBeat: 4,
    notes,
    unknownEvents: 0,
    patches: patches as PatchSet,
    voicesPerChannel: true,
    effects: tracks.length > 0 ? { stepS: stepMs / 1000, sections, tracks } : undefined,
  };
}
