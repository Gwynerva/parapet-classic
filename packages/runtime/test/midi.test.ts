import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMidi, songEvents, stripEndMarker, type MidiSong } from '../src/audio/MidiFile.ts';
import { drumFor, PATCH_COUNT, patchFor, songPatch } from '../src/audio/Instruments.ts';
import { SongCursor, type DueEvent } from '../src/audio/MusicPlayer.ts';
import {
  LIVE_BOSS,
  LIVE_MENU,
  LIVE_SCORES,
  MENU_TRACK,
  MusicDirector,
  trackPatches,
  trackTrim,
} from '../src/audio/MusicDirector.ts';
import type { MusicPlayer } from '../src/audio/MusicPlayer.ts';
import { CONTENT_DIR, hasContent } from './helpers/content.ts';

/** A minimal format-0 file: tempo 120, one note on channel 0 and one drum hit. */
function tinyMidi(): Uint8Array {
  const track = [
    0x00,
    0xff,
    0x51,
    0x03,
    0x07,
    0xa1,
    0x20, // tempo 500000 us
    0x00,
    0xc0,
    0x18, // program 24 (guitar)
    0x00,
    0xb0,
    0x07,
    0x40, // volume 64
    0x00,
    0x90,
    0x3c,
    0x64, // note on C4 vel 100
    0x60,
    0x3c,
    0x00, // running status: note off after 96 ticks (one beat)
    0x00,
    0x99,
    0x26,
    0x7f, // snare on
    0x30,
    0x89,
    0x26,
    0x00, // snare off after half a beat
    0x00,
    0xff,
    0x2f,
    0x00,
  ];
  const header = [
    0x4d,
    0x54,
    0x68,
    0x64,
    0,
    0,
    0,
    6,
    0,
    0,
    0,
    1,
    0,
    96,
    0x4d,
    0x54,
    0x72,
    0x6b,
    0,
    0,
    0,
    track.length,
  ];
  return new Uint8Array([...header, ...track]);
}

describe('parseMidi', () => {
  it('resolves notes with durations, programs and channel volume', () => {
    const song = parseMidi(tinyMidi());
    expect(song.ticksPerBeat).toBe(96);
    expect(song.notes).toHaveLength(2);
    const [note, drum] = song.notes;
    expect(note).toMatchObject({
      time: 0,
      duration: 500,
      channel: 0,
      note: 60,
      velocity: 100,
      program: 24,
    });
    expect(note?.volume).toBeCloseTo(64 / 127, 3);
    expect(drum).toMatchObject({ time: 500, duration: 250, channel: 9, note: 38 });
    expect(song.durationMs).toBe(750);
    expect(song.unknownEvents).toBe(0);
  });

  it('rejects files that are not MIDI', () => {
    expect(() => parseMidi(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(/not a MIDI/);
  });

  it.skipIf(!hasContent())('parses the fourteen tracks of the original', () => {
    const table = JSON.parse(readFileSync(join(CONTENT_DIR, 'music.json'), 'utf8')) as {
      tracks: { id: number; file: string }[];
    };
    expect(table.tracks).toHaveLength(14);
    for (const track of table.tracks) {
      const file = join(CONTENT_DIR, track.file);
      expect(existsSync(file)).toBe(true);
      const song = parseMidi(readFileSync(file));
      expect(song.notes.length).toBeGreaterThan(20);
      expect(song.durationMs).toBeGreaterThan(3000);
      expect(song.durationMs).toBeLessThan(10 * 60 * 1000);
      for (const n of song.notes) {
        expect(n.duration).toBeGreaterThan(0);
        expect(n.program).toBeGreaterThanOrEqual(0);
        expect(n.program).toBeLessThan(128);
      }
    }
  });
});

describe('channel volume', () => {
  it('keeps the changes of channel volume in time order', () => {
    const song = parseMidi(tinyMidi());
    expect(song.controls).toEqual([{ time: 0, channel: 0, volume: 64 / 127 }]);
    const events = songEvents(song);
    expect(events[0]!.control).toBeDefined();
    expect(events.filter((e) => e.note).length).toBe(song.notes.length);
  });

  it.skipIf(!hasContent())('follows the swells of the menu pad and drops the end marker', () => {
    const song = parseMidi(new Uint8Array(readFileSync(join(CONTENT_DIR, 'music', '1.mid'))));
    // The pad swells through hundreds of volume changes; the note-on volume alone misses them.
    expect(song.controls!.length).toBeGreaterThan(500);
    const stripped = stripEndMarker(song);
    expect(stripped.durationMs).toBe(song.durationMs);
    expect(stripped.notes.some((n) => n.velocity <= 1)).toBe(false);
    expect(song.notes.length - stripped.notes.length).toBeGreaterThan(0);
  });
});

describe('instruments', () => {
  it('has a patch for every program and a drum for every key', () => {
    for (let p = 0; p < PATCH_COUNT; p++) {
      const patch = patchFor(p);
      expect(patch.gain).toBeGreaterThan(0);
      expect(patch.attack).toBeGreaterThanOrEqual(0);
    }
    for (let k = 27; k < 88; k++) expect(drumFor(k).decay).toBeGreaterThan(0);
  });

  it('plays the menu track with mellow patches of its own, kept below the rest', () => {
    const own = trackPatches(MENU_TRACK)!;
    for (const program of [50, 81]) {
      const patch = songPatch(own, program);
      expect(patch).not.toBe(patchFor(program));
      expect(patch.wave).not.toBe('square');
      expect(patch.lowpass ?? Infinity).toBeLessThanOrEqual(2000);
      expect(patch.attack).toBeGreaterThanOrEqual(0.2);
    }
    expect(songPatch(own, 0)).toBe(patchFor(0));
    expect(songPatch(undefined, 81)).toBe(patchFor(81));
    expect(trackPatches(2)).toBeUndefined();
    expect(trackTrim(MENU_TRACK)).toBeCloseTo(0.4225);
    expect(trackTrim(2)).toBe(1);
  });
});

describe('SongCursor', () => {
  const song = parseMidi(tinyMidi());

  it('yields the notes inside the lookahead and loops the song', () => {
    const cursor = new SongCursor(song, true, 10);
    const out: DueEvent[] = [];
    const notes = (): number[] => out.filter((d) => d.note).map((d) => d.at);
    expect(cursor.due(10, 0.3, out)).toBe(true);
    expect(notes()).toEqual([10]);
    // The volume change comes before the note it applies to.
    expect(out[0]!.control?.volume).toBeCloseTo(64 / 127, 6);
    out.length = 0;
    cursor.due(10.4, 0.3, out);
    expect(notes()).toEqual([10.5]);
    out.length = 0;
    // Past the end (0.75 s) the song starts again at 10.75, as the next pass.
    cursor.due(10.7, 0.3, out);
    expect(notes()).toEqual([10.75]);
    expect(out.every((d) => d.pass === 1)).toBe(true);
    expect(cursor.startTime).toBeCloseTo(10.75, 6);
  });

  it('ends a non-looping song after its last note', () => {
    const cursor = new SongCursor(song, false, 0);
    const out: DueEvent[] = [];
    expect(cursor.due(0, 1, out)).toBe(true);
    expect(cursor.due(0.8, 0.3, out)).toBe(false);
  });

  it('seeks to a position for resuming', () => {
    const cursor = new SongCursor(song, true, 0);
    cursor.seek(400, 100);
    const out: DueEvent[] = [];
    cursor.due(100, 0.3, out);
    expect(out.filter((d) => d.note).map((d) => d.at)).toEqual([100.1]);
  });
});

describe('MusicDirector', () => {
  function fakePlayer(): MusicPlayer & { played: number[] } {
    const played: number[] = [];
    let playing = false;
    return {
      played,
      get playing() {
        return playing;
      },
      get ready() {
        return true;
      },
      get volume() {
        return 1;
      },
      setVolume: () => undefined,
      unlock: () => undefined,
      play: (song: MidiSong) => {
        played.push(song.durationMs);
        playing = true;
      },
      stop: () => {
        playing = false;
      },
      pause: () => undefined,
      resume: () => undefined,
    } as unknown as MusicPlayer & { played: number[] };
  }

  it("rotates the game tracks per theme and keeps the warm-ups' menu track going", async () => {
    const player = fakePlayer();
    const requested: number[] = [];
    const director = new MusicDirector({
      player,
      loadTrack: (id) => {
        requested.push(id);
        return Promise.resolve(parseMidi(tinyMidi()));
      },
    });
    director.warmUp();
    await Promise.resolve();
    director.warmUp();
    expect(requested).toEqual([MENU_TRACK]);
    director.game(0);
    director.game(0);
    director.game(0);
    director.game(1);
    expect(requested.slice(1)).toEqual([2, 3, 4, 5]);
    expect(director.current).toBe(5);
  });

  it('keeps one score through the menus and picks another for every run with a boss', async () => {
    const player = fakePlayer();
    const requested: number[] = [];
    const rolls = [0.45, 0.45, 0.05, 0.45, 0.05, 0.99];
    const director = new MusicDirector({
      player,
      loadTrack: (id) => {
        requested.push(id);
        return Promise.resolve(parseMidi(tinyMidi()));
      },
      random: () => rolls.shift() ?? 0,
    });
    director.menu();
    await Promise.resolve();
    director.menu();
    expect(requested).toEqual([LIVE_MENU + 4]);
    director.boss();
    await Promise.resolve();
    // A run started over keeps its score; a new run (the menus between) gets another.
    director.boss();
    expect(requested.slice(1)).toEqual([LIVE_BOSS + 4]);
    director.menu();
    director.boss();
    director.menu();
    director.boss();
    // Never the same score twice in a row: a roll skips over the last score's number.
    expect(requested.filter((id) => id >= LIVE_BOSS)).toEqual([
      LIVE_BOSS + 4,
      LIVE_BOSS + 5,
      LIVE_BOSS + 9,
    ]);
    expect(requested.filter((id) => id >= LIVE_MENU && id < LIVE_BOSS)).toEqual([
      LIVE_MENU + 4,
      LIVE_MENU + 0,
      LIVE_MENU + 1,
    ]);
    expect(trackTrim(LIVE_MENU + 3)).toBe(trackTrim(MENU_TRACK));
    expect(trackTrim(LIVE_BOSS + 3)).toBe(1);
  });

  it('can pick the last score when the roll is 1, and never one past the end', () => {
    const player = fakePlayer();
    const requested: number[] = [];
    // Every choice rolls 1, the menus' too (they take a roll each in between).
    const rolls = [1, 1, 1, 1, 1, 1];
    const director = new MusicDirector({
      player,
      loadTrack: (id) => {
        requested.push(id);
        return Promise.resolve(parseMidi(tinyMidi()));
      },
      random: () => rolls.shift() ?? 0,
    });
    const n = LIVE_SCORES.length;
    const chosen: (number | null)[] = [];
    for (let i = 0; i < 3; i++) {
      director.boss();
      chosen.push(director.current);
      director.menu();
    }
    expect(chosen).toEqual([LIVE_BOSS + n - 1, LIVE_BOSS + n - 2, LIVE_BOSS + n - 1]);
    expect(requested.every((id) => id < LIVE_BOSS + n)).toBe(true);
  });

  it('stops at volume zero and restarts when the volume comes back', async () => {
    const player = fakePlayer();
    const director = new MusicDirector({
      player,
      loadTrack: () => Promise.resolve(parseMidi(tinyMidi())),
    });
    director.menu();
    await Promise.resolve();
    expect(player.playing).toBe(true);
    director.setVolume(0);
    expect(player.playing).toBe(false);
    director.setVolume(70);
    await Promise.resolve();
    expect(player.playing).toBe(true);
  });
});
