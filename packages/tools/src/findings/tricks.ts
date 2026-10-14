/**
 * What tricks cost: the search for the bosses' records (`reference/notes/09-tas.md`) measured
 * what each kind of trick costs a run in time; its table is read from that page, so the chart
 * follows it. Next to it, one block taken four ways on a Moves menu level shows the same thing
 * where anyone can see it. The bosses' routes stay out of it: nothing here reads them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { raceScene, ways } from '@parapet/lab/experiments/race.ts';
import type { Facts, Finding } from '@parapet/lab/finding.ts';
import type { Lab } from '@parapet/lab/lab.ts';
import { INK, SERIES } from '@parapet/lab/palette.ts';
import { STEP_MS } from '@parapet/lab/scene.ts';
import { Svg } from '@parapet/lab/svg.ts';
import { REPO_ROOT } from '../files.ts';

const TAS_NOTES = join(REPO_ROOT, 'reference', 'notes', '09-tas.md');

interface Cost {
  trick: string;
  points: number;
  /** In the 24 fastest runs. */
  inFastest: string;
  /** ms a run loses per trick of the kind added, as the table gives it ("~0" is 0). */
  ms: number[];
}

/** The rows of the "What a trick costs" table of 09-tas.md. */
export function trickCosts(markdown = readFileSync(TAS_NOTES, 'utf8')): Cost[] {
  const start = markdown.indexOf('| Trick');
  if (start < 0) throw new Error('09-tas.md: no trick table');
  const rows = markdown
    .slice(start)
    .split('\n')
    .map((l) => l.trim());
  const out: Cost[] = [];
  for (const row of rows.slice(2)) {
    if (!row.startsWith('|')) break;
    const cells = row
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    out.push({
      trick: cells[0]!,
      points: Number(cells[1]),
      inFastest: cells[2]!,
      ms: cells[3]!.split(',').map((v) => Number(v.trim().replace('~', ''))),
    });
  }
  return out;
}

function costChart(costs: readonly Cost[]): string {
  const rows = costs.flatMap((c) => {
    const names = c.trick.split(',').map((n) => n.trim());
    return c.ms.map((ms, i) => ({ trick: names[i] ?? names[0]!, points: c.points, ms }));
  });
  rows.sort((a, b) => a.ms - b.ms);
  const x0 = 150;
  const plotW = 440;
  const top = 72;
  const rowH = 22;
  const max = Math.max(...rows.map((r) => r.ms));
  const width = x0 + plotW + 120;
  const height = top + rows.length * rowH + 40;
  const svg = new Svg(
    width,
    height,
    'What a trick costs a fast run',
    'Time lost per trick of a kind added to a run, from the search for the bosses’ stylish records; and its points',
  );
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    svg.text(x0 - 8, y + 15, r.trick, { size: 12, fill: INK.text, anchor: 'end' });
    svg.rect(x0, y + 4, Math.max(2, (r.ms / max) * plotW), rowH - 8, SERIES[0], {
      rx: 2,
      tip: `${r.trick}: ${r.ms} ms per trick, ${r.points} points`,
    });
    svg.text(x0 + (r.ms / max) * plotW + 6, y + 15, `${r.ms} ms`, { size: 11, fill: INK.muted });
    svg.text(width - 20, y + 15, `${r.points} points`, {
      size: 11,
      fill: SERIES[3],
      anchor: 'end',
    });
  });
  return svg.toString();
}

interface TrickFacts extends Facts {
  tricks: number;
  cheapest: string;
  dearest: string;
  /** The staged block: the ways, fastest first, and the step each crosses the line. */
  ways: string;
  arrivals: readonly number[];
  /** The vault's time behind the tiger jump on it (ms), and what the search says a vault costs. */
  vaultLoss: number;
  vaultCost: number;
}

export const whatTricksCost: Finding<TrickFacts> = {
  slug: '15-what-tricks-cost',
  title: 'What tricks cost',
  claim:
    'The game pays for speed, not style: the quick tricks are in every fast run, and the showy ones cost a quarter of a second to almost a second each.',

  facts(lab: Lab): TrickFacts {
    const costs = trickCosts();
    const all = costs.flatMap((c) => c.ms.map((ms) => ({ trick: c.trick, ms })));
    const byMs = [...all].sort((a, b) => a.ms - b.ms);
    const w = ways(lab);
    const at = (name: string): number => w.find((x) => x.name === name)?.arrival ?? -1;
    return {
      tricks: all.length,
      cheapest: byMs[0]!.trick,
      dearest: byMs.at(-1)!.trick,
      ways: w.map((x) => x.name).join(', '),
      arrivals: w.map((x) => x.arrival),
      vaultLoss: Math.round((at('monkey vault') - at('tiger jump')) * STEP_MS),
      vaultCost: costs.find((c) => c.trick === 'monkey vault')?.ms[0] ?? -1,
    };
  },

  measured(f: TrickFacts): [string, string][] {
    const first = f.arrivals[0]!;
    return [
      [
        'Kinds of trick measured; the cheapest and the dearest',
        `${f.tricks}; ${f.cheapest}, ${f.dearest}`,
      ],
      [
        'One block, four ways, fastest first (time behind the first)',
        f.ways
          .split(', ')
          .map(
            (name, i) => `${name} +${(((f.arrivals[i]! - first) * STEP_MS) / 1000).toFixed(2)} s`,
          )
          .join('; '),
      ],
      [
        'The vault behind the tiger jump on it, and a vault’s cost in the search',
        `${f.vaultLoss} ms, ${f.vaultCost} ms`,
      ],
    ];
  },

  checks(f: TrickFacts): string[] {
    const out: string[] = [];
    if (!f.ways.startsWith('tiger jump')) {
      out.push(`the fastest way over the block is ${f.ways.split(',')[0]}`);
    }
    if (f.vaultLoss <= 0) out.push('the vault is not slower than the tiger jump');
    if (f.dearest !== 'wall flip') out.push(`the dearest trick is ${f.dearest}`);
    return out;
  },

  clips(lab: Lab) {
    const w = ways(lab);
    const colors = [SERIES[0], SERIES[1], SERIES[2], INK.muted];
    const scene = raceScene(lab, w, colors);
    return [
      {
        name: 'race',
        alt: `The same low block taken four ways, each as early as it gets over cleanly: ${w.map((x) => x.name).join(', ')}; as each crosses the line, its time behind the first appears.`,
        scene,
        script: [
          { from: scene.from, to: scene.to },
          { at: scene.to, holdMs: 1500 },
        ],
      },
    ];
  },

  charts() {
    return [
      {
        name: 'cost',
        alt: 'The time a run loses per trick added, from about none for the tiger jump to almost a second for the wall flip, with each trick’s points.',
        svg: costChart(trickCosts()),
      },
    ];
  },
};
