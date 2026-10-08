/**
 * What a TAS run is made of: presses of the four direction keys, one key on one step, the way
 * a player's keyboard produces them (no holding, no chords; `InputManager.pressBits`). The
 * original's own rival recordings, made by its developers on a phone, look exactly like that.
 */
import { Input, type RunMode } from '@parapet/sim';

/** The modes Gwynerva is raced in. */
export const CONTEST_MODES = ['flags', 'sprint'] as const satisfies readonly RunMode[];
export type ContestMode = (typeof CONTEST_MODES)[number];

export function isContestMode(mode: string): mode is ContestMode {
  return (CONTEST_MODES as readonly string[]).includes(mode);
}

/** The direction keys; left and right turn into FORWARD or BACK by the facing at the press. */
export const Key = { UP: 1, DOWN: 2, RIGHT: 3, LEFT: 4 } as const;
export type KeyCode = 1 | 2 | 3 | 4;
export const KEY_CODES: readonly KeyCode[] = [1, 2, 3, 4];
const KEY_LETTERS = ' UDRL';

export function keyLetter(key: KeyCode): string {
  return KEY_LETTERS[key] ?? '?';
}

export function keyFromLetter(letter: string): KeyCode | null {
  const i = KEY_LETTERS.indexOf(letter);
  return i >= 1 && i <= 4 ? (i as KeyCode) : null;
}

/** Press bits of `key` for a runner facing right or left (`InputManager.pressBits`). */
export function keyBits(key: KeyCode, facingRight: boolean): number {
  switch (key) {
    case Key.UP:
      return Input.UP;
    case Key.DOWN:
      return Input.DOWN;
    case Key.RIGHT:
      return Input.RIGHT | (facingRight ? Input.FORWARD : Input.BACK);
    case Key.LEFT:
      return Input.LEFT | (facingRight ? Input.BACK : Input.FORWARD);
  }
}

/** One key pressed on step `step` (0-based: the step that consumes it). */
export interface Press {
  step: number;
  key: KeyCode;
}

/** Compact text form of a press list, `step:K` pairs separated by spaces. */
export function formatPresses(presses: readonly Press[]): string {
  return presses.map((p) => `${p.step}:${keyLetter(p.key)}`).join(' ');
}

export function parsePresses(text: string): Press[] {
  const out: Press[] = [];
  for (const part of text.trim().split(/\s+/)) {
    if (part === '') continue;
    const [step, letter] = part.split(':');
    const key = keyFromLetter(letter ?? '');
    const n = Number(step);
    if (key === null || !Number.isInteger(n) || n < 0) throw new Error(`bad press "${part}"`);
    out.push({ step: n, key });
  }
  return out;
}

/** The look a contest's winner unlocks doubles as the character of Gwynerva's replays. */
export function contestCharacter(levelId: number, mode: ContestMode): number {
  return 10 + 2 * levelId + (mode === 'sprint' ? 1 : 0);
}
