// The Java side of the reference scripts (`decompile.mjs`, `reference/oracle/run.mjs`): a
// local JDK (JAVA_HOME, then PATH, then the usual Windows install folders), otherwise Docker's
// eclipse-temurin:17-jdk with the repository mounted at /w. Tools run without a shell, so
// paths with spaces pass as they are.
import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, relative, sep } from 'node:path';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
/** The original game: the only input of the extractor, the decompiler and the oracle. */
export const ORIGINAL_JAR = join(
  ROOT,
  'packages',
  'content',
  'playman',
  'original',
  'Playman_Extreme_Running_240x320.jar',
);
export const DOCKER_IMAGE = 'eclipse-temurin:17-jdk';

/** The `bin` folder of a JDK ('' for one on PATH), or null when there is none. */
export function findJdk() {
  const candidates = [];
  if (process.env.JAVA_HOME) candidates.push(join(process.env.JAVA_HOME, 'bin'));
  candidates.push(''); // PATH
  if (process.platform === 'win32') {
    // common vendor install roots, newest first
    for (const vendor of [
      'C:\Program Files\Eclipse Adoptium',
      'C:\Program Files\Java',
      'C:\Program Files\Microsoft',
    ]) {
      if (!existsSync(vendor)) continue;
      const jdks = readdirSync(vendor)
        .filter((n) => /^jdk/i.test(n))
        .sort()
        .reverse();
      for (const n of jdks) candidates.push(join(vendor, n, 'bin'));
    }
  }
  for (const bin of candidates) {
    const javac = bin ? join(bin, 'javac') : 'javac';
    const r = spawnSync(javac, ['-version'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return bin;
  }
  return null;
}

/** A path inside the repository as the Docker container sees it. */
export function toDocker(path) {
  return '/w/' + relative(ROOT, path).split(sep).join('/');
}

/** `docker run` arguments for a command in the JDK image, in /w. */
export function dockerArgs(args) {
  return ['run', '--rm', '-v', `${ROOT}:/w`, '-w', '/w', DOCKER_IMAGE, ...args];
}

/** Runs a command and throws when it fails. */
export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`${basename(cmd)} ${args.slice(0, 3).join(' ')}... exited with ${r.status}`);
  }
}
