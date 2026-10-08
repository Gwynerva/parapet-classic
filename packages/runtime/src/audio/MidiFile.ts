/**
 * Standard MIDI file parser (formats 0 and 1) that resolves everything the synthesiser needs
 * up front: a flat list of notes with absolute start times and durations in ms, each carrying
 * the program, channel volume and pan in force when it started, and the changes of channel
 * volume over time (a held chord swells and fades with them). Tempo changes are applied
 * through the tempo map, so the player only has to walk the lists.
 */

export interface MidiNote {
  /** Start time in ms from the beginning of the song. */
  time: number;
  /** Length in ms. */
  duration: number;
  /** 0..15; channel 9 is percussion. */
  channel: number;
  /** Key number 0..127. */
  note: number;
  /** 1..127. */
  velocity: number;
  /** GM program 0..127 of the channel at the note's start. */
  program: number;
  /** Channel volume × expression, 0..1. */
  volume: number;
  /** -1 (left) .. 1 (right). */
  pan: number;
}

/** A change of a channel's volume (CC7 × CC11) at a moment of the song. */
export interface MidiControl {
  time: number;
  channel: number;
  /** Channel volume × expression, 0..1. */
  volume: number;
}

/** The channel volume before any controller says otherwise (CC7 100, CC11 127). */
export const DEFAULT_CHANNEL_VOLUME = 100 / 127;

export interface MidiSong {
  durationMs: number;
  ticksPerBeat: number;
  notes: MidiNote[];
  /** Level the loader chose for the song (from measured loudness); estimated when absent. */
  gain?: number;
  /**
   * Channel volume changes in time order. When present the synthesiser applies them to the
   * channels as they happen (and ignores `MidiNote.volume`); songs without them (our own
   * scores) play every note at its own volume.
   */
  controls?: MidiControl[];
  /** Events the parser skipped (unknown status bytes); for diagnostics. */
  unknownEvents: number;
}

interface RawEvent {
  tick: number;
  order: number;
  status: number;
  data1: number;
  data2: number;
  /** Tempo in microseconds per quarter note (meta 0x51 only). */
  tempo?: number;
}

const DEFAULT_TEMPO = 500000;

class Reader {
  readonly bytes: Uint8Array;
  pos = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  u8(): number {
    const b = this.bytes[this.pos++];
    if (b === undefined) throw new Error('midi: unexpected end of file');
    return b;
  }

  u16(): number {
    return (this.u8() << 8) | this.u8();
  }

  u32(): number {
    return ((this.u8() << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8()) >>> 0;
  }

  varint(): number {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.u8();
      value = (value << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) return value;
    }
    throw new Error('midi: variable-length quantity too long');
  }

  tag(): string {
    return String.fromCharCode(this.u8(), this.u8(), this.u8(), this.u8());
  }

  skip(n: number): void {
    this.pos += n;
  }
}

function readTrack(bytes: Uint8Array, order: number, out: RawEvent[]): number {
  const r = new Reader(bytes);
  let tick = 0;
  let running = 0;
  let unknown = 0;
  while (r.pos < bytes.length) {
    tick += r.varint();
    let status = r.u8();
    if (status === 0xff) {
      const type = r.u8();
      const length = r.varint();
      if (type === 0x51 && length === 3) {
        const tempo = (r.u8() << 16) | (r.u8() << 8) | r.u8();
        out.push({ tick, order, status: 0xff, data1: 0x51, data2: 0, tempo });
      } else {
        if (type === 0x2f) return unknown;
        r.skip(length);
      }
      continue;
    }
    if (status === 0xf0 || status === 0xf7) {
      r.skip(r.varint());
      continue;
    }
    let data1: number;
    if (status < 0x80) {
      // Running status: the byte read was the first data byte.
      if (running === 0) throw new Error('midi: data byte without a status');
      data1 = status;
      status = running;
    } else {
      running = status;
      data1 = r.u8();
    }
    const kind = status & 0xf0;
    if (kind === 0xc0 || kind === 0xd0) {
      out.push({ tick, order, status, data1, data2: 0 });
    } else if (kind >= 0x80 && kind <= 0xe0) {
      out.push({ tick, order, status, data1, data2: r.u8() });
    } else {
      unknown++;
      r.u8();
    }
  }
  return unknown;
}

/** Parse a `.mid` file. Throws on a malformed header; tolerates truncated tracks. */
export function parseMidi(data: ArrayBuffer | Uint8Array): MidiSong {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const r = new Reader(bytes);
  if (r.tag() !== 'MThd') throw new Error('midi: not a MIDI file');
  const headerLength = r.u32();
  const format = r.u16();
  const trackCount = r.u16();
  const division = r.u16();
  r.skip(headerLength - 6);
  if (format > 1) throw new Error(`midi: format ${format} is not supported`);
  // SMPTE divisions are not used by the game's files; fall back to a sane PPQ.
  const ticksPerBeat = (division & 0x8000) !== 0 ? 480 : Math.max(1, division);

  const events: RawEvent[] = [];
  let unknownEvents = 0;
  let order = 0;
  for (let t = 0; t < trackCount && r.pos < bytes.length; t++) {
    if (r.tag() !== 'MTrk') throw new Error('midi: expected a track');
    const length = r.u32();
    const end = Math.min(bytes.length, r.pos + length);
    unknownEvents += readTrack(bytes.subarray(r.pos, end), order, events);
    r.pos = end;
    order += 1_000_000;
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  // Tempo map: ms at every tempo change.
  const tempos: { tick: number; ms: number; usPerBeat: number }[] = [
    { tick: 0, ms: 0, usPerBeat: DEFAULT_TEMPO },
  ];
  for (const e of events) {
    if (e.status !== 0xff || e.tempo === undefined) continue;
    const last = tempos[tempos.length - 1]!;
    const ms = last.ms + ((e.tick - last.tick) * last.usPerBeat) / 1000 / ticksPerBeat;
    tempos.push({ tick: e.tick, ms, usPerBeat: e.tempo });
  }
  let segment = 0;
  const toMs = (tick: number): number => {
    while (segment + 1 < tempos.length && tempos[segment + 1]!.tick <= tick) segment++;
    while (segment > 0 && tempos[segment]!.tick > tick) segment--;
    const t = tempos[segment]!;
    return t.ms + ((tick - t.tick) * t.usPerBeat) / 1000 / ticksPerBeat;
  };

  const program = new Array<number>(16).fill(0);
  const volume = new Array<number>(16).fill(100);
  const expression = new Array<number>(16).fill(127);
  const pan = new Array<number>(16).fill(64);
  const active = new Map<number, MidiNote>();
  const notes: MidiNote[] = [];
  const controls: MidiControl[] = [];
  const lastControl = new Array<number>(16).fill(DEFAULT_CHANNEL_VOLUME);
  const control = (channel: number, ms: number): void => {
    const value = ((volume[channel] ?? 100) / 127) * ((expression[channel] ?? 127) / 127);
    if (value === lastControl[channel]) return;
    lastControl[channel] = value;
    controls.push({ time: ms, channel, volume: value });
  };
  let lastMs = 0;
  const closeNote = (key: number, ms: number): void => {
    const n = active.get(key);
    if (!n) return;
    active.delete(key);
    n.duration = Math.max(1, ms - n.time);
  };
  for (const e of events) {
    if (e.status === 0xff) continue;
    const channel = e.status & 0x0f;
    const kind = e.status & 0xf0;
    const ms = toMs(e.tick);
    lastMs = Math.max(lastMs, ms);
    const key = (channel << 8) | e.data1;
    switch (kind) {
      case 0x90:
        if (e.data2 === 0) {
          closeNote(key, ms);
          break;
        }
        closeNote(key, ms);
        {
          const note: MidiNote = {
            time: ms,
            duration: 0,
            channel,
            note: e.data1,
            velocity: e.data2,
            program: program[channel] ?? 0,
            volume: ((volume[channel] ?? 100) / 127) * ((expression[channel] ?? 127) / 127),
            pan: ((pan[channel] ?? 64) - 64) / 64,
          };
          active.set(key, note);
          notes.push(note);
        }
        break;
      case 0x80:
        closeNote(key, ms);
        break;
      case 0xb0:
        if (e.data1 === 7) {
          volume[channel] = e.data2;
          control(channel, ms);
        } else if (e.data1 === 11) {
          expression[channel] = e.data2;
          control(channel, ms);
        } else if (e.data1 === 10) pan[channel] = e.data2;
        else if (e.data1 === 123 || e.data1 === 120) {
          for (const k of [...active.keys()]) if (k >> 8 === channel) closeNote(k, ms);
        }
        break;
      case 0xc0:
        program[channel] = e.data1;
        break;
      default:
        break;
    }
  }
  for (const key of [...active.keys()]) closeNote(key, lastMs + 500);
  let durationMs = lastMs;
  for (const n of notes) durationMs = Math.max(durationMs, n.time + n.duration);
  return { durationMs: Math.round(durationMs), ticksPerBeat, notes, controls, unknownEvents };
}

/**
 * Drops the marker chord the original's tracks end with (key 36 at velocity 1 on every
 * channel, a kick on the drum channel, just before the end): inaudible on the phone, a thud at
 * every loop on ours. The song keeps its length.
 */
export function stripEndMarker(song: MidiSong): MidiSong {
  const tail = song.durationMs - 250;
  const notes = song.notes.filter((n) => !(n.velocity <= 1 && n.time >= tail));
  return { ...song, notes };
}

/** A note or a channel volume change, in time order (what the player schedules). */
export interface SongEvent {
  time: number;
  note?: MidiNote;
  control?: MidiControl;
}

const eventCache = new WeakMap<MidiSong, SongEvent[]>();

/** Notes and controls of a song merged in time order (controls first at equal times). */
export function songEvents(song: MidiSong): SongEvent[] {
  const cached = eventCache.get(song);
  if (cached) return cached;
  const events: SongEvent[] = [];
  for (const control of song.controls ?? []) events.push({ time: control.time, control });
  for (const note of song.notes) events.push({ time: note.time, note });
  events.sort((a, b) => a.time - b.time || (a.control ? 0 : 1) - (b.control ? 0 : 1));
  eventCache.set(song, events);
  return events;
}
