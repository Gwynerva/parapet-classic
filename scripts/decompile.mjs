// Regenerates reference/decompiled/*.java from the original jar with the CFR decompiler.
// Uses a local java if available, otherwise Docker (eclipse-temurin:17-jdk).
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const jar = join(
  root,
  'packages',
  'content-classic',
  'original',
  'Playman_Extreme_Running_240x320.jar',
);
const cfr = join(root, 'reference', 'cfr.jar');
const out = join(root, 'reference', 'decompiled');
const CFR_URL = 'https://github.com/leibnitz27/cfr/releases/download/0.152/cfr-0.152.jar';

if (!existsSync(cfr)) {
  console.log('downloading CFR...');
  const res = await fetch(CFR_URL);
  if (!res.ok) throw new Error(`cannot download CFR: ${res.status}`);
  writeFileSync(cfr, Buffer.from(await res.arrayBuffer()));
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const cfrOpts = ['--renamedupmembers', 'true', '--renameillegalidents', 'true', '--silent', 'true'];
const haveJava = spawnSync('java', ['-version'], { shell: true }).status === 0;
let r;
if (haveJava) {
  r = spawnSync('java', ['-jar', cfr, jar, '--outputdir', out, ...cfrOpts], {
    stdio: 'inherit',
    shell: true,
  });
} else {
  console.log('no local java, using docker eclipse-temurin:17-jdk');
  const args = [
    'run',
    '--rm',
    '-v',
    `${root}:/w`,
    'eclipse-temurin:17-jdk',
    'java',
    '-jar',
    '/w/reference/cfr.jar',
    '/w/packages/content-classic/original/Playman_Extreme_Running_240x320.jar',
    '--outputdir',
    '/w/reference/decompiled',
    ...cfrOpts,
  ];
  r = spawnSync('docker', args, { stdio: 'inherit', shell: true });
}
if (r.status !== 0) process.exit(r.status ?? 1);
for (const f of ['S', 'a', 'b', 'c', 'd', 'e', 'f', 'g']) {
  const p = join(out, `${f}.java`);
  if (existsSync(p)) writeFileSync(p, readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
}
console.log('done:', out);
