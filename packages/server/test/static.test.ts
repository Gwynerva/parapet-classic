/** The static handler that serves the built client in production. */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStaticHandler, resolveInside } from '../src/static.ts';
import { call } from './helpers/http.ts';

function site(): string {
  const root = mkdtempSync(join(tmpdir(), 'parapet-static-'));
  mkdirSync(join(root, 'assets'));
  mkdirSync(join(root, 'dev'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>Parapet</title>');
  writeFileSync(join(root, 'assets', 'main-abc123.js'), 'console.log(1);');
  writeFileSync(join(root, 'dev', 'replay.json'), '{"ok":true}');
  writeFileSync(join(root, 'secret.bin'), 'x');
  return root;
}

describe('static files', () => {
  it('serves index.html for the root and for directories', async () => {
    const files = createStaticHandler(site());
    const root = await call(files, 'GET', '/');
    expect(root.status).toBe(200);
    expect(root.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(root.headers['cache-control']).toBe('no-cache');
    expect(root.body).toContain('<title>Parapet</title>');
    const query = await call(files, 'GET', '/?level=3&mode=sprint');
    expect(query.status).toBe(200);
  });

  it('caches hashed assets and revalidates the rest', async () => {
    const files = createStaticHandler(site());
    const asset = await call(files, 'GET', '/assets/main-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(asset.headers['cache-control']).toContain('immutable');
    const json = await call(files, 'GET', '/dev/replay.json');
    expect(json.headers['cache-control']).toBe('no-cache');
    const again = await call(files, 'GET', '/dev/replay.json', {
      headers: { 'if-modified-since': json.headers['last-modified'] ?? '' },
    });
    expect(again.status).toBe(304);
    expect(again.body).toBe('');
  });

  it('answers HEAD without a body and refuses other methods', async () => {
    const files = createStaticHandler(site());
    const head = await call(files, 'HEAD', '/index.html');
    expect(head.status).toBe(200);
    expect(head.body).toBe('');
    expect(Number(head.headers['content-length'])).toBeGreaterThan(0);
    const post = await call(files, 'POST', '/index.html');
    expect(post.status).toBe(405);
  });

  it('never leaves the root', async () => {
    const root = site();
    const files = createStaticHandler(root);
    expect((await call(files, 'GET', '/missing.js')).status).toBe(404);
    // The URL parser folds `%2e%2e` segments away; an encoded slash survives it.
    expect((await call(files, 'GET', '/%2e%2e/%2e%2e/etc/passwd')).status).toBe(404);
    expect((await call(files, 'GET', '/..%2f..%2fetc%2fpasswd')).status).toBe(400);
    expect((await call(files, 'GET', '/%E0%A4%A')).status).toBe(400);
    expect((await call(files, 'GET', '/a%00b')).status).toBe(400);
    expect(resolveInside(root, '/../outside')).toBe(null);
    expect(resolveInside(root, '/assets/../index.html')).toBe(resolve(root, 'index.html'));
  });

  it('labels unknown types as binary', async () => {
    const files = createStaticHandler(site());
    const bin = await call(files, 'GET', '/secret.bin');
    expect(bin.headers['content-type']).toBe('application/octet-stream');
  });
});
