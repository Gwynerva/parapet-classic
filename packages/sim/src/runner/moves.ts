/**
 * The move table: 135 states with transition lists, loaded from
 * `packages/content/generated/moves.json`. See reference/notes/02-moves.md.
 */

export interface MoveTransition {
  /** Condition ids that must all hold (empty = unconditional). Evaluated in order. */
  conditions: number[];
  target: number;
}

export interface MoveDef {
  id: number;
  /** Duration in time units; -1 means `100 + (storedSpeed >> 3)`. */
  duration: number;
  /** Move entered when the timer expires, -1 = none. */
  next: number;
  impulseType: number;
  paramB: number;
  paramC: number;
  paramD: number;
  /** Animation clip offset in anims.json, -1 = none (rendering only). */
  clipOffset: number;
  /** Animation playback mode (rendering only). */
  animMode: number;
  flags: number;
  snapType: number;
  /** Parent move whose transitions are checked after this move's own, -1 = none. */
  parent: number;
  transitionList: number;
  transitions: MoveTransition[];
  /** Scoring type: -1 none, 0 fail, 1 exit points, 2 continuous, 3 exit points + popup, 4 reset chain factor, 5 continuous while rising. */
  scoreType: number;
  points: number;
}

export interface MoveTableData {
  states: MoveDef[];
}

export class MoveTable {
  readonly states: readonly MoveDef[];

  constructor(data: MoveTableData) {
    this.states = data.states;
  }

  get(id: number): MoveDef {
    const m = this.states[id];
    if (!m) throw new Error(`unknown move ${id}`);
    return m;
  }
}

/** Bits of `MoveDef.flags`. */
export const MoveFlag = {
  /** The anchor is the hands point. */
  HANDS: 0x1,
  /** Force gravity and detach from surfaces every step. */
  FORCE_GRAVITY: 0x2,
  /** Unused: the original compares `(flags & 4) == 1`, which never holds. */
  UNUSED_4: 0x4,
  /** No collision at all. */
  NO_COLLISION: 0x8,
  /** Lock facing; flips on leaving to a move without FACE_AGAINST_VELOCITY. */
  LOCK_FACING: 0x10,
  /** Animation: no blending. */
  ANIM_NO_BLEND: 0x20,
  /** Keep the input buffer on entry. */
  KEEP_BUFFER: 0x40,
  /** Sweep only the contact probe. */
  SINGLE_PROBE: 0x80,
  /** Extra hands probe 32 units ahead that accepts only ledge corners. */
  LEDGE_PROBE: 0x100,
  /** Animation: 15 fps. */
  ANIM_15FPS: 0x200,
  /** Animation: 10 fps. */
  ANIM_10FPS: 0x400,
  /** Face against the velocity. */
  FACE_AGAINST_VELOCITY: 0x800,
  /** Store the vertical speed on entry (`w = v`). */
  STORE_SPEED: 0x8000,
} as const;

/** Well-known move ids (see reference/notes/02-moves.md). */
export const MoveId = {
  START: 0,
  RUN: 2,
  RUN_DOWNHILL: 3,
  RUN_UPHILL: 4,
  STOP: 5,
  TURN: 6,
  TURN_FAST: 8,
  PIT: 11,
  FALL: 15,
  JUMP: 18,
  JUMP_STEEP: 19,
  TIC_TAC_JUMP: 20,
  ROLL: 21,
  LANDING_PREPARE: 22,
  LANDING: 23,
  TIC_TAC_ARMED: 28,
  WALL_RUN_ARMED: 30,
  WALL_RUN: 33,
  WALL_FLIP_ARMED: 47,
  WALL_FLIP: 48,
  TIGER_JUMP: 56,
  MONKEY_VAULT: 62,
  FRONT_FLIP: 63,
  BACK_FLIP: 64,
  /** Slow bounce off a wall approached without BACK (the warm-up hint about tic-tacs). */
  WALL_BOUNCE: 40,
  STUMBLE: 82,
  CRASH: 84,
  /** First recovery stage after a crash (the warm-up hint about landings). */
  CRASH_RECOVER: 86,
  DASH: 94,
  LEDGE_HANG: 112,
  LADDER_UP: 119,
  LADDER_DOWN: 120,
  POLE_JUMP: 123,
  POLE_SPIN: 125,
  POLE_SLIDE: 127,
} as const;

/**
 * Bits of `RunnerState.moveBits` (`bC`), set on entering the move (d.java lines 9265-9291) and
 * checked by the challenge missions: level 3 needs the wall flip, level 5 the spider jump,
 * monkey vault and monkey flip, level 6 the pole jump and pole spin.
 */
export const ChallengeBit = {
  TIC_TAC_JUMP: 0x1,
  WALL_FLIP: 0x2,
  SPIDER_JUMP: 0x4,
  MONKEY_VAULT: 0x8,
  MONKEY_FLIP: 0x10,
  POLE_JUMP: 0x20,
  POLE_SPIN: 0x40,
  ALL: 0x7f,
} as const;
