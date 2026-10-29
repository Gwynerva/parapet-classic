import { describe, expect, it } from 'vitest';
import {
  codeFromQuery,
  extractReplayCode,
  MAX_LINK_LENGTH,
  replayFileName,
  replayRunKey,
  replayFileText,
  replayLink,
} from '../src/app/replayFile.ts';

const CODE = 'AQ5wYXJhcGV0LXNpbUAwLjIuMAdjbGFzc2lj';

describe('replay links and files', () => {
  it('builds a link to the race page under the game, the code as its query', () => {
    expect(replayLink('https://example.org/parapet-classic/?app=1#old', CODE)).toBe(
      `https://example.org/parapet-classic/r/?${CODE}`,
    );
    expect(replayLink(`https://example.org/parapet-classic/r/?${CODE}`, CODE)).toBe(
      `https://example.org/parapet-classic/r/?${CODE}`,
    );
    expect(replayLink('http://localhost:5173/index.html', CODE)).toBe(
      `http://localhost:5173/r/?${CODE}`,
    );
  });

  it('offers no link longer than a chat message takes', () => {
    const site = 'https://example.org/';
    const fits = 'A'.repeat(MAX_LINK_LENGTH - `${site}r/?`.length);
    expect(replayLink(site, fits)).toHaveLength(MAX_LINK_LENGTH);
    expect(replayLink(site, `${fits}A`)).toBeNull();
  });

  it('finds the code in a link, a file and a bare code', () => {
    expect(extractReplayCode(replayLink('https://example.org/', CODE)!)).toBe(CODE);
    expect(extractReplayCode(replayFileText(CODE, { level: 2, mode: 'sprint', name: 'x' }))).toBe(
      CODE,
    );
    expect(extractReplayCode(CODE)).toBe(CODE);
    expect(extractReplayCode(`https://example.org/r/?${CODE}`)).toBe(CODE);
    expect(extractReplayCode(`race me: https://example.org/game/r/?${CODE} !`)).toBe(CODE);
    expect(extractReplayCode(`https://example.org/r/?${CODE}&utm_source=chat`)).toBe(CODE);
  });

  it('reads the code from a page query, ignoring parameters added after it', () => {
    expect(codeFromQuery(`?${CODE}`)).toBe(CODE);
    expect(codeFromQuery(`?${CODE}&utm_source=telegram`)).toBe(CODE);
    expect(codeFromQuery('')).toBeNull();
    expect(codeFromQuery('?level=3&mode=sprint')).toBeNull();
    expect(codeFromQuery(`?r=${CODE}`)).toBeNull();
  });

  it('finds nothing in other text', () => {
    expect(extractReplayCode('')).toBeNull();
    expect(extractReplayCode('hello world')).toBeNull();
    expect(extractReplayCode('{"format":"something-else","code":"abc"}')).toBeNull();
    expect(extractReplayCode('{not json')).toBeNull();
    expect(extractReplayCode(`{"format":"parapet-classic-replay","code":"a b"}`)).toBeNull();
  });

  it('names files after the level, mode, runner and a key of the run', () => {
    const name = replayFileName(2, 'sprint', 'Blaise!', 'AnUaDAR50gQKCEd3eW5lcnZh');
    expect(name).toMatch(/^parapet-l3-sprint-blaise-[0-9a-z]{6}\.parapet-replay$/);
    expect(replayFileName(0, 'flags', 'Вася', 'AnUaDAR50gQKCEd3eW5lcnZh')).toMatch(
      /^parapet-l1-flags-[0-9a-z]{6}\.parapet-replay$/,
    );
    // The key follows the run: the same code gives the same name, another code another one.
    expect(replayFileName(2, 'sprint', 'Blaise', 'AnUaDAR50gQKCEd3eW5lcnZh')).toBe(
      replayFileName(2, 'sprint', 'Blaise', 'AnUaDAR50gQKCEd3eW5lcnZh'),
    );
    expect(replayRunKey('AnUaDAR50gQKCEd3eW5lcnZh')).not.toBe(
      replayRunKey('AnUaDAR50gQKCEd3eW5lcnZi'),
    );
    // A name cut at one of its separators leaves no double hyphen before the key.
    expect(
      replayFileName(0, 'sprint', 'twenty-three-characters-xyz', 'AnUaDAR50gQKCEd3eW5lcnZh'),
    ).toMatch(/^parapet-l1-sprint-twenty-three-characters-[0-9a-z]{6}\.parapet-replay$/);
  });
});
