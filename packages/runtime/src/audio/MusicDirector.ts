/**
 * Which track plays when, after the original (reference/notes/08-flow-and-menus.md §10):
 * track 1 in the warm-ups, one of three tracks per background theme during a run (the rotation
 * advances on every start), track 0 once for the prize. Ours (`content/music`, `LiveScore.ts`):
 * the main menus play the opening and middle sections of one of our scores, softly, kept while
 * the menus last; a run with a boss (a contest, or a boss played or watched) loops the energetic
 * sections of another, a new one every run and the same one when the run is started over.
 * Tracks are loaded on demand through `loadTrack` and cached.
 */
import { MENU_PATCHES, type PatchSet } from './Instruments.ts';
import type { LiveKind } from './LiveScore.ts';
import type { MidiSong } from './MidiFile.ts';
import type { MusicPlayer } from './MusicPlayer.ts';

export const MENU_TRACK = 1;
export const PRIZE_TRACK = 0;
/** Our scores (`content/music/<name>.json`), in the order they were written. */
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
/** Track ids of our scores: `LIVE_MENU + k` is score k's menu plan, `LIVE_BOSS + k` its boss plan. */
export const LIVE_MENU = 200;
export const LIVE_BOSS = 300;

/** The score and plan a track id stands for, or null for the original's tracks. */
export function liveTrackOf(id: number): { name: LiveScoreName; kind: LiveKind } | null {
  for (const [base, kind] of [
    [LIVE_MENU, 'menu'],
    [LIVE_BOSS, 'boss'],
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

/** Tracks played with patches of their own (`MidiSong.patches`): the warm-ups' mellow sound. */
export const TRACK_PATCHES: Readonly<Record<number, PatchSet>> = { [MENU_TRACK]: MENU_PATCHES };

/**
 * Tracks kept below the measured common level, whatever the volume: the warm-ups' long chords
 * and the main menus' scores, as if the slider stood 35 % lower (it is squared, `volumeGain`).
 */
const MENU_TRIM = 0.65 ** 2;
const TRACK_TRIM: Readonly<Record<number, number>> = { [MENU_TRACK]: MENU_TRIM };

export function trackPatches(id: number): PatchSet | undefined {
  return TRACK_PATCHES[id];
}

/** Gain a track gets on top of its loudness normalisation. */
export function trackTrim(id: number): number {
  return TRACK_TRIM[id] ?? (liveTrackOf(id)?.kind === 'menu' ? MENU_TRIM : 1);
}

/** Gain for a slider level: squared, so the slider feels even to the ear. */
export function volumeGain(level: number): number {
  const t = Math.max(0, Math.min(MAX_VOLUME, level)) / MAX_VOLUME;
  return t * t;
}

export interface MusicDirectorOptions {
  player: MusicPlayer;
  loadTrack: (id: number) => Promise<MidiSong>;
  /** 0..1, for the scores' random choice (tests pass their own). */
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
  /** The score each kind played last, so the next choice is another one. */
  private readonly last: Record<LiveKind, number> = { menu: -1, boss: -1 };

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

  /** The main menus: a score's calm opening, chosen when the menus begin and kept while they last. */
  menu(): void {
    this.live('menu', LIVE_MENU);
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

  /**
   * A run with a boss (a contest, a boss played or watched): a score's energetic sections,
   * another score every run; a run started over keeps its score.
   */
  boss(): void {
    this.live('boss', LIVE_BOSS);
  }

  /** The track of `kind` playing now, else a score of that kind chosen at random. */
  private live(kind: LiveKind, base: number): void {
    const id = this.wanted?.id ?? -1;
    if (liveTrackOf(id)?.kind === kind) this.start(id, true);
    else this.start(base + this.choose(kind), true);
  }

  /** A score at random, not the one this kind played last. */
  private choose(kind: LiveKind): number {
    const n = LIVE_SCORES.length;
    const last = this.last[kind];
    // The last score is skipped over, so the draw is one narrower after the first.
    const range = last < 0 ? n : n - 1;
    let k = Math.min(range - 1, Math.floor(this.random() * range));
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
