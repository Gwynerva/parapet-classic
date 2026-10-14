/**
 * Landings, taken apart on generated towers: the runner runs off a roof and falls 1 to 20 tiles
 * onto flat ground, without a key or with DOWN pressed as it starts to fall. What decides the
 * landing is the vertical speed alone (conditions 56–59 read `|v|`, the vertical speed before
 * the step); what survives it is the horizontal speed alone (the touchdown keeps `q` and drops
 * `r`).
 */
import { Input, MoveId } from '@parapet/sim';
import { parseDemoLevel } from '@parapet/runtime/moves/demoLevel.ts';
import { asciiWorld } from '../demo.ts';
import { demoScene } from '../demoScene.ts';
import type { RasterFont } from '@parapet/runtime/text/RasterText.ts';
import type { Frame } from '../frame.ts';
import type { Lab } from '../lab.ts';
import type { ToPixels } from '../demoScene.ts';
import { INK, rgb, SERIES } from '../palette.ts';
import { Svg } from '../svg.ts';
import { record, type Recording, type Track } from '../record.ts';
import type { Scene } from '../scene.ts';
import { sweep } from './sweep.ts';

export const MAX_DROP = 20;
/** The roof's edge is the right side of this column. */
export const EDGE_COL = 9;
/** Rows above the roof. */
const SKY_ROWS = 3;

/** A tower `drop` tiles above the ground, the runner starting on its roof. */
export function tower(drop: number, width = 44): string[] {
  const rows = ['.'.repeat(width), '.'.repeat(width), `.S${'.'.repeat(width - 2)}`];
  rows.push(`${'='.repeat(EDGE_COL)}]${'.'.repeat(width - EDGE_COL - 1)}`);
  for (let i = 0; i < drop - 1; i++)
    rows.push(`${'x'.repeat(EDGE_COL)}!${'.'.repeat(width - EDGE_COL - 1)}`);
  rows.push(`${'x'.repeat(EDGE_COL)}#${'='.repeat(width - EDGE_COL - 1)}`);
  rows.push('x'.repeat(width));
  return rows;
}

/** The row of the ground under a tower of `drop` tiles. */
export function groundRow(drop: number): number {
  return SKY_ROWS + drop;
}

/** What a landing gives. */
export type Grade = 'clean' | 'soft' | 'roll' | 'stumble' | 'crash';

const GRADE_OF: Record<number, Grade> = {
  [MoveId.RUN]: 'clean',
  25: 'soft',
  24: 'roll',
  [MoveId.STUMBLE]: 'stumble',
  [MoveId.CRASH]: 'crash',
};

export interface Drop {
  drop: number;
  down: boolean;
  rec: Recording;
  /** The step the runner left the roof (entered the fall), and touched down. */
  fall: number;
  touchdown: number;
  grade: Grade;
  /** The velocity before and after the touchdown. */
  before: { vx: number; vy: number };
  after: { vx: number; vy: number };
}

/** The drop from a tower of `drop` tiles, with DOWN two steps into the fall or without. */
export function dropTry(lab: Lab, drop: number, down: boolean): Drop {
  const world = asciiWorld(lab, tower(drop));
  let pressAt = -1;
  const rec = record(world, lab.clips, {
    steps: 320,
    input: (w) => {
      if (!down) return 0;
      if (pressAt < 0 && w.player.moveId === MoveId.FALL) pressAt = w.stepCount + 1;
      return w.stepCount === pressAt ? Input.DOWN : 0;
    },
  });
  const track = rec.tracks[0]!;
  const entries = track.entries();
  const fall = entries.find((e) => e.id === MoveId.FALL)?.step ?? -1;
  const land = entries.find((e) => e.step > fall && GRADE_OF[e.id] !== undefined);
  if (fall < 0 || !land) throw new Error(`no landing from ${drop} tiles`);
  const b = track.after(land.step - 1);
  const a = track.after(land.step);
  return {
    drop,
    down,
    rec,
    fall,
    touchdown: land.step,
    grade: GRADE_OF[land.id]!,
    before: { vx: b.vx, vy: b.vy },
    after: { vx: a.vx, vy: a.vy },
  };
}

const drops = new WeakMap<Lab, Map<boolean, readonly Drop[]>>();

/** Every drop from 1 to `MAX_DROP` tiles (run once per lab). */
export function dropSweep(lab: Lab, down: boolean): readonly Drop[] {
  let byKey = drops.get(lab);
  if (!byKey) {
    byKey = new Map();
    drops.set(lab, byKey);
  }
  let out = byKey.get(down);
  if (!out) {
    out = sweep(1, MAX_DROP, (n) => dropTry(lab, n, down));
    byKey.set(down, out);
  }
  return out;
}

/** Pixels per unit of speed of the velocity arrows. */
const ARROW_SCALE = 1 / 180;

/**
 * The runner's velocity at moment `t` as two arrows from its middle: the horizontal part and
 * the vertical part.
 */
export function drawVelocity(
  frame: Frame,
  font: RasterFont,
  t: number,
  px: ToPixels,
  track: Track,
): void {
  const s = track.after(Math.floor(t) - 1);
  const pose = track.pose(t);
  const x = px.x(pose.x);
  const y = px.y(pose.y) - 24;
  const across = rgb(SERIES[0]);
  const down = rgb(SERIES[1]);
  if (Math.abs(s.vx) > 100) {
    const end = x + s.vx * ARROW_SCALE;
    frame.arrow(x, y, end, y, across, { width: 2 });
    frame.text(font, String(Math.abs(s.vx)), end + 4, y - 6, across, { outline: true });
  }
  if (Math.abs(s.vy) > 100) {
    const end = y + s.vy * ARROW_SCALE;
    frame.arrow(x, y, x, end, down, { width: 2 });
    frame.text(font, String(Math.abs(s.vy)), x + 4, end - 10, down, { outline: true });
  }
}

export const GRADES: Record<Grade, { color: string; label: string }> = {
  clean: { color: SERIES[2], label: 'lands and runs on' },
  soft: { color: SERIES[2], label: 'lands and runs on (with DOWN: state 25, 25 points)' },
  roll: { color: SERIES[0], label: 'landing roll (24, then 21: 70 points)' },
  stumble: { color: SERIES[3], label: 'stumble (82): a fail, speed halved' },
  crash: { color: SERIES[6], label: 'crash (84): a fail, about 4 s to get up' },
};

/** The vertical speeds that decide a landing (conditions 56, 58, 57, 59). */
export const THRESHOLDS: readonly { speed: number; down: boolean; label: string }[] = [
  { speed: 6750, down: false, label: 'stumble' },
  { speed: 9500, down: true, label: 'roll' },
  { speed: 10200, down: false, label: 'crash' },
  { speed: 15000, down: true, label: 'crash' },
];

/**
 * The vertical speed at touchdown by the height of the drop, the thresholds it is judged by, and
 * what each drop gives without a key and with DOWN.
 */
export function gradesChart(plain: readonly Drop[], down: readonly Drop[]): string {
  const x0 = 76;
  const cell = 26;
  const top = 72;
  const plotH = 200;
  const vMax = 18000;
  const n = plain.length;
  const plotW = n * cell;
  const stripY = top + plotH + 40;
  // `clean` and `soft` share a colour: the legend says it once.
  const used = [...new Set([...plain, ...down].map((d) => d.grade))].filter((g) => g !== 'clean');
  const legendY = stripY + 2 * 22 + 36;
  const width = x0 + plotW + 90;
  const height = legendY + (used.length + 2) * 20 + 12;
  const svg = new Svg(
    width,
    height,
    'A landing is judged by the vertical speed alone',
    'The runner runs off a roof and falls 1 to 20 tiles onto flat ground (horizontal speed 3400 every time)',
  );
  const xOf = (drop: number): number => x0 + (drop - 1) * cell + cell / 2;
  const yOf = (v: number): number => top + plotH - (v / vMax) * plotH;
  for (let v = 0; v <= vMax; v += 3000) {
    svg.line(x0, yOf(v), x0 + plotW, yOf(v), INK.line);
    svg.text(x0 - 8, yOf(v) + 4, String(v), { size: 11, fill: INK.muted, anchor: 'end' });
  }
  let lastLabel = Infinity;
  for (const th of THRESHOLDS) {
    const c = th.down ? SERIES[0] : SERIES[1];
    svg.line(x0, yOf(th.speed), x0 + plotW, yOf(th.speed), c, { dash: '4 3' });
    // Labels of thresholds close together are pushed apart.
    const ly = Math.min(yOf(th.speed) + 4, lastLabel - 12);
    lastLabel = ly;
    svg.text(x0 + plotW + 6, ly, `${th.speed} ${th.label}`, { size: 11, fill: c });
  }
  for (const d of plain) {
    const tip = `${d.drop} tiles: ${Math.abs(d.before.vy)} at touchdown`;
    svg.circle(xOf(d.drop), yOf(Math.abs(d.before.vy)), 4, INK.text, { tip });
  }
  svg.text(20, top + plotH / 2, 'vertical speed at touchdown', {
    size: 11,
    fill: INK.muted,
    anchor: 'middle',
    rotate: -90,
  });
  const rows: [string, readonly Drop[], string][] = [
    ['no key', plain, SERIES[1]],
    ['DOWN', down, SERIES[0]],
  ];
  rows.forEach(([label, drops, c], r) => {
    const y = stripY + r * 22;
    svg.text(x0 - 8, y + 13, label, { size: 11, fill: c, anchor: 'end' });
    for (const d of drops) {
      const g = GRADES[d.grade];
      svg.rect(xOf(d.drop) - cell / 2 + 1, y, cell - 2, 18, g.color, {
        rx: 3,
        tip: `${d.drop} tiles, ${label}: ${g.label}`,
      });
    }
  });
  for (const d of plain) {
    if (d.drop % 2 !== 0 && d.drop !== 1) continue;
    svg.text(xOf(d.drop), stripY + 2 * 22 + 12, String(d.drop), {
      size: 11,
      fill: INK.muted,
      anchor: 'middle',
    });
  }
  svg.text(x0 + plotW / 2, stripY + 2 * 22 + 26, 'drop, in tiles', {
    size: 11,
    fill: INK.muted,
    anchor: 'middle',
  });
  used.forEach((g, i) => svg.key(20, legendY + i * 20, GRADES[g].color, GRADES[g].label));
  const ly = legendY + used.length * 20;
  for (const [i, [c, label]] of [
    [SERIES[1], 'thresholds without a key (conditions 56, 57)'],
    [SERIES[0], 'thresholds with DOWN (58, 59)'],
  ].entries()) {
    svg.line(20, ly + i * 20 - 4, 30, ly + i * 20 - 4, c!, { dash: '4 3' });
    svg.text(35, ly + i * 20, label!, { size: 12, fill: INK.text });
  }
  return svg.toString();
}

/**
 * One drop from its tower: the runner with its state over its head once it falls, its speed as
 * arrows, and under it the DOWN pressed and the touchdown; `from`..`to` the steps shown.
 */
export function landingLane(lab: Lab, d: Drop, ink: string, from: number, to: number): Scene {
  const track = d.rec.tracks[0]!;
  const ground = groundRow(d.drop) * 32;
  return demoScene(lab, {
    level: parseDemoLevel(tower(d.drop)),
    view: { x: EDGE_COL * 32 - 56, y: ground - 196, width: 320, height: 212 },
    actors: [
      {
        track,
        ink,
        tag: (at) => {
          const id = track.after(at).moveId;
          return at >= d.fall && id !== MoveId.RUN && id !== MoveId.FALL ? String(id) : null;
        },
      },
    ],
    overlay: (frame, t, px) => drawVelocity(frame, lab.fonts.small, t, px, track),
    from,
    to,
    timeline: {
      from,
      to,
      rows: [
        {
          color: ink,
          presses: d.down ? [{ step: d.fall + 1, key: 'down' }] : [],
          marks: [d.touchdown],
        },
      ],
    },
  });
}
