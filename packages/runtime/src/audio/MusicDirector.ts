/**
 * Which track plays when, after the original (reference/notes/08-flow-and-menus.md §10):
 * track 1 in the menus and the warm-ups, one of three tracks per background theme during a
 * run (the rotation advances on every start), track 0 once for the prize. Tracks are loaded
 * on demand through `loadTrack` and cached.
 */
import type { MidiSong } from './MidiFile.ts';
import type { MusicPlayer } from './MusicPlayer.ts';

export const MENU_TRACK = 1;
export const PRIZE_TRACK = 0;
export const THEME_COUNT = 4;
export const TRACKS_PER_THEME = 3;
/** Volume steps of the options slider (the original's 0..64 in steps of 8). */
export const VOLUME_STEPS = 8;

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
  private volumeStep = VOLUME_STEPS / 2;

  constructor(opts: MusicDirectorOptions) {
    this.player = opts.player;
    this.loadTrack = opts.loadTrack;
  }

  /** Current volume step 0..8. */
  get volume(): number {
    return this.volumeStep;
  }

  setVolume(step: number): void {
    this.volumeStep = Math.max(0, Math.min(VOLUME_STEPS, Math.round(step)));
    this.player.setVolume(this.volumeStep / VOLUME_STEPS);
    if (this.volumeStep === 0) this.player.stop();
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
    if (!restart && this.wanted?.id === id && (this.player.playing || this.volumeStep === 0))
      return;
    this.wanted = { id, loop };
    if (this.volumeStep === 0) return;
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
