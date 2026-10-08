import { describe, expect, it } from 'vitest';
import type { Progress } from '@parapet/runtime/storage/profile.ts';
import { isCharacterOpen, rivalLevels } from '../src/app/characters.ts';

/** Three levels: Spike (2) races on the first two, Trix (3) on the third. */
const content = {
  missions: {
    levels: [
      { rivalCharacter: 2, missionCount: 2 },
      { rivalCharacter: 2, missionCount: 1 },
      { rivalCharacter: 3, missionCount: 3 },
    ],
  },
} as unknown as Parameters<typeof isCharacterOpen>[0];

const progress = (...completed: number[]): Progress => ({ completed, prizeSeen: false });

describe('characters', () => {
  it('opens Blaise and Playman from the start', () => {
    expect(isCharacterOpen(content, progress(), 0)).toBe(true);
    expect(isCharacterOpen(content, progress(), 1)).toBe(true);
  });

  it('opens a rival once every mission of their levels is complete', () => {
    expect(rivalLevels(content, 2)).toEqual([0, 1]);
    expect(isCharacterOpen(content, progress(0b11), 2)).toBe(false);
    expect(isCharacterOpen(content, progress(0b11, 0b1), 2)).toBe(true);
    expect(isCharacterOpen(content, progress(0b11, 0b1, 0b011), 3)).toBe(false);
    expect(isCharacterOpen(content, progress(0, 0, 0b111), 3)).toBe(true);
  });

  it('keeps characters without levels closed', () => {
    expect(isCharacterOpen(content, progress(0b11, 0b1, 0b111), 9)).toBe(false);
  });
});
