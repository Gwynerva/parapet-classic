/**
 * The character skeleton (`k0`) as body parts: which sprite is which part, which slot is on the
 * near or the far side, which way the body faces in a keyframe and where its head, hands and
 * feet are. Pure, used by looks (left and right pictures), effects (anchors) and the tools.
 *
 * Sprite ids follow Blaise's numbering (the keyframes'), plus the faces and the other
 * characters' heads and the male torso and chest that their skin rules swap in.
 */
import type { SceneObject } from '../content/types.ts';

/** Body-part families. */
export const Family = {
  HEAD: 0,
  FACE: 1,
  PONYTAIL: 2,
  CHEST: 3,
  TORSO: 4,
  UPPER_ARM: 5,
  FOREARM: 6,
  HAND: 7,
  THIGH: 8,
  KNEE: 9,
  SHIN: 10,
  SHOE: 11,
} as const;
export type FamilyId = (typeof Family)[keyof typeof Family];

/** Names of the families, for tools and messages. */
export const FAMILY_NAMES: readonly string[] = [
  'head',
  'face',
  'ponytail',
  'chest',
  'torso',
  'upper arm',
  'forearm',
  'hand',
  'thigh',
  'knee',
  'shin',
  'shoe',
];

/** Which side of the body a drawn part is on. */
export const Side = { FAR: 0, NEAR: 1, MID: 2 } as const;
export type SideId = (typeof Side)[keyof typeof Side];

interface Range {
  from: number;
  to: number;
  family: FamilyId;
  /** Side baked into the sprite (the original shades the far limb darker), or MID. */
  side: SideId;
}

/** Sprite ranges of the character (inclusive). */
const RANGES: readonly Range[] = [
  { from: 1, to: 4, family: Family.FOREARM, side: Side.MID },
  { from: 5, to: 8, family: Family.UPPER_ARM, side: Side.NEAR },
  { from: 9, to: 12, family: Family.UPPER_ARM, side: Side.FAR },
  { from: 13, to: 16, family: Family.PONYTAIL, side: Side.MID },
  { from: 17, to: 20, family: Family.HAND, side: Side.NEAR },
  { from: 21, to: 24, family: Family.HAND, side: Side.FAR },
  { from: 25, to: 29, family: Family.HEAD, side: Side.MID },
  { from: 30, to: 33, family: Family.SHIN, side: Side.MID },
  { from: 34, to: 38, family: Family.TORSO, side: Side.MID },
  { from: 39, to: 42, family: Family.SHOE, side: Side.NEAR },
  { from: 43, to: 46, family: Family.SHOE, side: Side.FAR },
  { from: 47, to: 48, family: Family.SHOE, side: Side.MID },
  { from: 49, to: 52, family: Family.THIGH, side: Side.FAR },
  { from: 53, to: 56, family: Family.THIGH, side: Side.NEAR },
  { from: 57, to: 61, family: Family.CHEST, side: Side.MID },
  { from: 62, to: 65, family: Family.KNEE, side: Side.MID },
  { from: 76, to: 79, family: Family.FACE, side: Side.MID },
  { from: 82, to: 126, family: Family.HEAD, side: Side.MID },
  { from: 127, to: 131, family: Family.TORSO, side: Side.MID },
  { from: 132, to: 136, family: Family.CHEST, side: Side.MID },
];

const FAMILY_OF = new Int8Array(140).fill(-1);
const BAKED_SIDE = new Int8Array(140).fill(Side.MID);
const FIRST_OF = new Int16Array(140).fill(-1);
for (const r of RANGES) {
  for (let id = r.from; id <= r.to; id++) {
    FAMILY_OF[id] = r.family;
    BAKED_SIDE[id] = r.side;
    // The other characters' heads come five to a character.
    FIRST_OF[id] = r.from === 82 ? 82 + Math.floor((id - 82) / 5) * 5 : r.from;
  }
}

/** Every sprite of the character a look or a tool may deal with. */
export const CHARACTER_SPRITES: readonly number[] = RANGES.flatMap((r) =>
  Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from + i),
);

/** The family of sprite `id`, or -1 when it is not a body part. */
export function familyOf(id: number): number {
  return id >= 0 && id < FAMILY_OF.length ? FAMILY_OF[id]! : -1;
}

/** Arms and legs: the families drawn twice, on the near and the far side. */
export function isLimb(family: number): boolean {
  return family >= Family.UPPER_ARM;
}

/** Index of sprite `id` among the pre-rotated pictures of its part (0 upright). */
export function rotationIndex(id: number): number {
  const first = id >= 0 && id < FIRST_OF.length ? FIRST_OF[id]! : -1;
  return first < 0 ? 0 : id - first;
}

/** The side baked into a sprite id (near and far arms, hands, thighs and shoes differ). */
export function bakedSide(id: number): SideId {
  return (id >= 0 && id < BAKED_SIDE.length ? BAKED_SIDE[id]! : Side.MID) as SideId;
}

/**
 * Side of each slot of the character object: 0–6 the far arm and leg, 9–12 the near leg,
 * 16–18 the near arm; the torso, chest, head and ponytail are in the middle.
 */
export const SLOT_SIDE: readonly SideId[] = [
  Side.FAR,
  Side.FAR,
  Side.FAR,
  Side.FAR,
  Side.FAR,
  Side.FAR,
  Side.FAR,
  Side.MID,
  Side.MID,
  Side.NEAR,
  Side.NEAR,
  Side.NEAR,
  Side.NEAR,
  Side.MID,
  Side.MID,
  Side.MID,
  Side.NEAR,
  Side.NEAR,
  Side.NEAR,
];

/**
 * Side of a drawn part: limbs take their slot's side (an arm's upper arm, forearm and hand
 * stay one arm even where a slot borrows the other side's shading); a limb drawn by a middle
 * slot (a few turning frames) its sprite's, the far side for the sprites both sides share;
 * everything else is in the middle.
 */
export function partSide(id: number, slot: number): SideId {
  const family = familyOf(id);
  if (!isLimb(family)) return Side.MID;
  const s = SLOT_SIDE[slot] ?? Side.MID;
  if (s !== Side.MID) return s;
  const baked = bakedSide(id);
  return baked === Side.MID ? Side.FAR : baked;
}

const mirrors = new WeakMap<SceneObject, Uint8Array>();

/**
 * Per keyframe, whether the body is drawn mirrored by its own transforms (the turns): the
 * majority of the head, torso and chest sprites. Limbs use reflections as a way to draw other
 * angles, so they do not count. Cached per object.
 */
export function bodyMirror(obj: SceneObject): Uint8Array {
  let out = mirrors.get(obj);
  if (out) return out;
  out = new Uint8Array(obj.frames);
  for (let f = 0; f < obj.frames; f++) {
    let votes = 0;
    let mirrored = 0;
    for (const p of obj.primitives) {
      if (p.type !== 1 || !p.swapParts) continue;
      const v = p.value[f] ?? -1;
      if (v === -1) continue;
      const fam = familyOf(v >> 3);
      if (fam !== Family.HEAD && fam !== Family.TORSO && fam !== Family.CHEST) continue;
      votes++;
      if ((v & 7) >= 4) mirrored++;
    }
    out[f] = votes > 0 && mirrored * 2 > votes ? 1 : 0;
  }
  mirrors.set(obj, out);
  return out;
}

/** Points of a drawn pose, in the object's box (pixels; feet at the pivot). */
export interface PoseAnchors {
  head: { x: number; y: number };
  neck: { x: number; y: number };
  chest: { x: number; y: number };
  hips: { x: number; y: number };
  handNear: { x: number; y: number };
  handFar: { x: number; y: number };
  footNear: { x: number; y: number };
  footFar: { x: number; y: number };
  /** Bounding box of the drawn sprites. */
  box: { x: number; y: number; w: number; h: number };
}

export function emptyAnchors(): PoseAnchors {
  const p = (): { x: number; y: number } => ({ x: 0, y: 0 });
  return {
    head: p(),
    neck: p(),
    chest: p(),
    hips: p(),
    handNear: p(),
    handFar: p(),
    footNear: p(),
    footFar: p(),
    box: { x: 0, y: 0, w: 0, h: 0 },
  };
}
