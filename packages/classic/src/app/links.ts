/** Where the project lives, for the links the pages show. */
import { isRacePage } from './racePage.ts';

/** The repository. */
export const SOURCE_URL = 'https://github.com/Gwynerva/parapet-classic';

/** The findings about the original (`reference/findings`), or one of their pages. */
export function findingsUrl(page?: string): string {
  return `${SOURCE_URL}/tree/main/reference/findings${page ? `/${page}` : ''}`;
}

/** The Lab next to the game (the race page is the game one folder down). */
export function labUrl(): string {
  return new URL(isRacePage() ? '../lab/' : 'lab/', location.href).href;
}
