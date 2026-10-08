/**
 * Shareable replays: everything needed to re-run a recorded run (level, mode, rival flag and
 * the input log) plus the versions it was recorded on and the runner's name and character.
 * Encoded as compact bytes in base64url so a whole run fits into a link fragment:
 *
 *   u8   format (REPLAY_FORMAT)
 *   str  simVersion, rulesetId          (u8 byte length + UTF-8)
 *   u8   levelId, mode index (RUN_MODES), flags (bit 0: with rival), character
 *   u32  content hashes: level, moves, tables (little endian)
 *   str  playerName
 *   var  number of input runs, then per run `ticks * 64 + bits` as an unsigned LEB128 varint
 *
 * A minute of play is roughly 600 bytes, 800 characters of link. Decoding never throws: any
 * malformed, truncated or oversized input yields an error result.
 */
import type { ContentHash } from './content/hash.ts';
import { isRankedMode, LEVEL_COUNT } from './ranking.ts';
import { MAX_INPUT_BITS, MAX_STEPS, type InputRun } from './replay.ts';
import { RUN_MODES, type RunMode } from './run.ts';

export const REPLAY_FORMAT = 1;

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
// Bytes
// ---------------------------------------------------------------------------------------------

class Writer {
  private bytes: number[] = [];

  u8(v: number): void {
    this.bytes.push(v & 0xff);
  }

  u32(v: number): void {
    this.u8(v);
    this.u8(v >>> 8);
    this.u8(v >>> 16);
    this.u8(v >>> 24);
  }

  varint(v: number): void {
    let n = v;
    while (n >= 0x80) {
      this.u8((n % 0x80) | 0x80);
      n = Math.floor(n / 0x80);
    }
    this.u8(n);
  }

  str(text: string, maxBytes: number): void {
    const data = new TextEncoder().encode(text);
    if (data.length > maxBytes) throw new Error(`string longer than ${maxBytes} bytes`);
    this.u8(data.length);
    for (const b of data) this.u8(b);
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

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

// ---------------------------------------------------------------------------------------------
// Replay <-> code
// ---------------------------------------------------------------------------------------------

/** Encodes a replay as a base64url code. Throws on a replay `decodeReplay` would refuse. */
export function encodeReplay(replay: Replay): string {
  const problem = checkReplay(replay);
  if (problem) throw new Error(`invalid replay: ${problem}`);
  const w = new Writer();
  w.u8(REPLAY_FORMAT);
  w.str(replay.simVersion, MAX_VERSION_BYTES);
  w.str(replay.rulesetId, MAX_VERSION_BYTES);
  w.u8(replay.levelId);
  w.u8(RUN_MODES.indexOf(replay.mode));
  w.u8(replay.withRival ? 1 : 0);
  w.u8(replay.character);
  w.u32(replay.contentHash.level);
  w.u32(replay.contentHash.moves);
  w.u32(replay.contentHash.tables);
  w.str(replay.playerName, MAX_NAME_BYTES);
  w.varint(replay.input.length);
  for (const run of replay.input) w.varint(run.ticks * WRAP_TICKS + run.bits);
  return toBase64Url(w.finish());
}

export function decodeReplay(code: string): DecodeResult {
  const bytes = fromBase64Url(code.trim());
  if (!bytes) return fail('not a replay code');
  const r = new Reader(bytes);
  const format = r.u8();
  if (format === null) return fail('empty replay');
  if (format !== REPLAY_FORMAT) return fail(`unknown replay format ${format}`);
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
