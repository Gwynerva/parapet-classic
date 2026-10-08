/**
 * Who can be chosen: Blaise and Playman from the start (the original's single-player pair);
 * each rival once every mission of the levels where they race is complete. The bosses have
 * their own rule (`bosses.ts`).
 */
import { completedMissions, type Progress } from '@parapet/runtime/storage/profile.ts';
import type { GameContent } from '../assets/content.ts';

/** Characters open from the start: Blaise (0) and Playman (1). */
export const STARTER_CHARACTERS: readonly number[] = [0, 1];

/** Levels where a rival races (the sprint's ghost), in level order. */
export function rivalLevels(content: Pick<GameContent, 'missions'>, character: number): number[] {
  const out: number[] = [];
  content.missions.levels.forEach((level, id) => {
    if (level.rivalCharacter === character) out.push(id);
  });
  return out;
}

/** Whether one of the original's ten characters can be chosen. */
export function isCharacterOpen(
  content: Pick<GameContent, 'missions'>,
  progress: Progress,
  character: number,
): boolean {
  if (STARTER_CHARACTERS.includes(character)) return true;
  const levels = rivalLevels(content, character);
  return (
    levels.length > 0 &&
    levels.every(
      (id) => completedMissions(progress, id) >= (content.missions.levels[id]?.missionCount ?? 0),
    )
  );
}
