/**
 * Plays a parsed MIDI song through the synthesiser: notes are scheduled a little ahead of the
 * audio clock from a timer, the song loops by rescheduling from its start, and the player can
 * pause, resume and change its volume. The audio context is created lazily and only becomes
 * audible after `unlock()` (browsers require a user gesture); a song requested before that
 * starts as soon as the context runs.
 */
import type { MidiSong } from './MidiFile.ts';
import { normalisationGain } from './Loudness.ts';
import { Synth } from './Synth.ts';

/** Seconds of notes scheduled ahead of the audio clock. */
export const LOOKAHEAD_S = 0.25;
/** Scheduler period in ms. */
export const TICK_MS = 50;
/** Master level at full volume; the per-song normalisation keeps the synthesiser well below clipping. */
export const MASTER_GAIN = 0.8;

/** The scheduling decisions, without audio nodes, so they can be tested. */
export class SongCursor {
  readonly song: MidiSong;
  readonly loop: boolean;
  /** Audio time (s) of the song's beginning for the current pass. */
  startTime: number;
  index = 0;

  constructor(song: MidiSong, loop: boolean, startTime: number) {
    this.song = song;
    this.loop = loop;
    this.startTime = startTime;
  }

  /** Position in the song in ms at audio time `now`. */
  positionMs(now: number): number {
    return (now - this.startTime) * 1000;
  }

  /** Skip the notes before `positionMs` (resume). */
  seek(positionMs: number, now: number): void {
    this.startTime = now - positionMs / 1000;
    this.index = 0;
    while (this.index < this.song.notes.length && this.song.notes[this.index]!.time < positionMs) {
      this.index++;
    }
  }

  /**
   * Notes due before `now + lookahead`, with their absolute audio times. Advances the cursor
   * and wraps a looping song. Returns false once a non-looping song is over.
   */
  due(
    now: number,
    lookahead: number,
    out: { note: MidiSong['notes'][number]; at: number }[],
  ): boolean {
    const horizon = now + lookahead;
    const notes = this.song.notes;
    for (;;) {
      while (this.index < notes.length) {
        const n = notes[this.index]!;
        const at = this.startTime + n.time / 1000;
        if (at >= horizon) return true;
        out.push({ note: n, at });
        this.index++;
      }
      const end = this.startTime + Math.max(this.song.durationMs, 1) / 1000;
      if (!this.loop) return end >= now;
      if (end >= horizon) return true;
      this.startTime = end;
      this.index = 0;
      if (notes.length === 0) return true;
    }
  }
}

export class MusicPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Per-song normalisation stage between the synthesiser and the master gain. */
  private songGain: GainNode | null = null;
  private synth: Synth | null = null;
  private cursor: SongCursor | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending: { song: MidiSong; loop: boolean } | null = null;
  private pausedAtMs = -1;
  private level = 1;
  private readonly due: { note: MidiSong['notes'][number]; at: number }[] = [];

  /** Whether the context exists and runs (a gesture has unlocked audio). */
  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get playing(): boolean {
    return this.cursor !== null && this.pausedAtMs < 0;
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
      this.master.connect(this.ctx.destination);
      this.songGain = this.ctx.createGain();
      this.songGain.connect(this.master);
      this.synth = new Synth(this.ctx, this.songGain);
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
    if (this.songGain) this.songGain.gain.value = normalisationGain(song);
    this.cursor = new SongCursor(song, loop, this.ctx.currentTime + 0.1);
    this.pausedAtMs = -1;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop(): void {
    this.pending = null;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.cursor = null;
    this.pausedAtMs = -1;
    if (this.synth && this.ctx) this.synth.silence(this.ctx.currentTime);
  }

  pause(): void {
    if (!this.cursor || !this.ctx || this.pausedAtMs >= 0) return;
    this.pausedAtMs = Math.max(0, this.cursor.positionMs(this.ctx.currentTime));
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.synth?.silence(this.ctx.currentTime);
  }

  resume(): void {
    if (!this.cursor || !this.ctx || this.pausedAtMs < 0) return;
    const position = this.pausedAtMs % Math.max(1, this.cursor.song.durationMs);
    this.pausedAtMs = -1;
    this.cursor.seek(position, this.ctx.currentTime + 0.05);
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  private tick(): void {
    const cursor = this.cursor;
    const ctx = this.ctx;
    const synth = this.synth;
    if (!cursor || !ctx || !synth) return;
    this.due.length = 0;
    const alive = cursor.due(ctx.currentTime, LOOKAHEAD_S, this.due);
    for (const d of this.due) synth.noteAt(d.note, d.at);
    if (!alive) this.stop();
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
