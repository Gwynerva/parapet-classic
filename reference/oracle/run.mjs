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
// Uses a local JDK if there is one, otherwise Docker (scripts/java.mjs).
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
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename, delimiter } from 'node:path';
import {
  ORIGINAL_JAR as jar,
  ROOT as root,
  dockerArgs,
  findJdk,
  run,
  toDocker,
} from '../../scripts/java.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, 'build');
const classesDir = join(build, 'classes');
const stubsDir = join(build, 'stubs');
const oracleDir = join(build, 'oracle');
const goldenDir = join(root, 'packages', 'sim', 'test', 'golden');
const scriptsDir = join(goldenDir, 'scripts');

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

function tool(name) {
  return jdkBin ? join(jdkBin, name) : name;
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

const USAGE =
  'usage: node run.mjs <level> <missionType> <script.txt> <out.jsonl> | <script.txt> <out.jsonl>' +
  ' | --random <seed> <steps> <level> <missionType> <out.jsonl> [minWait maxWait] | --golden | --build';

/** What the arguments ask for, checked before anything is built; null for bad arguments. */
function command(args) {
  if (args.length === 1 && args[0] === '--build') return () => console.log('build ok');
  if (args.length === 1 && args[0] === '--golden') return runGolden;
  if (args[0] === '--random' && (args.length === 6 || args.length === 8)) {
    const [seed, steps, level, mission] = args.slice(1, 5).map(Number);
    if (![seed, steps, level, mission].every(Number.isInteger)) return null;
    const out = resolve(args[5]);
    const waits = args.length === 8 ? args.slice(6, 8).map(Number) : [];
    return () => {
      const script = out.replace(/\.jsonl$/i, '') + '.txt';
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(script, randomScript(seed, steps, level, mission, ...waits));
      console.log(`wrote ${script}`);
      runOracle(level, mission, script, out);
    };
  }
  if (args.length === 4 && !args[0].startsWith('--')) {
    const [level, mission] = args.slice(0, 2).map(Number);
    if (!Number.isInteger(level) || !Number.isInteger(mission)) return null;
    return () => runOracle(level, mission, resolve(args[2]), resolve(args[3]));
  }
  if (args.length === 2 && !args[0].startsWith('--')) {
    return () => {
      const script = resolve(args[0]);
      const { level, mission } = directives(script);
      runOracle(level, mission, script, resolve(args[1]));
    };
  }
  return null;
}

function runGolden() {
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
}

const action = command(process.argv.slice(2));
if (!action) {
  console.error(USAGE);
  process.exit(2);
}
if (useDocker) console.log('no local JDK found, using docker');
buildAll();
action();
