/**
 * Just enough of a Standard MIDI File reader for the findings: how long a file plays (tempo
 * changes followed) and how many events of each kind it has.
 */

export interface MidiSummary {
  /** Length in ms, to the last event. */
  ms: number;
  tracks: number;
  notes: number;
  /** Controller 7 (channel volume) changes. */
  volume: number;
}

export function readMidi(bytes: Uint8Array): MidiSummary {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at: number): string => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (text(0) !== 'MThd') throw new Error('midi: no MThd');
  const tracks = view.getUint16(10);
  const division = view.getUint16(12);
  // Every event in absolute ticks: tempo changes for the clock, the rest counted.
  const tempos: { tick: number; usPerQuarter: number }[] = [];
  let notes = 0;
  let volume = 0;
  let lastTick = 0;
  let pos = 8 + view.getUint32(4);
  for (let t = 0; t < tracks; t++) {
    if (text(pos) !== 'MTrk') throw new Error(`midi: no MTrk at ${pos}`);
    const end = pos + 8 + view.getUint32(pos + 4);
    pos += 8;
    let tick = 0;
    let status = 0;
    const vlq = (): number => {
      let v = 0;
      for (;;) {
        const byte = bytes[pos++]!;
        v = (v << 7) | (byte & 0x7f);
        if ((byte & 0x80) === 0) return v;
      }
    };
    while (pos < end) {
      tick += vlq();
      let first = bytes[pos]!;
      if (first & 0x80) {
        status = first;
        pos++;
        first = bytes[pos]!;
      }
      if (status === 0xff) {
        const type = bytes[pos++]!;
        const len = vlq();
        if (type === 0x51) {
          tempos.push({
            tick,
            usPerQuarter: (bytes[pos]! << 16) | (bytes[pos + 1]! << 8) | bytes[pos + 2]!,
          });
        }
        pos += len;
      } else if (status === 0xf0 || status === 0xf7) {
        pos += vlq();
      } else {
        const kind = status & 0xf0;
        const size = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
        if (kind === 0x90 && bytes[pos + 1]! > 0) notes++;
        if (kind === 0xb0 && bytes[pos] === 7) volume++;
        pos += size;
      }
      lastTick = Math.max(lastTick, tick);
    }
    pos = end;
  }
  tempos.sort((a, b) => a.tick - b.tick);
  let ms = 0;
  let at = 0;
  let us = 500000;
  for (const change of tempos) {
    if (change.tick > lastTick) break;
    ms += ((change.tick - at) * us) / division / 1000;
    at = change.tick;
    us = change.usPerQuarter;
  }
  ms += ((lastTick - at) * us) / division / 1000;
  return { ms: Math.round(ms), tracks, notes, volume };
}
