// Runs `tsc --noEmit` for every workspace package that has a tsconfig.json.
import { readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packagesDir = join(root, 'packages');
let failed = false;
for (const name of readdirSync(packagesDir)) {
  const dir = join(packagesDir, name);
  if (!existsSync(join(dir, 'tsconfig.json'))) continue;
  process.stdout.write(`typecheck ${name}... `);
  const r = spawnSync('npx', ['tsc', '-p', dir], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    cwd: root,
  });
  if (r.status === 0) {
    console.log('ok');
  } else {
    failed = true;
    console.log('FAILED');
    process.stdout.write(r.stdout.toString());
    process.stderr.write(r.stderr.toString());
  }
}
process.exit(failed ? 1 : 0);
