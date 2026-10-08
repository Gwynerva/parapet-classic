/** Scores written as text (`audio/Score.ts`) and the contests' theme. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { noteNumber, scoreProblems, scoreToSong, type Score } from '../src/audio/Score.ts';
import { normalisationGain } from '../src/audio/Loudness.ts';

const here = dirname(fileURLToPath(import.meta.url));
const THEME = join(here, '..', '..', 'content', 'bosses', 'theme.json');

function score(patch: Partial<Score>): Score {
  return {
    title: 't',
    bpm: 120,
    stepsPerBar: 4,
    tracks: { lead: { channel: 1, program: 81 }, drums: { channel: 9 } },
    drumKit: { K: 36 },
    patterns: { a: 'C4 - . E4+G4!', d: ['K.K.'] },
    sections: { s: { bars: 2, play: { lead: ['a', 'a@+12'], drums: ['d'] } } },
    song: ['s'],
    ...patch,
  };
}

describe('scores', () => {
  it('names notes the MIDI way', () => {
    expect(noteNumber('C4')).toBe(60);
    expect(noteNumber('A4')).toBe(69);
    expect(noteNumber('C#4')).toBe(61);
    expect(noteNumber('Eb2')).toBe(39);
    expect(noteNumber('H4')).toBeNull();
  });

  it('turns steps into timed notes: holds, rests, chords, accents, transposition, drums', () => {
    const song = scoreToSong(score({}));
    const step = 60000 / 120 / 4;
    expect(song.durationMs).toBe(8 * step);
    const lead = song.notes.filter((n) => n.channel === 1);
    expect(lead.map((n) => [n.time / step, n.note, n.velocity])).toEqual([
      [0, 60, 96],
      [3, 64, 120],
      [3, 67, 120],
      [4, 72, 96],
      [7, 76, 120],
      [7, 79, 120],
    ]);
    expect(lead[0]!.duration).toBeCloseTo(2 * step * 0.9);
    const drums = song.notes.filter((n) => n.channel === 9);
    expect(drums.map((n) => n.time / step)).toEqual([0, 2, 4, 6]);
  });

  it('finds mistakes', () => {
    const bad = scoreProblems(
      score({
        patterns: { a: 'C4 X9 .', d: ['K.Z.'] },
        sections: { s: { bars: 1, play: { lead: ['d', 'zzz'], bass: ['a'] } } },
        song: ['s', 'nope'],
      }),
    );
    const text = bad.join('\n');
    expect(text).toMatch(/a: 3 steps, not whole bars/);
    expect(text).toMatch(/bad step "X9"/);
    expect(text).toMatch(/"Z" is not in the drum kit/);
    expect(text).toMatch(/d does not suit track lead/);
    expect(text).toMatch(/unknown pattern zzz/);
    expect(text).toMatch(/unknown track bass/);
    expect(text).toMatch(/unknown section nope/);
  });

  it('the contest theme is sound and loops after its last note', () => {
    const theme = JSON.parse(readFileSync(THEME, 'utf8')) as Score;
    expect(scoreProblems(theme)).toEqual([]);
    const song = scoreToSong(theme);
    expect(song.durationMs / 1000).toBeGreaterThan(40);
    expect(song.durationMs / 1000).toBeLessThan(60);
    const lastEnd = Math.max(...song.notes.map((n) => n.time + n.duration));
    expect(lastEnd).toBeLessThanOrEqual(song.durationMs + 1e-6);
    expect(normalisationGain(song)).toBeGreaterThan(0);
    // Never more voices at once than the synthesiser has (32).
    const starts = new Map<number, number>();
    for (const n of song.notes) starts.set(n.time, (starts.get(n.time) ?? 0) + 1);
    expect(Math.max(...starts.values())).toBeLessThanOrEqual(32);
  });
});
