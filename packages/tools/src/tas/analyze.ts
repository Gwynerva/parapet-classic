/**
 * What tricks cost (`npm run tas -- analyze`): the optimal run of every contest next to its
 * stylish runs (`run --style`), with their times and tricks, and estimates of what a trick of
 * each kind costs. Writes `tas-out/analysis/report.md` and `report.json`: times and counts only,
 * never the inputs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEVEL_COUNT } from '@parapet/sim';
import { levelContent } from './content.ts';
import { readRun, TAS_OUT_DIR, type TasRunFile } from './files.ts';
import { isCurrent, styleCap } from './job.ts';
import { CONTEST_MODES, parsePresses, type ContestMode } from './model.ts';
import { styleOf, trickCount, TRICKS } from './style.ts';

export const ANALYSIS_DIR = join(TAS_OUT_DIR, 'analysis');

/** One run as the analysis sees it. */
export interface RunFacts {
  timeMs: number;
  score: number;
  /** Tricks per kind (`style.ts`), packed and as a record. */
  packed: number;
  tricks: Record<string, number>;
  failed: boolean;
  fragile: number;
}

export interface ContestFacts {
  levelId: number;
  mode: ContestMode;
  optimal: RunFacts | null;
  /** Per stylish variant (`style-05`): the run, or null when there is none. */
  stylish: Record<string, RunFacts | null>;
  /** What is wrong with a stylish run (over its cap, a fail, a frame-perfect press). */
  problems: string[];
}

function facts(levelId: number, mode: ContestMode, run: TasRunFile): RunFacts {
  const style = styleOf(levelContent(levelId), mode, parsePresses(run.presses));
  return {
    timeMs: run.timeMs,
    score: Math.round(style.score),
    packed: style.packed,
    tricks: style.tricks,
    failed: style.failed,
    fragile: run.fragile.length,
  };
}

/** Gathers the stored runs of every contest. */
export function gather(variants: readonly { name: string; capPct: number }[]): ContestFacts[] {
  const out: ContestFacts[] = [];
  for (let levelId = 0; levelId < LEVEL_COUNT; levelId++) {
    for (const mode of CONTEST_MODES) {
      const opt = readRun(levelId, mode);
      const optimal = opt && isCurrent(opt, levelId) ? facts(levelId, mode, opt) : null;
      const stylish: Record<string, RunFacts | null> = {};
      const problems: string[] = [];
      for (const v of variants) {
        const run = readRun(levelId, mode, v.name);
        if (!run || !isCurrent(run, levelId) || !optimal) {
          stylish[v.name] = null;
          continue;
        }
        const f = facts(levelId, mode, run);
        stylish[v.name] = f;
        if (run.optimalMs !== optimal.timeMs)
          problems.push(`${v.name}: measured against another optimal run`);
        if (f.timeMs > styleCap(optimal.timeMs, v.capPct)) problems.push(`${v.name}: over its cap`);
        if (f.failed) problems.push(`${v.name}: fails somewhere`);
        if (f.fragile > 0) problems.push(`${v.name}: ${f.fragile} frame-perfect presses`);
      }
      if (optimal && optimal.fragile > 0)
        problems.push(`optimal: ${optimal.fragile} frame-perfect presses`);
      out.push({ levelId, mode, optimal, stylish, problems });
    }
  }
  return out;
}

/** Points a run's tricks of kind `k` are worth. */
function kindPoints(packed: number, k: number): number {
  const n = trickCount(packed, k);
  return TRICKS[k]!.weight * (2 - 2 * 0.5 ** n);
}

/** Estimated cost of one more trick of each kind, from the time the stylish runs lose. */
export interface TrickPrice {
  kind: string;
  /** Tricks of this kind in the optimal runs, and added by the stylish ones (all contests). */
  inOptimal: number;
  added: Record<string, number>;
  /** Contests whose optimal run already has one. */
  freeIn: number;
  /** Time lost per added trick (ms), the loss of a stylish run shared by the points it gained. */
  msPerTrick: number | null;
}

export function prices(
  contests: readonly ContestFacts[],
  variants: readonly string[],
): TrickPrice[] {
  return TRICKS.map((t, k) => {
    let inOptimal = 0;
    let freeIn = 0;
    const added: Record<string, number> = {};
    let lost = 0;
    let count = 0;
    for (const c of contests) {
      if (!c.optimal) continue;
      const nOpt = c.optimal.tricks[t.id] ?? 0;
      inOptimal += nOpt;
      if (nOpt > 0) freeIn++;
      for (const v of variants) {
        const s = c.stylish[v];
        if (!s) continue;
        const more = (s.tricks[t.id] ?? 0) - nOpt;
        added[v] = (added[v] ?? 0) + Math.max(0, more);
        if (more <= 0) continue;
        // The run's loss shared among the kinds by the points each gained.
        let gained = 0;
        for (let j = 0; j < TRICKS.length; j++) {
          gained += Math.max(0, kindPoints(s.packed, j) - kindPoints(c.optimal.packed, j));
        }
        const mine = kindPoints(s.packed, k) - kindPoints(c.optimal.packed, k);
        if (gained > 0) lost += ((s.timeMs - c.optimal.timeMs) * mine) / gained;
        count += more;
      }
    }
    return { kind: t.id, inOptimal, added, freeIn, msPerTrick: count > 0 ? lost / count : null };
  });
}

const sec = (ms: number): string => (ms / 1000).toFixed(2);
const pct = (a: number, b: number): string => `${(((a - b) / b) * 100).toFixed(1)} %`;
const trickList = (t: Record<string, number>): string =>
  Object.entries(t)
    .map(([k, n]) => (n > 1 ? `${k}×${n}` : k))
    .join(', ') || '–';

/** The report as Markdown. */
export function reportMarkdown(
  contests: readonly ContestFacts[],
  variants: readonly { name: string; capPct: number }[],
): string {
  const names = variants.map((v) => v.name);
  const lines: string[] = [
    '# What tricks cost',
    '',
    'Every contest (level × mode) has an optimal run, the fastest found under human limits, and',
    `stylish runs: the most style (\`packages/tools/src/tas/style.ts\`) within ${variants
      .map((v) => `+${v.capPct} %`)
      .join(' and ')} of the optimal time, never failing, no frame-perfect press. Style is a`,
    "trick's points in the original's Score mode, each repeat of a kind worth half the one",
    'before (the tiger jump next to nothing).',
    '',
    '## By contest',
    '',
    `| Level | Mode | Optimal | Its tricks | ${names.map((n) => `${n} | Δ | style | tricks it adds`).join(' | ')} |`,
    `| --- | --- | --- | --- | ${names.map(() => '--- | --- | --- | ---').join(' | ')} |`,
  ];
  for (const c of contests) {
    const level = String(c.levelId + 1);
    const o = c.optimal;
    const cells = [
      level,
      c.mode,
      o ? `${sec(o.timeMs)} (${o.score})` : '–',
      o ? trickList(o.tricks) : '–',
    ];
    for (const n of names) {
      const s = c.stylish[n];
      if (!s || !o) {
        cells.push('–', '–', '–', '–');
        continue;
      }
      const more: Record<string, number> = {};
      TRICKS.forEach((t) => {
        const d = (s.tricks[t.id] ?? 0) - (o.tricks[t.id] ?? 0);
        if (d > 0) more[t.id] = d;
      });
      cells.push(sec(s.timeMs), pct(s.timeMs, o.timeMs), String(s.score), trickList(more));
    }
    lines.push(`| ${cells.join(' | ')} |`);
  }

  lines.push('', '## Overall', '');
  for (const v of variants) {
    const pairs = contests.filter((c) => c.optimal && c.stylish[v.name]);
    if (pairs.length === 0) continue;
    const dt = pairs.map(
      (c) => (c.stylish[v.name]!.timeMs - c.optimal!.timeMs) / c.optimal!.timeMs,
    );
    const ds = pairs.map((c) => c.stylish[v.name]!.score - c.optimal!.score);
    const lost = pairs.reduce((a, c) => a + c.stylish[v.name]!.timeMs - c.optimal!.timeMs, 0);
    const gained = ds.reduce((a, b) => a + b, 0);
    lines.push(
      `- **${v.name}** (${pairs.length} contests): ${(
        (dt.reduce((a, b) => a + b, 0) / dt.length) *
        100
      ).toFixed(1)} % slower on average, +${Math.round(gained / pairs.length)} style points` +
        ` per contest, ${gained > 0 ? `${(lost / gained).toFixed(1)} ms per style point` : 'no style gained'}.`,
    );
  }

  lines.push(
    '',
    '## Price of a trick',
    '',
    'A stylish run loses time for every trick it adds; the loss is shared among its kinds by the',
    'points each gained. A rough estimate: tricks change the route around them too.',
    '',
    `| Trick | Points | In optimal runs | Contests where free | ${names.map((n) => `Added in ${n}`).join(' | ')} | ms per added trick |`,
    `| --- | --- | --- | --- | ${names.map(() => '---').join(' | ')} | --- |`,
  );
  for (const p of prices(contests, names)) {
    const w = TRICKS.find((t) => t.id === p.kind)!.weight;
    lines.push(
      `| ${p.kind} | ${w} | ${p.inOptimal} | ${p.freeIn} | ${names.map((n) => String(p.added[n] ?? 0)).join(' | ')} | ${
        p.msPerTrick === null ? '–' : Math.round(p.msPerTrick)
      } |`,
    );
  }

  const problems = contests.flatMap((c) =>
    c.problems.map((p) => `- ${c.levelId + 1} ${c.mode}: ${p}`),
  );
  lines.push(
    '',
    '## Checks',
    '',
    ...(problems.length > 0 ? problems : ['- every run is within its limits']),
  );
  return lines.join('\n') + '\n';
}

/** Gathers, writes `report.md` and `report.json`, and returns the Markdown. */
export function writeAnalysis(variants: readonly { name: string; capPct: number }[]): string {
  const contests = gather(variants);
  const markdown = reportMarkdown(contests, variants);
  mkdirSync(ANALYSIS_DIR, { recursive: true });
  writeFileSync(join(ANALYSIS_DIR, 'report.md'), markdown);
  writeFileSync(
    join(ANALYSIS_DIR, 'report.json'),
    JSON.stringify(
      {
        variants,
        contests,
        prices: prices(
          contests,
          variants.map((v) => v.name),
        ),
      },
      null,
      2,
    ) + '\n',
  );
  return markdown;
}
