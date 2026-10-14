/**
 * Fixed-point maths: the original has no floating point (CLDC 1.0 phones had none). Lengths are
 * measured with an octagonal formula whose "circle" has 16 sides, the sine table is grown at
 * start-up from a single number by a recurrence, and square roots are exact integers.
 */
import {
  isqrtCheck,
  normChart,
  normSides,
  normStep,
  normExtremes,
  octagonScene,
  sineChart,
  sineErrors,
} from '../experiments/fixedPoint.ts';
import type { Facts, Finding } from '../finding.ts';
import type { Lab } from '../lab.ts';

interface MathFacts extends Facts {
  /** approxLength over the true length, minus 1, at its extremes, and where (degrees). */
  normMin: number;
  normMinAngle: number;
  normMax: number;
  normMaxAngle: number;
  /** Straight pieces of the game's circle. */
  sides: number;
  /** Where it steps (degrees off an axis), and by how much of the length. */
  stepAngle: number;
  stepJump: number;
  sineEntries: number;
  /** The largest difference between the table and 1024·sin. */
  sineMaxError: number;
  /** Entries equal to 1024·sin rounded. */
  sineRounded: number;
  /** isqrt: exact below this; values checked; what it gives from there on. */
  isqrtExactBelow: number;
  isqrtChecked: number;
  isqrtAbove: number;
}

const pct = (e: number): string => `${e >= 0 ? '+' : ''}${(e * 100).toFixed(2)} %`;

export const fixedPointMaths: Finding<MathFacts> = {
  slug: '06-fixed-point-maths',
  title: 'Fixed-point maths',
  claim:
    'No floating point anywhere: lengths come from a 16-sided “circle” with steps in it, the sine table is grown from one number, square roots are exact integers.',

  facts(): MathFacts {
    const e = normExtremes();
    const { table, errors } = sineErrors();
    const isq = isqrtCheck();
    return {
      normMin: Number(e.min.toFixed(4)),
      normMinAngle: e.minAngle,
      normMax: Number(e.max.toFixed(4)),
      normMaxAngle: e.maxAngle,
      sides: normSides(),
      stepAngle: Number(normStep().angle.toFixed(2)),
      stepJump: Number(normStep().jump.toFixed(4)),
      sineEntries: table.length,
      sineMaxError: Number(Math.max(...errors.map(Math.abs)).toFixed(3)),
      sineRounded: errors.filter((x, i) => table[i] === Math.round(table[i]! - x)).length,
      isqrtExactBelow: isq.exactBelow,
      isqrtChecked: isq.checked,
      isqrtAbove: isq.above,
    };
  },

  measured(f: MathFacts): [string, string][] {
    return [
      [
        'approxLength against the true length',
        `${pct(f.normMin)} (at ${f.normMinAngle.toFixed(2)}°) to ${pct(f.normMax)} (at ${f.normMaxAngle.toFixed(2)}°)`,
      ],
      ['Straight pieces of the game’s circle', String(f.sides)],
      [
        'Step in the measured length',
        `${pct(f.stepJump)} of the length, ${f.stepAngle}° off each axis`,
      ],
      ['Sine table entries, largest error (×1024)', `${f.sineEntries}, ${f.sineMaxError}`],
      ['Entries equal to 1024·sin rounded', `${f.sineRounded} of ${f.sineEntries}`],
      [
        'isqrt exact for every n below',
        `2^${Math.log2(f.isqrtExactBelow)} (${f.isqrtChecked.toLocaleString('en')} values checked); ${f.isqrtAbove} from 2^30 on`,
      ],
    ];
  },

  checks(f: MathFacts): string[] {
    const out: string[] = [];
    if (f.normMin > -0.02 || f.normMax < 0.03 || f.normMax > 0.05) {
      out.push(`approxLength errs ${pct(f.normMin)} to ${pct(f.normMax)}`);
    }
    if (f.stepJump < 0.03) out.push('the measured length has no step');
    if (f.sides !== 16) out.push(`the game's circle has ${f.sides} sides`);
    if (f.sineMaxError >= 1) out.push('a sine entry is off by 1 or more');
    if (f.isqrtExactBelow !== 2 ** 30) out.push('isqrt is not exact below 2^30');
    return out;
  },

  clips(lab: Lab) {
    const scene = octagonScene(lab);
    return [
      {
        name: 'circle',
        alt: 'A vector turns once around a dotted true circle; its tip follows the game’s circle, a 16-sided shape slightly inside and outside the true one, and the game’s error in its length is shown underneath.',
        scene,
        script: [
          { from: 0, to: scene.to, speed: 0.6 },
          { at: scene.to, holdMs: 400 },
        ],
      },
    ];
  },

  charts(_lab: Lab, f: MathFacts) {
    const { table, errors } = sineErrors();
    return [
      {
        name: 'norm',
        alt: `The points the original puts at one distance form a 16-sided shape around the true circle; its error runs from ${pct(f.normMin)} to ${pct(f.normMax)} with the direction.`,
        svg: normChart(normExtremes()),
      },
      {
        name: 'sine',
        alt: 'The 512 entries of the sine table follow a sine wave; each is less than one unit (of 1024) off the true value.',
        svg: sineChart(table, errors),
      },
    ];
  },
};
