/**
 * Serves the built client (`packages/classic/dist`) next to the API, so a deployment is one
 * process behind a reverse proxy. Only GET and HEAD; a path resolves inside the root and never
 * outside it, a directory maps to its `index.html`. Vite's hashed files under `assets/` are
 * cached for a year, everything else revalidates with `Last-Modified`. The client is a few
 * megabytes, so files are read whole rather than streamed.
 */
import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import type { RequestHandler } from './app.ts';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mid': 'audio/midi',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const IMMUTABLE = 'public, max-age=31536000, immutable';

function sendText(res: ServerResponse, status: number, text: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(text);
}

/** The file a request path names inside `root`, or null when it would leave the root. */
export function resolveInside(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const file = resolve(root, '.' + decoded);
  return file === root || file.startsWith(root + sep) ? file : null;
}

export function createStaticHandler(rootDir: string): RequestHandler {
  const root = resolve(rootDir);

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return sendText(res, 405, 'method not allowed');
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    let file = resolveInside(root, url.pathname);
    if (file === null) return sendText(res, 400, 'bad path');
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      file = join(file, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info?.isFile()) return sendText(res, 404, 'not found');

    const hashed = file.startsWith(join(root, 'assets') + sep);
    res.setHeader('Content-Type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', hashed ? IMMUTABLE : 'no-cache');
    const modified = new Date(Math.floor(info.mtimeMs / 1000) * 1000);
    res.setHeader('Last-Modified', modified.toUTCString());
    const since = Date.parse(String(req.headers['if-modified-since'] ?? ''));
    if (!Number.isNaN(since) && modified.getTime() <= since) {
      res.statusCode = 304;
      res.end();
      return;
    }
    const body = await readFile(file);
    res.statusCode = 200;
    res.setHeader('Content-Length', body.length);
    res.end(method === 'HEAD' ? undefined : body);
  }

  return (req, res) => {
    handle(req, res).catch((err: unknown) => {
      console.error(err);
      if (!res.headersSent) sendText(res, 500, 'internal error');
      else res.end();
    });
  };
}
