/**
 * Which track plays when, after the original (reference/notes/08-flow-and-menus.md §10):
 * track 1 in the warm-ups, one of three tracks per background theme during a run (the rotation
 * advances on every start), track 0 once for the prize. Ours: the main menus play the calm
 * opening of one of the promo video's scores (`content/music`, softly),
 * and a contest with a boss loops the energetic modules of another, a new one every run.
 * Tracks are loaded on demand through `loadTrack` and cached.
 */
import { MENU_PATCHES, type PatchSet } from './Instruments.ts';
import type { MidiSong } from './MidiFile.ts';
import type { MusicPlayer } from './MusicPlayer.ts';

export const MENU_TRACK = 1;
export const PRIZE_TRACK = 0;
/** The bosses' first theme (`content/bosses/theme.json`), ours; the contests now play `LIVE_CONTEST`. */
export const CONTEST_TRACK = 100;
/** The promo video's layered scores (`content/music/<name>.json`), in episode order. */
export const LIVE_SCORES = [
  'teaser',
  'idea',
  'day1',
  'day2',
  'day3',
  'day4',
  'day5',
  'day6',
  'speedrun',
  'finale',
] as const;
export type LiveScoreName = (typeof LIVE_SCORES)[number];
/** Track ids of the live scores: the menu's calm opening and a contest's loop. */
export const LIVE_MENU = 200;
export const LIVE_CONTEST = 300;

/** The live score and plan a track id stands for, or null for the other tracks. */
export function liveTrack(id: number): { name: LiveScoreName; kind: 'menu' | 'contest' } | null {
  for (const [base, kind] of [
    [LIVE_MENU, 'menu'],
    [LIVE_CONTEST, 'contest'],
  ] as const) {
    const name = LIVE_SCORES[id - base];
    if (id >= base && name) return { name, kind };
  }
  return null;
}
export const THEME_COUNT = 4;
export const TRACKS_PER_THEME = 3;
/** Volume of the options slider, in percent. */
export const MAX_VOLUME = 100;

/** Tracks played with patches of their own (`MidiSong.patches`): the menu's mellow sound. */
export const TRACK_PATCHES: Readonly<Record<number, PatchSet>> = { [MENU_TRACK]: MENU_PATCHES };

/**
 * Tracks kept below the measured common level, whatever the volume: the menu's long chords
 * and the main menus' live scores, as if the slider stood 35 % lower (it is squared,
 * `volumeGain`).
 */
const MENU_TRIM = 0.65 ** 2;
const TRACK_TRIM: Readonly<Record<number, number>> = { [MENU_TRACK]: MENU_TRIM };

export function trackPatches(id: number): PatchSet | undefined {
  return TRACK_PATCHES[id];
}

/** Gain a track gets on top of its loudness normalisation. */
export function trackTrim(id: number): number {
  return TRACK_TRIM[id] ?? (liveTrack(id)?.kind === 'menu' ? MENU_TRIM : 1);
}

/** Gain for a slider level: squared, so the slider feels even to the ear. */
export function volumeGain(level: number): number {
  const t = Math.max(0, Math.min(MAX_VOLUME, level)) / MAX_VOLUME;
  return t * t;
}

export interface MusicDirectorOptions {
  player: MusicPlayer;
  loadTrack: (id: number) => Promise<MidiSong>;
  /** 0..1, for the live scores' random choice (tests pass their own). */
  random?: () => number;
}

export class MusicDirector {
  private readonly player: MusicPlayer;
  private readonly loadTrack: (id: number) => Promise<MidiSong>;
  private readonly cache = new Map<number, Promise<MidiSong>>();
  /** Rotation per theme (`ropt[5 + theme]`). */
  readonly rotation = new Array<number>(THEME_COUNT).fill(0);
  private wanted: { id: number; loop: boolean } | null = null;
  private level = 40;
  private readonly random: () => number;
  /** The live score each kind played last, so the next choice is another one. */
  private readonly last = { menu: -1, contest: -1 };

  constructor(opts: MusicDirectorOptions) {
    this.player = opts.player;
    this.loadTrack = opts.loadTrack;
    this.random = opts.random ?? Math.random;
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

  /**
   * The main menus: a live score's calm opening, chosen at random when the menus begin and
   * kept while they last.
   */
  menu(): void {
    const id = this.wanted?.id ?? -1;
    if (liveTrack(id)?.kind === 'menu') this.start(id, true);
    else this.start(LIVE_MENU + this.choose('menu'), true);
  }

  /** The warm-ups: the original's menu track (it played in its menus and warm-ups). */
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

  /** A contest with a boss: a live score's energetic modules, another score every run. */
  contest(): void {
    this.start(LIVE_CONTEST + this.choose('contest'), true);
  }

  /** A live score at random, not the one this kind played last. */
  private choose(kind: 'menu' | 'contest'): number {
    const n = LIVE_SCORES.length;
    const last = this.last[kind];
    let k = Math.min(n - 1, Math.floor(this.random() * (last < 0 ? n : n - 1)));
    if (last >= 0 && k >= last) k++;
    this.last[kind] = k;
    return k;
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
