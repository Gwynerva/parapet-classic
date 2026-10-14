/**
 * A finding about the original, as its page in `reference/findings/` shows it: the numbers
 * measured on the real simulation and data (`facts`, which the page's table and the tests
 * compare), the checks that it still shows what the page says (`checks`: empty when it does),
 * its animations, its charts and its pictures. Everything is computed; nothing is drawn by
 * hand.
 */
import type { RgbaImage } from '@parapet/runtime/render/Raster.ts';
import type { Lab } from './lab.ts';
import type { ClipSpec } from './scene.ts';

/** Measured values: numbers, words, flags or lists of numbers. */
export type Facts = Record<string, number | string | boolean | readonly number[]>;

export interface Chart {
  /** File name stem (`sweep` → sweep.svg). */
  name: string;
  /** What the chart shows, for the page (`alt` text). */
  alt: string;
  svg: string;
}

export interface Picture {
  /** File name stem (`parts` → parts.png). */
  name: string;
  alt: string;
  image: RgbaImage;
  /** Magnification in the PNG (pixels stay sharp). */
  scale?: number;
}

export interface Finding<F extends Facts = Facts> {
  /** The page's folder: `03-one-press-two-kicks`. */
  slug: string;
  title: string;
  /** The finding in one sentence, for the gallery. */
  claim: string;
  facts(lab: Lab): F;
  /** The measured numbers as the page's table shows them: what, and how much. */
  measured(facts: F): [string, string][];
  checks(facts: F): string[];
  clips(lab: Lab, facts: F): ClipSpec[];
  charts(lab: Lab, facts: F): Chart[];
  /** Still pictures drawn like the animations' frames. */
  pictures?(lab: Lab, facts: F): Picture[];
}
