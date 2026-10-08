/**
 * Which track plays when, after the original (reference/notes/08-flow-and-menus.md §10):
 * track 1 in the menus and the warm-ups, one of three tracks per background theme during a
 * run (the rotation advances on every start), track 0 once for the prize; the bosses' theme
 * (`CONTEST_TRACK`) in their contests. Tracks are loaded on demand through `loadTrack` and
 * cached.
 */
import type { MidiSong } from './MidiFile.ts';
import type { MusicPlayer } from './MusicPlayer.ts';

export const MENU_TRACK = 1;
export const PRIZE_TRACK = 0;
/** The bosses' theme, played in their contests (ours, not the original's). */
export const CONTEST_TRACK = 100;
export const THEME_COUNT = 4;
export const TRACKS_PER_THEME = 3;
/** Volume of the options slider, in percent. */
export const MAX_VOLUME = 100;

/** Gain for a slider level: squared, so the slider feels even to the ear. */
export function volumeGain(level: number): number {
  const t = Math.max(0, Math.min(MAX_VOLUME, level)) / MAX_VOLUME;
  return t * t;
}

export interface MusicDirectorOptions {
  player: MusicPlayer;
  loadTrack: (id: number) => Promise<MidiSong>;
}

export class MusicDirector {
  private readonly player: MusicPlayer;
  private readonly loadTrack: (id: number) => Promise<MidiSong>;
  private readonly cache = new Map<number, Promise<MidiSong>>();
  /** Rotation per theme (`ropt[5 + theme]`). */
  readonly rotation = new Array<number>(THEME_COUNT).fill(0);
  private wanted: { id: number; loop: boolean } | null = null;
  private level = 70;

  constructor(opts: MusicDirectorOptions) {
    this.player = opts.player;
    this.loadTrack = opts.loadTrack;
  }

  /** Current volume in percent. */
  get volume(): number {
    return this.level;
  }

  setVolume(level: number): void {
    this.level = Math.max(0, Math.min(MAX_VOLUME, Math.round(level)));
    this.player.setVolume(volumeGain(this.level));
    if (this.level === 0) this.player.stop();
    else if (this.wanted && !this.player.playing) this.start(this.wanted.id, this.wanted.loop);
  }

  /** The track wanted right now, or null. */
  get current(): number | null {
    return this.wanted?.id ?? null;
  }

  menu(): void {
    this.start(MENU_TRACK, true);
  }

  warmUp(): void {
    this.start(MENU_TRACK, true);
  }

  /** Start a run on `theme`: advance its rotation and pick `2 + 3·theme + (rot + 2) % 3`. */
  game(theme: number): void {
    const t = Math.max(0, Math.min(THEME_COUNT - 1, theme));
    const rot = ((this.rotation[t] ?? 0) + 1) % TRACKS_PER_THEME;
    this.rotation[t] = rot;
    this.start(2 + TRACKS_PER_THEME * t + ((rot + 2) % TRACKS_PER_THEME), true);
  }

  /** A contest with a boss: their theme instead of the level's music. */
  contest(): void {
    this.start(CONTEST_TRACK, true);
  }

  /** The same track again (resume after a pause). */
  again(): void {
    if (this.wanted) this.start(this.wanted.id, this.wanted.loop, true);
  }

  prize(): void {
    this.start(PRIZE_TRACK, false);
  }

  stop(): void {
    this.wanted = null;
    this.player.stop();
  }

  pause(): void {
    this.player.pause();
  }

  resume(): void {
    this.player.resume();
  }

  private start(id: number, loop: boolean, restart = false): void {
    if (!restart && this.wanted?.id === id && (this.player.playing || this.level === 0)) return;
    this.wanted = { id, loop };
    if (this.level === 0) return;
    let song = this.cache.get(id);
    if (!song) {
      song = this.loadTrack(id);
      this.cache.set(id, song);
    }
    song.then(
      (parsed) => {
        if (this.wanted?.id === id) this.player.play(parsed, loop);
      },
      () => {
        this.cache.delete(id);
      },
    );
  }
}
