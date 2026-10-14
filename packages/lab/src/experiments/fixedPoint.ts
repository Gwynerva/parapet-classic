/**
 * The original's integer maths measured against real numbers: the octagonal length
 * `approxLength` (how far from a circle its circle is), the 512-entry sine table grown by a
 * recurrence from one number, and the integer square root.
 */
import { approxLength, buildSineTable, isqrt } from '@parapet/sim';
import type { Frame } from '../frame.ts';
import type { Lab } from '../lab.ts';
import { INK, RGB, rgb, SERIES } from '../palette.ts';
import type { Scene } from '../scene.ts';
import { Svg } from '../svg.ts';

/** The radius the norm is measured at (large, so rounding does not show). */
const R = 1 << 20;

/** `approxLength` of the direction `angle` (radians) over the true length, minus 1. */
export function normError(angle: number): number {
  const x = Math.round(Math.cos(angle) * R);
  const y = Math.round(Math.sin(angle) * R);
  return approxLength(x, y) / Math.hypot(x, y) - 1;
}

export interface NormExtremes {
  min: number;
  minAngle: number;
  max: number;
  maxAngle: number;
}

/** The largest errors over a full turn, in steps of a hundredth of a degree (in degrees). */
export function normExtremes(): NormExtremes {
  const out = { min: Infinity, minAngle: 0, max: -Infinity, maxAngle: 0 };
  for (let i = 0; i < 9000; i++) {
    const deg = i / 100;
    const e = normError((deg * Math.PI) / 180);
    if (e < out.min) Object.assign(out, { min: e, minAngle: deg });
    if (e > out.max) Object.assign(out, { max: e, maxAngle: deg });
  }
  return out;
}

/**
 * The sides of the game's circle, counted as the corners of a full turn: the directions where
 * the error is lowest around it (each side is straight, so it bulges out of the circle in its
 * middle and comes back in at its ends).
 */
export function normSides(): number {
  // A quarter of a degree apart: far enough that the rounding of the integers does not show.
  const n = 1440;
  const e = (i: number): number => normError((((i + n) % n) / n) * Math.PI * 2);
  let corners = 0;
  for (let i = 0; i < n; i++) {
    if (e(i - 1) - e(i) > 1e-5 && e(i + 1) - e(i) > 1e-5) corners++;
  }
  return corners;
}

/**
 * The step of the measured length where the correction for the larger part starts (when it is
 * less than 16 times the smaller one, about 3.58° off an axis): error just before minus just
 * after.
 */
export function normStep(): { angle: number; jump: number } {
  const switchAt = Math.atan(1 / 16);
  const eps = 1e-4;
  return {
    angle: (switchAt * 180) / Math.PI,
    jump: normError(switchAt - eps) - normError(switchAt + eps),
  };
}

/** The sine table the game builds, against `1024 · sin`. */
export function sineErrors(): { table: Int16Array; errors: number[] } {
  const table = buildSineTable(10, true);
  const errors = [...table].map((v, i) => v - 1024 * Math.sin((i * Math.PI * 2) / 512));
  return { table, errors };
}

/**
 * Where `isqrt` agrees with the true root: every n below 2^24, and every square below 2^30 with
 * its neighbours; and what it gives for 2^30 and above.
 */
export function isqrtCheck(): { exactBelow: number; checked: number; above: number } {
  let checked = 0;
  let bad = 0;
  for (let n = 0; n < 1 << 24; n++, checked++) if (isqrt(n) !== Math.floor(Math.sqrt(n))) bad++;
  for (let r = 1 << 12; r < 1 << 15; r++) {
    for (const n of [r * r - 1, r * r, r * r + 1]) {
      checked++;
      if (isqrt(n) !== Math.floor(Math.sqrt(n))) bad++;
    }
  }
  return { exactBelow: bad === 0 ? 2 ** 30 : -1, checked, above: isqrt(2 ** 30) };
}

/** The game's circle (all points `approxLength` puts at one distance) against a true circle. */
export function normChart(e: NormExtremes): string {
  const size = 300;
  const cx = 20 + size / 2;
  const cy = 72 + size / 2;
  const r = size / 2 - 16;
  const plotX = cx + size / 2 + 40;
  const plotW = 360;
  const width = plotX + plotW + 30;
  const height = 72 + size + 80;
  const svg = new Svg(
    width,
    height,
    'The game’s circle: 16 straight pieces, with steps',
    'Points the original puts at one distance (approxLength), against a true circle; and its error by direction',
  );
  const circle: [number, number][] = [];
  const game: [number, number][] = [];
  for (let i = 0; i <= 720; i++) {
    const a = (i / 720) * Math.PI * 2;
    circle.push([cx + Math.cos(a) * r, cy - Math.sin(a) * r]);
    const k = 1 / (1 + normError(a));
    game.push([cx + Math.cos(a) * r * k, cy - Math.sin(a) * r * k]);
  }
  svg.line(cx - r - 8, cy, cx + r + 8, cy, INK.line);
  svg.line(cx, cy - r - 8, cx, cy + r + 8, INK.line);
  svg.polyline(circle, INK.muted, { width: 1.5, dash: '4 3' });
  svg.polyline(game, SERIES[2], { width: 2 });
  // The error by direction over a quarter turn (it repeats every 45°, mirrored).
  const top = 92;
  const plotH = 200;
  const eMax = 0.05;
  const xOf = (deg: number): number => plotX + (deg / 90) * plotW;
  const yOf = (err: number): number => top + plotH / 2 - (err / eMax) * (plotH / 2);
  for (const v of [-0.04, -0.02, 0, 0.02, 0.04]) {
    svg.line(plotX, yOf(v), plotX + plotW, yOf(v), v === 0 ? INK.muted : INK.line);
    svg.text(plotX - 6, yOf(v) + 4, `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)} %`, {
      size: 11,
      fill: INK.muted,
      anchor: 'end',
    });
  }
  const pts: [number, number][] = [];
  for (let i = 0; i <= 900; i++) pts.push([xOf(i / 10), yOf(normError((i / 10 / 180) * Math.PI))]);
  svg.polyline(pts, SERIES[2], { width: 2 });
  for (const [deg, err, label] of [
    [e.minAngle, e.min, 'low'],
    [e.maxAngle, e.max, 'high'],
  ] as const) {
    svg.circle(xOf(deg), yOf(err), 4, INK.text, {
      tip: `${label}: ${(err * 100).toFixed(2)} % at ${deg.toFixed(2)}°`,
    });
    svg.text(
      xOf(deg) + 7,
      yOf(err) + (err < 0 ? 14 : -6),
      `${(err * 100).toFixed(2)} % at ${deg.toFixed(1)}°`,
      {
        size: 11,
        fill: INK.text,
      },
    );
  }
  for (const deg of [0, 15, 30, 45, 60, 75, 90]) {
    svg.text(xOf(deg), top + plotH + 16, `${deg}°`, {
      size: 11,
      fill: INK.muted,
      anchor: 'middle',
    });
  }
  svg.text(plotX + plotW / 2, top + plotH + 34, 'direction of the vector', {
    size: 11,
    fill: INK.muted,
    anchor: 'middle',
  });
  const ly = height - 24;
  svg.line(20, ly - 4, 34, ly - 4, INK.muted, { dash: '4 3', width: 1.5 });
  svg.text(40, ly, 'a true circle', { size: 12, fill: INK.text });
  svg.line(150, ly - 4, 164, ly - 4, SERIES[2], { width: 2 });
  svg.text(170, ly, 'the game’s circle (approxLength = radius)', { size: 12, fill: INK.text });
  return svg.toString();
}

/** The sine table against the true sine, and what the recurrence gets wrong, entry by entry. */
export function sineChart(table: Int16Array, errors: readonly number[]): string {
  const x0 = 70;
  const plotW = 512;
  const top = 72;
  const plotH = 160;
  const errTop = top + plotH + 40;
  const errH = 80;
  const width = x0 + plotW + 30;
  const height = errTop + errH + 70;
  const svg = new Svg(
    width,
    height,
    'A sine table grown from one number',
    'The 512 entries the original computes at start-up (×1024), and how far each is from 1024·sin',
  );
  const xOf = (i: number): number => x0 + i;
  const yOf = (v: number): number => top + plotH / 2 - (v / 1024) * (plotH / 2 - 4);
  svg.line(x0, yOf(0), x0 + plotW, yOf(0), INK.line);
  for (const v of [-1024, 0, 1024]) {
    svg.text(x0 - 6, yOf(v) + 4, String(v), { size: 11, fill: INK.muted, anchor: 'end' });
  }
  svg.polyline(
    [...table].map((v, i) => [xOf(i), yOf(v)] as [number, number]),
    SERIES[0],
    { width: 2 },
  );
  const eY = (e: number): number => errTop + errH / 2 - e * (errH / 2 - 4);
  for (const v of [-1, 0, 1]) {
    svg.line(x0, eY(v), x0 + plotW, eY(v), v === 0 ? INK.muted : INK.line);
    svg.text(x0 - 6, eY(v) + 4, String(v), { size: 11, fill: INK.muted, anchor: 'end' });
  }
  errors.forEach((e, i) => {
    if (Math.abs(e) < 0.02) return;
    svg.line(xOf(i), eY(0), xOf(i), eY(e), SERIES[1], { width: 1 });
  });
  for (const i of [0, 128, 256, 384, 512]) {
    svg.text(xOf(i), errTop + errH + 16, String(i), {
      size: 11,
      fill: INK.muted,
      anchor: 'middle',
    });
  }
  svg.text(x0 + plotW / 2, errTop + errH + 34, 'entry (512 to a turn)', {
    size: 11,
    fill: INK.muted,
    anchor: 'middle',
  });
  svg.text(x0, errTop - 10, 'table − 1024·sin', { size: 11, fill: SERIES[1] });
  svg.text(x0, top - 6, 'the table', { size: 11, fill: SERIES[0] });
  return svg.toString();
}

/**
 * A vector turning once: the true circle, the game's circle, and the vector's length as the
 * game counts it, for the animation.
 */
export function octagonScene(lab: Lab): Scene {
  const size = 220;
  const r = 96;
  const turnSteps = 240;
  // The game's circle as a closed line, a point every quarter of a degree.
  const shape: [number, number][] = [];
  for (let i = 0; i <= 1440; i++) {
    const a = (i / 1440) * Math.PI * 2;
    const k = 1 / (1 + normError(a));
    shape.push([Math.cos(a) * r * k, -Math.sin(a) * r * k]);
  }
  return {
    width: size,
    height: size + 28,
    from: 0,
    to: turnSteps,
    draw(frame: Frame, t: number) {
      frame.clear(RGB.card);
      const cx = size / 2;
      const cy = size / 2 + 4;
      const aqua = rgb(SERIES[2]);
      frame.ring(cx, cy, r, RGB.muted);
      for (let i = 1; i < shape.length; i++) {
        const [x0, y0] = shape[i - 1]!;
        const [x1, y1] = shape[i]!;
        frame.line(cx + x0, cy + y0, cx + x1, cy + y1, aqua);
      }
      const a = (t / turnSteps) * Math.PI * 2;
      const err = normError(a);
      // The vector the game counts as long as the radius: it reaches its circle, not the true one.
      const k = 1 / (1 + err);
      frame.arrow(cx, cy, cx + Math.cos(a) * r * k, cy - Math.sin(a) * r * k, aqua, { width: 2 });
      const pct = `${err >= 0 ? '+' : ''}${(err * 100).toFixed(1)}%`;
      frame.text(lab.fonts.text, pct, size / 2, size + 6, aqua, { align: 'center', tabular: true });
    },
  };
}
