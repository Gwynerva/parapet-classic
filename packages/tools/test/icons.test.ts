import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ICON_ART, ICON_FILES, renderIcon } from '../src/icons.ts';
import { readPngSize } from '../src/png.ts';

const PUBLIC = fileURLToPath(new URL('../../classic/public/', import.meta.url));

describe('app icons', () => {
  it('are square pixel art', () => {
    expect(ICON_ART.length).toBe(32);
    for (const row of ICON_ART) expect(row.length).toBe(32);
  });

  for (const file of ICON_FILES) {
    it(`${file.name} matches the art (run npm run icons after changing it)`, () => {
      const stored = new Uint8Array(readFileSync(`${PUBLIC}icons/${file.name}`));
      expect(readPngSize(stored)).toEqual({ width: file.size, height: file.size });
      expect(Buffer.from(stored).equals(Buffer.from(renderIcon(file.scale, file.size)))).toBe(true);
    });
  }

  it('keep the maskable art inside the safe zone', () => {
    const maskable = ICON_FILES.find((f) => f.name.includes('maskable'))!;
    expect(32 * maskable.scale).toBeLessThanOrEqual(maskable.size * 0.8);
  });
});

describe('web app manifest', () => {
  const manifest = JSON.parse(readFileSync(`${PUBLIC}manifest.webmanifest`, 'utf8')) as {
    start_url: string;
    scope: string;
    icons: { src: string; sizes: string }[];
  };

  it('uses relative paths only (the site lives under a sub-path)', () => {
    for (const url of [manifest.start_url, manifest.scope, ...manifest.icons.map((i) => i.src)]) {
      expect(url.startsWith('/')).toBe(false);
      expect(url).not.toMatch(/^[a-z]+:/);
    }
    expect(manifest.start_url).toContain('app=1');
  });

  it('lists icons that exist in their stated size', () => {
    for (const icon of manifest.icons) {
      const path = `${PUBLIC}${icon.src}`;
      expect(existsSync(path)).toBe(true);
      const { width, height } = readPngSize(new Uint8Array(readFileSync(path)));
      expect(`${width}x${height}`).toBe(icon.sizes);
    }
  });
});
