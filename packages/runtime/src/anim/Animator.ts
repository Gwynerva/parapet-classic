/**
 * Per-runner character animation state: port of class `g` and of the methods that drive it,
 * `c(int,int,int)` (set a clip, d.java line 5702), `z(int)` (advance, line 5786), `ag()`
 * (faces, line 5755) and the tween part of `aj()` (line 5886).
 *
 * Clips live in a flat table (`short_h`, blob 17): at `offset` the frame count, followed by
 * that many keyframe ids of the character object (k0). A move's table entry names the clip
 * offset and the playback mode; the modes are:
 *
 * | mode | behaviour                                                                     |
 * | ---- | ----------------------------------------------------------------------------- |
 * | 0    | hold the first frame, keeping the clip time and tween of the previous clip    |
 * | 1    | hold the first frame (tween reset, blends from the previous pose for 255 ms)  |
 * | 2    | hold the last frame (tween reset)                                             |
 * | 3    | loop at 13 fps (15 / 10 fps with flags 0x200 / 0x400, 4 fps for clip 228)     |
 * | 4    | play once over the move duration                                              |
 * | 5    | loop like 3 but continue the clip time of the previous clip                   |
 * | 6    | loop backwards, continuing the clip time (stops when it reaches 0)            |
 * | 7    | play once reversed over the move duration                                     |
 * | 8    | loop at a rate proportional to |vx| (13 fps × (|vx|/2 + 1700) / 3400)         |
 * | 9    | hold the first frame, keeping the tween                                       |
 * | 10   | hold the last frame, keeping the tween                                        |
 *
 * Drawing always tweens from the previous keyframe to the current one by `tween / 256`
 * unless the move has flag 0x20 or no previous keyframe is known (`prevFrame === -1`).
 */
import type { MoveDef } from '@parapet/sim';
import { iabs, idiv } from '@parapet/sim';

/** Playback modes (`g.d`). */
export const AnimMode = {
  HOLD_FIRST_KEEP_TIME: 0,
  HOLD_FIRST: 1,
  HOLD_LAST: 2,
  LOOP: 3,
  ONCE: 4,
  LOOP_KEEP_TIME: 5,
  LOOP_BACKWARDS: 6,
  ONCE_REVERSED: 7,
  LOOP_BY_SPEED: 8,
  HOLD_FIRST_KEEP_TWEEN: 9,
  HOLD_LAST_KEEP_TWEEN: 10,
} as const;

/** Move flags read by the animation (field [8] of the move table). */
export const AnimFlag = {
  /** The anchor is the hands point (also a physics flag). */
  HANDS: 0x1,
  /** Never tween from the previous keyframe. */
  NO_BLEND: 0x20,
  /** Loop at 15 fps. */
  FPS_15: 0x200,
  /** Loop at 10 fps. */
  FPS_10: 0x400,
  /** Draw mirrored while the facing is still the one the clip was set with (line 5891). */
  MIRROR_UNTIL_TURN: 0x1000,
  /** Forget the previous keyframe on entry. */
  FORGET_PREVIOUS: 0x2000,
  /** Forget the previous keyframe on entry when the anchor mode changed. */
  FORGET_PREVIOUS_ON_ANCHOR_CHANGE: 0x4000,
} as const;

/** The idle clip set at run start (`y(int)`, line 5692): offset 228, mode 3, 4 fps. */
export const IDLE_CLIP_OFFSET = 228;

/** The runner fields the animator reads (a subset of `RunnerState`). */
export interface AnimRunner {
  facingRight: boolean;
  handsAnchored: boolean;
  renderX: number;
  renderY: number;
  renderHandsDx: number;
  renderHandsDy: number;
  vx: number;
  vy: number;
  prevVx: number;
  prevVy: number;
}

export interface KeyframePair {
  /** Previous keyframe id (equal to `b` when not blending). */
  a: number;
  /** Current keyframe id. */
  b: number;
  /** Tween 0..65536 from `a` to `b`. */
  t: number;
}

export interface DrawParams {
  /** Draw position in world units (feet, or hands when the move anchors there), tweened. */
  x: number;
  y: number;
  /** Draw mirrored (facing left). */
  flipX: boolean;
}

/** Face sprites (`ag`, line 5755). */
export const FACE_BLINK_A = 76;
export const FACE_BLINK_B = 77;
export const FACE_PAIN = 78;
/** Head sprite the face replaces (`a(int,int[])`, line 5935). */
export const HEAD_SPRITE = 25;

/**
 * Build the flat clip table (`short_h`) from `anims.json`: `table[offset] = count`,
 * `table[offset + 1 + i] = keyframe id`.
 */
export function buildClipTable(clips: Record<string, number[]>): Int16Array {
  let length = 0;
  for (const [key, ids] of Object.entries(clips)) {
    length = Math.max(length, Number(key) + 1 + ids.length);
  }
  const table = new Int16Array(length);
  for (const [key, ids] of Object.entries(clips)) {
    const offset = Number(key);
    table[offset] = ids.length;
    ids.forEach((id, i) => {
      table[offset + 1 + i] = id;
    });
  }
  return table;
}

/** Small deterministic PRNG (xorshift32) standing in for `java.util.Random` (line 3438). */
export class Prng {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0 || 0x9e3779b9;
  }

  /** Non-negative 31-bit value like `abs(Random.nextInt())`. */
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x | 0;
    return this.state & 0x7fffffff;
  }
}

/**
 * Clip-start remaps applied when the facing flips mid-animation (line 5866): the previous
 * keyframe is taken from the first frame of a turning clip so the tween shows a turn.
 */
const TURN_REMAP: Record<number, number> = {
  459: 470,
  472: 482,
  287: 296,
  539: 550,
  144: 158,
  331: 331,
  103: 482,
};
/** Clip start that keeps its previous keyframe through a turn (line 5880). */
const TURN_KEEP_CLIP = 310;

export class Animator {
  private readonly clips: Int16Array;
  private readonly rng: Prng;

  /** Frame count of the current clip (`var_int_a`). */
  clipLength = 0;
  /** Index of the current frame within the clip (`var_int_b`). */
  frame = 0;
  /** Table index of the first keyframe id of the clip (`var_int_c` = offset + 1). */
  clipStart = 0;
  /** Playback mode (`d`). */
  mode = 0;
  /** Frame count of the clip the previous keyframe belongs to (`e`); the original creates it as 1 (`af`, line 5677). */
  prevClipLength = 1;
  /** Previous frame index, -1 = no previous keyframe (`f`). */
  prevFrame = -1;
  /** Clip start of the previous keyframe (`g`). */
  prevClipStart = 0;
  /** `!facingRight` when the clip was set; a flip is detected against it (`var_boolean_a`). */
  notFacingAtSet = false;
  /** Draw position captured at the previous keyframe, for the anchor-change tween (`h`, `i`). */
  anchorX = 0;
  anchorY = 0;
  /** Tween 0..255 from the previous keyframe to the current (`j`). */
  tween = 0;
  /** Anchor mode of the previous / current keyframe (`var_boolean_b`, `var_boolean_c`). */
  prevHandsAnchored = false;
  handsAnchored = false;
  /** Clip time in units << 10 (`k`), i.e. ms × 1024. */
  time = 0;
  /** Move duration for the play-once modes (`l`). */
  duration = 0;
  /** Face sprite override and its expiry on the game clock (`m`, `n`). */
  face = -1;
  faceUntil = 0;
  /** Flags of the current move. */
  flags = 0;

  constructor(clips: Int16Array, seed = 1) {
    this.clips = clips;
    this.rng = new Prng(seed);
  }

  /** `y(int)`: the idle loop shown before the first move change (clip 228 at 4 fps). */
  setIdle(runner: AnimRunner): void {
    this.setClip(IDLE_CLIP_OFFSET, 0, AnimMode.LOOP, 0, runner);
    this.prevFrame = -1;
    this.prevHandsAnchored = false;
    this.handsAnchored = false;
    // The original sets the idle clip before the runner's facing is initialised (facing right is
    // false at that point), so the "facing at set" flag starts as if the runner faced left.
    this.notFacingAtSet = true;
  }

  /**
   * What `O(int)` does for the animation on entering a move: `c(clipOffset, duration, mode)`
   * when the move has a clip. `moveTimer` is the move duration at entry (`int_p`).
   */
  setMove(move: MoveDef, moveTimer: number, runner: AnimRunner): void {
    if (move.clipOffset === -1) {
      this.flags = move.flags;
      return;
    }
    this.setClip(move.clipOffset, moveTimer, move.animMode, move.flags, runner);
  }

  /** `c(int,int,int)` (line 5702). */
  setClip(
    clipOffset: number,
    duration: number,
    mode: number,
    flags: number,
    runner: AnimRunner,
  ): void {
    this.mode = mode;
    this.duration = duration;
    this.clipLength = this.clips[clipOffset] ?? 0;
    this.clipStart = clipOffset + 1;
    this.flags = flags;
    if (mode !== AnimMode.HOLD_FIRST_KEEP_TIME && mode !== 5 && mode !== 6) {
      this.frame = 0;
      this.time = 0;
      this.notFacingAtSet = !runner.facingRight;
    }
    if (mode === 1 || mode === 2 || mode === 9) {
      if (mode !== 9) this.tween = 0;
      if (this.handsAnchored === runner.handsAnchored) {
        this.captureAnchor(runner);
      }
    }
    if (mode === 2 || mode === 10) {
      this.frame = (this.clipLength << 10) - 1;
    }
    // CFR renders this as "set to true when the flag is on", but the bytecode assigns the
    // boolean unconditionally (`c(III)V` offsets 396–421): a move without the hands flag
    // clears the animator's anchor immediately, which drives the anchor tween of `aj()`.
    this.handsAnchored = (flags & AnimFlag.HANDS) !== 0;
    if ((flags & AnimFlag.FORGET_PREVIOUS) !== 0) {
      this.prevFrame = -1;
    }
    if (
      (flags & AnimFlag.FORGET_PREVIOUS_ON_ANCHOR_CHANGE) !== 0 &&
      this.handsAnchored !== this.prevHandsAnchored
    ) {
      this.prevFrame = -1;
    }
  }

  /**
   * `z(int)`: advance by `dtUnits` time units (30 per simulation step, the original calls
   * `z(30720)` = 30 << 10). `clock` is the game clock in ms (for the face timers).
   */
  update(dtUnits: number, runner: AnimRunner, clock: number): void {
    const n = dtUnits << 10;
    const before = this.frame;
    const mode = this.mode;
    const len = this.clipLength;

    if (mode !== 0 && mode !== 1 && mode !== 9 && mode !== 2 && mode !== 10) {
      if (mode === AnimMode.LOOP_BACKWARDS) {
        this.time = (this.time - n) | 0;
      } else if (mode === AnimMode.LOOP_BY_SPEED) {
        this.time = (this.time + idiv(n * (iabs((runner.vx * 500) >> 10) + 1700), 3400)) | 0;
      } else {
        this.time = (this.time + n) | 0;
      }
    }

    if (mode === AnimMode.ONCE || mode === AnimMode.ONCE_REVERSED) {
      const q = this.duration > 0 ? idiv(this.time * len, this.duration) : len << 10;
      this.frame = q >> 10;
      if (mode === AnimMode.ONCE_REVERSED) {
        this.frame = len - this.frame - 1;
      }
      this.tween = (q >> 2) & 0xff;
    } else if (mode === 3 || mode === 5 || mode === 6 || mode === 8) {
      let fps = 13;
      if (this.clipStart === IDLE_CLIP_OFFSET + 1) {
        fps = 4;
      } else if ((this.flags & AnimFlag.FPS_15) !== 0) {
        fps = 15;
      } else if ((this.flags & AnimFlag.FPS_10) !== 0) {
        fps = 10;
      }
      const q = idiv(this.time * fps, 1000);
      this.frame = q >> 10;
      this.tween = (q >> 2) & 0xff;
      if (mode === AnimMode.LOOP_BACKWARDS) {
        this.tween = 255 - this.tween;
      }
    } else {
      // Hold modes: the tween runs out over 255 ms, then blending stops.
      this.tween += n >> 10;
      if (this.tween > 255) {
        this.prevFrame = -1;
      }
    }

    if (mode === AnimMode.ONCE && this.frame >= len) {
      this.frame = len - 1;
      this.prevFrame = this.frame;
    } else if (mode === 3 || mode === 8) {
      if (len > 0) this.frame %= len;
    } else if (mode === 5 || mode === 6) {
      if (len > 0) {
        while (this.frame < 0) this.frame += len;
        this.frame %= len;
      } else {
        this.frame = 0;
      }
    } else if (mode === AnimMode.ONCE_REVERSED && this.frame < 0) {
      this.frame = 0;
      this.prevFrame = 0;
    }

    this.updateFace(runner, clock);

    if (this.frame !== before) {
      this.prevFrame = before;
      this.prevClipStart = this.clipStart;
      this.prevClipLength = this.clipLength;
      if (mode === 4 || mode === 7 || mode === 3 || mode === 8) {
        this.captureAnchor(runner);
      }
      this.prevHandsAnchored = this.handsAnchored;
      this.handsAnchored = runner.handsAnchored;
    }

    // Facing flipped since the clip was set: tween from the first frame of a turning clip.
    if (runner.facingRight === this.notFacingAtSet) {
      const remapped = TURN_REMAP[this.prevClipStart];
      if (remapped !== undefined) {
        this.prevClipStart = remapped;
      }
      if (this.prevClipStart !== TURN_KEEP_CLIP) {
        this.prevFrame = 0;
        this.prevClipLength = 1;
        this.notFacingAtSet = !runner.facingRight;
      }
    }
    if (this.time < 0) this.time = 0;
  }

  /** Whether the draw tweens from the previous keyframe (`aj`, line 5894). */
  get blending(): boolean {
    return (
      this.prevFrame !== -1 && (this.flags & AnimFlag.NO_BLEND) === 0 && this.prevClipLength > 0
    );
  }

  /** Keyframe id of the current frame (`s2` in `aj`). */
  currentKeyframe(): number {
    return this.keyframe(this.clipStart, this.clipLength, this.frame);
  }

  /** Keyframe id of the blend source (`s` in `aj`), meaningful only while blending. */
  previousKeyframe(): number {
    return this.keyframe(this.prevClipStart, this.prevClipLength, this.prevFrame);
  }

  /** The keyframe pair to draw and the tween between them (0..65536). */
  frames(): KeyframePair {
    const current = this.keyframe(this.clipStart, this.clipLength, this.frame);
    if (!this.blending) {
      return { a: current, b: current, t: 0 };
    }
    const previous = this.keyframe(this.prevClipStart, this.prevClipLength, this.prevFrame);
    return { a: previous, b: current, t: this.tween << 8 };
  }

  /** Draw position and mirroring (the first part of `aj`, line 5886). */
  drawParams(runner: AnimRunner): DrawParams {
    let x = runner.renderX;
    let y = runner.renderY;
    if (runner.handsAnchored) {
      x += runner.renderHandsDx;
      y += runner.renderHandsDy;
    }
    let facingRight = runner.facingRight;
    if (
      (this.flags & AnimFlag.MIRROR_UNTIL_TURN) !== 0 &&
      runner.facingRight !== this.notFacingAtSet
    ) {
      facingRight = !facingRight;
    }
    if (this.blending && this.handsAnchored !== this.prevHandsAnchored) {
      const j = this.tween;
      x = (x * j + this.anchorX * (256 - j)) >> 8;
      y = (y * j + this.anchorY * (256 - j)) >> 8;
    }
    return { x, y, flipX: !facingRight };
  }

  /** Face sprite to show instead of the head (25), or -1 (`a(int,int[])`, line 5935). */
  faceSprite(clock: number): number {
    return this.faceUntil > clock ? this.face : -1;
  }

  /** `void_a(int,int,boolean)` (line 5748). */
  setFace(sprite: number, ms: number, force: boolean, clock: number): void {
    if (force || clock > this.faceUntil) {
      this.face = sprite;
      this.faceUntil = clock + ms;
    }
  }

  /** `ag()`: blinks with a 1/64 chance per step, pain face on a sharp velocity change. */
  private updateFace(runner: AnimRunner, clock: number): void {
    if ((this.rng.next() & 0x3f) === 0) {
      this.setFace(FACE_BLINK_A, 250, false, clock);
    }
    if ((this.rng.next() & 0x3f) === 0) {
      this.setFace(FACE_BLINK_B, 250, false, clock);
    }
    const dvx = iabs(runner.prevVx - runner.vx);
    const dvy = iabs(runner.prevVy - runner.vy);
    if (dvx > 5000 || dvy > 5000) {
      this.setFace(FACE_PAIN, 400, true, clock);
    }
  }

  private captureAnchor(runner: AnimRunner): void {
    this.anchorX = runner.renderX + (this.handsAnchored ? runner.renderHandsDx : 0);
    this.anchorY = runner.renderY + (this.handsAnchored ? runner.renderHandsDy : 0);
  }

  private keyframe(start: number, length: number, frame: number): number {
    if (length <= 0) return this.clips[start] ?? 0;
    // Java `%` keeps the sign: a frame of -1 reads the entry before the clip (its length),
    // which the original only does while not blending, so the value is never drawn.
    const index = frame % length;
    return this.clips[start + index] ?? 0;
  }
}
