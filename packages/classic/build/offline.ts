/** Offline play: the service worker written after the build (`src/app/offline.ts`). */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { precacheFiles, serviceWorkerSource } from '../src/app/offline.ts';

/** Every file under `dir`, as paths relative to it. */
async function filesUnder(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) out.push(relative(dir, join(entry.parentPath, entry.name)));
  }
  return out;
}

/**
 * Offline play: once the build is written (the challenge page too, so this waits for the end),
 * writes `sw.js`, the service worker that keeps the build's files (`src/app/offline.ts`). Its
 * cache is named by a hash of those files, so every change to the build makes a new one.
 */
export function offlinePlugin(): Plugin {
  let outDir = '';
  return {
    name: 'parapet-offline',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const files = precacheFiles(await filesUnder(outDir));
      const hash = createHash('sha256');
      for (const file of files) {
        hash.update(`${file}\0`);
        hash.update(await readFile(join(outDir, file)));
      }
      const version = hash.digest('hex').slice(0, 12);
      await writeFile(join(outDir, 'sw.js'), serviceWorkerSource(version, files));
    },
  };
}
