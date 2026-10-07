/**
 * Entry point: `node src/main.ts` (or `npm run server` from the root).
 *
 * Environment: `PORT` (default 8787), `HOST` (default every interface), `ALLOWED_ORIGINS`
 * (comma-separated, default the Vite dev server), `DATA_DIR` (default `packages/server/data`),
 * `STATIC_DIR` (the built client to serve next to the API; unset, only the API is served).
 */
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIM_VERSION } from '@parapet/sim';
import { createApp, DEFAULT_ALLOWED_ORIGINS } from './app.ts';
import { JsonBoardStore } from './boards.ts';
import { JsonNameStore } from './names.ts';
import { createStaticHandler } from './static.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env['DATA_DIR']
  ? resolve(process.env['DATA_DIR'])
  : join(here, '..', 'data');
export const RUNS_FILE = join(DATA_DIR, 'runs.json');
export const NAMES_FILE = join(DATA_DIR, 'names.json');

const port = Number(process.env['PORT'] ?? 8787);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`invalid PORT ${process.env['PORT']}`);
  process.exit(1);
}
const host = process.env['HOST'] || undefined;
const allowedOrigins = process.env['ALLOWED_ORIGINS']
  ? process.env['ALLOWED_ORIGINS']
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : DEFAULT_ALLOWED_ORIGINS;

const boards = new JsonBoardStore(RUNS_FILE);
const names = new JsonNameStore(NAMES_FILE);
const api = createApp(boards, { names, allowedOrigins });
const staticDir = process.env['STATIC_DIR'] ? resolve(process.env['STATIC_DIR']) : null;
const files = staticDir ? createStaticHandler(staticDir) : null;
const server = createServer((req, res) => {
  const path = req.url ?? '/';
  if (files && path !== '/api' && !path.startsWith('/api/')) files(req, res);
  else api(req, res);
});
server.listen(port, host, () => {
  console.log(
    `parapet server listening on http://${host ?? 'localhost'}:${port} (${SIM_VERSION}, ${boards.count()} runs, ${names.count()} names in ${DATA_DIR}${staticDir ? `, client from ${staticDir}` : ''})`,
  );
});
