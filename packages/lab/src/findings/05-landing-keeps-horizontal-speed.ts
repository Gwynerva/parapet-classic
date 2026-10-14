/**
 * Landing keeps the horizontal speed: at touchdown the runner keeps running as fast as it ran
 * off the roof, and the fall's speed is gone. How the landing goes is judged by that vertical
 * speed alone, against four thresholds; DOWN pressed in the air moves them up, so a drop that
 * stumbles without it lands softly with it, and one that crashes rolls.
 */
import {
  dropSweep,
  dropTry,
  gradesChart,
  landingLane,
  MAX_DROP,
  type Drop,
  type Grade,
} from '../experiments/landing.ts';
import { bands, onlyBand, type Band } from '../experiments/sweep.ts';
import type { Facts, Finding } from '../finding.ts';
import type { Lab } from '../lab.ts';
import { SERIES } from '../palette.ts';
import { gridScene } from '../scene.ts';

/** The drop the animation compares with and without DOWN. */
const SHOWN_DROP = 4;

interface LandingFacts extends Facts {
  /** `[first, last]` drops (tiles) of each grade, without a key and with DOWN. */
  clean: readonly number[];
  stumble: readonly number[];
  crash: readonly number[];
  soft: readonly number[];
  roll: readonly number[];
  crashDown: readonly number[];
  /** A clean landing: horizontal and vertical speed before and after. */
  vxBefore: number;
  vxAfter: number;
  vyBefore: number;
  vyAfter: number;
  /** After a stumble and a crash. */
  vxStumble: number;
  vxCrash: number;
  /** The vertical speed no fall exceeds, and the drop it is reached from. */
  terminal: number;
  terminalDrop: number;
  /** Every landing of the sweep keeps the horizontal speed unless it fails. */
  keptWhenNotFailed: boolean;
}

const gradeBands = (drops: readonly Drop[]): Band<Grade>[] =>
  bands(drops.map((d) => [d.drop, d.grade] as const));

export const landingKeepsSpeed: Finding<LandingFacts> = {
  slug: '05-landing-keeps-horizontal-speed',
  title: 'Landing keeps the horizontal speed',
  claim:
    'At touchdown the fall’s speed is thrown away and the horizontal speed kept; how hard the landing is depends on the vertical speed alone.',

  facts(lab: Lab): LandingFacts {
    const plain = dropSweep(lab, false);
    const down = dropSweep(lab, true);
    const p = gradeBands(plain);
    const d = gradeBands(down);
    const clean = plain.find((x) => x.grade === 'clean')!;
    const terminal = Math.max(...plain.map((x) => x.before.vy));
    return {
      clean: onlyBand(p, 'clean'),
      stumble: onlyBand(p, 'stumble'),
      crash: onlyBand(p, 'crash'),
      soft: onlyBand(d, 'soft'),
      roll: onlyBand(d, 'roll'),
      crashDown: onlyBand(d, 'crash'),
      vxBefore: clean.before.vx,
      vxAfter: clean.after.vx,
      vyBefore: clean.before.vy,
      vyAfter: clean.after.vy,
      vxStumble: plain.find((x) => x.grade === 'stumble')?.after.vx ?? 0,
      vxCrash: plain.find((x) => x.grade === 'crash')?.after.vx ?? 0,
      terminal,
      terminalDrop: plain.find((x) => x.before.vy === terminal)?.drop ?? -1,
      keptWhenNotFailed: [...plain, ...down]
        .filter((x) => x.grade !== 'stumble' && x.grade !== 'crash')
        .every((x) => x.after.vx === x.before.vx),
    };
  },

  measured(f: LandingFacts): [string, string][] {
    const tiles = (r: readonly number[]): string =>
      r.length === 2 ? (r[0] === r[1] ? `${r[0]}` : `${r[0]} to ${r[1]}`) : '—';
    return [
      [
        'Without a key: lands running, stumbles, crashes (drop in tiles)',
        `${tiles(f.clean)}; ${tiles(f.stumble)}; ${tiles(f.crash)}`,
      ],
      [
        'With DOWN: soft landing, roll, crash',
        `${tiles(f.soft)}; ${tiles(f.roll)}; ${tiles(f.crashDown)}`,
      ],
      ['Horizontal speed before and after a clean landing', `${f.vxBefore} → ${f.vxAfter}`],
      ['Vertical speed before and after', `${f.vyBefore} → ${f.vyAfter}`],
      ['Horizontal speed after a stumble, after a crash', `${f.vxStumble}, ${f.vxCrash}`],
      ['Fastest fall (reached from a drop of)', `${f.terminal} (${f.terminalDrop} tiles)`],
    ];
  },

  checks(f: LandingFacts): string[] {
    const out: string[] = [];
    if (f.clean[0] !== 1 || f.stumble.length !== 2 || f.crash.at(-1) !== MAX_DROP) {
      out.push('without a key the drops are not clean, then stumbles, then crashes');
    }
    if (f.soft[0] !== 1 || f.roll.length !== 2 || f.crashDown.at(-1) !== MAX_DROP) {
      out.push('with DOWN the drops are not soft, then rolls, then crashes');
    }
    if (!(f.crashDown[0]! > f.crash[0]!)) out.push('DOWN does not raise the crash height');
    if (f.vxBefore !== f.vxAfter || f.vyAfter !== 0)
      out.push('a clean landing changes vx or keeps vy');
    if (!f.keptWhenNotFailed) out.push('a landing that does not fail changes the horizontal speed');
    return out;
  },

  clips(lab: Lab) {
    const drops = [dropTry(lab, SHOWN_DROP, false), dropTry(lab, SHOWN_DROP, true)];
    const from = Math.min(...drops.map((d) => d.fall)) - 8;
    const to = Math.max(...drops.map((d) => d.touchdown)) + 22;
    const scene = gridScene(
      [
        landingLane(lab, drops[0]!, SERIES[1], from, to),
        landingLane(lab, drops[1]!, SERIES[0], from, to),
      ],
      2,
      4,
    );
    return [
      {
        name: 'landing',
        alt: `Two runners run off a roof ${SHOWN_DROP} tiles high; arrows show their horizontal speed (blue) and vertical speed (orange). At touchdown the vertical arrow vanishes. Left, no key: a stumble that halves the horizontal speed. Right, DOWN in the air: a soft landing that keeps it.`,
        scene,
        script: [
          { from: scene.from, to: scene.from + 30 },
          { from: scene.from + 30, to: scene.from + 46, speed: 0.25 },
          { from: scene.from + 46, to: scene.to },
          { at: scene.to, holdMs: 1200 },
        ],
      },
    ];
  },

  charts(lab: Lab) {
    return [
      {
        name: 'grades',
        alt: 'The vertical speed at touchdown grows with the height of the drop up to a cap; dashed lines mark the four thresholds; under it, what each drop gives without a key (lands, stumbles, crashes) and with DOWN (soft landing, roll, crash).',
        svg: gradesChart(dropSweep(lab, false), dropSweep(lab, true)),
      },
    ];
  },
};
