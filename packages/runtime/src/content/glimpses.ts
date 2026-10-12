/**
 * Glimpses: what a boss did around each flag of its record, shown as a hologram that loops
 * from a second before the flag to a second after it (`content/bosses/glimpses.json`, written
 * by `npm run tas -- publish`). The routes of the records stay secret but for these pieces, and
 * those are published as the poses the renderer draws, never as input: a glimpse cannot be
 * played, only watched.
 *
 * A glimpse is the runner's `CharacterPose` after every simulation step, plus whether the
 * renderer may interpolate into it, coded as bytes in base64url: a varint pose count, a varint
 * `at` (the index of the pose on the step the flag was taken), then per pose
 *
 * - a header byte: `0x01` flipX, `0x02` anchored, `0x04` cut, `0x08` b changed, `0x30` a-mode,
 *   `0xc0` tween code. Pose 0 always has the cut and the b bits;
 * - the position: pose 0 its x and y (zigzag varints); a cut pose its move from the previous
 *   pose; any other pose the change of that move since the previous step (the move before a
 *   cut and before pose 0 counts as 0);
 * - b, when it changed: pose 0 as a varint, later poses as the zigzag change;
 * - a, by its mode: 0 not blending (`a = b`, `t = 0`), 1 the previous pose's a, 2 the previous
 *   pose's b (the frame just advanced), 3 a zigzag `a - b` follows (before pose 0, a and b
 *   are 0);
 * - t while blending (a-mode 1 to 3), in 256ths: `Animator.frames` gives `tween << 8`, so a
 *   byte holds it exactly (the animator could give a tween past 255 for a step, on a turn while
 *   it holds a frame; no published run does, and the encoder refuses one). Tween code 0 is
 *   that byte; 1, 2 and 3 store nothing, it is the prediction, the prediction + 1 or the
 *   prediction - 1 (modulo 256). The prediction is the previous pose's tween plus that pose's
 *   own step from the one before, modulo 256: a clip advances by about the same amount every
 *   step, give or take the rounding. Before pose 0 the tween and its step are 0; a pose that
 *   does not blend (a-mode 0, tween code 0, no byte) counts as tween 0.
 *
 * Varints are unsigned LEB128 (5 bytes at most), zigzag maps 0, -1, 1, -2… to 0, 1, 2, 3…
 */
import { fromBase64Url, toBase64Url, type ContentHash } from '@parapet/sim';
import type { CharacterPose } from '../render/CharacterRenderer.ts';

export const GLIMPSE_FORMAT = 1;
/** Steps shown before the step a flag is taken, and after it. */
export const GLIMPSE_BEFORE_STEPS = 33;
export const GLIMPSE_AFTER_STEPS = 33;

export interface GlimpsePose extends CharacterPose {
  /**
   * Not to be interpolated into from the previous pose: the first pose, a switch between the
   * feet and the hands origin, or a snap (`CharacterRenderer.step`'s teleport).
   */
  cut: boolean;
}

export interface GlimpseTrack {
  poses: GlimpsePose[];
  /** Index of the pose on the step the flag was taken. */
  at: number;
}

/** One record's glimpses. */
export interface GlimpseSet {
  /** SHA-256 (hex) of the run's replay code, as in `contests.json`. */
  runSha256: string;
  /** Coded glimpses (`encodeGlimpse`) by flag or checkpoint index, not in the order taken. */
  clips: string[];
}

/** `glimpses.json`. */
export interface GlimpsesFile {
  format: 1;
  simVersion: string;
  rulesetId: string;
  beforeSteps: number;
  afterSteps: number;
  levels: { levelId: number; contentHash: ContentHash; flags: GlimpseSet; sprint: GlimpseSet }[];
}

const FLIP = 0x01;
const ANCHORED = 0x02;
const CUT = 0x04;
const NEW_B = 0x08;
const A_SHIFT = 4;
const A_MASK = 0x30;
const T_SHIFT = 6;

const A_SAME = 0;
const A_KEEP = 1;
const A_PREVIOUS_B = 2;
const A_EXPLICIT = 3;

/** Tween codes: a byte follows, or the prediction is off by these (modulo 256). */
const T_EXPLICIT = 0;
const T_OFFSETS = [0, 1, -1];

/** Largest |x| or |y| stored, so that every number of the code fits a varint of 5 bytes. */
const MAX_COORD = 1 << 28;
const MAX_KEYFRAME = 0xffff;
const MAX_POSES = 0xffff;

function zigzag(n: number): number {
  return n >= 0 ? 2 * n : -2 * n - 1;
}

function unzigzag(z: number): number {
  return z % 2 === 0 ? z / 2 : -(z + 1) / 2;
}

function pushVarint(out: number[], value: number): void {
  let v = value;
  while (v >= 0x80) {
    out.push((v % 0x80) | 0x80);
    v = Math.floor(v / 0x80);
  }
  out.push(v);
}

/** Whether `t` is a tween in whole 256ths (0..255), as `Animator.frames` gives it. */
function isTween(t: number): boolean {
  return Number.isInteger(t) && t >= 0 && t <= 0xff00 && t % 256 === 0;
}

function poseProblem(p: GlimpsePose, i: number): string | null {
  for (const v of [p.x, p.y]) {
    if (!Number.isInteger(v) || Math.abs(v) > MAX_COORD) return `pose ${i}: position ${v}`;
  }
  for (const v of [p.a, p.b]) {
    if (!Number.isInteger(v) || v < 0 || v > MAX_KEYFRAME) return `pose ${i}: keyframe ${v}`;
  }
  if (!isTween(p.t)) return `pose ${i}: tween ${p.t} is not a multiple of 256 below 65536`;
  if (typeof p.flipX !== 'boolean' || typeof p.anchored !== 'boolean' || typeof p.cut !== 'boolean')
    return `pose ${i}: flags`;
  if (i === 0 && !p.cut) return 'pose 0 must be a cut';
  return null;
}

/** Codes a glimpse (see the top of the file); throws on a track it cannot store exactly. */
export function encodeGlimpse(track: GlimpseTrack): string {
  const { poses, at } = track;
  if (poses.length === 0 || poses.length > MAX_POSES) {
    throw new Error(`a glimpse of ${poses.length} poses cannot be stored`);
  }
  if (!Number.isInteger(at) || at < 0 || at >= poses.length) {
    throw new Error(`glimpse pose ${at} does not exist`);
  }
  const out: number[] = [];
  pushVarint(out, poses.length);
  pushVarint(out, at);
  let x = 0;
  let y = 0;
  let dx = 0;
  let dy = 0;
  let a = 0;
  let b = 0;
  let tween = 0;
  let tweenStep = 0;
  poses.forEach((p, i) => {
    const problem = poseProblem(p, i);
    if (problem) throw new Error(`glimpse ${problem}`);
    let header = (p.flipX ? FLIP : 0) | (p.anchored ? ANCHORED : 0) | (p.cut ? CUT : 0);
    if (i === 0 || p.b !== b) header |= NEW_B;
    const blending = p.a !== p.b || p.t !== 0;
    const aMode = !blending ? A_SAME : p.a === a ? A_KEEP : p.a === b ? A_PREVIOUS_B : A_EXPLICIT;
    header |= aMode << A_SHIFT;
    const t = p.t / 256;
    const miss = (t - tween - tweenStep) & 0xff;
    const offset = T_OFFSETS.findIndex((o) => (o & 0xff) === miss);
    const tCode = blending && offset >= 0 ? offset + 1 : T_EXPLICIT;
    header |= tCode << T_SHIFT;
    out.push(header);
    if (i === 0) {
      pushVarint(out, zigzag(p.x));
      pushVarint(out, zigzag(p.y));
      dx = 0;
      dy = 0;
    } else if (p.cut) {
      pushVarint(out, zigzag(p.x - x));
      pushVarint(out, zigzag(p.y - y));
      dx = 0;
      dy = 0;
    } else {
      pushVarint(out, zigzag(p.x - x - dx));
      pushVarint(out, zigzag(p.y - y - dy));
      dx = p.x - x;
      dy = p.y - y;
    }
    x = p.x;
    y = p.y;
    if (i === 0) pushVarint(out, p.b);
    else if (p.b !== b) pushVarint(out, zigzag(p.b - b));
    if (aMode === A_EXPLICIT) pushVarint(out, zigzag(p.a - p.b));
    if (blending && tCode === T_EXPLICIT) out.push(t);
    a = p.a;
    b = p.b;
    tweenStep = (t - tween) & 0xff;
    tween = t;
  });
  return toBase64Url(Uint8Array.from(out));
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

  get left(): number {
    return this.bytes.length - this.pos;
  }

  u8(): number | null {
    return this.pos < this.bytes.length ? this.bytes[this.pos++]! : null;
  }

  /** Unsigned LEB128 of at most 5 bytes. */
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

  zigzag(): number | null {
    const z = this.varint();
    return z === null ? null : unzigzag(z);
  }
}

/** The glimpse of a code, or null when it is not one (bad characters, cut short, too long). */
export function decodeGlimpse(code: string): GlimpseTrack | null {
  const bytes = fromBase64Url(code);
  if (!bytes) return null;
  const r = new Reader(bytes);
  const count = r.varint();
  const at = r.varint();
  // Every pose takes three bytes at least.
  if (
    count === null ||
    at === null ||
    count === 0 ||
    count > MAX_POSES ||
    count * 3 > r.left ||
    at >= count
  ) {
    return null;
  }
  const poses: GlimpsePose[] = [];
  let x = 0;
  let y = 0;
  let dx = 0;
  let dy = 0;
  let a = 0;
  let b = 0;
  let tween = 0;
  let tweenStep = 0;
  for (let i = 0; i < count; i++) {
    const header = r.u8();
    if (header === null) return null;
    const cut = (header & CUT) !== 0;
    const newB = (header & NEW_B) !== 0;
    const aMode = (header & A_MASK) >> A_SHIFT;
    const tCode = header >> T_SHIFT;
    if (i === 0 && (!cut || !newB)) return null;
    if (aMode === A_SAME && tCode !== T_EXPLICIT) return null;
    const mx = r.zigzag();
    const my = r.zigzag();
    if (mx === null || my === null) return null;
    if (i === 0) {
      x = mx;
      y = my;
      dx = 0;
      dy = 0;
    } else if (cut) {
      x += mx;
      y += my;
      dx = 0;
      dy = 0;
    } else {
      dx += mx;
      dy += my;
      x += dx;
      y += dy;
    }
    if (Math.abs(x) > MAX_COORD || Math.abs(y) > MAX_COORD) return null;
    let nextB = b;
    if (newB) {
      const v = i === 0 ? r.varint() : r.zigzag();
      if (v === null) return null;
      nextB = i === 0 ? v : b + v;
      if (nextB < 0 || nextB > MAX_KEYFRAME) return null;
    }
    let nextA = nextB;
    if (aMode === A_KEEP) nextA = a;
    else if (aMode === A_PREVIOUS_B) nextA = b;
    else if (aMode === A_EXPLICIT) {
      const v = r.zigzag();
      if (v === null) return null;
      nextA = nextB + v;
      if (nextA < 0 || nextA > MAX_KEYFRAME) return null;
    }
    let t = 0;
    if (aMode !== A_SAME && tCode === T_EXPLICIT) {
      const v = r.u8();
      if (v === null) return null;
      t = v;
    } else if (aMode !== A_SAME) {
      t = (tween + tweenStep + T_OFFSETS[tCode - 1]!) & 0xff;
    }
    // A blending pose that comes out as `a = b`, `t = 0` would be coded as not blending.
    if (aMode !== A_SAME && nextA === nextB && t === 0) return null;
    a = nextA;
    b = nextB;
    tweenStep = (t - tween) & 0xff;
    tween = t;
    poses.push({
      x,
      y,
      a,
      b,
      t: t * 256,
      flipX: (header & FLIP) !== 0,
      anchored: (header & ANCHORED) !== 0,
      cut,
    });
  }
  return r.done ? { poses, at } : null;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function setProblems(set: unknown, name: string): string[] {
  if (!isObject(set)) return [`${name}: missing`];
  const out: string[] = [];
  if (typeof set.runSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(set.runSha256)) {
    out.push(`${name}: runSha256`);
  }
  if (!Array.isArray(set.clips)) return [...out, `${name}: clips`];
  set.clips.forEach((clip: unknown, i) => {
    const track = typeof clip === 'string' ? decodeGlimpse(clip) : null;
    if (!track) {
      out.push(`${name} clip ${i}: does not decode`);
      return;
    }
    if (
      track.at > GLIMPSE_BEFORE_STEPS ||
      track.poses.length - 1 - track.at > GLIMPSE_AFTER_STEPS
    ) {
      out.push(`${name} clip ${i}: longer than the file says`);
    }
  });
  return out;
}

/**
 * What is wrong with the shape of a glimpses file, or nothing: its format, its window and that
 * every clip decodes. Whether it belongs to this simulation, these levels and these records
 * (`simVersion`, `rulesetId`, `contentHash`, `runSha256`) is for the reader to compare.
 */
export function glimpseProblems(file: unknown): string[] {
  if (!isObject(file)) return ['not an object'];
  const out: string[] = [];
  if (file.format !== GLIMPSE_FORMAT) out.push(`format ${String(file.format)}`);
  if (typeof file.simVersion !== 'string' || file.simVersion === '') out.push('simVersion');
  if (typeof file.rulesetId !== 'string' || file.rulesetId === '') out.push('rulesetId');
  if (file.beforeSteps !== GLIMPSE_BEFORE_STEPS)
    out.push(`beforeSteps ${String(file.beforeSteps)}`);
  if (file.afterSteps !== GLIMPSE_AFTER_STEPS) out.push(`afterSteps ${String(file.afterSteps)}`);
  if (!Array.isArray(file.levels)) return [...out, 'levels'];
  const seen = new Set<number>();
  for (const level of file.levels as unknown[]) {
    if (!isObject(level) || !Number.isInteger(level.levelId) || seen.has(level.levelId as number)) {
      out.push('a level without a levelId of its own');
      continue;
    }
    const id = level.levelId as number;
    seen.add(id);
    const hash = level.contentHash;
    if (!isObject(hash) || !['level', 'moves', 'tables'].every((k) => Number.isInteger(hash[k]))) {
      out.push(`level ${id}: contentHash`);
    }
    out.push(...setProblems(level.flags, `level ${id} flags`));
    out.push(...setProblems(level.sprint, `level ${id} sprint`));
  }
  return out;
}
