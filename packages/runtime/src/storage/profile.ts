/**
 * Player profile in `localStorage` under the `parapet.` prefix: options, the best run per
 * level and mode (with its input log, so it can be watched, raced as a ghost or shared) and the
 * last player name/character. Every entry is wrapped in `{ v, data }` so the schema can evolve; every
 * read is guarded, because storage may be disabled, full or hold garbage.
 */
import type { ContestMode } from '@parapet/sim';
import {
  compareRuns,
  isRankedMode,
  parseInputRuns,
  rankingSort,
  type InputRun,
  type RunMode,
} from '@parapet/sim';
import { isTouchLayout, type TouchLayout } from '../input/TouchControls.ts';
import { isScaleMode, type ScaleMode } from '../render/Viewport.ts';

export const STORAGE_PREFIX = 'parapet.';
export const SCHEMA_VERSION = 1;

export type TouchControlsSetting = 'auto' | 'on' | 'off';
/** Full screen: `auto` is on for touch screens (the first tap enters it), off elsewhere. */
export type FullscreenSetting = 'auto' | 'on' | 'off';

export interface Options {
  /** BCP 47 code of the chosen language; empty until the first launch picks one. */
  locale: string;
  scaleMode: ScaleMode;
  vibration: boolean;
  /** Music volume in percent, 0..100 (a slider; 0 is off). */
  musicLevel: number;
  touchControls: TouchControlsSetting;
  touchLayout: TouchLayout;
  /** Race the ghost of the local record when starting a mission that has one. */
  bestGhost: boolean;
  fullscreen: FullscreenSetting;
  /** Show the full-game timer (it counts while hidden, too). */
  fullGameTimer: boolean;
  /** Show the pressed keys during a run (always shown while watching a replay). */
  inputDisplay: boolean;
}

export const DEFAULT_OPTIONS: Readonly<Options> = {
  locale: '',
  scaleMode: 'auto',
  vibration: true,
  musicLevel: 40,
  touchControls: 'auto',
  touchLayout: 'move-left',
  bestGhost: true,
  fullscreen: 'auto',
  fullGameTimer: false,
  inputDisplay: false,
};

export interface RecordEntry {
  /** Finish time in ms of game clock (0 when the time ran out). */
  time: number;
  score: number;
  finished: boolean;
  timeUp: boolean;
  /** The full input log (`InputRecorder.finish()`), replayable and shareable. */
  input: InputRun[];
  playerName: string;
  character: number;
  withRival: boolean;
  simVersion: string;
  /** ISO 8601 timestamp of the run. */
  date: string;
}

export interface PlayerInfo {
  name: string;
  character: number;
}

export const DEFAULT_PLAYER: Readonly<PlayerInfo> = { name: '', character: 0 };

interface Envelope {
  v: number;
  data: unknown;
}

const OPTIONS_KEY = 'options';
const PLAYER_KEY = 'player';
const RECORD_PREFIX = 'record.';

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEnvelope(value: unknown): value is Envelope {
  return isRecordObject(value) && typeof value['v'] === 'number' && 'data' in value;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function read<T>(key: string, validate: (raw: unknown) => T | null): T | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_PREFIX + key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    // An entry of another schema (a newer build's) is ignored rather than misread.
    if (!isEnvelope(parsed) || parsed.v !== SCHEMA_VERSION) return null;
    return validate(parsed.data);
  } catch {
    return null;
  }
}

function write(key: string, data: unknown): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(STORAGE_PREFIX + key, JSON.stringify({ v: SCHEMA_VERSION, data }));
    return true;
  } catch {
    return false;
  }
}

function validateOptions(raw: unknown): Partial<Options> | null {
  if (!isRecordObject(raw)) return null;
  const out: Partial<Options> = {};
  if (typeof raw['locale'] === 'string') out.locale = raw['locale'];
  if (isScaleMode(raw['scaleMode'])) out.scaleMode = raw['scaleMode'];
  if (typeof raw['vibration'] === 'boolean') out.vibration = raw['vibration'];
  const musicLevel = raw['musicLevel'];
  if (typeof musicLevel === 'number' && Number.isFinite(musicLevel)) {
    out.musicLevel = Math.max(0, Math.min(100, Math.round(musicLevel)));
  }
  const fullscreen = raw['fullscreen'];
  if (fullscreen === 'auto' || fullscreen === 'on' || fullscreen === 'off') {
    out.fullscreen = fullscreen;
  }
  const touchControls = raw['touchControls'];
  if (touchControls === 'auto' || touchControls === 'on' || touchControls === 'off') {
    out.touchControls = touchControls;
  }
  if (isTouchLayout(raw['touchLayout'])) out.touchLayout = raw['touchLayout'];
  if (typeof raw['bestGhost'] === 'boolean') out.bestGhost = raw['bestGhost'];
  if (typeof raw['fullGameTimer'] === 'boolean') out.fullGameTimer = raw['fullGameTimer'];
  if (typeof raw['inputDisplay'] === 'boolean') out.inputDisplay = raw['inputDisplay'];
  return out;
}

export function loadOptions(): Options {
  return { ...DEFAULT_OPTIONS, ...(read(OPTIONS_KEY, validateOptions) ?? {}) };
}

/** Merges `patch` into the stored options and returns the result. */
export function saveOptions(patch: Partial<Options>): Options {
  const merged = { ...loadOptions(), ...patch };
  write(OPTIONS_KEY, merged);
  return merged;
}

/** Whether full screen is wanted: `auto` means on touch screens. */
export function wantsFullscreen(
  options: Pick<Options, 'fullscreen'>,
  coarsePointer: boolean,
): boolean {
  return options.fullscreen === 'on' || (options.fullscreen === 'auto' && coarsePointer);
}

function validatePlayer(raw: unknown): PlayerInfo | null {
  if (!isRecordObject(raw)) return null;
  const name = raw['name'];
  const character = raw['character'];
  return {
    name: typeof name === 'string' ? name : DEFAULT_PLAYER.name,
    character:
      typeof character === 'number' && Number.isInteger(character) && character >= 0
        ? character
        : DEFAULT_PLAYER.character,
  };
}

export function loadPlayer(): PlayerInfo {
  return read(PLAYER_KEY, validatePlayer) ?? { ...DEFAULT_PLAYER };
}

export function savePlayer(player: PlayerInfo): boolean {
  return write(PLAYER_KEY, player);
}

function validateRecord(raw: unknown): RecordEntry | null {
  if (!isRecordObject(raw)) return null;
  const time = raw['time'];
  const score = raw['score'];
  const input: InputRun[] | null = parseInputRuns(raw['input']);
  const simVersion = raw['simVersion'];
  const date = raw['date'];
  if (typeof time !== 'number' || typeof score !== 'number' || !input) return null;
  if (typeof simVersion !== 'string' || typeof date !== 'string') return null;
  const character = raw['character'];
  return {
    time,
    score,
    finished: raw['finished'] === true,
    timeUp: raw['timeUp'] === true,
    input,
    playerName: typeof raw['playerName'] === 'string' ? raw['playerName'] : '',
    character: typeof character === 'number' && Number.isInteger(character) ? character : 0,
    withRival: raw['withRival'] === true,
    simVersion,
    date,
  };
}

function recordKey(levelId: number, mode: RunMode): string {
  return `${RECORD_PREFIX}${levelId}.${mode}`;
}

export function loadRecord(levelId: number, mode: RunMode): RecordEntry | null {
  return read(recordKey(levelId, mode), validateRecord);
}

export function saveRecord(levelId: number, mode: RunMode, entry: RecordEntry): boolean {
  return write(recordKey(levelId, mode), entry);
}

/**
 * Whether `candidate` beats `existing` for the board of the mode: races (sprint, flag hunt,
 * move challenges) by lowest finish time among finished runs, score runs and score
 * challenges by highest score. Free runs and warm-ups are never records.
 */
export function isBetterRecord(
  mode: RunMode,
  candidate: RecordEntry,
  existing: RecordEntry | null,
  levelId = -1,
): boolean {
  if (!isRankedMode(mode)) return false;
  const sort = rankingSort(mode, levelId);
  if (sort === 'time' && !candidate.finished) return false;
  return existing === null || compareRuns(sort, candidate, existing) < 0;
}

// ---------------------------------------------------------------------------------------------
// Progress (the original's `ropt[9 + level]` mission bits)
// ---------------------------------------------------------------------------------------------

export interface Progress {
  /** Entry `level` holds bit `m` when mission slot `m` of that level was completed. */
  completed: number[];
  /** The prize ending was shown. */
  prizeSeen: boolean;
}

const PROGRESS_KEY = 'progress';

function validateProgress(raw: unknown): Progress | null {
  if (!isRecordObject(raw)) return null;
  const completed = Array.isArray(raw['completed'])
    ? raw['completed'].map((v) => (typeof v === 'number' && Number.isInteger(v) ? v & 0xff : 0))
    : [];
  return { completed, prizeSeen: raw['prizeSeen'] === true };
}

export function loadProgress(): Progress {
  return read(PROGRESS_KEY, validateProgress) ?? { completed: [], prizeSeen: false };
}

export function saveProgress(progress: Progress): boolean {
  return write(PROGRESS_KEY, progress);
}

export function isMissionCompleted(progress: Progress, levelId: number, slot: number): boolean {
  return ((progress.completed[levelId] ?? 0) & (1 << slot)) !== 0;
}

function popcount(bits: number): number {
  let n = 0;
  for (let b = bits; b !== 0; b >>>= 1) n += b & 1;
  return n;
}

/** Completed missions of one level. */
export function completedMissions(progress: Progress, levelId: number): number {
  return popcount(progress.completed[levelId] ?? 0);
}

/** Completed missions over every level (`int_j`, d.java line 10334). */
export function completedCount(progress: Progress): number {
  return progress.completed.reduce((sum, bits) => sum + popcount(bits), 0);
}

export interface CompletionResult {
  progress: Progress;
  /** True when the mission had not been completed before. */
  firstTime: boolean;
  /** Completed missions over every level after this one. */
  total: number;
}

/** Record a completed mission (`n(level, m)`, line 10301) and save. */
export function completeMission(levelId: number, slot: number): CompletionResult {
  const progress = loadProgress();
  const before = progress.completed[levelId] ?? 0;
  const after = before | (1 << slot);
  const firstTime = after !== before;
  if (firstTime) {
    while (progress.completed.length <= levelId) progress.completed.push(0);
    progress.completed[levelId] = after;
    saveProgress(progress);
  }
  return { progress, firstTime, total: completedCount(progress) };
}

/** What the unlock rules need to know of a level: how many missions it has. */
export interface LevelMissions {
  missionCount: number;
}

/** Every mission of a level is done (its contests with a boss are not missions). */
export function isLevelComplete(
  progress: Progress,
  levels: readonly LevelMissions[],
  levelId: number,
): boolean {
  const level = levels[levelId];
  return level !== undefined && completedMissions(progress, levelId) >= level.missionCount;
}

/**
 * A level opens once the one before it is complete. (The original counted the missions done
 * over all levels instead: `z[8]`, kept as `unlockThreshold`.)
 */
export function isLevelUnlocked(
  progress: Progress,
  levels: readonly LevelMissions[],
  levelId: number,
): boolean {
  if (levelId <= 0) return true;
  return isLevelComplete(progress, levels, levelId - 1);
}

export function markPrizeSeen(): void {
  const progress = loadProgress();
  if (progress.prizeSeen) return;
  progress.prizeSeen = true;
  saveProgress(progress);
}

export function clearRecords(): void {
  const store = storage();
  if (!store) return;
  try {
    const prefix = STORAGE_PREFIX + RECORD_PREFIX;
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) store.removeItem(key);
  } catch {
    // nothing to do
  }
}

function remove(key: string): void {
  // The timer's cache reads its entries again.
  fullGameCache = null;
  try {
    storage()?.removeItem(STORAGE_PREFIX + key);
  } catch {
    // nothing to do
  }
}

/**
 * A fresh game, as a speedrun starts it: records, missions done, bosses beaten and the
 * full-game timer's run are gone. The options, the player's name and the timer's best stay.
 */
export function resetProgress(): void {
  clearRecords();
  remove(PROGRESS_KEY);
  remove(CONTEST_KEY);
  remove(FULL_GAME_RUN_KEY);
}

// ---------------------------------------------------------------------------------------------
// Contests with the bosses (not part of the original's progress)
// ---------------------------------------------------------------------------------------------

/** The modes the bosses are raced in (`CONTEST_MODES`). */
export type ContestKind = ContestMode;

export interface ContestProgress {
  /** Per kind, bit `level` set once the level's boss was beaten in it. */
  beaten: Record<ContestKind, number>;
}

const CONTEST_KEY = 'contest';

function validateContest(raw: unknown): ContestProgress | null {
  if (!isRecordObject(raw) || !isRecordObject(raw['beaten'])) return null;
  const beaten = raw['beaten'];
  const bits = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) ? v >>> 0 : 0);
  return { beaten: { flags: bits(beaten['flags']), sprint: bits(beaten['sprint']) } };
}

export function loadContestProgress(): ContestProgress {
  return read(CONTEST_KEY, validateContest) ?? { beaten: { flags: 0, sprint: 0 } };
}

export function isContestBeaten(
  progress: ContestProgress,
  levelId: number,
  kind: ContestKind,
): boolean {
  return (progress.beaten[kind] & (1 << levelId)) !== 0;
}

/** Records a win over a boss; returns whether it is the first on that level and mode. */
export function markContestBeaten(levelId: number, kind: ContestKind): boolean {
  const progress = loadContestProgress();
  if (isContestBeaten(progress, levelId, kind)) return false;
  progress.beaten[kind] = (progress.beaten[kind] | (1 << levelId)) >>> 0;
  write(CONTEST_KEY, progress);
  return true;
}

/** The player's best contest run (cleared with the records, unlike the wins). */
function contestRecordKey(levelId: number, kind: ContestKind): string {
  return `${RECORD_PREFIX}contest.${levelId}.${kind}`;
}

export function loadContestRecord(levelId: number, kind: ContestKind): RecordEntry | null {
  return read(contestRecordKey(levelId, kind), validateRecord);
}

/** Stores `entry` when it is the player's fastest contest run; returns whether it was. */
export function updateContestRecord(
  levelId: number,
  kind: ContestKind,
  entry: RecordEntry,
): boolean {
  if (!isBetterRecord(kind, entry, loadContestRecord(levelId, kind), levelId)) return false;
  return write(contestRecordKey(levelId, kind), entry);
}

// ---------------------------------------------------------------------------------------------
// The full-game timer (for speedruns; not part of the original)
// ---------------------------------------------------------------------------------------------

/** The timer's total when a level turned complete. */
export interface FullGameSplit {
  levelId: number;
  totalMs: number;
}

/**
 * The game clock of every attempt of a run added up: only play counts, never the menus,
 * briefings or pauses. `finishedMs` is set once the credits were reached.
 */
export interface FullGameRun {
  totalMs: number;
  splits: FullGameSplit[];
  finishedMs: number | null;
}

/** The fastest finished run. */
export interface FullGameBest {
  totalMs: number;
  splits: FullGameSplit[];
}

const FULL_GAME_RUN_KEY = 'speedrun.run';
const FULL_GAME_BEST_KEY = 'speedrun.best';

function isMs(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function validateSplits(raw: unknown): FullGameSplit[] | null {
  if (!Array.isArray(raw)) return null;
  const out: FullGameSplit[] = [];
  for (const split of raw) {
    if (!isRecordObject(split) || !isMs(split['levelId']) || !isMs(split['totalMs'])) return null;
    out.push({ levelId: split['levelId'], totalMs: split['totalMs'] });
  }
  return out;
}

function validateFullGameRun(raw: unknown): FullGameRun | null {
  if (!isRecordObject(raw) || !isMs(raw['totalMs'])) return null;
  const splits = validateSplits(raw['splits']);
  if (!splits) return null;
  const finishedMs = isMs(raw['finishedMs']) ? raw['finishedMs'] : null;
  return { totalMs: raw['totalMs'], splits, finishedMs };
}

function validateFullGameBest(raw: unknown): FullGameBest | null {
  if (!isRecordObject(raw) || !isMs(raw['totalMs'])) return null;
  const splits = validateSplits(raw['splits']);
  return splits ? { totalMs: raw['totalMs'], splits } : null;
}

/**
 * The timer's entries as last read or written, kept for the storage they live in: the timer is
 * drawn every frame and should not parse them every frame. (Another tab writing them is not
 * seen until a reload.)
 */
let fullGameCache: { store: Storage | null; run: FullGameRun; best: FullGameBest | null } | null =
  null;

function fullGame(): { run: FullGameRun; best: FullGameBest | null } {
  const store = storage();
  if (fullGameCache?.store !== store) {
    fullGameCache = {
      store,
      run: read(FULL_GAME_RUN_KEY, validateFullGameRun) ?? {
        totalMs: 0,
        splits: [],
        finishedMs: null,
      },
      best: read(FULL_GAME_BEST_KEY, validateFullGameBest),
    };
  }
  return fullGameCache;
}

function saveRun(run: FullGameRun): FullGameRun {
  fullGame().run = run;
  write(FULL_GAME_RUN_KEY, run);
  return run;
}

/** The run (a copy: change it through the functions below). */
export function loadFullGameRun(): FullGameRun {
  const { run } = fullGame();
  return { ...run, splits: [...run.splits] };
}

export function loadFullGameBest(): FullGameBest | null {
  return fullGame().best;
}

/** Adds an attempt's game clock to the run (nothing once the run is finished). */
export function addFullGameTime(ms: number): FullGameRun {
  const run = loadFullGameRun();
  if (run.finishedMs !== null || ms <= 0) return run;
  run.totalMs += Math.round(ms);
  return saveRun(run);
}

/** Notes the run's total when a level turned complete (once per level). */
export function splitFullGame(levelId: number): FullGameRun {
  const run = loadFullGameRun();
  if (run.finishedMs !== null || run.splits.some((s) => s.levelId === levelId)) return run;
  run.splits.push({ levelId, totalMs: run.totalMs });
  return saveRun(run);
}

export interface FullGameFinish {
  run: FullGameRun;
  /** The best before this run (null when there was none). */
  previousBest: FullGameBest | null;
  /** This run is the new best. */
  newBest: boolean;
}

/** Stops the run and keeps it as the best when it is faster; null if it was stopped already. */
export function finishFullGame(): FullGameFinish | null {
  const run = loadFullGameRun();
  if (run.finishedMs !== null || run.totalMs <= 0) return null;
  run.finishedMs = run.totalMs;
  saveRun(run);
  const previousBest = loadFullGameBest();
  const newBest = previousBest === null || run.totalMs < previousBest.totalMs;
  if (newBest) {
    const best = { totalMs: run.totalMs, splits: run.splits };
    fullGame().best = best;
    write(FULL_GAME_BEST_KEY, best);
  }
  return { run, previousBest, newBest };
}

/** Zeroes the full-game timer: its run and its best. */
export function clearFullGameTimer(): void {
  remove(FULL_GAME_RUN_KEY);
  remove(FULL_GAME_BEST_KEY);
}
