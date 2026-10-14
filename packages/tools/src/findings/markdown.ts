/**
 * The generated parts of a finding's page: between `<!-- findings:media NAME -->` and
 * `<!-- /findings -->` a chart, a picture, or the GIF of an animation with a link to its MP4;
 * between `<!-- findings:measured -->` and `<!-- /findings -->` the table of measured numbers.
 * The rest of the page is written by hand, for readers who never saw the code; a missing page
 * starts as an outline.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';

export interface Media {
  name: string;
  alt: string;
  kind: 'clip' | 'chart' | 'picture';
}

const BLOCK = /<!-- findings:(media [\w-]+|measured) -->[\s\S]*?<!-- \/findings -->/g;

function mediaBlock(m: Media): string {
  if (m.kind === 'chart') return `![${m.alt}](${m.name}.svg)`;
  if (m.kind === 'picture') return `![${m.alt}](${m.name}.png)`;
  return `![${m.alt}](${m.name}.gif)\n\n[The animation as an MP4, 60 frames a second](${m.name}.mp4)`;
}

function measuredBlock(rows: readonly (readonly [string, string])[]): string {
  return ['| Measured | |', '| --- | --- |', ...rows.map(([k, v]) => `| ${k} | ${v} |`)].join('\n');
}

/**
 * A new page: the story first, in plain words, with the pictures; the numbers and the code
 * folded away under `<details>` for the readers who want them.
 */
function outline(title: string, claim: string, media: readonly Media[]): string {
  return [
    `# ${title}`,
    '',
    claim,
    '',
    ...media.flatMap((m) => [`<!-- findings:media ${m.name} -->`, '<!-- /findings -->', '']),
    '## What is going on',
    '',
    '<details>',
    '<summary>The numbers</summary>',
    '',
    '<!-- findings:measured -->',
    '<!-- /findings -->',
    '',
    '</details>',
    '',
    '<details>',
    '<summary>Under the hood: the original’s code and Parapet’s</summary>',
    '',
    '</details>',
    '',
  ].join('\n');
}

/**
 * Brings the generated parts of `dir/README.md` up to date; returns whether they were (with
 * `check` nothing is written).
 */
export async function updateReadme(
  dir: string,
  title: string,
  claim: string,
  media: readonly Media[],
  measured: readonly (readonly [string, string])[],
  check: boolean,
): Promise<boolean> {
  const path = join(dir, 'README.md');
  const before = existsSync(path) ? readFileSync(path, 'utf8') : null;
  const raw = (before ?? outline(title, claim, media)).replace(BLOCK, (_, what: string) => {
    if (what === 'measured')
      return `<!-- findings:measured -->\n${measuredBlock(measured)}\n<!-- /findings -->`;
    const name = what.slice('media '.length);
    const m = media.find((x) => x.name === name);
    if (!m) throw new Error(`${path}: no chart or animation ${name}`);
    return `<!-- findings:media ${name} -->\n${mediaBlock(m)}\n<!-- /findings -->`;
  });
  return save(path, before, raw, check);
}

/**
 * Brings the generated gallery of the findings' index (`<!-- findings:index -->`) up to date;
 * returns whether it was.
 */
export async function updateIndex(path: string, gallery: string, check: boolean): Promise<boolean> {
  const before = readFileSync(path, 'utf8');
  const raw = before.replace(
    /<!-- findings:index -->[\s\S]*?<!-- \/findings -->/,
    `<!-- findings:index -->\n${gallery}\n<!-- /findings -->`,
  );
  return save(path, before, raw, check);
}

/** `raw` formatted as the repository keeps it (Prettier aligns the tables), written if new. */
export async function save(
  path: string,
  before: string | null,
  raw: string,
  check: boolean,
): Promise<boolean> {
  const text = await format(raw, { ...((await resolveConfig(path)) ?? {}), filepath: path });
  if (text === before) return true;
  if (check) console.log(`${path} is out of date`);
  else writeFileSync(path, text);
  return false;
}
