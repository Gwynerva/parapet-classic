// Deploys the test build: builds the client, packs it with the server and the game data the
// server verifies runs against, uploads it as a new release, switches `current` to it and
// restarts the service. The one-time server setup is in deploy/README.md.
//
//   npm run deploy                 build, upload, switch, restart
//   npm run deploy -- --no-build   reuse packages/classic/dist as it is
//
// Environment: DEPLOY_HOST (ssh destination, default `parapet-vps` from ~/.ssh/config).
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const host = process.env.DEPLOY_HOST || 'parapet-vps';
const build = !process.argv.includes('--no-build');
const KEEP_RELEASES = 5;

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (r.status !== 0) {
    console.error(`${[cmd, ...args].join(' ')} failed${r.error ? `: ${r.error.message}` : ''}`);
    process.exit(1);
  }
  return r;
}

function revision() {
  const r = spawnSync('git', ['describe', '--always', '--dirty'], { cwd: root });
  return r.status === 0 ? r.stdout.toString().trim() : 'unknown';
}

if (build) run('npm run build', [], { cwd: root, shell: true });
const dist = join(root, 'packages', 'classic', 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('packages/classic/dist is missing; run without --no-build');
  process.exit(1);
}

const now = new Date();
const id = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const work = mkdtempSync(join(tmpdir(), 'parapet-deploy-'));
const stage = join(work, 'release');
mkdirSync(stage);

cpSync(dist, join(stage, 'www'), { recursive: true });
for (const name of ['server', 'sim', 'protocol']) {
  const from = join(root, 'packages', name);
  const to = join(stage, 'packages', name);
  cpSync(join(from, 'package.json'), join(to, 'package.json'));
  cpSync(join(from, 'src'), join(to, 'src'), {
    recursive: true,
    filter: (path) => !path.endsWith('.test.ts'),
  });
}
const content = join('packages', 'content-classic', 'generated');
cpSync(join(root, content), join(stage, content), { recursive: true });
writeFileSync(join(stage, 'REVISION'), `${revision()} ${now.toISOString()}\n`);

// Relative paths only: GNU tar reads `C:` in an absolute Windows path as a remote host.
run('tar', ['-czf', 'release.tgz', '-C', 'release', '.'], { cwd: work });
console.log(`uploading release ${id} to ${host}`);
run('scp', ['-q', 'release.tgz', `${host}:/tmp/parapet-${id}.tgz`], { cwd: work });

const remote = `
set -euo pipefail
dir=/opt/parapet/releases/${id}
mkdir -p "$dir"
tar -xzf /tmp/parapet-${id}.tgz -C "$dir" --no-same-owner
rm -f /tmp/parapet-${id}.tgz
mkdir -p "$dir/node_modules/@parapet"
ln -s ../../packages/sim "$dir/node_modules/@parapet/sim"
ln -s ../../packages/protocol "$dir/node_modules/@parapet/protocol"
chown -R root:root "$dir"
chmod -R u=rwX,go=rX "$dir"
ln -sfn "$dir" /opt/parapet/current.next
mv -T /opt/parapet/current.next /opt/parapet/current
systemctl restart parapet
ok=
for i in $(seq 1 30); do
  if curl -fs http://172.18.0.1:8787/api/health; then ok=1; break; fi
  sleep 0.5
done
echo
if [ -z "$ok" ]; then journalctl -u parapet -n 40 --no-pager; exit 1; fi
ls -1dt /opt/parapet/releases/* | tail -n +${KEEP_RELEASES + 1} | xargs -r rm -rf
echo "release ${id} is live"
`;
run('ssh', [host, 'bash -s'], { input: remote, stdio: ['pipe', 'inherit', 'inherit'] });
rmSync(work, { recursive: true, force: true });
