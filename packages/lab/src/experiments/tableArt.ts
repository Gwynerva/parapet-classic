/**
 * Pictures of the move table: every state as a cell of a "periodic table" coloured by the shared
 * transition list it falls back on, one state's record and transition list as the original
 * stores them, and the same table as a small panel under a running runner, its state lit.
 */
import { MoveFlag, type MoveDef } from '@parapet/sim';
import type { RasterFont } from '@parapet/runtime/text/RasterText.ts';
import type { Frame } from '../frame.ts';
import { INK, RGB, rgb, SERIES } from '../palette.ts';
import { Svg } from '../svg.ts';
import {
  conditionWord,
  enteredByTable,
  familyOf,
  instantStates,
  reachable,
  type Family,
} from './table.ts';

export const FAMILY: Record<Family, { color: string; label: string }> = {
  ground: { color: SERIES[0], label: 'falls back on the ground list (1)' },
  air: { color: SERIES[2], label: 'falls back on the air lists (10, then 9)' },
  other: { color: SERIES[4], label: 'falls back on another shared list (21 or 55)' },
  own: { color: INK.muted, label: 'its own list only' },
  list: { color: INK.muted, label: 'only a shared list: never entered' },
};

const COLS = 15;

export interface TableLook {
  family: Family[];
  instant: Set<number>;
  unreachable: Set<number>;
}

export function tableLook(states: readonly MoveDef[]): TableLook {
  const entered = enteredByTable(states);
  const reach = reachable(states);
  return {
    family: states.map((s) => familyOf(states, entered, s.id)),
    instant: new Set(instantStates(states)),
    unreachable: new Set(
      states.filter((s) => !reach.has(s.id) && entered.has(s.id)).map((s) => s.id),
    ),
  };
}

/** Every state as a cell, 15 to a row. */
export function periodicTable(states: readonly MoveDef[]): string {
  const look = tableLook(states);
  const cw = 40;
  const ch = 34;
  const gap = 4;
  const x0 = 20;
  const top = 68;
  const rows = Math.ceil(states.length / COLS);
  const families = (Object.keys(FAMILY) as Family[]).filter((f) => look.family.includes(f));
  const legendY = top + rows * (ch + gap) + 16;
  const width = x0 * 2 + COLS * (cw + gap) - gap;
  const height = legendY + (families.length + 2) * 20 + 8;
  const svg = new Svg(
    width,
    height,
    `The parkour as a table: ${states.length} states`,
    'Every state of the original’s move table; the transitions of a state are tried first, then its shared list’s',
  );
  for (const s of states) {
    const x = x0 + (s.id % COLS) * (cw + gap);
    const y = top + Math.floor(s.id / COLS) * (ch + gap);
    const f = look.family[s.id]!;
    const c = FAMILY[f].color;
    const tip = [
      `State ${s.id}`,
      s.duration === -1 ? 'duration from the speed' : `${s.duration} time units`,
      s.next >= 0 ? `then ${s.next}` : '',
      `${s.transitions.length} transitions of its own`,
      s.parent >= 0 ? `then list ${s.parent}` : '',
      s.points > 0 ? `${s.points} points` : '',
      look.instant.has(s.id) ? 'instant' : '',
    ]
      .filter(Boolean)
      .join(', ');
    if (f === 'list') {
      svg.rect(x + 0.5, y + 0.5, cw - 1, ch - 1, 'none', { rx: 4, stroke: c, tip });
    } else {
      svg.rect(x, y, cw, ch, c, { rx: 4, opacity: f === 'own' ? 0.22 : 0.4, tip });
    }
    if (look.unreachable.has(s.id)) {
      svg.rect(x + 1.5, y + 1.5, cw - 3, ch - 3, 'none', { rx: 3, stroke: SERIES[6] });
    }
    svg.text(x + cw / 2, y + 17, String(s.id), {
      size: 13,
      weight: 600,
      fill: INK.text,
      anchor: 'middle',
    });
    if (s.points > 0) {
      svg.text(x + cw / 2, y + 29, `+${s.points}`, { size: 9, fill: INK.muted, anchor: 'middle' });
    }
    if (look.instant.has(s.id)) svg.circle(x + cw - 6, y + 6, 2.5, SERIES[3]);
  }
  families.forEach((f, i) => {
    const y = legendY + i * 20;
    if (f === 'list') svg.rect(20, y - 9, 10, 10, 'none', { rx: 2, stroke: FAMILY[f].color });
    else svg.rect(20, y - 9, 10, 10, FAMILY[f].color, { rx: 2, opacity: f === 'own' ? 0.5 : 1 });
    svg.text(35, y, FAMILY[f].label, { size: 12, fill: INK.text });
  });
  const y = legendY + families.length * 20;
  svg.circle(25, y - 4, 2.5, SERIES[3]);
  svg.text(35, y, 'instant: no time of its own, the next state follows in the same step', {
    size: 12,
    fill: INK.text,
  });
  svg.rect(20, y + 11, 10, 10, 'none', { rx: 2, stroke: SERIES[6] });
  svg.text(35, y + 20, 'reached by no transition from the start', { size: 12, fill: INK.text });
  svg.text(width - 20, y + 20, '+n: points', { size: 12, fill: INK.muted, anchor: 'end' });
  return svg.toString();
}

const FIELDS: readonly [string, (s: MoveDef) => string][] = [
  ['duration', (s) => String(s.duration)],
  ['next state', (s) => String(s.next)],
  ['impulse type', (s) => String(s.impulseType)],
  ['B', (s) => String(s.paramB)],
  ['C', (s) => String(s.paramC)],
  ['D', (s) => String(s.paramD)],
  ['animation', (s) => String(s.clipOffset)],
  ['playback', (s) => String(s.animMode)],
  ['flags', (s) => `0x${s.flags.toString(16)}`],
  ['snap type', (s) => String(s.snapType)],
  ['parent', (s) => String(s.parent)],
  ['transitions', (s) => String(s.transitionList)],
  ['score type', (s) => String(s.scoreType)],
  ['points', (s) => String(s.points)],
];

/** The names of the flags set in `flags`, from `MoveFlag`. */
export function flagNames(flags: number): string[] {
  return Object.entries(MoveFlag)
    .filter(([, bit]) => (flags & bit) !== 0)
    .map(([name]) => name.toLowerCase().replace(/_/g, ' '));
}

/** One state's 14 numbers and its transition list, as the original stores them. */
export function recordChart(s: MoveDef, title: string): string {
  const bw = 84;
  const bh = 46;
  const gap = 6;
  const x0 = 20;
  const top = 68;
  const listTop = top + 2 * (bh + gap) + 40;
  const width = x0 * 2 + 7 * (bw + gap) - gap;
  const height = listTop + (s.transitions.length + 1) * 20 + 40;
  const svg = new Svg(
    width,
    height,
    title,
    `State ${s.id}: 14 numbers of the table, then its list`,
  );
  FIELDS.forEach(([name, value], i) => {
    const x = x0 + (i % 7) * (bw + gap);
    const y = top + Math.floor(i / 7) * (bh + gap);
    svg.rect(x, y, bw, bh, INK.line, { rx: 4 });
    svg.text(x + 8, y + 16, `[${i}] ${name}`, { size: 10, fill: INK.muted });
    svg.text(x + 8, y + 36, value(s), { size: 15, fill: INK.text, mono: true });
  });
  const flags = flagNames(s.flags);
  svg.text(x0, top + 2 * (bh + gap) + 14, `flags: ${flags.join(', ') || 'none'}`, {
    size: 12,
    fill: INK.muted,
  });
  svg.text(
    x0,
    listTop,
    `At ${s.transitionList}: ${s.transitions.length}, then a word of conditions and a state for each`,
    {
      size: 12,
      fill: INK.text,
    },
  );
  s.transitions.forEach((t, i) => {
    const y = listTop + 22 + i * 20;
    const word = `0x${conditionWord(t).toString(16).padStart(8, '0')}`;
    svg.text(x0 + 10, y, word, { size: 13, fill: INK.text, mono: true });
    svg.text(x0 + 120, y, `→ ${t.target}`, { size: 13, fill: SERIES[0], mono: true });
    svg.text(x0 + 190, y, `if ${t.conditions.join(' and ') || 'always'}`, {
      size: 12,
      fill: INK.muted,
    });
  });
  svg.text(
    x0,
    height - 16,
    'A word packs up to four condition ids, one per byte; all of them must hold.',
    { size: 12, fill: INK.muted },
  );
  return svg.toString();
}

/**
 * The table as a panel of 22 × 14 pixel cells: the `current` state bright, the states entered
 * lately outlined by how lately (`recent`: 1 just now … 0), the `visited` ones legible.
 */
export function drawTablePanel(
  frame: Frame,
  font: RasterFont,
  x: number,
  y: number,
  look: TableLook,
  current: number,
  recent: ReadonlyMap<number, number>,
  visited: ReadonlySet<number>,
): void {
  const cw = 22;
  const ch = 14;
  look.family.forEach((f, id) => {
    const cx = x + (id % COLS) * (cw + 1);
    const cy = y + Math.floor(id / COLS) * (ch + 1);
    const c = rgb(FAMILY[f].color);
    const on = id === current;
    if (on) frame.fill(cx, cy, cw, ch, RGB.text);
    else if (f === 'list') frame.box(cx, cy, cw, ch, c, 0.6);
    else frame.fill(cx, cy, cw, ch, c, f === 'own' ? 0.15 : 0.3);
    const glow = recent.get(id) ?? 0;
    if (!on && glow > 0) frame.box(cx - 1, cy - 1, cw + 2, ch + 2, RGB.text, glow);
    frame.text(font, String(id), cx + cw / 2, cy + 1, on ? RGB.black : RGB.text, {
      align: 'center',
      alpha: on || visited.has(id) ? 1 : 0.45,
    });
  });
}

/** The panel's size. */
export function tablePanelSize(states: number): { width: number; height: number } {
  return { width: COLS * 23 - 1, height: Math.ceil(states / COLS) * 15 - 1 };
}
