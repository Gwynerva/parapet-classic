/**
 * The rivals as the original ships them: per level a recording of the developers' own run (a
 * snapshot of the runner, the total time, then the presses as `(ticks, input)` entries), played
 * back through the same physics as the player's. No AI anywhere.
 */
import { Input, type RivalRecording } from '@parapet/sim';
import { drawKey } from '../draw.ts';
import { Frame } from '../frame.ts';
import { INK, RGB, rgb, SERIES } from '../palette.ts';
import type { Scene } from '../scene.ts';
import { STEP_MS } from '../scene.ts';
import { Svg } from '../svg.ts';

/** Bytes of the snapshot (28 ints and 2 flag bytes), of the total time, and of an entry. */
export const SNAPSHOT_BYTES = 28 * 4 + 2;
export const TOTAL_BYTES = 4;
export const ENTRY_BYTES = 5;

/** The keys of the presses, in the order of the rolls. */
export const KEYS = [
  { name: 'UP', bit: Input.UP, arrow: 'up', color: SERIES[0] },
  { name: 'DOWN', bit: Input.DOWN, arrow: 'down', color: SERIES[1] },
  { name: 'FORWARD', bit: Input.FORWARD, arrow: 'right', color: SERIES[2] },
  { name: 'BACK', bit: Input.BACK, arrow: 'left', color: SERIES[3] },
] as const;

export interface Press {
  /** The tick (step) of the press from the rival's start. */
  tick: number;
  input: number;
}

/** The presses of a recording, at their ticks. */
export function pressesOf(rec: RivalRecording): Press[] {
  const out: Press[] = [];
  let tick = 0;
  for (const e of rec.entries) {
    if (e.input !== 0) out.push({ tick, input: e.input });
    tick += e.ticks;
  }
  return out;
}

/** The key of a press (its first bit in `KEYS`' order). */
export function keyOf(input: number): (typeof KEYS)[number] | undefined {
  return KEYS.find((k) => (input & k.bit) !== 0);
}

/** Every level's presses as a row of marks over the seconds of its run. */
export function pressChart(
  recs: readonly RivalRecording[],
  name: (level: number) => string,
): string {
  const x0 = 80;
  const plotW = 600;
  const top = 72;
  const rowH = 20;
  const ticks = recs.map((r) => r.entries.reduce((n, e) => n + e.ticks, 0));
  const maxS = Math.ceil((Math.max(...ticks) * STEP_MS) / 1000 / 10) * 10;
  const width = x0 + plotW + 30;
  const height = top + recs.length * rowH + 70;
  const svg = new Svg(
    width,
    height,
    'Every press of the twelve rivals',
    'The developers’ recorded runs, a row per level; each mark is one press of one tick',
  );
  const xOf = (tick: number): number => x0 + ((tick * STEP_MS) / 1000 / maxS) * plotW;
  recs.forEach((r, i) => {
    const y = top + i * rowH;
    const presses = pressesOf(r);
    svg.text(x0 - 8, y + 13, name(r.level), { size: 12, fill: INK.text, anchor: 'end' });
    svg.line(x0, y + 9, xOf(ticks[i]!), y + 9, INK.line);
    for (const p of presses) {
      const k = keyOf(p.input);
      if (!k) continue;
      svg.rect(xOf(p.tick) - 1, y + 2, 3, rowH - 6, k.color, {
        tip: `${name(r.level)}, ${((p.tick * STEP_MS) / 1000).toFixed(1)} s: ${k.name}`,
      });
    }
    svg.text(xOf(ticks[i]!) + 6, y + 13, String(presses.length), { size: 11, fill: INK.muted });
  });
  const axisY = top + recs.length * rowH + 6;
  for (let s = 0; s <= maxS; s += 10) {
    svg.text(x0 + (s / maxS) * plotW, axisY + 10, `${s} s`, {
      size: 11,
      fill: INK.muted,
      anchor: 'middle',
    });
  }
  KEYS.forEach((k, i) => svg.key(x0 + i * 110, height - 18, k.color, k.name));
  svg.text(width - 20, height - 18, 'n: presses', { size: 12, fill: INK.muted, anchor: 'end' });
  return svg.toString();
}

/** One recording laid out byte by byte. */
export function blobChart(rec: RivalRecording, name: string): string {
  const entries = rec.entries.length;
  const bytes = SNAPSHOT_BYTES + TOTAL_BYTES + (entries + 1) * ENTRY_BYTES;
  const x0 = 20;
  const plotW = 680;
  const top = 80;
  const barH = 34;
  const width = x0 * 2 + plotW;
  const height = top + barH + 120;
  const svg = new Svg(
    width,
    height,
    `The rival of ${name}, byte by byte`,
    `${bytes} bytes; no end marker, the reader stops at the end of the blob`,
  );
  const k = plotW / bytes;
  const parts: [number, string, string, string][] = [
    [SNAPSHOT_BYTES, INK.muted, 'snapshot', '28 ints of the runner’s state and 2 flag bytes'],
    [TOTAL_BYTES, SERIES[3], 'total', `the time, ${rec.totalTime} ms`],
    [entries * ENTRY_BYTES, SERIES[0], 'entries', `${entries} × (ticks: int, input: byte)`],
    [ENTRY_BYTES, SERIES[1], 'again', 'the last entry, written twice'],
  ];
  let x = x0;
  parts.forEach(([n, color, label, note], i) => {
    const w = n * k;
    svg.rect(x, top, Math.max(2, w - 2), barH, color, {
      rx: 3,
      tip: `${label}: ${n} bytes, ${note}`,
    });
    if (i === 2) {
      // The entries' boundaries.
      for (let e = 1; e < entries; e++) {
        svg.line(
          x + e * ENTRY_BYTES * k,
          top + 4,
          x + e * ENTRY_BYTES * k,
          top + barH - 4,
          INK.card,
          { opacity: 0.6 },
        );
      }
    }
    const ly = top + barH + 22 + (i % 2) * 34;
    svg.line(x + Math.min(w, 8) / 2, top + barH, x + Math.min(w, 8) / 2, ly - 12, INK.muted);
    svg.text(x, ly, `${label}, ${n} bytes`, { size: 12, fill: INK.text });
    svg.text(x, ly + 15, note, { size: 11, fill: INK.muted });
    x += w;
  });
  return svg.toString();
}

/**
 * A roll of a recording's presses scrolling under a playhead: the next seconds of the run, a lane
 * per key; a press lights up as it is played. `start` is the world step the rival's ticks count
 * from.
 */
export function rollScene(
  rec: RivalRecording,
  start: number,
  from: number,
  to: number,
  width: number,
): Scene {
  const presses = pressesOf(rec);
  const laneH = 14;
  const height = KEYS.length * laneH + 8;
  const ahead = 120;
  const behind = 40;
  return {
    width,
    height,
    from,
    to,
    draw(frame: Frame, t: number) {
      frame.clear(RGB.card);
      const now = t - start;
      const xOf = (tick: number): number =>
        16 + ((tick - (now - behind)) / (ahead + behind)) * (width - 20);
      KEYS.forEach((k, i) => {
        const y = 4 + i * laneH;
        frame.fill(16, y + laneH / 2, width - 20, 1, RGB.line);
        drawKey(frame, 2, y + 1, k.arrow, rgb(k.color));
      });
      for (const p of presses) {
        const k = keyOf(p.input);
        if (!k || p.tick < now - behind || p.tick > now + ahead) continue;
        const i = KEYS.indexOf(k);
        const played = p.tick <= now;
        frame.fill(xOf(p.tick) - 1, 5 + i * laneH, 3, laneH - 2, rgb(k.color), played ? 1 : 0.45);
      }
      const ph = Math.round(xOf(now));
      frame.fill(ph, 2, 1, height - 4, RGB.text);
    },
  };
}
