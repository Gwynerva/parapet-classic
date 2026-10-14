/**
 * Offline play. The build writes a service worker, `sw.js` at the site's root
 * (`offlinePlugin` in `vite.config.ts`), that keeps every file the game needs, the music and
 * the name field's font included, though they load only when wanted. Once the site has been
 * opened, it starts with no connection: the game itself needs no network (the visit counter
 * simply misses what it cannot send).
 *
 * A new build comes on the next launch: the browser checks `sw.js` whenever the site is opened,
 * the new worker keeps the new files and takes over, and the page already open plays on with
 * the files it started with (the build before is kept for it, the music it has not loaded yet
 * included).
 */

/** What offline play does without: the debug page, search engines' files, link previews. */
const LEFT_OUT = [
  /^debug\.html$/,
  /^assets\/debug-/,
  /^sitemap\.xml$/,
  /^robots\.txt$/,
  /^og-[^/]*\.png$/,
  /^sw\.js$/,
];

/** The files of a build (paths under its root) the service worker keeps, sorted. */
export function precacheFiles(paths: readonly string[]): string[] {
  return paths
    .map((p) => p.replace(/\\/g, '/'))
    .filter((p) => !LEFT_OUT.some((pattern) => pattern.test(p)))
    .sort();
}

/**
 * The page for a visit (a navigation), by its path under the site's root: the game, the
 * same game one folder down for challenge links (`r/?<code>`), or the Lab. The query is the
 * page's own business (`?app=1`, the race's code).
 */
const PAGES: Readonly<Record<string, string>> = {
  '': 'index.html',
  'index.html': 'index.html',
  'r/': 'r/index.html',
  'r/index.html': 'r/index.html',
  'lab/': 'lab/index.html',
  'lab/index.html': 'lab/index.html',
};

/**
 * The service worker of a build: `version` names its cache (a hash of the files, so every
 * build has its own), `files` are what it keeps (`precacheFiles`). Plain JavaScript, served as
 * it is.
 */
export function serviceWorkerSource(version: string, files: readonly string[]): string {
  return `// Parapet Classic: offline play. Written by the build (packages/classic/src/app/offline.ts).
const PREFIX = 'parapet-';
const CACHE = PREFIX + ${JSON.stringify(version)};
const FILES = ${JSON.stringify(files)};
const PAGES = new Map(${JSON.stringify(Object.entries(PAGES))});
const ROOT = self.registration.scope;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((file) => new URL(file, ROOT).href)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const ours = (await caches.keys()).filter((name) => name.startsWith(PREFIX));
      // The build before stays: a page still running it may yet load its music.
      const keep = new Set([CACHE, ours[ours.indexOf(CACHE) - 1]]);
      await Promise.all(ours.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(ROOT)) return;
  const path = new URL(request.url).pathname.slice(new URL(ROOT).pathname.length);
  const visit = request.mode === 'navigate';
  const file = visit ? PAGES.get(path) : path;
  if (file === undefined) return;
  const url = new URL(file, ROOT).href;
  event.respondWith(
    (async () =>
      (await caches.match(url, { cacheName: CACHE })) ||
      (visit ? undefined : await caches.match(url)) ||
      fetch(request))(),
  );
});
`;
}

/**
 * Registers the service worker, in a published build only. The site's root is where its
 * manifest is, so a challenge page one folder down registers the same worker.
 */
export function registerOffline(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!manifest) return;
  const root = new URL('./', manifest.href);
  const register = (): void => {
    navigator.serviceWorker
      .register(new URL('sw.js', root), { scope: root.href })
      .catch((error: unknown) => console.warn('offline play is not available:', error));
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
