// Builds and runs the oracle harness: the original game's class files on a plain JVM
// against the J2ME stubs in ./stubs, driven by ./src/Oracle.java.
//
//   node reference/oracle/run.mjs <level> <missionType> <script.txt> <out.jsonl>
//   node reference/oracle/run.mjs <script.txt> <out.jsonl>     (level/mission from "# level:" / "# mission:" lines)
//   node reference/oracle/run.mjs --random <seed> <steps> <level> <missionType> <out.jsonl> [minWait maxWait]
//                                                              (LCG-generated script, saved as <out>.txt next to the trace;
//                                                               idle wait after a press defaults to 2..13 steps)
//   node reference/oracle/run.mjs --golden                     (re-run every script in packages/sim/test/golden/{scripts/,}*.txt)
//   node reference/oracle/run.mjs --build                      (compile only)
//
// Uses a local JDK (JAVA_HOME, then PATH), otherwise Docker (eclipse-temurin:17-jdk).
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  statSync,
} from 'node:fs';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative, basename, delimiter, sep } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const jar = join(
  root,
  'packages',
  'content-classic',
  'original',
  'Playman_Extreme_Running_240x320.jar',
);
const build = join(here, 'build');
const classesDir = join(build, 'classes');
const stubsDir = join(build, 'stubs');
const oracleDir = join(build, 'oracle');
const goldenDir = join(root, 'packages', 'sim', 'test', 'golden');
const scriptsDir = join(goldenDir, 'scripts');

function findJdk() {
  const candidates = [];
  if (process.env.JAVA_HOME) candidates.push(join(process.env.JAVA_HOME, 'bin'));
  candidates.push(''); // PATH
  if (process.platform === 'win32') {
    // common vendor install roots, newest first
    for (const vendor of [
      'C:\\Program Files\\Eclipse Adoptium',
      'C:\\Program Files\\Java',
      'C:\\Program Files\\Microsoft',
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

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`${basename(cmd)} ${args.slice(0, 3).join(' ')}... exited with ${r.status}`);
  }
}

function listJava(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJava(p));
    else if (entry.name.endsWith('.java')) out.push(p);
  }
  return out;
}

function newest(files) {
  return Math.max(0, ...files.map((f) => statSync(f).mtimeMs));
}

const jdkBin = findJdk();
const useDocker = jdkBin === null;
const toDocker = (p) => '/w/' + relative(root, p).split(sep).join('/');

function tool(name) {
  return jdkBin ? join(jdkBin, name) : name;
}

function dockerArgs(args) {
  return ['run', '--rm', '-v', `${root}:/w`, '-w', '/w', 'eclipse-temurin:17-jdk', ...args];
}

function buildAll() {
  if (!existsSync(jar)) throw new Error(`missing ${jar}`);
  mkdirSync(classesDir, { recursive: true });
  mkdirSync(stubsDir, { recursive: true });
  mkdirSync(oracleDir, { recursive: true });

  if (!existsSync(join(classesDir, 'd.class'))) {
    console.log('extracting jar -> build/classes');
    if (useDocker)
      run(
        'docker',
        dockerArgs(['sh', '-c', `cd ${toDocker(classesDir)} && jar xf ${toDocker(jar)}`]),
      );
    else run(tool('jar'), ['xf', jar], { cwd: classesDir });
  }

  const stubSources = listJava(join(here, 'stubs'));
  const stubStamp = join(stubsDir, '.built');
  if (!existsSync(stubStamp) || statSync(stubStamp).mtimeMs < newest(stubSources)) {
    console.log('compiling stubs');
    const list = join(build, 'stubs.list');
    writeFileSync(list, (useDocker ? stubSources.map(toDocker) : stubSources).join('\n') + '\n');
    if (useDocker)
      run(
        'docker',
        dockerArgs(['javac', '-nowarn', '-d', toDocker(stubsDir), '@' + toDocker(list)]),
      );
    else run(tool('javac'), ['-nowarn', '-d', stubsDir, '@' + list]);
    writeFileSync(stubStamp, new Date().toISOString());
  }

  const driver = join(here, 'src', 'Oracle.java');
  const driverClass = join(oracleDir, 'Oracle.class');
  if (!existsSync(driverClass) || statSync(driverClass).mtimeMs < statSync(driver).mtimeMs) {
    console.log('compiling Oracle.java');
    if (useDocker)
      run('docker', dockerArgs(['javac', '-nowarn', '-d', toDocker(oracleDir), toDocker(driver)]));
    else run(tool('javac'), ['-nowarn', '-d', oracleDir, driver]);
  }
}

function runOracle(level, mission, script, out) {
  mkdirSync(dirname(out), { recursive: true });
  if (useDocker) {
    const cp = [classesDir, stubsDir, oracleDir].map(toDocker).join(':');
    run(
      'docker',
      dockerArgs([
        'java',
        '-cp',
        cp,
        'Oracle',
        String(level),
        String(mission),
        toDocker(script),
        toDocker(out),
      ]),
    );
  } else {
    const cp = [classesDir, stubsDir, oracleDir].join(delimiter);
    run(tool('java'), ['-cp', cp, 'Oracle', String(level), String(mission), script, out]);
  }
}

function directives(script) {
  const text = readFileSync(script, 'utf8');
  const level = /^#\s*level:\s*(\d+)/m.exec(text);
  const mission = /^#\s*mission:\s*(\d+)/m.exec(text);
  if (!level || !mission) throw new Error(`${script}: needs "# level: N" and "# mission: N" lines`);
  return { level: Number(level[1]), mission: Number(mission[1]) };
}

// Random input script: a 32-bit LCG s = (s * 1664525 + 1013904223) mod 2^32 seeded with `seed`.
// Repeat until `steps` steps are scheduled: advance once, key = "UDRL"[floor(s / 2^32 * 4)],
// press it on one step; advance once more, wait minWait + floor(s / 2^32 * (maxWait - minWait + 1))
// idle steps (default 2..13, i.e. 2 + floor(rnd * 12)). The last wait is clamped so the script is
// exactly `steps` long.
const LCG_MOD = 4294967296;
const lcgNext = (s) => (s * 1664525 + 1013904223) % LCG_MOD; // exact: s * 1664525 < 2^53

function randomScript(seed, steps, level, mission, minWait = 2, maxWait = 13) {
  if (!(minWait >= 1 && maxWait >= minWait))
    throw new Error(`bad wait range ${minWait}..${maxWait}`);
  const span = maxWait - minWait + 1;
  const lines = [
    `# random script: seed=${seed} steps=${steps} level=${level} mission=${mission} wait=${minWait}..${maxWait}`,
    `# level: ${level}`,
    `# mission: ${mission}`,
    `# LCG s = (s*1664525 + 1013904223) mod 2^32; key = "UDRL"[floor(s/2^32*4)]; wait = ${minWait} + floor(s/2^32*${span})`,
  ];
  let s = seed >>> 0;
  let done = 0;
  while (done < steps) {
    s = lcgNext(s);
    lines.push(`1 ${'UDRL'[Math.floor((s / LCG_MOD) * 4)]}`);
    done++;
    if (done >= steps) break;
    s = lcgNext(s);
    const wait = Math.min(minWait + Math.floor((s / LCG_MOD) * span), steps - done);
    lines.push(`${wait} -`);
    done += wait;
  }
  return lines.join('\n') + '\n';
}

/** The golden set is stored gzipped: replace `file.jsonl` by `file.jsonl.gz`. */
function gzipTrace(file) {
  writeFileSync(file + '.gz', gzipSync(readFileSync(file), { level: 9 }));
  unlinkSync(file);
}

const args = process.argv.slice(2);
if (useDocker) console.log('no local JDK found, using docker eclipse-temurin:17-jdk');
buildAll();

if (args[0] === '--build') {
  console.log('build ok');
} else if (args[0] === '--golden') {
  // hand-written scripts live in golden/scripts/, generated ones next to their trace in golden/
  const scripts = [
    ...readdirSync(scriptsDir)
      .filter((f) => f.endsWith('.txt'))
      .map((f) => join(scriptsDir, f)),
    ...readdirSync(goldenDir)
      .filter((f) => f.endsWith('.txt'))
      .map((f) => join(goldenDir, f)),
  ].sort((a, b) => basename(a).localeCompare(basename(b)));
  for (const script of scripts) {
    const { level, mission } = directives(script);
    const out = join(goldenDir, basename(script, '.txt') + '.jsonl');
    runOracle(level, mission, script, out);
    gzipTrace(out);
  }
  console.log(`regenerated ${scripts.length} golden traces in ${goldenDir}`);
} else if (args[0] === '--random' && (args.length === 6 || args.length === 8)) {
  const [seed, steps, level, mission] = args.slice(1, 5).map(Number);
  const out = resolve(args[5]);
  const waits = args.length === 8 ? args.slice(6, 8).map(Number) : [];
  const script = out.replace(/\.jsonl$/i, '') + '.txt';
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(script, randomScript(seed, steps, level, mission, ...waits));
  console.log(`wrote ${script}`);
  runOracle(level, mission, script, out);
} else if (args.length === 4) {
  runOracle(Number(args[0]), Number(args[1]), resolve(args[2]), resolve(args[3]));
} else if (args.length === 2) {
  const script = resolve(args[0]);
  const { level, mission } = directives(script);
  runOracle(level, mission, script, resolve(args[1]));
} else {
  console.error(
    'usage: node run.mjs <level> <missionType> <script.txt> <out.jsonl> | <script.txt> <out.jsonl>' +
      ' | --random <seed> <steps> <level> <missionType> <out.jsonl> [minWait maxWait] | --golden | --build',
  );
  process.exit(2);
}
