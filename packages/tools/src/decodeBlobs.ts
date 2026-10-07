/**
 * Files `b0`, `b1`, `b2` - containers of binary blobs located through the directory in the index
 * (D[46 + 3k .. 48 + 3k] = b-file, offset, length; read by `a(int,int,int,...)`, d.java
 * lines 1442-1479). This module reads blobs and decodes the structured ones: the move state
 * table, animation clips, physics tables, level tile maps, the mission table and the rival
 * input recordings.
 */
import { BinaryReader, readI16Array, readI32Array } from './binary.ts';
import type { BlobLocation, GameIndex } from './decodeIndex.ts';
import { at } from './util.ts';

/** Blob ids (see reference/notes/01-formats.md). */
export const BLOB = {
  KEYPAD_CHARS: 0,
  KEYPAD_MAP: 1,
  MOVE_DEMOS: 2,
  KEYFRAME_BOUNDS: 3,
  RIVAL_FIRST: 4,
  MOVES: 16,
  ANIMS: 17,
  TABLE_F: 18,
  TABLE_A: 19,
  TABLE_B: 20,
  TABLE_G: 21,
  TABLE_C: 22,
  TABLE_D: 23,
  TABLE_E: 24,
  TABLE_H: 25,
  TABLE_M: 26,
  LEVEL_FIRST: 27,
  MISSIONS: 39,
} as const;

export const LEVEL_COUNT = 12;

export function blobLocation(index: GameIndex, id: number): BlobLocation {
  return at(index.blobs, id, 'blobs');
}

/** Returns a view of blob `id` inside the b-files (`files[0]` = b0, `files[1]` = b1, `files[2]` = b2). */
export function readBlob(index: GameIndex, files: readonly Uint8Array[], id: number): Uint8Array {
  const loc = blobLocation(index, id);
  const file = at(files, loc.file, 'b-files');
  if (loc.offset + loc.length > file.length) {
    throw new RangeError(
      `blob ${id}: ${loc.offset}+${loc.length} overruns b${loc.file} (${file.length} bytes)`,
    );
  }
  return file.subarray(loc.offset, loc.offset + loc.length);
}

export function readBlobInts(index: GameIndex, files: readonly Uint8Array[], id: number): number[] {
  return readI32Array(readBlob(index, files, id), `blob ${id}`);
}

export function readBlobShorts(
  index: GameIndex,
  files: readonly Uint8Array[],
  id: number,
): number[] {
  return readI16Array(readBlob(index, files, id), `blob ${id}`);
}

// ---------------------------------------------------------------------------------------------
// Blob 16 - move state table (see 02-moves.md)
// ---------------------------------------------------------------------------------------------

export const MOVE_RECORD_SIZE = 14;

export interface MoveTransition {
  /** Condition ids (02-moves.md), all ANDed; empty = unconditional. */
  conditions: number[];
  target: number;
}

export interface MoveState {
  id: number;
  /** Duration in time units; -1 = 100 + (w >> 3). */
  duration: number;
  /** State entered when the timer expires; -1 = none. */
  next: number;
  /** z-type (impulse / physics behaviour). */
  impulseType: number;
  paramB: number;
  paramC: number;
  paramD: number;
  /** Offset of the animation clip in blob 17. */
  clipOffset: number;
  animMode: number;
  flags: number;
  /** x-type (snap on entry / per-step root motion). */
  snapType: number;
  /** Parent state whose transition list is checked after this one; -1 = none. */
  parent: number;
  /** Index of the transition list inside the table; -1 = none. */
  transitionList: number;
  transitions: MoveTransition[];
  scoreType: number;
  points: number;
}

export interface MoveTable {
  states: MoveState[];
  /** Index of the first transition list (the records end there). */
  transitionListStart: number;
  rawTransitionLists: number[];
}

/**
 * Unpacks a transition condition word.
 *
 * `boolean_h` (d.java line 9321) evaluates `boolean_d(word & 0xFF)` first, then does
 * `word >>= 8` and stops as soon as the remaining value is 0, otherwise tests the next
 * `& 0xFF` byte, up to four times. So the conditions are stored LOW BYTE FIRST: bits 0-7 are
 * tested first, then bits 8-15, 16-23 and 24-31. A zero byte is condition 0 ("always true"),
 * and an all-zero word is unconditional, so dropping the zero bytes is exact.
 */
export function unpackConditionWord(word: number): number[] {
  const conditions: number[] = [];
  let w = word >>> 0;
  for (let i = 0; i < 4; i++) {
    const c = w & 0xff;
    if (c !== 0) conditions.push(c);
    w >>>= 8;
  }
  return conditions;
}

export function decodeMoves(ints: readonly number[]): MoveTable {
  // The records are not counted anywhere: they run until the first transition list.
  let listStart = ints.length;
  let count = 0;
  for (;;) {
    const end = (count + 1) * MOVE_RECORD_SIZE;
    if (end > listStart) break;
    const list = at(ints, count * MOVE_RECORD_SIZE + 11, 'moves');
    if (list !== -1) {
      if (list < end) throw new Error(`move table: state ${count} points into its own record`);
      listStart = Math.min(listStart, list);
    }
    count++;
  }
  if (count * MOVE_RECORD_SIZE !== listStart) {
    throw new Error(
      `move table: ${listStart - count * MOVE_RECORD_SIZE} int(s) between the records and the transition lists`,
    );
  }
  const states: MoveState[] = [];
  for (let id = 0; id < count; id++) {
    const field = (i: number): number => at(ints, id * MOVE_RECORD_SIZE + i, 'moves');
    const transitionList = field(11);
    states.push({
      id,
      duration: field(0),
      next: field(1),
      impulseType: field(2),
      paramB: field(3),
      paramC: field(4),
      paramD: field(5),
      clipOffset: field(6),
      animMode: field(7),
      flags: field(8),
      snapType: field(9),
      parent: field(10),
      transitionList,
      transitions: transitionList === -1 ? [] : decodeTransitionList(ints, transitionList),
      scoreType: field(12),
      points: field(13),
    });
  }
  return { states, transitionListStart: listStart, rawTransitionLists: ints.slice(listStart) };
}

function decodeTransitionList(ints: readonly number[], start: number): MoveTransition[] {
  const count = at(ints, start, 'moves');
  const transitions: MoveTransition[] = [];
  for (let k = 0; k < count; k++) {
    transitions.push({
      conditions: unpackConditionWord(at(ints, start + 1 + 2 * k, 'moves')),
      target: at(ints, start + 2 + 2 * k, 'moves'),
    });
  }
  return transitions;
}

// ---------------------------------------------------------------------------------------------
// Blob 17 - animation clips; blob 2 - menu demos; blob 3 - keyframe bounding boxes
// ---------------------------------------------------------------------------------------------

export interface AnimClips {
  /** Keyframe ids of every clip, keyed by the offset of its count word. */
  clips: Record<string, number[]>;
  raw: number[];
}

/** Blob 17 is a plain sequence of clips: `count`, then `count` keyframe ids. */
export function decodeAnims(shorts: readonly number[]): AnimClips {
  const clips: Record<string, number[]> = {};
  let p = 0;
  while (p < shorts.length) {
    const count = at(shorts, p, 'anims');
    if (count <= 0 || p + 1 + count > shorts.length) {
      throw new Error(`anims: bad clip of ${count} frames at offset ${p}`);
    }
    clips[String(p)] = shorts.slice(p + 1, p + 1 + count);
    p += 1 + count;
  }
  return { clips, raw: [...shorts] };
}

export interface MoveDemo {
  clipOffset: number;
  frameCount: number;
  /** Description string id (56..75). */
  stringId: number;
}

/** Blob 2: 20 x (clip offset, frame count, description string) for the Moves menu. */
export function decodeMoveDemos(shorts: readonly number[]): MoveDemo[] {
  if (shorts.length % 3 !== 0)
    throw new Error(`move demos: ${shorts.length} shorts is not a multiple of 3`);
  const demos: MoveDemo[] = [];
  for (let i = 0; i < shorts.length; i += 3) {
    demos.push({
      clipOffset: at(shorts, i),
      frameCount: at(shorts, i + 1),
      stringId: at(shorts, i + 2),
    });
  }
  return demos;
}

/** Blob 3: per keyframe (minX, minY, maxX, maxY) of the character; used to centre the menu demos. */
export function decodeKeyframeBounds(
  shorts: readonly number[],
): [number, number, number, number][] {
  if (shorts.length % 4 !== 0)
    throw new Error(`keyframe bounds: ${shorts.length} shorts is not a multiple of 4`);
  const bounds: [number, number, number, number][] = [];
  for (let i = 0; i < shorts.length; i += 4) {
    bounds.push([at(shorts, i), at(shorts, i + 1), at(shorts, i + 2), at(shorts, i + 3)]);
  }
  return bounds;
}

// ---------------------------------------------------------------------------------------------
// Blobs 18-26 - physics tables and background themes (see 03-physics.md, 04-rendering.md)
// ---------------------------------------------------------------------------------------------

export interface PhysicsTables {
  /** Acceleration scale by speed/(cap/12). */
  F: number[];
  /** Tile -> column of B. */
  A: number[];
  /** 11 rows (k) x 11 pairs (flags, newK): contact following. */
  B: number[];
  /** Slope dy/dx x 1024 by surface type. */
  G: number[];
  /** Surface type -> speed class. */
  C: number[];
  /** Over-speed brake by class >> 1. */
  D: number[];
  /** Speed caps x 3400/1024 by class (+1 when moving up). */
  E: number[];
  /** Tile flag masks. */
  H: number[];
  /** 4 themes x (ground colour, sky bottom, sky top, far-layer sprite, cloud sprite or -1). */
  M: number[];
}

export function decodeTables(index: GameIndex, files: readonly Uint8Array[]): PhysicsTables {
  return {
    F: readBlobInts(index, files, BLOB.TABLE_F),
    A: readBlobInts(index, files, BLOB.TABLE_A),
    B: readBlobInts(index, files, BLOB.TABLE_B),
    G: readBlobInts(index, files, BLOB.TABLE_G),
    C: readBlobInts(index, files, BLOB.TABLE_C),
    D: readBlobInts(index, files, BLOB.TABLE_D),
    E: readBlobInts(index, files, BLOB.TABLE_E),
    H: readBlobInts(index, files, BLOB.TABLE_H),
    M: readBlobInts(index, files, BLOB.TABLE_M),
  };
}

// ---------------------------------------------------------------------------------------------
// Blobs 27-38 - level tile maps (`m(int,int)`, d.java lines 9588-9661)
// ---------------------------------------------------------------------------------------------

export const MISSION_TYPE_COUNT = 6;

export interface Point {
  x: number;
  y: number;
}

export interface MissionLayout {
  start: Point;
  finish: Point | null;
  /** Coach position in the warm-ups; in Sprint sections it is the rival start cell. */
  npc: Point | null;
  /** Checkpoints (Sprint) or flags, in order. */
  checkpoints: Point[];
}

export interface LevelMap {
  width: number;
  height: number;
  /** Row-major tile ids (index = y * width + x), exactly as stored. */
  tiles: number[];
  /** One section per mission type 0..5; null when the section is empty. */
  missions: Record<number, MissionLayout | null>;
}

/**
 * i16 W, i16 H; RLE pairs (count - 1, tileId) until W*H cells are filled; then 6 sections, one
 * per mission type, each terminated by -1: startX, startY; finishX, finishY or a single -2;
 * npcX, npcY or a single -2; then (x, y) checkpoint pairs.
 */
export function decodeLevelMap(shorts: readonly number[]): LevelMap {
  let p = 0;
  const next = (): number => at(shorts, p++, 'level map');
  const width = next();
  const height = next();
  const cellCount = width * height;
  const tiles: number[] = [];
  while (tiles.length < cellCount) {
    const run = next() + 1;
    const tile = next();
    for (let i = 0; i < run; i++) tiles.push(tile);
  }
  if (tiles.length !== cellCount) {
    throw new Error(`level map: RLE produced ${tiles.length} cells for ${width}x${height}`);
  }
  const missions: Record<number, MissionLayout | null> = {};
  const readPoint = (): Point => {
    const x = next();
    const y = next();
    return { x, y };
  };
  const readOptionalPoint = (): Point | null => {
    if (at(shorts, p, 'level map') === -2) {
      p++;
      return null;
    }
    return readPoint();
  };
  for (let type = 0; type < MISSION_TYPE_COUNT; type++) {
    if (at(shorts, p, 'level map') === -1) {
      p++;
      missions[type] = null;
      continue;
    }
    const start = readPoint();
    const finish = readOptionalPoint();
    const npc = readOptionalPoint();
    const checkpoints: Point[] = [];
    while (at(shorts, p, 'level map') !== -1) checkpoints.push(readPoint());
    p++;
    missions[type] = { start, finish, npc, checkpoints };
  }
  if (p !== shorts.length) {
    throw new Error(`level map: ${shorts.length - p} trailing short(s) after the mission sections`);
  }
  return { width, height, tiles, missions };
}

// ---------------------------------------------------------------------------------------------
// Blob 39 - mission table, 12 x 28 ints (see 05-modes-data.md; decoded at d.java line 6782)
// ---------------------------------------------------------------------------------------------

export const MISSION_RECORD_SIZE = 28;
export const MAX_MISSIONS_PER_LEVEL = 5;

export type GoalKind = 'sprint' | 'time' | 'score';

export interface MissionGoal {
  raw: number;
  /** -2 = sprint (target comes from the rival); sign bit set = time limit; otherwise a score. */
  kind: GoalKind;
  /** Time limit in ms or score target; null for sprint. */
  value: number | null;
  defaultTime: number;
  defaultScore: number;
}

/** Challenge rules of a level (`@parapet/sim` `ChallengeInfo`). */
export interface ChallengeInfo {
  timeLimit: number;
  requiredMoveBits: number;
  scoreTarget: number;
}

export interface LevelMissions {
  id: number;
  nameStringId: number;
  mapBlob: number;
  missionCount: number;
  /** Mission type per mission (nibbles of the type word, LSB first). */
  missionTypes: number[];
  scoreTimeLimit: number;
  sprintTimeLimit: number;
  rivalBlob: number;
  rivalStartDelay: number;
  unlockThreshold: number;
  backgroundFile: number;
  backgroundLength: number;
  backgroundSceneId: number;
  rivalCharacter: number;
  goals: MissionGoal[];
  challenge: ChallengeInfo | null;
}

/**
 * The challenge conditions are not in the data: `x(7)` (d.java lines 5359-5393) hard-codes
 * the required move bits (`bC`) of levels 3, 5 and 6 and the score targets of levels 8, 10
 * and 11. Bits: 0x2 wall flip, 0x4 spider jump, 0x8 monkey vault, 0x10 monkey flip,
 * 0x20 pole jump, 0x40 pole spin.
 */
const CHALLENGE_MOVE_BITS: Record<number, number> = { 3: 0x2, 5: 0x4 | 0x8 | 0x10, 6: 0x20 | 0x40 };
const CHALLENGE_SCORE_TARGET: Record<number, number> = { 8: 2000, 10: 3200, 11: 5000 };

function challengeInfo(
  id: number,
  missionTypes: readonly number[],
  goals: readonly MissionGoal[],
): ChallengeInfo | null {
  const slot = missionTypes.indexOf(3);
  if (slot < 0) return null;
  const goal = goals[slot];
  return {
    timeLimit: goal?.kind === 'time' && goal.value !== null ? goal.value : -1,
    requiredMoveBits: CHALLENGE_MOVE_BITS[id] ?? 0,
    scoreTarget: CHALLENGE_SCORE_TARGET[id] ?? 0,
  };
}

export interface MissionTable {
  levels: LevelMissions[];
  raw: number[];
}

export function decodeMissionTable(ints: readonly number[]): MissionTable {
  if (ints.length % MISSION_RECORD_SIZE !== 0) {
    throw new Error(
      `mission table: ${ints.length} ints is not a multiple of ${MISSION_RECORD_SIZE}`,
    );
  }
  const levels: LevelMissions[] = [];
  for (let id = 0; id < ints.length / MISSION_RECORD_SIZE; id++) {
    const z = (i: number): number => at(ints, id * MISSION_RECORD_SIZE + i, 'missions');
    const missionCount = z(2);
    if (missionCount < 0 || missionCount > MAX_MISSIONS_PER_LEVEL) {
      throw new Error(`mission table: level ${id} has ${missionCount} missions`);
    }
    const missionTypes: number[] = [];
    const goals: MissionGoal[] = [];
    for (let m = 0; m < missionCount; m++) {
      missionTypes.push((z(3) >> (m << 2)) & 0xf);
      const raw = z(13 + 3 * m);
      let kind: GoalKind;
      let value: number | null;
      if (raw === -2) {
        kind = 'sprint';
        value = null;
      } else if (raw < 0) {
        kind = 'time';
        value = raw & 0x7fffffff;
      } else {
        kind = 'score';
        value = raw;
      }
      goals.push({ raw, kind, value, defaultTime: z(14 + 3 * m), defaultScore: z(15 + 3 * m) });
    }
    levels.push({
      id,
      nameStringId: z(0),
      mapBlob: z(1),
      missionCount,
      missionTypes,
      scoreTimeLimit: z(4),
      sprintTimeLimit: z(5),
      rivalBlob: z(6),
      rivalStartDelay: z(7),
      unlockThreshold: z(8),
      backgroundFile: z(9),
      backgroundLength: z(10),
      backgroundSceneId: z(11),
      rivalCharacter: z(12),
      goals,
      challenge: challengeInfo(id, missionTypes, goals),
    });
  }
  return { levels, raw: [...ints] };
}

// ---------------------------------------------------------------------------------------------
// Blobs 4-15 - rival input recordings (written at d.java lines 4782 / 4951, read at 4824 / 4919)
// ---------------------------------------------------------------------------------------------

export const RIVAL_SNAPSHOT_SIZE = 28;
export const RIVAL_HEADER_SIZE = RIVAL_SNAPSHOT_SIZE * 4 + 2 + 4;
export const RIVAL_ENTRY_SIZE = 5;

export interface RivalEntry {
  /** Number of 30-unit steps the input value was held. */
  ticks: number;
  /** Input bits: 1 up, 2 down, 4 right, 8 left, 16 forward, 32 back. */
  input: number;
}

export interface RivalRecording {
  /** 28 int32 physics fields: time accumulator, move, move timer, x, y, velocity, ... (`V()`, line 4790). */
  snapshot: number[];
  /** (facing right, hands anchored). */
  flags: [number, number];
  /** Total time in ms. */
  totalTime: number;
  /**
   * (ticks, input) entries up to the end of the blob. There is no terminator in the file: the
   * writer (`w(int)`, line 4951) appends the last entry twice and the reader (`byte_a`, line
   * 4919) stops at the blob length.
   */
  entries: RivalEntry[];
}

export function decodeRival(bytes: Uint8Array): RivalRecording {
  const r = new BinaryReader(bytes, 'rival recording');
  const snapshot: number[] = [];
  for (let i = 0; i < RIVAL_SNAPSHOT_SIZE; i++) snapshot.push(r.i32());
  const flags: [number, number] = [r.u8(), r.u8()];
  const totalTime = r.i32();
  const entries: RivalEntry[] = [];
  while (r.remaining >= RIVAL_ENTRY_SIZE) {
    const ticks = r.i32();
    const input = r.i8();
    entries.push({ ticks, input });
  }
  r.assertAtEnd();
  return { snapshot, flags, totalTime, entries };
}
