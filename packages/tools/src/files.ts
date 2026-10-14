/** Where the tools read and write, and JSON as the repository keeps it. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BitmapFont, type BitmapFontData } from '@parapet/runtime/text/BitmapFont.ts';
import type { RasterFont } from '@parapet/runtime/text/RasterText.ts';
import { decodePng } from './png.ts';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const PACKAGES_DIR = join(REPO_ROOT, 'packages');
export const CONTENT_DIR = join(PACKAGES_DIR, 'content');
/** The original game: the only input of the extractor. */
export const ORIGINAL_JAR = join(
  CONTENT_DIR,
  'playman',
  'original',
  'Playman_Extreme_Running_240x320.jar',
);
/** What `npm run extract` decodes from the original jar. */
export const EXTRACTED_DIR = join(CONTENT_DIR, 'playman', 'extracted');
export const FONTS_DIR = join(CONTENT_DIR, 'fonts');

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** Writes `data` as two-space JSON with a final newline (Prettier keeps it so), folders made. */
export function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

/** One of the game's bitmap fonts (`text-12`, `display-16`…) for drawing into RGBA bytes. */
export function loadRasterFont(name = 'text-12'): RasterFont {
  const data = readJson<BitmapFontData>(join(FONTS_DIR, `${name}.json`));
  const png = decodePng(new Uint8Array(readFileSync(join(FONTS_DIR, `${name}.png`))));
  return {
    font: new BitmapFont(data, null),
    atlas: { width: png.width, height: png.height, data: png.rgba },
  };
}
