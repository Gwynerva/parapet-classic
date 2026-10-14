/**
 * The published site's pages: the page's own address in its links, the challenge page
 * (`r/index.html`), the sitemap and the robots file.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/** Where the game is published (links in the page: canonical, previews), with its `/`. */
export const DEFAULT_SITE_URL = 'https://gwynerva.github.io/parapet-classic/';

/**
 * The page's own address in its links (`%SITE_URL%`: the canonical link, the link previews, the
 * structured data), the counter's host among the pictures the page may load when the build
 * counts visits, and the sitemap and robots file of the published site.
 */
export function sitePlugin(site: string, counter: string): Plugin {
  let outDir = '';
  return {
    name: 'parapet-page',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      // The challenge page is the game itself (the build writes it from index.html).
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith('/r/')) req.url = req.url.slice('/r'.length);
        next();
      });
    },
    async writeBundle() {
      const page = join(outDir, 'index.html');
      await mkdir(join(outDir, 'r'), { recursive: true });
      await writeFile(
        join(outDir, 'r', 'index.html'),
        racePage(await readFile(page, 'utf8'), site),
      );
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        let out = html.replaceAll('%SITE_URL%', site);
        if (counter)
          out = out.replace("img-src 'self' data: blob:", `img-src 'self' data: blob: ${counter}`);
        return out;
      },
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          `  <url><loc>${site}</loc><changefreq>monthly</changefreq></url>`,
          `  <url><loc>${site}lab/</loc><changefreq>monthly</changefreq></url>`,
          '</urlset>',
          '',
        ].join('\n'),
      });
      // Read by search engines only at a domain's root (a site of its own, not a project page).
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: [
          'User-agent: *',
          'Allow: /',
          `Disallow: ${new URL(site).pathname}debug.html`,
          `Sitemap: ${site}sitemap.xml`,
          '',
        ].join('\n'),
      });
    },
  };
}

/**
 * The page challenge links open (`r/?<code>`): the game itself one folder down (its files'
 * relative paths one level up), with its own link preview (a race, a call to beat the run).
 * Link previews come from a page's HTML as served, the same for every race, so the preview is
 * one for every challenge. Search engines that run the script see each race as a page of its
 * own: the game sets the title, the description and the canonical address from the replay
 * (`src/app/racePage.ts`), so this page has no canonical link of its own.
 */
function racePage(html: string, site: string): string {
  const title = 'Race my ghost · Parapet Classic';
  const ogTitle = 'Race my ghost in Parapet Classic';
  const description =
    'Can you beat my time? Open the link and race my ghost over the rooftops. Free, in the browser.';
  const meta = (attr: 'name' | 'property', key: string, value: string) => (text: string) => {
    const pattern = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`);
    if (!pattern.test(text)) throw new Error(`r/index.html: no ${key} in index.html`);
    return text.replace(pattern, `$1${value}$2`);
  };
  const steps: ((text: string) => string)[] = [
    (text) => text.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`),
    (text) => {
      const canonical = /\s*<link rel="canonical" href="[^"]*" \/>/;
      if (!canonical.test(text)) throw new Error('r/index.html: no canonical link in index.html');
      return text.replace(canonical, '');
    },
    // The page's own files (scripts, styles, icons, the manifest) are one folder up.
    (text) => text.replace(/((?:src|href)=")\.\//g, '$1../'),
    meta('name', 'description', description),
    meta('property', 'og:title', ogTitle),
    meta('property', 'og:description', description),
    meta('property', 'og:url', `${site}r/`),
    meta('property', 'og:image', `${site}og-race.png`),
    meta('property', 'og:image:alt', 'Two runners racing over the rooftops of Parapet Classic'),
    meta('name', 'twitter:title', ogTitle),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', `${site}og-race.png`),
  ];
  return steps.reduce((text, step) => step(text), html);
}
