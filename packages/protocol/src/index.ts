/**
 * Wire protocol shared by the client and the server: the shape of a run submission, the
 * leaderboard records, the identity (claimed names) and the API responses, plus pure
 * structural validators. This package has no runtime dependency on the simulation so the
 * client bundle stays small and the server can validate before it touches the sim.
 */

export const PROTOCOL_VERSION = 2;

/** Game modes offered by Parapet (mirrors `RunMode` in @parapet/sim). */
export type RunMode = 'free' | 'sprint' | 'flags' | 'score' | 'challenge' | 'warmup1' | 'warmup2';

export const RUN_MODES: readonly RunMode[] = [
  'free',
  'sprint',
  'flags',
  'score',
  'challenge',
  'warmup1',
  'warmup2',
];

/** Modes with a leaderboard. Free runs never finish and warm-ups are tutorials. */
export const LEADERBOARD_MODES: readonly RunMode[] = ['sprint', 'flags', 'score', 'challenge'];

export type LeaderboardSort = 'time' | 'score';

/** Number of levels in the original game (`levels/0.json` .. `levels/11.json`). */
export const LEVEL_COUNT = 12;

/** Levels whose challenge is judged on the score (the others on time with required moves). */
export const SCORE_CHALLENGE_LEVELS: readonly number[] = [8, 10, 11];

/** Upper bound on the number of input runs in a submission. */
export const MAX_INPUT_RUNS = 50000;
/** Upper bound on the number of simulation steps a submission may replay (100 minutes). */
export const MAX_STEPS = 200000;
/** Display name carried by a submission (local records); public names are shorter. */
export const MAX_NAME_LENGTH = 24;
export const MAX_RULESET_ID_LENGTH = 32;
/** Largest press byte: UP | DOWN | RIGHT | LEFT | FORWARD | BACK. */
export const MAX_INPUT_BITS = 63;

/** Public (claimed) names. */
export const MIN_PUBLIC_NAME_LENGTH = 3;
export const MAX_PUBLIC_NAME_LENGTH = 16;
/** Secret that proves ownership of a claimed name: 32 random bytes, base64url. */
export const TOKEN_LENGTH = 43;
/** One-time code that recovers a name on another device. */
export const RECOVERY_CODE_LENGTH = 8;

export const LEADERBOARD_DEFAULT_LIMIT = 50;
export const LEADERBOARD_MAX_LIMIT = 200;

/** One run of the input log: `bits` held for `ticks` steps (see `InputRecorder` in the sim). */
export interface InputRun {
  ticks: number;
  bits: number;
}

/** Hashes of the content a run was recorded on (`contentHashes` in the sim). */
export interface ContentHash {
  level: number;
  moves: number;
  tables: number;
}

/** A claimed name and the device's secret for it. */
export interface Identity {
  name: string;
  token: string;
}

/** What the client thinks the run produced; the server replays and must agree. */
export interface RunClaim {
  finished: boolean;
  timeUp: boolean;
  /** Finish time in ms of game clock (`world.rules.result.time`). */
  time: number;
  /** `world.player.score.score` at the end of the run. */
  score: number;
  /** `world.stepCount` at the end of the run. */
  steps: number;
  /** `world.hash()` at the end of the run (unsigned 32-bit). */
  hash: number;
}

export interface RunSubmission {
  protocolVersion: 2;
  /** `SIM_VERSION` of the simulation the client ran. */
  simVersion: string;
  /** `RULESET_ID` of the rules and move table the client ran. */
  rulesetId: string;
  /** Hashes of the level, move table and physics tables the client ran. */
  contentHash: ContentHash;
  levelId: number;
  mode: RunMode;
  /** Sprint only: whether the original rival ghost was racing (it affects the hash). */
  withRival: boolean;
  playerName: string;
  character: number;
  /** `world.recorder.finish()` after the run ended. */
  input: InputRun[];
  claimed: RunClaim;
  /** Present to publish under a claimed name; absent to only verify the run. */
  identity?: Identity;
}

/** A verified run as stored and listed by the server. */
export interface RunRecord {
  id: string;
  levelId: number;
  mode: RunMode;
  withRival: boolean;
  /** The claimed name it was published under (the display name of a verify-only run). */
  playerName: string;
  /** Normalised name (`nameKey`); one personal best per key and board. */
  playerKey: string;
  character: number;
  time: number;
  score: number;
  finished: boolean;
  timeUp: boolean;
  /** Whether the run met the mission goal (`evaluateMission` in the sim). */
  won: boolean;
  steps: number;
  hash: number;
  simVersion: string;
  rulesetId: string;
  /** Kept off the boards for review (implausible result). */
  flagged: boolean;
  /** ISO 8601 timestamp. */
  submittedAt: string;
}

export type ErrorCode =
  | 'invalid'
  | 'mismatch'
  | 'unsupported'
  | 'limit'
  | 'rate-limited'
  | 'name-taken'
  | 'name-invalid'
  | 'unauthorized'
  | 'not-found';

export interface ErrorResponse {
  ok: false;
  error: string;
  code: ErrorCode;
  /** Seconds to wait before trying again (`rate-limited`). */
  retryAfter?: number;
}

export interface RunRank {
  /** 1-based position on the time board of the run's level and mode, null when not ranked. */
  byTime: number | null;
  /** 1-based position on the score board of the run's level and mode, null when not ranked. */
  byScore: number | null;
}

/** Why a verified run was not stored, or `stored` when it was. */
export type SubmitOutcome = 'stored' | 'verify-only' | 'not-best' | 'flagged';

export type SubmitRunResponse =
  { ok: true; run: RunRecord; rank: RunRank; outcome: SubmitOutcome } | ErrorResponse;

export interface LeaderboardResponse {
  levelId: number;
  mode: RunMode;
  sort: LeaderboardSort;
  entries: RunRecord[];
}

export interface HealthResponse {
  ok: true;
  simVersion: string;
  /** Number of stored runs. */
  runs: number;
  /** Number of claimed names. */
  names: number;
}

export interface ClaimNameRequest {
  name: string;
}

export type ClaimNameResponse =
  { ok: true; name: string; token: string; recoveryCode: string } | ErrorResponse;

export interface RecoverNameRequest {
  name: string;
  recoveryCode: string;
}

/** A recovery issues a new token and a new code; the old ones stop working. */
export type RecoverNameResponse =
  { ok: true; name: string; token: string; recoveryCode: string } | ErrorResponse;

export interface NameStatusResponse {
  name: string;
  valid: boolean;
  available: boolean;
}

export interface PlayerResponse {
  name: string;
  /** The player's personal best on every board they appear on. */
  bests: RunRecord[];
}

export interface ReplayResponse {
  id: string;
  levelId: number;
  mode: RunMode;
  withRival: boolean;
  input: InputRun[];
}

/**
 * Board a mode is ranked on when the request does not say: races by time, score runs and the
 * score challenges (levels 8, 10, 11) by score.
 */
export function defaultLeaderboardSort(mode: RunMode, levelId = -1): LeaderboardSort {
  if (mode === 'score') return 'score';
  if (mode === 'challenge' && SCORE_CHALLENGE_LEVELS.includes(levelId)) return 'score';
  return 'time';
}

export function isRunMode(value: unknown): value is RunMode {
  return typeof value === 'string' && (RUN_MODES as readonly string[]).includes(value);
}

export function isLeaderboardMode(mode: RunMode): boolean {
  return LEADERBOARD_MODES.includes(mode);
}

export function isLeaderboardSort(value: unknown): value is LeaderboardSort {
  return value === 'time' || value === 'score';
}

export type ValidationResult = { ok: true; value: RunSubmission } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function invalid(error: string): ValidationResult {
  return { ok: false, error };
}

/** Control characters and the Unicode line/paragraph separators are not allowed in names. */
export function hasControlChars(text: string): boolean {
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x20 || c === 0x7f || c === 0x2028 || c === 0x2029) return true;
  }
  return false;
}

const RULESET_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

// ---------------------------------------------------------------------------------------------
// Public names
// ---------------------------------------------------------------------------------------------

/**
 * Cyrillic letters that look like Latin ones, folded so "Pаrapet" with a Cyrillic "а" cannot
 * impersonate "Parapet". Applied after NFKC and lower-casing.
 */
const CONFUSABLES: Record<string, string> = {
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  у: 'y',
  х: 'x',
  к: 'k',
  м: 'm',
  т: 't',
  н: 'h',
  в: 'b',
  і: 'i',
  ѕ: 's',
  ј: 'j',
  ԁ: 'd',
  ɡ: 'g',
};

/** The key two names collide on: NFKC, lower case, confusables folded, separators dropped. */
export function nameKey(name: string): string {
  let out = '';
  for (const ch of name.normalize('NFKC').toLowerCase()) {
    if (ch === '_' || ch === '-' || ch === '.' || ch === ' ') continue;
    out += CONFUSABLES[ch] ?? ch;
  }
  return out;
}

export type NameValidation =
  { ok: true; name: string; key: string } | { ok: false; error: string; code: 'name-invalid' };

/** Letters and digits of any script plus `_`, `-` and `.`; 3-16 characters; no leading/trailing separators. */
export function validatePublicName(raw: unknown): NameValidation {
  if (typeof raw !== 'string')
    return { ok: false, error: 'name must be a string', code: 'name-invalid' };
  const name = raw.normalize('NFKC').trim();
  const length = Array.from(name).length;
  if (length < MIN_PUBLIC_NAME_LENGTH || length > MAX_PUBLIC_NAME_LENGTH) {
    return {
      ok: false,
      error: `name must be ${MIN_PUBLIC_NAME_LENGTH} to ${MAX_PUBLIC_NAME_LENGTH} characters`,
      code: 'name-invalid',
    };
  }
  if (hasControlChars(name))
    return { ok: false, error: 'name contains control characters', code: 'name-invalid' };
  if (!/^[\p{L}\p{N}][\p{L}\p{N}_.-]*[\p{L}\p{N}]$/u.test(name)) {
    return {
      ok: false,
      error:
        'name may use letters, digits, "_", "-" and "." and must start and end with a letter or digit',
      code: 'name-invalid',
    };
  }
  const key = nameKey(name);
  if (key.length < MIN_PUBLIC_NAME_LENGTH) {
    return {
      ok: false,
      error: 'name needs at least three letters or digits',
      code: 'name-invalid',
    };
  }
  return { ok: true, name, key };
}

function validateIdentity(value: unknown): Identity | null | 'invalid' {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return 'invalid';
  const name = value['name'];
  const token = value['token'];
  if (typeof name !== 'string' || typeof token !== 'string') return 'invalid';
  if (!validatePublicName(name).ok) return 'invalid';
  if (token.length < 16 || token.length > 128 || !TOKEN_PATTERN.test(token)) return 'invalid';
  return { name: name.normalize('NFKC').trim(), token };
}

function validateContentHash(value: unknown): ContentHash | null {
  if (!isRecord(value)) return null;
  const level = value['level'];
  const moves = value['moves'];
  const tables = value['tables'];
  if (!isInt(level, 0, 0xffffffff) || !isInt(moves, 0, 0xffffffff) || !isInt(tables, 0, 0xffffffff))
    return null;
  return { level, moves, tables };
}

/**
 * Structural validation of an untrusted submission (parsed JSON). Returns a normalised copy:
 * the name is trimmed and only the known fields are kept. Does not touch the simulation.
 */
export function validateSubmission(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid('submission must be an object');
  if (value['protocolVersion'] !== PROTOCOL_VERSION) {
    return invalid(`protocolVersion must be ${PROTOCOL_VERSION}`);
  }
  const simVersion = value['simVersion'];
  if (typeof simVersion !== 'string' || simVersion.length === 0 || simVersion.length > 64) {
    return invalid('simVersion must be a non-empty string');
  }
  const rulesetId = value['rulesetId'];
  if (
    typeof rulesetId !== 'string' ||
    rulesetId.length === 0 ||
    rulesetId.length > MAX_RULESET_ID_LENGTH ||
    !RULESET_ID_PATTERN.test(rulesetId)
  ) {
    return invalid('rulesetId must be a short lower-case identifier');
  }
  const contentHash = validateContentHash(value['contentHash']);
  if (!contentHash) return invalid('contentHash must hold level, moves and tables as uint32');
  const levelId = value['levelId'];
  if (!isInt(levelId, 0, LEVEL_COUNT - 1)) {
    return invalid(`levelId must be an integer between 0 and ${LEVEL_COUNT - 1}`);
  }
  const mode = value['mode'];
  if (!isRunMode(mode)) return invalid(`mode must be one of ${RUN_MODES.join(', ')}`);
  const withRival = value['withRival'];
  if (typeof withRival !== 'boolean') return invalid('withRival must be a boolean');
  const rawName = value['playerName'];
  if (typeof rawName !== 'string') return invalid('playerName must be a string');
  const playerName = rawName.trim();
  if (playerName.length === 0) return invalid('playerName must not be empty');
  if (playerName.length > MAX_NAME_LENGTH) {
    return invalid(`playerName must be at most ${MAX_NAME_LENGTH} characters`);
  }
  if (hasControlChars(playerName)) return invalid('playerName contains control characters');
  const character = value['character'];
  if (!isInt(character, 0, 255)) return invalid('character must be an integer between 0 and 255');
  const identity = validateIdentity(value['identity']);
  if (identity === 'invalid') return invalid('identity must hold a valid name and token');

  const rawInput = value['input'];
  if (!Array.isArray(rawInput)) return invalid('input must be an array');
  if (rawInput.length === 0) return invalid('input must not be empty');
  if (rawInput.length > MAX_INPUT_RUNS) {
    return invalid(`input must have at most ${MAX_INPUT_RUNS} runs`);
  }
  const input: InputRun[] = [];
  let totalTicks = 0;
  for (let i = 0; i < rawInput.length; i++) {
    const run: unknown = rawInput[i];
    if (!isRecord(run)) return invalid(`input[${i}] must be an object`);
    const ticks = run['ticks'];
    const bits = run['bits'];
    if (!isInt(ticks, 1, MAX_STEPS)) return invalid(`input[${i}].ticks must be a positive integer`);
    if (!isInt(bits, 0, MAX_INPUT_BITS)) {
      return invalid(`input[${i}].bits must be an integer between 0 and ${MAX_INPUT_BITS}`);
    }
    totalTicks += ticks;
    if (totalTicks > MAX_STEPS) return invalid(`input must cover at most ${MAX_STEPS} steps`);
    input.push({ ticks, bits });
  }

  const rawClaim = value['claimed'];
  if (!isRecord(rawClaim)) return invalid('claimed must be an object');
  const finished = rawClaim['finished'];
  const timeUp = rawClaim['timeUp'];
  const time = rawClaim['time'];
  const score = rawClaim['score'];
  const steps = rawClaim['steps'];
  const hash = rawClaim['hash'];
  if (typeof finished !== 'boolean') return invalid('claimed.finished must be a boolean');
  if (typeof timeUp !== 'boolean') return invalid('claimed.timeUp must be a boolean');
  if (!isInt(time, 0, Number.MAX_SAFE_INTEGER)) {
    return invalid('claimed.time must be a non-negative integer');
  }
  if (!isInt(score, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)) {
    return invalid('claimed.score must be an integer');
  }
  if (!isInt(steps, 0, MAX_STEPS)) {
    return invalid(`claimed.steps must be an integer between 0 and ${MAX_STEPS}`);
  }
  if (!isInt(hash, 0, 0xffffffff)) {
    return invalid('claimed.hash must be an unsigned 32-bit integer');
  }

  const normalised: RunSubmission = {
    protocolVersion: PROTOCOL_VERSION,
    simVersion,
    rulesetId,
    contentHash,
    levelId,
    mode,
    withRival,
    playerName,
    character,
    input,
    claimed: { finished, timeUp, time, score, steps, hash },
  };
  if (identity) normalised.identity = identity;
  return { ok: true, value: normalised };
}
