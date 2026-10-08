/**
 * Player profile in `localStorage` under the `parapet.` prefix: options, the best run per
 * level and mode (with its input log, so it can be watched, raced as a ghost or shared) and the
 * last player name/character. Every entry is wrapped in `{ v, data }` so the schema can evolve; every
 * read is guarded, because storage may be disabled, full or hold garbage.
 */
import {
  compareRuns,
  isRankedMode,
  isRunMode,
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
  /**
   * BCP 47 code of the chosen language; empty until the first launch picks one from the
   * browser's preferences ('auto', the old default, counts as empty).
   */
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
}

export const DEFAULT_OPTIONS: Readonly<Options> = {
  locale: '',
  scaleMode: 'auto',
  vibration: true,
  musicLevel: 70,
  touchControls: 'auto',
  touchLayout: 'move-left',
  bestGhost: true,
  fullscreen: 'auto',
};

/**
 * The volume of the first schemas, 0..8 steps on a linear scale, as a percentage on the
 * slider's curve (gain = level²) that sounds the same: 4 of 8 becomes 70 %.
 */
export function levelFromVolumeSteps(steps: number): number {
  const s = Math.max(0, Math.min(8, steps));
  return Math.round((Math.sqrt(s / 8) * 100) / 5) * 5;
}

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

export interface StoredRecord {
  levelId: number;
  mode: RunMode;
  entry: RecordEntry;
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

/** Whether `localStorage` can be read and written right now. */
export function isStorageAvailable(): boolean {
  const store = storage();
  if (!store) return false;
  try {
    const probe = `${STORAGE_PREFIX}probe`;
    store.setItem(probe, '1');
    store.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Upgrades an older envelope to the current schema; null drops entries we cannot read. */
function migrate(envelope: Envelope): unknown {
  if (envelope.v === SCHEMA_VERSION) return envelope.data;
  // Newer than this build, or an unknown older version: ignore rather than misread.
  return null;
}

function read<T>(key: string, validate: (raw: unknown) => T | null): T | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_PREFIX + key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed)) return null;
    const data = migrate(parsed);
    return data === null ? null : validate(data);
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

function remove(key: string): void {
  try {
    storage()?.removeItem(STORAGE_PREFIX + key);
  } catch {
    // nothing to do
  }
}

function validateOptions(raw: unknown): Partial<Options> | null {
  if (!isRecordObject(raw)) return null;
  const out: Partial<Options> = {};
  if (typeof raw['locale'] === 'string') out.locale = raw['locale'] === 'auto' ? '' : raw['locale'];
  if (isScaleMode(raw['scaleMode'])) out.scaleMode = raw['scaleMode'];
  if (typeof raw['vibration'] === 'boolean') out.vibration = raw['vibration'];
  const musicLevel = raw['musicLevel'];
  const musicVolume = raw['musicVolume'];
  if (typeof musicLevel === 'number' && Number.isFinite(musicLevel)) {
    out.musicLevel = Math.max(0, Math.min(100, Math.round(musicLevel)));
  } else if (typeof musicVolume === 'number' && Number.isInteger(musicVolume)) {
    out.musicLevel = levelFromVolumeSteps(musicVolume); // the 0..8 steps of the second schema
  } else if (raw['music'] === false) {
    out.musicLevel = 0; // the on/off switch of the first schema
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
  if (typeof time !== 'number' || typeof score !== 'number' || !input) return null;
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
    simVersion: typeof raw['simVersion'] === 'string' ? raw['simVersion'] : '',
    date: typeof raw['date'] === 'string' ? raw['date'] : '',
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

export function removeRecord(levelId: number, mode: RunMode): void {
  remove(recordKey(levelId, mode));
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

/** Stores `entry` when it beats the current record; returns whether it did. */
export function updateRecord(levelId: number, mode: RunMode, entry: RecordEntry): boolean {
  if (!isBetterRecord(mode, entry, loadRecord(levelId, mode), levelId)) return false;
  return saveRecord(levelId, mode, entry);
}

/** Every stored record, in storage order. */
export function listRecords(): StoredRecord[] {
  const store = storage();
  if (!store) return [];
  const out: StoredRecord[] = [];
  try {
    const prefix = STORAGE_PREFIX + RECORD_PREFIX;
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const [level, mode] = key.slice(prefix.length).split('.');
      const levelId = Number(level);
      if (!Number.isInteger(levelId) || !isRunMode(mode)) continue;
      const entry = loadRecord(levelId, mode);
      if (entry) out.push({ levelId, mode, entry });
    }
  } catch {
    // partial results are fine
  }
  return out;
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

/** A level opens once the total completed missions reach its threshold (`z[8]`). */
export function isLevelUnlocked(progress: Progress, threshold: number): boolean {
  return completedCount(progress) >= threshold;
}

export function markPrizeSeen(): void {
  const progress = loadProgress();
  if (progress.prizeSeen) return;
  progress.prizeSeen = true;
  saveProgress(progress);
}

export function clearProgress(): void {
  remove(PROGRESS_KEY);
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

// ---------------------------------------------------------------------------------------------
// Entries of earlier builds
// ---------------------------------------------------------------------------------------------

/**
 * Keys written by earlier builds that nothing reads any more: `identity` held the claimed
 * public name and its token from the time Parapet had an online leaderboard.
 */
const LEGACY_KEYS = ['identity'];

/** Removes the entries of earlier builds (call once at start-up). */
export function dropLegacyEntries(): void {
  for (const key of LEGACY_KEYS) remove(key);
}

// ---------------------------------------------------------------------------------------------
// Contests with the bosses (not part of the original's progress)
// ---------------------------------------------------------------------------------------------

/** The modes the bosses are raced in. */
export type ContestKind = 'flags' | 'sprint';

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
