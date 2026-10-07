// Serves the built client (packages/classic/dist) the way GitHub Pages does: as static files
// under a project sub-path, by default http://localhost:4173/parapet-classic/. Run
// `npm run build` first. Usage: node scripts/preview-pages.mjs [port] [base]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(dirname(fileURLToPath(import.meta.url))), 'packages', 'classic', 'dist');
const port = Number(process.argv[2] ?? 4173);
const base = `/${(process.argv[3] ?? 'parapet-classic').replace(/^\/+|\/+$/g, '')}/`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.mid': 'audio/midi',
  '.svg': 'image/svg+xml',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error('packages/classic/dist is missing; run `npm run build` first');
  process.exit(1);
}

createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (path === '/' || path === base.slice(0, -1)) {
    res.writeHead(302, { Location: base });
    res.end();
    return;
  }
  if (!path.startsWith(base)) {
    res.writeHead(404).end('not found');
    return;
  }
  let file = normalize(join(root, path.slice(base.length)));
  if (!file.startsWith(root + sep) && file !== root) {
    res.writeHead(403).end('forbidden');
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`serving ${root} at http://localhost:${port}${base}`);
});
