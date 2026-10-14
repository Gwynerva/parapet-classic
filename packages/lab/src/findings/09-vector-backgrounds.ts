/**
 * Vector backgrounds: the twelve levels' art is no picture but objects of the scene files, about
 * three quarters of them coloured rectangles, drawn anew every frame; shared props are nested
 * objects of one file (`k1`), and the warm-up's arrows pulse because its art is tweened between
 * two frames of the same object.
 */
import { CMD_RECT } from '@parapet/runtime/render/Pose.ts';
import {
  artObject,
  kindCounts,
  kindsChart,
  KINDS,
  pulseScene,
  xrayPicture,
} from '../experiments/levelArt.ts';
import type { Facts, Finding } from '../finding.ts';
import type { Lab } from '../lab.ts';

/** The level of the x-ray, and the warm-up whose arrows pulse. */
const XRAY_LEVEL = 7;
const WARM_UP = 0;

interface ArtFacts extends Facts {
  levels: number;
  primitives: number;
  /** Share of rectangles, in percent. */
  rectShare: number;
  /** Files the nested objects come from. */
  nestedFiles: readonly number[];
  /** Widest and narrowest level, in pixels. */
  widest: number;
  narrowest: number;
  /** Frames of the warm-up's art. */
  warmUpFrames: number;
  /** A full pulse, in game time units. */
  pulseUnits: number;
}

export const vectorBackgrounds: Finding<ArtFacts> = {
  slug: '09-vector-backgrounds',
  title: 'Vector backgrounds',
  claim:
    'The levels are not pictures: each is one object of coloured rectangles, sprites and shared props, drawn anew every frame, and the warm-up’s arrows pulse by tweening it.',

  facts(lab: Lab): ArtFacts {
    const rows = kindCounts(lab);
    const all = rows.reduce((n, r) => n + r.counts.reduce((a, b) => a + b, 0), 0);
    const rects = rows.reduce(
      (n, r) => n + r.counts[KINDS.findIndex((k) => k.kind === CMD_RECT)]!,
      0,
    );
    const widths = lab.src.missions.levels.map((l) => artObject(lab, l.id).obj.width);
    return {
      levels: rows.length,
      primitives: all,
      rectShare: Math.round((rects / all) * 100),
      nestedFiles: [...new Set(rows.flatMap((r) => r.nestedFiles))],
      widest: Math.max(...widths),
      narrowest: Math.min(...widths),
      warmUpFrames: artObject(lab, WARM_UP).obj.frames,
      pulseUnits: (512 / 2) * 4,
    };
  },

  measured(f: ArtFacts): [string, string][] {
    return [
      ['Primitives of the twelve levels’ art', `${f.primitives.toLocaleString('en')}`],
      ['Of them coloured rectangles', `${f.rectShare} %`],
      ['Files the nested props come from', f.nestedFiles.map((n) => `k${n}`).join(', ')],
      ['Narrowest and widest level', `${f.narrowest} and ${f.widest} pixels`],
      ['Frames of the warm-up’s art', String(f.warmUpFrames)],
      ['A full pulse of its arrows', `${f.pulseUnits} game time units`],
    ];
  },

  checks(f: ArtFacts): string[] {
    const out: string[] = [];
    if (f.nestedFiles.join() !== '1') out.push(`nested props from k${f.nestedFiles.join(', k')}`);
    if (f.rectShare < 50) out.push('rectangles are not most of the art');
    if (f.warmUpFrames < 2) out.push('the warm-up has one frame');
    return out;
  },

  clips(lab: Lab) {
    const scene = pulseScene(lab, WARM_UP, 0, 1, 240, 150, 90);
    return [
      {
        name: 'pulse',
        alt: 'A warm-up arrow of the first level grows and fades: the level’s art is drawn between two of its frames by a pulsing amount, shown by the bar underneath.',
        scene,
        script: [{ from: 0, to: scene.to }],
      },
    ];
  },

  charts(lab: Lab) {
    return [
      {
        name: 'kinds',
        alt: 'For each of the twelve levels, how many rectangles, sprites, tiled sprites and nested objects its art is made of; rectangles are most of every level.',
        svg: kindsChart(kindCounts(lab), (level) => lab.levelName(level)),
      },
    ];
  },

  pictures(lab: Lab) {
    return [
      {
        name: 'xray',
        alt: `A piece of ${lab.levelName(XRAY_LEVEL)} as the game draws it, and the same piece as an x-ray: every rectangle, sprite, tiled sprite and nested prop outlined in its colour.`,
        image: xrayPicture(lab, XRAY_LEVEL, 300, 220).img,
        scale: 2,
      },
    ];
  },
};
