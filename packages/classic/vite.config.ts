import { defineConfig, loadEnv, type Plugin, type UserConfig } from 'vite';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** What `npm run extract` decodes from the original jar. */
const playman = fileURLToPath(new URL('../content/playman/extracted', import.meta.url));
/** All game data: fonts, translations, Gwynerva's records, looks and theme. */
const content = fileURLToPath(new URL('../content', import.meta.url));

/** Local TAS runs (git-ignored), served to the dev server only (`?tas=`). */
const tasOut = fileURLToPath(new URL('../tools/tas-out', import.meta.url)).replace(/\\/g, '/');

/**
 * Development helpers (`dev/`): recorded input logs for `?replay=`, the sprite gallery, the
 * loudness meter and the looks page.
 */
const devHelpers = fileURLToPath(new URL('./dev', import.meta.url));
/** Where the loudness page saves its measurements. */
const loudnessFile = join(content, 'audio', 'loudness.json');
/** The bosses' folders: the looks page saves an outfit back into `<boss>/looks/<id>.json`. */
const bosses = join(content, 'bosses');

/** Where the promo art page saves its pictures (dev/art.html), by name. */
const ART_FILES: Record<string, string> = {
  banner: fileURLToPath(new URL('../../docs/banner.png', import.meta.url)),
  'play-now': fileURLToPath(new URL('../../docs/play-now.png', import.meta.url)),
  'og-image': fileURLToPath(new URL('./public/og-image.png', import.meta.url)),
};

/** The file of a look by its id, or null. */
async function lookFile(id: string): Promise<string | null> {
  for (const boss of await readdir(bosses, { withFileTypes: true })) {
    if (!boss.isDirectory()) continue;
    const file = join(bosses, boss.name, 'looks', `${id}.json`);
    try {
      await readFile(file);
      return file;
    } catch {
      // Not this boss's.
    }
  }
  return null;
}

/** JSON as the repository keeps it: through Prettier, objects expanded. */
async function prettyJson(file: string, data: unknown): Promise<string> {
  const prettier = await import('prettier');
  const options = (await prettier.resolveConfig(file)) ?? {};
  return prettier.format(JSON.stringify(data, null, 2), { ...options, filepath: file });
}

/** Reads a request's body as text. */
function bodyOf(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((done, fail) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
    req.on('end', () => done(body));
    req.on('error', fail);
  });
}

const DEV_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
};

/**
 * Serves `dev/` at `/dev/` and the extracted sprites at `/dev/sprites/<id>.png`, on the dev
 * server only: the helpers stay out of the published build.
 */
function devHelpersPlugin(): Plugin {
  return {
    name: 'parapet-dev-helpers',
    apply: 'serve',
    configureServer(server) {
      // The looks page saves an edited outfit here (dev/looks.html): an existing look only.
      server.middlewares.use('/dev/save-look', (req, res, next) => {
        if (req.method !== 'POST') return next();
        const fail = (code: number, err: unknown): void => {
          res.statusCode = code;
          res.end(String(err));
        };
        bodyOf(req)
          .then(async (body) => {
            const { id, data } = JSON.parse(body) as { id?: unknown; data?: { id?: unknown } };
            if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id) || data?.id !== id) {
              return fail(400, 'not a look');
            }
            const file = await lookFile(id);
            if (!file) return fail(404, `no look ${id}`);
            await writeFile(file, await prettyJson(file, data));
            res.end('saved');
          })
          .catch((err: unknown) => fail(500, err));
      });
      // The promo art page saves its pictures here (dev/art.html): known names only.
      server.middlewares.use('/dev/save-art', (req, res, next) => {
        if (req.method !== 'POST') return next();
        bodyOf(req)
          .then(async (body) => {
            const { name, png } = JSON.parse(body) as { name?: string; png?: string };
            const file = name ? ART_FILES[name] : undefined;
            const data = /^data:image\/png;base64,(.+)$/.exec(png ?? '')?.[1];
            if (!file || !data) {
              res.statusCode = 400;
              res.end('not a picture of the page');
              return;
            }
            await mkdir(dirname(file), { recursive: true });
            await writeFile(file, Buffer.from(data, 'base64'));
            res.end('saved');
          })
          .catch((err: unknown) => {
            res.statusCode = 500;
            res.end(String(err));
          });
      });
      // The loudness page saves its table here (dev/loudness.html).
      server.middlewares.use('/dev/loudness', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
        req.on('end', () => {
          try {
            const table = JSON.parse(body) as {
              synth?: unknown;
              target?: unknown;
              tracks?: unknown;
            };
            if (
              typeof table.synth !== 'string' ||
              typeof table.target !== 'number' ||
              typeof table.tracks !== 'object'
            ) {
              throw new Error('not a loudness table');
            }
            const text = JSON.stringify(
              { synth: table.synth, target: table.target, tracks: table.tracks },
              null,
              2,
            );
            mkdir(join(content, 'audio'), { recursive: true })
              .then(() => writeFile(loudnessFile, text + '\n'))
              .then(() => res.end('saved'))
              .catch((err: unknown) => {
                res.statusCode = 500;
                res.end(String(err));
              });
          } catch (err) {
            res.statusCode = 400;
            res.end(String(err));
          }
        });
      });
      server.middlewares.use('/dev', (req, res, next) => {
        const path = new URL(req.url ?? '/', 'http://dev').pathname;
        const match = /^\/(?:(sprites)\/)?([\w-]+\.(?:html|json|png))$/.exec(path);
        if (!match) return next();
        const file = match[1] ? join(playman, 'sprites', match[2]!) : join(devHelpers, match[2]!);
        readFile(file).then(
          (body) => {
            res.setHeader('Content-Type', DEV_TYPES[extname(file)]!);
            res.end(body);
          },
          () => next(),
        );
      });
    },
  };
}

/** Where the game is published (links in the page: canonical, previews), with its `/`. */
const DEFAULT_SITE_URL = 'https://gwynerva.github.io/parapet-classic/';

/**
 * Where the visit counter takes its counts (`VITE_GOATCOUNTER`, see `src/app/analytics.ts`):
 * a goatcounter.com code, or the address of a GoatCounter of our own; '' for none.
 */
function counterOrigin(setting: string): string {
  const v = setting.trim();
  if (/^[a-z0-9-]+$/.test(v)) return `https://${v}.goatcounter.com`;
  try {
    const url = new URL(v);
    return url.protocol === 'https:' ? url.origin : '';
  } catch {
    return '';
  }
}

/**
 * The page's own address in its links (`%SITE_URL%`: the canonical link, the link previews, the
 * structured data), the counter's host among the pictures the page may load when the build
 * counts visits, and the sitemap and robots file of the published site.
 */
function pagePlugin(site: string, counter: string): Plugin {
  return {
    name: 'parapet-page',
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
          'Disallow: /debug.html',
          `Sitemap: ${site}sitemap.xml`,
          '',
        ].join('\n'),
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const site = (env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/?$/, '/');
  return config(command, site, counterOrigin(env.VITE_GOATCOUNTER ?? ''));
});

/** The configuration for a command (`serve`, `build`), the page's address and counter. */
function config(command: string, site: string, counter: string): UserConfig {
  return {
    base: './',
    // The dev server only: a build must not carry a path of the developer's machine.
    define: { TAS_OUT: JSON.stringify(command === 'serve' ? tasOut : '') },
    // The original's music ships as MIDI files played by our own synthesiser.
    assetsInclude: ['**/*.mid'],
    plugins: [devHelpersPlugin(), pagePlugin(site, counter)],
    resolve: {
      alias: {
        '@playman': playman,
        '@content': content,
      },
    },
    server: {
      port: 5173,
    },
    build: {
      target: 'es2022',
      assetsInlineLimit: 0,
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          debug: fileURLToPath(new URL('./debug.html', import.meta.url)),
        },
      },
    },
  };
}
