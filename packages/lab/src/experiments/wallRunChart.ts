/** The chart of a wall run sweep: what the second UP gives, by the step it is pressed on. */
import { Svg } from '../svg.ts';
import { INK, SERIES } from '../palette.ts';
import { JUMP_STEP, outcomeOf, type Outcome, type WallRunTry } from './wallRun.ts';

const OUTCOMES: { id: Outcome; color: string; label: string }[] = [
  { id: 'none', color: '#3d4450', label: 'nothing: the runner slides down' },
  { id: 'one', color: SERIES[0], label: 'one kick, then a fall' },
  { id: 'twoClimb', color: SERIES[1], label: 'two kicks, and a climb onto the roof' },
  { id: 'twoFall', color: SERIES[2], label: 'two kicks, then a fall' },
];

export function sweepChart(
  title: string,
  note: string,
  rows: readonly { label: string; tries: readonly WallRunTry[] }[],
): string {
  const labelW = 270;
  const cell = 12;
  const gap = 2;
  const rowH = 26;
  const top = 92;
  const cols = rows[0]?.tries.length ?? 0;
  const width = labelW + cols * cell + 40;
  const used = new Set(rows.flatMap((r) => r.tries.map(outcomeOf)));
  const legend = OUTCOMES.filter((o) => used.has(o.id));
  const height = top + rows.length * rowH + 44 + legend.length * 20 + 16;
  const svg = new Svg(width, height, title, note);
  const x0 = labelW;
  // Brackets over the first row: where the wall run is armed, where it starts on contact.
  for (const [o, text] of [
    ['one', 'pressed in the air: armed'],
    ['twoClimb', 'pressed on contact'],
  ] as const) {
    const cells = (rows[0]?.tries ?? [])
      .map((t, i) => [i, outcomeOf(t)] as const)
      .filter(([, x]) => x === o);
    if (cells.length === 0) continue;
    const a = x0 + cells[0]![0] * cell;
    const b = x0 + cells.at(-1)![0] * cell + cell - gap;
    svg.line(a, top - 8, b, top - 8, INK.muted);
    svg.line(a, top - 8, a, top - 4, INK.muted);
    svg.line(b, top - 8, b, top - 4, INK.muted);
    svg.text((a + b) / 2, top - 12, text, { size: 11, fill: INK.muted, anchor: 'middle' });
  }
  rows.forEach((row, r) => {
    const y = top + r * rowH;
    svg.text(20, y + 15, row.label, { size: 12, fill: INK.text });
    row.tries.forEach((t, c) => {
      const o = OUTCOMES.find((x) => x.id === outcomeOf(t))!;
      const after = t.press! - JUMP_STEP;
      svg.rect(x0 + c * cell, y, cell - gap, rowH - 6, o.color, {
        rx: 2,
        tip: `UP ${after} steps (${after * 30} ms) after the jump: ${o.label}`,
      });
    });
  });
  // The axis: steps after the jump.
  const axisY = top + rows.length * rowH + 4;
  rows[0]?.tries.forEach((t, c) => {
    const after = t.press! - JUMP_STEP;
    if (after % 5 !== 0) return;
    const x = x0 + c * cell + (cell - gap) / 2;
    svg.line(x, axisY - 2, x, axisY + 3, INK.muted);
    svg.text(x, axisY + 16, String(after), { size: 11, fill: INK.muted, anchor: 'middle' });
  });
  svg.text(x0 - 10, axisY + 16, 'steps after the jump (30 ms each)', {
    size: 11,
    fill: INK.muted,
    anchor: 'end',
  });
  legend.forEach((o, i) => svg.key(20, axisY + 44 + i * 20, o.color, o.label));
  return svg.toString();
}

/**
 * When the wall run starts (its first kick), by the step of the second UP: flat where the press
 * only arms it, diagonal where it starts on the press. Rows after the first are drawn as rings.
 */
export function startChart(
  title: string,
  note: string,
  rows: readonly { label: string; tries: readonly WallRunTry[] }[],
  seeing: readonly number[],
  contact: number,
): string {
  const x0 = 76;
  const cell = 14;
  const rowPx = 14;
  const presses = (rows[0]?.tries ?? []).map((t) => t.press!);
  const first = presses[0] ?? JUMP_STEP;
  const starts = rows.flatMap((r) =>
    r.tries.filter((t) => t.kicks.length > 0).map((t) => t.kicks[0]!),
  );
  const yMin = Math.min(...starts) - JUMP_STEP - 2;
  const yMax = Math.max(...starts) - JUMP_STEP + 2;
  const top = 84;
  const plotH = (yMax - yMin) * rowPx;
  const plotW = presses.length * cell;
  const width = x0 + plotW + 24;
  const height = top + plotH + 52 + rows.length * 20 + 12;
  const svg = new Svg(width, height, title, note);
  const xOf = (step: number): number => x0 + (step - first) * cell + cell / 2;
  const yOf = (after: number): number => top + (yMax - after) * rowPx;
  for (let a = yMin; a <= yMax; a += 2) {
    svg.line(x0, yOf(a), x0 + plotW, yOf(a), INK.line);
    svg.text(x0 - 8, yOf(a) + 4, String(a), { size: 11, fill: INK.muted, anchor: 'end' });
  }
  if (seeing.length === 2) {
    const a = xOf(seeing[0]!) - cell / 2;
    const b = xOf(seeing[1]!) + cell / 2;
    svg.rect(a, top, b - a, plotH, SERIES[2], { opacity: 0.14 });
    svg.text((a + b) / 2, top - 8, 'the ray sees the wall', {
      size: 11,
      fill: INK.muted,
      anchor: 'middle',
    });
  }
  const cx = xOf(contact);
  svg.line(cx, top, cx, top + plotH, INK.muted, { dash: '3 3' });
  svg.text(cx + 4, top + 12, 'touches the wall', { size: 11, fill: INK.muted });
  // Rings first, so the original's dots stay on top of them.
  [...rows.entries()].reverse().forEach(([r, row]) => {
    for (const t of row.tries) {
      if (t.kicks.length === 0) continue;
      const after = t.press! - JUMP_STEP;
      const start = t.kicks[0]! - JUMP_STEP;
      const tip = `${row.label}: UP ${after} steps after the jump, the wall run starts ${start} steps after it`;
      if (r === 0) svg.circle(xOf(t.press!), yOf(start), 3.5, SERIES[0], { tip });
      else svg.circle(xOf(t.press!), yOf(start), 6, 'none', { stroke: SERIES[r]!, tip });
    }
  });
  const axisY = top + plotH + 6;
  for (const p of presses) {
    const after = p - JUMP_STEP;
    if (after % 5 !== 0) continue;
    svg.line(xOf(p), axisY - 2, xOf(p), axisY + 3, INK.muted);
    svg.text(xOf(p), axisY + 16, String(after), { size: 11, fill: INK.muted, anchor: 'middle' });
  }
  svg.text(x0 + plotW / 2, axisY + 32, 'second UP, steps after the jump', {
    size: 11,
    fill: INK.muted,
    anchor: 'middle',
  });
  svg.text(20, top + plotH / 2, 'wall run starts, steps after the jump', {
    size: 11,
    fill: INK.muted,
    anchor: 'middle',
    rotate: -90,
  });
  rows.forEach((row, r) => {
    const y = axisY + 58 + r * 20;
    if (r === 0) svg.circle(25, y - 4, 3.5, SERIES[0]);
    else svg.circle(25, y - 4, 5, 'none', { stroke: SERIES[r]! });
    svg.text(38, y, row.label, { size: 12, fill: INK.text });
  });
  return svg.toString();
}
