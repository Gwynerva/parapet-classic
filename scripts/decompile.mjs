// Regenerates reference/decompiled/*.java from the original jar with the CFR decompiler.
// Uses a local JDK if there is one, otherwise Docker (scripts/java.mjs).
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ORIGINAL_JAR, ROOT, dockerArgs, findJdk, run, toDocker } from './java.mjs';

const cfr = join(ROOT, 'reference', 'cfr.jar');
const out = join(ROOT, 'reference', 'decompiled');
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
const jdk = findJdk();
if (jdk !== null) {
  run(join(jdk, 'java'), ['-jar', cfr, ORIGINAL_JAR, '--outputdir', out, ...cfrOpts]);
} else {
  console.log('no local JDK, using docker');
  const args = [
    'java',
    '-jar',
    toDocker(cfr),
    toDocker(ORIGINAL_JAR),
    '--outputdir',
    toDocker(out),
  ];
  run('docker', dockerArgs([...args, ...cfrOpts]));
}
for (const f of ['S', 'a', 'b', 'c', 'd', 'e', 'f', 'g']) {
  const p = join(out, `${f}.java`);
  if (existsSync(p)) writeFileSync(p, readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
}
console.log('done:', out);
