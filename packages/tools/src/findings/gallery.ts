/**
 * The gallery of the findings' index (`reference/findings/README.md`): the pages in the parts
 * the story tells them in, each a cover, its title and its claim.
 */
import type { PageEntry } from './pages.ts';

/** The parts of the story and the pages (by number) in each. */
export const PARTS: readonly { title: string; pages: readonly number[] }[] = [
  { title: 'I. The controls', pages: [1, 2, 3] },
  { title: 'II. The engine', pages: [4, 5, 6, 7] },
  { title: 'III. The picture', pages: [8, 9, 10] },
  { title: 'IV. The data', pages: [11, 12, 13, 14] },
  { title: 'V. The search', pages: [15] },
];

/** The picture that stands for a page: a still of its first animation, else its first picture or chart. */
function coverOf(slug: string, page: PageEntry): string {
  if (Object.keys(page.clips).length > 0) return `${slug}/cover.png`;
  if (page.pictures[0]) return `${slug}/${page.pictures[0]}.png`;
  return `${slug}/${page.charts[0]}.svg`;
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function cell(slug: string, page: PageEntry): string {
  const n = Number(slug.slice(0, 2));
  return [
    '<td width="50%" valign="top">',
    `<a href="${slug}/"><img src="${coverOf(slug, page)}" alt="${esc(page.title)}"></a><br>`,
    `<b><a href="${slug}/">${n}. ${esc(page.title)}</a></b><br>`,
    esc(page.claim),
    '</td>',
  ].join('\n');
}

export function galleryBlock(
  pages: readonly { slug: string; page: PageEntry | undefined }[],
): string {
  const bySlug = new Map(pages.filter((p) => p.page).map((p) => [Number(p.slug.slice(0, 2)), p]));
  const out: string[] = [];
  for (const part of PARTS) {
    const items = part.pages.map((n) => bySlug.get(n)).filter((p) => p !== undefined);
    if (items.length === 0) continue;
    out.push(`### ${part.title}`, '', '<table>');
    for (let i = 0; i < items.length; i += 2) {
      out.push('<tr>');
      for (const p of items.slice(i, i + 2)) out.push(cell(p.slug, p.page!));
      out.push('</tr>');
    }
    out.push('</table>', '');
  }
  return out.join('\n').trimEnd();
}
