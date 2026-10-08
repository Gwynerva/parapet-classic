import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MOVE_KEYS } from '../src/moves/moveKeys.ts';
import { checkDemo, type MoveDemoData } from '../src/moves/MoveDemo.ts';
import { parseDemoLevel } from '../src/moves/demoLevel.ts';
import { hasContent, loadMoves, loadTables } from './helpers/content.ts';

const DEMOS = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../content/moves/demos.json', import.meta.url)), 'utf8'),
) as { demos: MoveDemoData[] };

describe('move demo levels', () => {
  it('parse every tile and the start', () => {
    const level = parseDemoLevel(['....', '.S..', '[==]', 'x!|x']);
    expect(level.start).toEqual({ x: 1, y: 1 });
    expect(level.data.tiles.slice(8, 12)).toEqual([5, 3, 3, 6]);
    expect(Array.from(level.fill.slice(12, 16))).toEqual([1, 0, 0, 1]);
    expect(() => parseDemoLevel(['.S.', '..'])).toThrow();
    expect(() => parseDemoLevel(['...', '...'])).toThrow();
    expect(() => parseDemoLevel(['.S?'])).toThrow();
  });
});

describe.skipIf(!hasContent())('move demos', () => {
  const content = { moves: loadMoves(), tables: loadTables() };

  it('cover the twenty moves in the menu order', () => {
    expect(DEMOS.demos.map((d) => d.move)).toEqual([...MOVE_KEYS]);
  });

  for (const demo of DEMOS.demos) {
    it(`${demo.move} shows its move without a fall (npm run demo -- show ${demo.move})`, () => {
      expect(checkDemo(demo, content)).toEqual([]);
    });
  }
});
