/** Offline play: what the service worker keeps, and how it answers, in a stand-in browser. */
import { describe, expect, it } from 'vitest';
import { precacheFiles, serviceWorkerSource } from '../src/app/offline.ts';

const BUILD = [
  'index.html',
  'r/index.html',
  'debug.html',
  'assets/main-a1.js',
  'assets/Particles-b2.js',
  'assets/debug-c3.js',
  'assets/atlas-d4.png',
  'assets/0-e5.mid',
  'assets/TerminusTTF-4.49.3-f6.ttf',
  'favicon.ico',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-maskable-512.png',
  'og-image.png',
  'og-race.png',
  'sitemap.xml',
  'robots.txt',
  'sw.js',
];

describe('the files kept for offline play', () => {
  const kept = precacheFiles(BUILD);

  it('are both pages, every chunk, picture, tune and font, and the icons', () => {
    expect(kept).toEqual([
      'assets/0-e5.mid',
      'assets/Particles-b2.js',
      'assets/TerminusTTF-4.49.3-f6.ttf',
      'assets/atlas-d4.png',
      'assets/main-a1.js',
      'favicon.ico',
      'icons/icon-192.png',
      'icons/icon-maskable-512.png',
      'index.html',
      'manifest.webmanifest',
      'r/index.html',
    ]);
  });

  it('take Windows paths as the build lists them', () => {
    expect(precacheFiles(['r\\index.html', 'assets\\debug-c3.js'])).toEqual(['r/index.html']);
  });
});

/** A browser's caches, in the order they were made. */
type Store = Map<string, Map<string, string>>;

interface FakeRequest {
  url: string;
  method: string;
  mode: string;
}

/** Runs a worker's source against stand-ins for `self`, `caches` and `fetch`. */
function startWorker(source: string, scope: string, store: Store = new Map()) {
  const listeners = new Map<string, (event: unknown) => void>();
  const self = {
    registration: { scope },
    addEventListener: (type: string, listener: (event: unknown) => void) =>
      listeners.set(type, listener),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  const caches = {
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const cache = store.get(name)!;
      return {
        addAll: async (urls: string[]) => {
          for (const url of urls) cache.set(url, `${name}: ${url}`);
        },
      };
    },
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    match: async (url: string, options?: { cacheName?: string }) => {
      for (const [name, cache] of store) {
        if (options?.cacheName !== undefined && name !== options.cacheName) continue;
        if (cache.has(url)) return cache.get(url);
      }
      return undefined;
    },
  };
  const fetch = async (request: FakeRequest) => `network: ${request.url}`;
  new Function('self', 'caches', 'fetch', source)(self, caches, fetch);

  const settle = async (type: string, extra: object = {}): Promise<void> => {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)!({ ...extra, waitUntil: (p: Promise<unknown>) => pending.push(p) });
    await Promise.all(pending);
  };
  return {
    store,
    install: () => settle('install'),
    activate: () => settle('activate'),
    /** What the worker answers, or null when it leaves the request to the browser. */
    async fetch(url: string, mode = 'no-cors', method = 'GET'): Promise<string | null> {
      let answer: Promise<string> | null = null;
      listeners.get('fetch')!({
        request: { url, mode, method },
        respondWith: (p: Promise<string>) => (answer = p),
      });
      return answer ? await answer : null;
    },
  };
}

describe('the service worker', () => {
  const scope = 'https://example.test/parapet-classic/';
  const files = precacheFiles(BUILD);

  it('keeps every file of the build under its scope', async () => {
    const worker = startWorker(serviceWorkerSource('v1', files), scope);
    await worker.install();
    const cache = worker.store.get('parapet-v1')!;
    expect([...cache.keys()]).toEqual(files.map((f) => scope + f));
  });

  it('opens the game, and a challenge, with whatever the query says', async () => {
    const worker = startWorker(serviceWorkerSource('v1', files), scope);
    await worker.install();
    const page = (file: string) => `parapet-v1: ${scope}${file}`;
    expect(await worker.fetch(`${scope}?app=1`, 'navigate')).toBe(page('index.html'));
    expect(await worker.fetch(scope, 'navigate')).toBe(page('index.html'));
    expect(await worker.fetch(`${scope}r/?Abc-123`, 'navigate')).toBe(page('r/index.html'));
    expect(await worker.fetch(`${scope}r/index.html?x`, 'navigate')).toBe(page('r/index.html'));
    expect(await worker.fetch(`${scope}assets/0-e5.mid`)).toBe(page('assets/0-e5.mid'));
  });

  it('leaves the network to what it does not keep', async () => {
    const worker = startWorker(serviceWorkerSource('v1', files), scope);
    await worker.install();
    expect(await worker.fetch('https://counter.example/count?p=x')).toBeNull();
    expect(await worker.fetch(`${scope}debug.html`, 'navigate')).toBeNull();
    expect(await worker.fetch(`${scope}constructor`, 'navigate')).toBeNull();
    expect(await worker.fetch(`${scope}manifest.webmanifest`, 'no-cors', 'POST')).toBeNull();
    expect(await worker.fetch(`${scope}sitemap.xml`)).toBe(`network: ${scope}sitemap.xml`);
  });

  it('keeps the build before for a page still running it, and drops older ones', async () => {
    const store: Store = new Map();
    for (const version of ['v1', 'v2', 'v3']) {
      const built = version === 'v3' ? [...files, 'assets/0-new.mid'] : files;
      const worker = startWorker(serviceWorkerSource(version, built), scope, store);
      await worker.install();
      await worker.activate();
    }
    expect([...store.keys()]).toEqual(['parapet-v2', 'parapet-v3']);
    const worker = startWorker(
      serviceWorkerSource('v3', [...files, 'assets/0-new.mid']),
      scope,
      store,
    );
    store.get('parapet-v2')!.set(`${scope}assets/0-old.mid`, 'parapet-v2: old tune');
    // The new build's own files first, then the build before's.
    expect(await worker.fetch(`${scope}index.html`)).toBe(`parapet-v3: ${scope}index.html`);
    expect(await worker.fetch(`${scope}assets/0-old.mid`)).toBe('parapet-v2: old tune');
  });
});
