/**
 * Sprite ids of the original's menu graphics (see reference/notes/08-flow-and-menus.md §9).
 */

/** 64×64 level thumbnails: `THUMBNAIL_BASE + level`. The original's locked card is 163. */
export const THUMBNAIL_BASE = 164;

/** Name-tag graffiti of the two playable characters. */
export const TAG_BLAISE = 66;
export const TAG_PLAYMAN = 67;

/** 21×21 head icon of a character (`int_l`, d.java line 10099). */
export function headIconSprite(character: number): number {
  if (character <= 0) return 81;
  if (character === 1) return 82;
  return 87 + (character - 2) * 5;
}

export const MENU_ARROW = 162;
export const BUBBLE_TAIL = 183;
export const FINISH_MARKER = 191;
export const TUTORIAL_ARROW = 223;

/** Keyframe the coach holds while idle and the clip it plays while talking. */
export const COACH_IDLE_KEYFRAME = 434;
export const COACH_TALK_CLIP = 483;
