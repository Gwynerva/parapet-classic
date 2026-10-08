/**
 * Plays a parsed MIDI song through the synthesiser: notes and channel volume changes are
 * scheduled a little ahead of the audio clock from a timer, and the player can pause, resume
 * and change its volume. The audio context is created lazily and only becomes audible after
 * `unlock()` (browsers require a user gesture); a song requested before that starts as soon as
 * the context runs.
 *
 * Nothing stops abruptly: a new song fades in while the old one fades out, pausing fades
 * briefly, and a looping song alternates between two synthesisers, so the last notes of one
 * pass ring out with their own channel volumes while the next pass begins.
 */
import { songEvents, type MidiControl, type MidiNote, type MidiSong } from './MidiFile.ts';
import { normalisationGain } from './Loudness.ts';
import { Synth } from './Synth.ts';

/** Seconds of notes scheduled ahead of the audio clock. */
export const LOOKAHEAD_S = 0.25;
/** Scheduler period in ms. */
export const TICK_MS = 50;
/** Master level at full volume; the per-song normalisation keeps the synthesiser well below clipping. */
export const MASTER_GAIN = 0.8;
/** Fades in seconds: a song coming in, a song going out, and a pause. */
export const FADE_IN_S = 0.3;
export const FADE_OUT_S = 0.45;
export const PAUSE_FADE_S = 0.12;
/**
 * At the loop point the notes still sounding at the very end ring on for this long and fade
 * out, over the start of the next pass, instead of stopping dead.
 */
export const LOOP_TAIL_S = 2;

/** A scheduled event with its absolute audio time and the pass of the loop it belongs to. */
export interface DueEvent {
  note?: MidiNote;
  control?: MidiControl;
  at: number;
  pass: number;
  /** Audio time the pass began. */
  start: number;
}

/** The scheduling decisions, without audio nodes, so they can be tested. */
export class SongCursor {
  readonly song: MidiSong;
  readonly loop: boolean;
  /** Audio time (s) of the song's beginning for the current pass. */
  startTime: number;
  index = 0;
  /** Passes of the loop played so far (0 for the first). */
  pass = 0;
  private readonly events: ReturnType<typeof songEvents>;

  constructor(song: MidiSong, loop: boolean, startTime: number) {
    this.song = song;
    this.loop = loop;
    this.startTime = startTime;
    this.events = songEvents(song);
  }

  /** Position in the song in ms at audio time `now`. */
  positionMs(now: number): number {
    return (now - this.startTime) * 1000;
  }

  /** Skip the events before `positionMs` (resume). */
  seek(positionMs: number, now: number): void {
    this.startTime = now - positionMs / 1000;
    this.index = 0;
    while (this.index < this.events.length && this.events[this.index]!.time < positionMs) {
      this.index++;
    }
  }

  /**
   * Events due before `now + lookahead`, with their absolute audio times. Advances the cursor
   * and wraps a looping song. Returns false once a non-looping song is over.
   */
  due(now: number, lookahead: number, out: DueEvent[]): boolean {
    const horizon = now + lookahead;
    const events = this.events;
    for (;;) {
      while (this.index < events.length) {
        const e = events[this.index]!;
        const at = this.startTime + e.time / 1000;
        if (at >= horizon) return true;
        out.push({ note: e.note, control: e.control, at, pass: this.pass, start: this.startTime });
        this.index++;
      }
      const end = this.startTime + Math.max(this.song.durationMs, 1) / 1000;
      if (!this.loop) return end >= now;
      if (end >= horizon) return true;
      this.startTime = end;
      this.index = 0;
      this.pass++;
      if (events.length === 0) return true;
    }
  }
}

/** One synthesiser and its output gain. */
interface Bus {
  synth: Synth;
  gain: GainNode;
  /** The pass whose notes it plays now (-1: none yet). */
  pass: number;
}

/** A song being played: its cursor, its level (normalisation and fades) and two buses. */
interface Playback {
  cursor: SongCursor;
  songGain: GainNode;
  buses: [Bus, Bus];
  level: number;
}

export class MusicPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private playback: Playback | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending: { song: MidiSong; loop: boolean } | null = null;
  /** A paused song: where it stopped. */
  private paused: { song: MidiSong; loop: boolean; positionMs: number } | null = null;
  private level = 1;
  private readonly due: DueEvent[] = [];

  /** Whether the context exists and runs (a gesture has unlocked audio). */
  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get playing(): boolean {
    return this.playback !== null && this.paused === null;
  }

  /** Volume 0..1 (applied on top of `MASTER_GAIN`). */
  get volume(): number {
    return this.level;
  }

  setVolume(volume: number): void {
    this.level = Math.max(0, Math.min(1, volume));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.level * MASTER_GAIN, this.ctx.currentTime, 0.02);
    }
  }

  /** Create or resume the audio context; call from a user gesture. */
  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.level * MASTER_GAIN;
      // A gentle limiter: the loudest chords of a track never clip.
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 3;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      this.master.connect(limiter);
      limiter.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') {
      this.ctx.resume().then(
        () => this.flushPending(),
        () => undefined,
      );
    } else {
      this.flushPending();
    }
  }

  private flushPending(): void {
    const pending = this.pending;
    if (!pending || !this.ready) return;
    this.pending = null;
    this.play(pending.song, pending.loop);
  }

  play(song: MidiSong, loop = true): void {
    this.stop();
    if (!this.ready || !this.ctx) {
      this.pending = { song, loop };
      return;
    }
    this.begin(song, loop, 0);
  }

  /** Starts `song` at `positionMs` with a fade in. */
  private begin(song: MidiSong, loop: boolean, positionMs: number): void {
    const ctx = this.ctx!;
    // The measured level the loader set, or an estimate from the notes.
    const level = song.gain ?? normalisationGain(song);
    const songGain = ctx.createGain();
    songGain.connect(this.master!);
    const now = ctx.currentTime;
    const start = now + 0.05;
    songGain.gain.setValueAtTime(0, now);
    songGain.gain.linearRampToValueAtTime(level, start + FADE_IN_S);
    const bus = (): Bus => {
      const gain = ctx.createGain();
      gain.connect(songGain);
      const synth = new Synth(ctx, gain);
      synth.channelVolumes = (song.controls?.length ?? 0) > 0;
      return { synth, gain, pass: -1 };
    };
    const cursor = new SongCursor(song, loop, start);
    if (positionMs > 0) cursor.seek(positionMs, start);
    this.playback = { cursor, songGain, buses: [bus(), bus()], level };
    this.paused = null;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  /** Fades the current song out (then frees its nodes) and stops scheduling. */
  stop(fadeSeconds = FADE_OUT_S): void {
    this.pending = null;
    this.paused = null;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const playback = this.playback;
    this.playback = null;
    if (playback && this.ctx) this.fadeOut(playback, fadeSeconds);
  }

  private fadeOut(playback: Playback, seconds: number): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const gain = playback.songGain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + seconds);
    const end = now + seconds + 0.02;
    for (const bus of playback.buses) bus.synth.silence(end);
    setTimeout(() => playback.songGain.disconnect(), (seconds + 0.2) * 1000);
  }

  pause(): void {
    const playback = this.playback;
    if (!playback || !this.ctx || this.paused) return;
    const cursor = playback.cursor;
    const position = Math.max(0, cursor.positionMs(this.ctx.currentTime));
    this.stop(PAUSE_FADE_S);
    this.paused = { song: cursor.song, loop: cursor.loop, positionMs: position };
  }

  resume(): void {
    const paused = this.paused;
    if (!paused || !this.ready) return;
    const position = paused.positionMs % Math.max(1, paused.song.durationMs);
    this.begin(paused.song, paused.loop, position);
  }

  private tick(): void {
    const playback = this.playback;
    const ctx = this.ctx;
    if (!playback || !ctx) return;
    this.due.length = 0;
    const alive = playback.cursor.due(ctx.currentTime, LOOKAHEAD_S, this.due);
    const cursor = playback.cursor;
    const endMs = cursor.song.durationMs;
    for (const d of this.due) {
      // Passes alternate between the buses; a bus taking a new pass starts from the song's
      // default channel volumes, and the other one lets the last pass's final notes fade.
      const bus = playback.buses[d.pass & 1]!;
      if (bus.pass !== d.pass) {
        bus.pass = d.pass;
        bus.synth.resetChannels(d.at);
        bus.gain.gain.cancelScheduledValues(d.start);
        bus.gain.gain.setValueAtTime(1, d.start);
        if (d.pass > 0) {
          const old = playback.buses[(d.pass - 1) & 1]!.gain.gain;
          old.cancelScheduledValues(d.start);
          old.setValueAtTime(1, d.start);
          old.linearRampToValueAtTime(0, d.start + LOOP_TAIL_S);
        }
      }
      let note = d.note;
      if (note && cursor.loop && note.time + note.duration >= endMs - 60) {
        // Held up to the loop point: it rings on while its bus fades.
        note = { ...note, duration: note.duration + LOOP_TAIL_S * 1000 };
      }
      if (note) bus.synth.noteAt(note, d.at);
      else if (d.control) bus.synth.controlAt(d.control, d.at);
    }
    if (!alive) {
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      this.playback = null;
    }
  }
}

/**
 * Unlocks the player on the first key press or pointer tap, as browsers demand. Returns the
 * function that removes the listeners.
 */
export function unlockOnGesture(player: MusicPlayer, target: EventTarget = window): () => void {
  const handler = (): void => {
    player.unlock();
    if (player.ready) remove();
  };
  const events = ['pointerdown', 'keydown', 'touchend'];
  const remove = (): void => {
    for (const e of events) target.removeEventListener(e, handler);
  };
  for (const e of events) target.addEventListener(e, handler);
  return remove;
}
