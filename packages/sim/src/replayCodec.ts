/**
 * Shareable replays: everything needed to re-run a recorded run (level, mode, rival flag and
 * the input log) plus the versions it was recorded on and the runner's name and character,
 * packed into base64url so a whole run fits into a link fragment.
 *
 * Format 2 (written now), a stream of bits, most significant first:
 *
 *   8   format (2)
 *   16  version key: FNV-1a of simVersion and rulesetId, low 16 bits (`versionKey`)
 *   32  content key: FNV-1a of the level, move table and physics table hashes (`contentKey`)
 *   4+3+1  levelId, mode index (RUN_MODES), with rival
 *   8   character
 *   8   name length in bytes, then the name in UTF-8
 *   ..  the input: the number of runs less one (Exp-Golomb, order 4), then per run its value
 *       and its length. A value after a press: 0 for "nothing pressed", else 1 and the press;
 *       after nothing pressed (and first) the press alone. Presses use a prefix code by how
 *       often they come (up: 1 bit; down and a direction with forward or back: 3 to 5 bits;
 *       anything else: an escape and 6 bits). A length less one is a Rice code whose parameter
 *       follows the mean of the earlier ones of its kind (pauses, presses), so long pauses and
 *       one-step presses both cost little; a huge one escapes to Exp-Golomb.
 *   ..  zero bits to the byte.
 *
 * Less than half of format 1 for human play: a sprint of half a minute is under a hundred
 * characters. The keys only tell whether a replay was made by this build on this content
 * (`replayCompatibility`); a decoded replay carries them in `keys`.
 *
 * Format 1 (still read): bytes; u8 format, versions as strings, levelId, mode, flags and
 * character as bytes, the three content hashes as u32, the name, then the number of runs and
 * per run `ticks * 64 + bits` as unsigned LEB128.
 *
 * Decoding never throws: any malformed, truncated or oversized input yields an error result,
 * and a code has one spelling only (no stray bits, no trailing bytes).
 */
import { fnv1a, type ContentHash } from './content/hash.ts';
import { isRankedMode, LEVEL_COUNT } from './ranking.ts';
import { MAX_INPUT_BITS, MAX_STEPS, type InputRun } from './replay.ts';
import { RUN_MODES, type RunMode } from './run.ts';
import { RULESET_ID, SIM_VERSION } from './version.ts';

/** The format codes are written in (see above). */
export const REPLAY_FORMAT = 2;
/** The first format, still read. */
const FORMAT_BYTES = 1;

/** Longest runner name a replay carries, in characters. */
export const MAX_REPLAY_NAME_LENGTH = 24;

const MAX_VERSION_BYTES = 64;
const MAX_NAME_BYTES = MAX_REPLAY_NAME_LENGTH * 4;
const WRAP_TICKS = MAX_INPUT_BITS + 1;

export interface Replay {
  /** `SIM_VERSION` of the simulation that recorded the run. */
  simVersion: string;
  /** `RULESET_ID` of the rules and move table it ran. */
  rulesetId: string;
  /** Hashes of the level, move table and physics tables it ran on. */
  contentHash: ContentHash;
  levelId: number;
  /** One of the ranked modes (sprint, flag hunt, score run, challenge). */
  mode: RunMode;
  /** Sprint only: whether the original rival raced (the rival is part of the world). */
  withRival: boolean;
  /**
   * Character the runner played: 0 Blaise, 1..9 the original's others, 10 and up the looks won
   * from Gwynerva. Purely cosmetic; a character a client does not know is drawn as Blaise.
   */
  character: number;
  /** Display name of the runner; not verified by anything. */
  playerName: string;
  input: InputRun[];
  /**
   * What a compact code carries instead of the versions and the content hashes: decoded from
   * format 2, `simVersion` and `rulesetId` are this build's when the version key matches (else
   * "unknown") and `contentHash` is unknown (zeros); compare with `replayCompatibility`.
   */
  keys?: ReplayKeys;
}

/** The short keys of a replay's versions (16 bits) and content (32 bits). */
export interface ReplayKeys {
  version: number;
  content: number;
}

/** Key of a simulation version and ruleset: 16 bits of FNV-1a. */
export function versionKey(simVersion: string, rulesetId: string): number {
  return fnv1a(`${simVersion}\n${rulesetId}`) & 0xffff;
}

/** Key of a run's content: FNV-1a of its three hashes. */
export function contentKey(hash: ContentHash): number {
  return fnv1a(`${hash.level},${hash.moves},${hash.tables}`);
}

/** The keys of a replay (its own when it was decoded from a compact code). */
export function replayKeys(replay: Replay): ReplayKeys {
  return (
    replay.keys ?? {
      version: versionKey(replay.simVersion, replay.rulesetId),
      content: contentKey(replay.contentHash),
    }
  );
}

export type DecodeResult = { ok: true; replay: Replay } | { ok: false; error: string };

/** Control characters and the Unicode line/paragraph separators are not allowed in names. */
export function hasControlChars(text: string): boolean {
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x20 || c === 0x7f || c === 0x2028 || c === 0x2029) return true;
  }
  return false;
}

/** Trims a name to what a replay can carry: no control characters, at most 24 characters. */
export function cleanReplayName(name: string): string {
  const visible = Array.from(name.normalize('NFC'))
    .filter((ch) => !hasControlChars(ch))
    .join('')
    .trim();
  return Array.from(visible).slice(0, MAX_REPLAY_NAME_LENGTH).join('');
}

// ---------------------------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------------------------

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOOKUP = new Int8Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += ALPHABET[n >> 18]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]!;
    out += ALPHABET[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i]! << 16;
    out += ALPHABET[n >> 18]! + ALPHABET[(n >> 12) & 63]!;
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += ALPHABET[n >> 18]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]!;
  }
  return out;
}

/** Decodes unpadded base64url; null for any other character or an impossible length. */
export function fromBase64Url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const v = c < 128 ? LOOKUP[c]! : -1;
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------------------------

/** A press's code: its value, its bits (read most significant first) and their count. */
type PressCode = readonly [value: number, code: number, length: number];

/**
 * Presses by how often people make them: up; down; right or left with forward (towards where
 * the runner looks) or back. Anything else follows the escape as 6 plain bits.
 */
const PRESS_CODES: readonly PressCode[] = [
  [1, 0b0, 1],
  [2, 0b100, 3],
  [20, 0b101, 3],
  [24, 0b110, 3],
  [36, 0b1110, 4],
  [40, 0b11110, 5],
];
const PRESS_ESCAPE = 0b11111;
const PRESS_ESCAPE_LENGTH = 5;
const PRESS_BITS = 6;
/** A Rice code's ones before it gives up and escapes to Exp-Golomb. */
const RICE_LIMIT = 12;
/** Order of the Exp-Golomb code of the number of runs. */
const COUNT_ORDER = 4;

/** The parameter of a Rice code from the mean of the values coded so far (as in LOCO-I). */
class Adaptive {
  private sum: number;
  private count = 1;

  constructor(start: number) {
    this.sum = start;
  }

  get k(): number {
    let k = 0;
    while (this.count * 2 ** k < this.sum && k < 20) k++;
    return k;
  }

  update(value: number): void {
    this.sum += value;
    this.count++;
    // Halving keeps it following the recent values.
    if (this.count >= 32) {
      this.sum = Math.floor(this.sum / 2);
      this.count = Math.floor(this.count / 2);
    }
  }
}

class BitWriter {
  private readonly bytes: number[] = [];
  private acc = 0;
  private used = 0;

  bit(b: number): void {
    this.acc = (this.acc << 1) | (b & 1);
    if (++this.used === 8) {
      this.bytes.push(this.acc);
      this.acc = 0;
      this.used = 0;
    }
  }

  /** The low `count` bits of `value` (count ≤ 32), most significant first. */
  bits(value: number, count: number): void {
    for (let i = count - 1; i >= 0; i--) this.bit(Math.floor(value / 2 ** i) % 2);
  }

  /** Exp-Golomb code of order `k` of `value` ≥ 0. */
  expGolomb(value: number, k: number): void {
    const m = Math.floor(value / 2 ** k) + 1;
    const length = Math.floor(Math.log2(m)) + 1;
    this.bits(0, length - 1);
    this.bits(m, length);
    this.bits(value % 2 ** k, k);
  }

  /** Rice code of parameter `k` of `value` ≥ 0, escaping to Exp-Golomb for big ones. */
  rice(value: number, k: number): void {
    const q = Math.floor(value / 2 ** k);
    if (q < RICE_LIMIT) {
      for (let i = 0; i < q; i++) this.bit(1);
      this.bit(0);
      this.bits(value % 2 ** k, k);
      return;
    }
    for (let i = 0; i < RICE_LIMIT; i++) this.bit(1);
    this.expGolomb(value - RICE_LIMIT * 2 ** k, k);
  }

  press(value: number): void {
    const code = PRESS_CODES.find(([v]) => v === value);
    if (code) {
      this.bits(code[1], code[2]);
      return;
    }
    this.bits(PRESS_ESCAPE, PRESS_ESCAPE_LENGTH);
    this.bits(value, PRESS_BITS);
  }

  /** The bytes, the last one filled up with zero bits. */
  finish(): Uint8Array {
    const out = this.bytes.slice();
    if (this.used > 0) out.push(this.acc << (8 - this.used));
    return Uint8Array.from(out);
  }
}

class BitReader {
  private readonly bytes: Uint8Array;
  private pos = 0;
  /** Read past the end (every read then gives zeros). */
  overrun = false;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  bit(): number {
    const byte = this.pos >> 3;
    if (byte >= this.bytes.length) {
      this.overrun = true;
      return 0;
    }
    const b = (this.bytes[byte]! >> (7 - (this.pos & 7))) & 1;
    this.pos++;
    return b;
  }

  bits(count: number): number {
    let v = 0;
    for (let i = 0; i < count; i++) v = v * 2 + this.bit();
    return v;
  }

  /** Exp-Golomb of order `k`, or null for a length no value of ours has. */
  expGolomb(k: number): number | null {
    let zeros = 0;
    while (this.bit() === 0) {
      if (++zeros > 31 || this.overrun) return null;
    }
    const m = 2 ** zeros + this.bits(zeros);
    return (m - 1) * 2 ** k + this.bits(k);
  }

  rice(k: number): number | null {
    let q = 0;
    while (q < RICE_LIMIT && this.bit() === 1) q++;
    if (this.overrun) return null;
    if (q < RICE_LIMIT) return q * 2 ** k + this.bits(k);
    const rest = this.expGolomb(k);
    return rest === null ? null : RICE_LIMIT * 2 ** k + rest;
  }

  press(): number {
    let code = 0;
    for (let length = 1; length <= PRESS_ESCAPE_LENGTH; length++) {
      code = code * 2 + this.bit();
      const found = PRESS_CODES.find(([, c, l]) => l === length && c === code);
      if (found) return found[0];
    }
    return this.bits(PRESS_BITS);
  }

  /** Only the zero bits that fill up the last byte are left. */
  get atEnd(): boolean {
    if (this.overrun) return false;
    const rest = this.bytes.length * 8 - this.pos;
    if (rest >= 8) return false;
    return this.bits(rest) === 0 && !this.overrun;
  }

  /** `count` whole bytes (the reader is on a byte boundary), or null past the end. */
  byteArray(count: number): Uint8Array | null {
    const out = new Uint8Array(count);
    for (let i = 0; i < count; i++) out[i] = this.bits(8);
    return this.overrun ? null : out;
  }
}

// ---------------------------------------------------------------------------------------------
// Replay <-> code
// ---------------------------------------------------------------------------------------------

/** Encodes a replay as a base64url code. Throws on a replay `decodeReplay` would refuse. */
export function encodeReplay(replay: Replay): string {
  const problem = checkReplay(replay);
  if (problem) throw new Error(`invalid replay: ${problem}`);
  const name = new TextEncoder().encode(replay.playerName);
  if (name.length > MAX_NAME_BYTES) throw new Error(`name longer than ${MAX_NAME_BYTES} bytes`);
  const keys = replayKeys(replay);
  const w = new BitWriter();
  w.bits(REPLAY_FORMAT, 8);
  w.bits(keys.version, 16);
  w.bits(keys.content, 32);
  w.bits(replay.levelId, 4);
  w.bits(RUN_MODES.indexOf(replay.mode), 3);
  w.bit(replay.withRival ? 1 : 0);
  w.bits(replay.character, 8);
  w.bits(name.length, 8);
  for (const b of name) w.bits(b, 8);
  w.expGolomb(replay.input.length - 1, COUNT_ORDER);
  const pauses = new Adaptive(24);
  const presses = new Adaptive(1);
  let pressed = false;
  for (const run of replay.input) {
    if (pressed) {
      w.bit(run.bits === 0 ? 0 : 1);
      if (run.bits !== 0) w.press(run.bits);
    } else {
      w.press(run.bits);
    }
    const kind = run.bits === 0 ? pauses : presses;
    w.rice(run.ticks - 1, kind.k);
    kind.update(run.ticks - 1);
    pressed = run.bits !== 0;
  }
  return toBase64Url(w.finish());
}

export function decodeReplay(code: string): DecodeResult {
  const bytes = fromBase64Url(code.trim());
  if (!bytes) return fail('not a replay code');
  if (bytes.length === 0) return fail('empty replay');
  if (bytes[0] === FORMAT_BYTES) return decodeBytes(bytes);
  if (bytes[0] !== REPLAY_FORMAT) return fail(`unknown replay format ${bytes[0]}`);
  const r = new BitReader(bytes);
  r.bits(8);
  const version = r.bits(16);
  const content = r.bits(32);
  const levelId = r.bits(4);
  const modeIndex = r.bits(3);
  const withRival = r.bit() === 1;
  const character = r.bits(8);
  const nameLength = r.bits(8);
  if (nameLength > MAX_NAME_BYTES) return fail('name is too long');
  const nameBytes = r.byteArray(nameLength);
  if (r.overrun || !nameBytes) return fail('truncated replay');
  let playerName: string;
  try {
    playerName = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
  } catch {
    return fail('name is not UTF-8');
  }
  const runs = r.expGolomb(COUNT_ORDER);
  if (runs === null || r.overrun) return fail('truncated replay');
  if (runs + 1 > MAX_STEPS) return fail('too many input runs');
  const input: InputRun[] = [];
  const pauses = new Adaptive(24);
  const presses = new Adaptive(1);
  let pressed = false;
  for (let i = 0; i <= runs; i++) {
    const bits: number = !pressed || r.bit() === 1 ? r.press() : 0;
    const kind = bits === 0 ? pauses : presses;
    const length = r.rice(kind.k);
    if (length === null || r.overrun) return fail('truncated input');
    if (length >= MAX_STEPS) return fail('input run of an invalid length');
    kind.update(length);
    input.push({ ticks: length + 1, bits });
    pressed = bits !== 0;
  }
  if (!r.atEnd) return fail('trailing bits');
  const mode = RUN_MODES[modeIndex];
  if (!mode) return fail('unknown mode');
  const ours = version === versionKey(SIM_VERSION, RULESET_ID);
  const replay: Replay = {
    simVersion: ours ? SIM_VERSION : 'unknown',
    rulesetId: ours ? RULESET_ID : 'unknown',
    contentHash: { level: 0, moves: 0, tables: 0 },
    levelId,
    mode,
    withRival,
    character,
    playerName,
    input,
    keys: { version, content },
  };
  const problem = checkReplay(replay);
  return problem ? fail(problem) : { ok: true, replay };
}

/** Format 1: plain bytes (see the top of the file). */
function decodeBytes(bytes: Uint8Array): DecodeResult {
  const r = new Reader(bytes);
  r.u8();
  const simVersion = r.str(MAX_VERSION_BYTES);
  const rulesetId = r.str(MAX_VERSION_BYTES);
  const levelId = r.u8();
  const modeIndex = r.u8();
  const flags = r.u8();
  const character = r.u8();
  const level = r.u32();
  const moves = r.u32();
  const tables = r.u32();
  const playerName = r.str(MAX_NAME_BYTES);
  const count = r.varint();
  if (
    simVersion === null ||
    rulesetId === null ||
    levelId === null ||
    modeIndex === null ||
    flags === null ||
    character === null ||
    level === null ||
    moves === null ||
    tables === null ||
    playerName === null ||
    count === null
  ) {
    return fail('truncated replay');
  }
  if (count > MAX_STEPS) return fail('too many input runs');
  const input: InputRun[] = [];
  for (let i = 0; i < count; i++) {
    const v = r.varint();
    if (v === null) return fail('truncated input');
    input.push({ ticks: Math.floor(v / WRAP_TICKS), bits: v % WRAP_TICKS });
  }
  if (!r.done) return fail('trailing bytes');
  const mode = RUN_MODES[modeIndex];
  if (!mode) return fail('unknown mode');
  const replay: Replay = {
    simVersion,
    rulesetId,
    contentHash: { level, moves, tables },
    levelId,
    mode,
    withRival: (flags & 1) !== 0,
    character,
    playerName,
    input,
  };
  const problem = checkReplay(replay);
  return problem ? fail(problem) : { ok: true, replay };
}

// ---------------------------------------------------------------------------------------------
// Format 1 bytes
// ---------------------------------------------------------------------------------------------

class Reader {
  private pos = 0;
  private readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  get done(): boolean {
    return this.pos >= this.bytes.length;
  }

  u8(): number | null {
    return this.pos < this.bytes.length ? this.bytes[this.pos++]! : null;
  }

  u32(): number | null {
    if (this.pos + 4 > this.bytes.length) return null;
    const b = this.bytes;
    const p = this.pos;
    this.pos += 4;
    return (b[p]! | (b[p + 1]! << 8) | (b[p + 2]! << 16) | (b[p + 3]! << 24)) >>> 0;
  }

  /** Unsigned LEB128 of at most 5 bytes (values below 2^35). */
  varint(): number | null {
    let value = 0;
    let scale = 1;
    for (let i = 0; i < 5; i++) {
      const b = this.u8();
      if (b === null) return null;
      value += (b & 0x7f) * scale;
      if ((b & 0x80) === 0) return value;
      scale *= 0x80;
    }
    return null;
  }

  str(maxBytes: number): string | null {
    const length = this.u8();
    if (length === null || length > maxBytes || this.pos + length > this.bytes.length) return null;
    const data = this.bytes.subarray(this.pos, this.pos + length);
    this.pos += length;
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(data);
    } catch {
      return null;
    }
  }
}

/** Structural checks shared by encoding and decoding; null when the replay is sound. */
function checkReplay(replay: Replay): string | null {
  if (!Number.isInteger(replay.levelId) || replay.levelId < 0 || replay.levelId >= LEVEL_COUNT) {
    return `level ${replay.levelId} does not exist`;
  }
  if (!RUN_MODES.includes(replay.mode) || !isRankedMode(replay.mode)) {
    return `mode ${replay.mode} has no records`;
  }
  if (replay.withRival && replay.mode !== 'sprint') return 'only a sprint has a rival';
  if (!Number.isInteger(replay.character) || replay.character < 0 || replay.character > 255) {
    return `character ${replay.character} cannot be stored`;
  }
  if (hasControlChars(replay.playerName)) return 'name contains control characters';
  if (Array.from(replay.playerName).length > MAX_REPLAY_NAME_LENGTH) return 'name is too long';
  if (replay.input.length === 0) return 'input is empty';
  let total = 0;
  for (const run of replay.input) {
    if (!Number.isInteger(run.ticks) || run.ticks < 1 || run.ticks > MAX_STEPS) {
      return 'input run of an invalid length';
    }
    if (!Number.isInteger(run.bits) || run.bits < 0 || run.bits > MAX_INPUT_BITS) {
      return 'input run with invalid press bits';
    }
    total += run.ticks;
    if (total > MAX_STEPS) return `input covers more than ${MAX_STEPS} steps`;
  }
  return null;
}

function fail(error: string): DecodeResult {
  return { ok: false, error };
}
