/**
 * Routes of the free search: one bit set per step (any chord of U, D, F, B), written as
 * `step:LETTERS` for the steps with a press, and played back on a plain `World`.
 */
import { Input, type World } from '@parapet/sim';

const LETTERS: [number, string][] = [
  [Input.UP, 'U'],
  [Input.DOWN, 'D'],
  [Input.FORWARD, 'F'],
  [Input.BACK, 'B'],
];

export function pressText(bits: readonly number[]): string {
  const parts: string[] = [];
  bits.forEach((b, step) => {
    if (b === 0) return;
    parts.push(
      `${step}:${LETTERS.filter(([bit]) => b & bit)
        .map(([, l]) => l)
        .join('')}`,
    );
  });
  return parts.join(' ');
}

export function parsePressText(text: string): number[] {
  const bits: number[] = [];
  for (const part of text.trim().split(/\s+/)) {
    if (!part) continue;
    const [s, letters] = part.split(':');
    const step = Number(s);
    let b = 0;
    for (const ch of letters ?? '') {
      const hit = LETTERS.find(([, l]) => l === ch);
      if (!hit) throw new Error(`bad press "${part}"`);
      b |= hit[0];
    }
    while (bits.length < step) bits.push(0);
    bits[step] = b;
  }
  return bits;
}

/** Plays `bits` (step i gets `bits[i]`, zeros after) until the run finishes or 240 s pass. */
export function playBits(
  world: World,
  bits: readonly number[],
): { finished: boolean; steps: number; timeMs: number } {
  for (let i = 0; world.clock < 240000; i++) {
    if (!world.step(bits[i] ?? 0)) break;
  }
  const r = world.rules.result;
  return { finished: !!r?.finished, steps: world.stepCount, timeMs: r?.time ?? 0 };
}
