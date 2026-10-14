/** The Moves menu's demos (`packages/content/moves/demos.json`, authored with `npm run demo`). */
import type { MoveDemoData } from '@parapet/runtime/moves/MoveDemo.ts';
import demosJson from '@content/moves/demos.json';

export const MOVE_DEMOS: readonly MoveDemoData[] = (
  demosJson as unknown as { demos: MoveDemoData[] }
).demos;
