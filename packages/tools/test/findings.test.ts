/**
 * The findings' pages still show what they say: every finding's checks pass on the current
 * simulation and data, its numbers are the ones its page and the manifest show, its animations
 * would be drawn as they are (the fingerprint of their frames), its files are where the page
 * links them and within their size budget. No ffmpeg needed.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { record } from '@parapet/lab/record.ts';
import { demoWorld, press } from '@parapet/lab/demo.ts';
import { JUMP_STEP, wallRunTry } from '@parapet/lab/experiments/wallRun.ts';
import { REPO_ROOT } from '../src/files.ts';
import { loadLab } from '../src/findings/content.ts';
import { frameHash } from '../src/findings/encode.ts';
import { updateReadme, type Media } from '../src/findings/markdown.ts';
import { ALL_FINDINGS, FINDINGS_DIR, readManifest } from '../src/findings/pages.ts';

const KB = 1024;
const BUDGET = { gif: 1536 * KB, mp4: 1536 * KB, svg: 60 * KB, png: 1536 * KB, page: 4096 * KB };

const lab = loadLab();
const manifest = readManifest();

describe.each(ALL_FINDINGS.map((f) => [f.slug, f] as const))('%s', (slug, f) => {
  const facts = f.facts(lab);
  const page = manifest.pages[slug];
  const dir = join(FINDINGS_DIR, slug);

  it('still shows what its page says', () => {
    expect(f.checks(facts)).toEqual([]);
  });

  it('has the numbers of the manifest', () => {
    expect(page).toBeDefined();
    expect(JSON.parse(JSON.stringify(facts))).toEqual(page!.facts);
  });

  it('draws its animations as they were encoded', () => {
    for (const clip of f.clips(lab, facts)) {
      expect(page!.clips[clip.name]?.hash, clip.name).toBe(frameHash(clip));
    }
  }, 120_000);

  it('has a page whose generated parts are current', async () => {
    const media: Media[] = [
      ...f.clips(lab, facts).map((c) => ({ name: c.name, alt: c.alt, kind: 'clip' as const })),
      ...f.charts(lab, facts).map((c) => ({ name: c.name, alt: c.alt, kind: 'chart' as const })),
      ...(f.pictures?.(lab, facts) ?? []).map((p) => ({
        name: p.name,
        alt: p.alt,
        kind: 'picture' as const,
      })),
    ];
    expect(await updateReadme(dir, f.title, f.claim, media, f.measured(facts), true)).toBe(true);
  }, 60_000);

  it('has every file its page links, within budget', () => {
    const readme = readFileSync(join(dir, 'README.md'), 'utf8');
    const linked = [...readme.matchAll(/\]\(([\w-]+\.(?:gif|mp4|svg|png))\)/g)].map((m) => m[1]!);
    expect(linked.length).toBeGreaterThan(0);
    let total = 0;
    for (const name of new Set(linked)) {
      const path = join(dir, name);
      expect(existsSync(path), name).toBe(true);
      const size = statSync(path).size;
      total += size;
      const kind = name.split('.').pop() as keyof typeof BUDGET;
      expect(size, name).toBeLessThanOrEqual(BUDGET[kind]);
    }
    expect(total).toBeLessThanOrEqual(BUDGET.page);
  });
});

describe('the findings', () => {
  it('are watched without being touched: the look-ahead is cast on a copy', () => {
    const watched = wallRunTry(lab, JUMP_STEP + 15).rec.tracks[0]!;
    const demo = lab.demo('wallRun');
    const { world, input } = demoWorld(lab, demo, {
      presses: [press(JUMP_STEP, 'up'), press(JUMP_STEP + 15, 'up')],
    });
    const plain = record(world, lab.clips, { steps: watched.steps.length - 1, input }).tracks[0]!;
    expect(plain.steps.map((s) => [s.x, s.y, s.moveId])).toEqual(
      watched.steps.map((s) => [s.x, s.y, s.moveId]),
    );
  });

  it('never read the bosses’ routes', () => {
    const roots = [
      join(REPO_ROOT, 'packages', 'lab', 'src'),
      join(REPO_ROOT, 'packages', 'tools', 'src', 'findings'),
    ];
    const files = roots.flatMap((root) =>
      readdirSync(root, { recursive: true, encoding: 'utf8' })
        .filter((f) => f.endsWith('.ts'))
        .map((f) => join(root, f)),
    );
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/tas-out|tas\/files|glimpses\.json/);
    }
  });

  it('are listed in the index, every page once', () => {
    const index = readFileSync(join(FINDINGS_DIR, 'README.md'), 'utf8');
    for (const f of ALL_FINDINGS) {
      expect(index.split(`<b><a href="${f.slug}/">`).length - 1, f.slug).toBe(1);
    }
  });
});
