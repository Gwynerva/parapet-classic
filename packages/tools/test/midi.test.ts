import { describe, expect, it } from 'vitest';
import { splitMidi } from '../src/splitMidi.ts';
import { index, jar } from './helpers.ts';

describe('music (file s)', () => {
  it('splits into 14 MIDI files that tile the resource exactly', () => {
    const bytes = jar().read('s');
    const tracks = splitMidi(bytes, index());
    expect(tracks.length).toBe(14);
    let end = 0;
    tracks.forEach((track, i) => {
      expect(track.id).toBe(i);
      expect(track.offset).toBe(end);
      expect(String.fromCharCode(...track.data.subarray(0, 4))).toBe('MThd');
      end += track.length;
    });
    expect(end).toBe(bytes.length);
    expect(tracks[1]?.duration).toBe(127067);
    for (const track of tracks.slice(2)) expect(track.duration).toBe(43157);
  });
});
