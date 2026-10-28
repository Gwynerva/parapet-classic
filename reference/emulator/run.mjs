// Footage of the original game running on a phone: the jar plays in MicroEmulator (in Docker,
// on a virtual screen), a script of key presses drives it, and the recording is laid into a
// painted Nokia 6300 whose keys light up exactly while they are held.
//
//   node reference/emulator/run.mjs <script.txt> [--config <file.json>] [--<option> <value>]...
//   node reference/emulator/run.mjs --help
//
// See README.md for the script language and the options (options.mjs has their table).
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGINAL_JAR } from '../../scripts/java.mjs';
import { FONTS_CSS, KEY_NAMES, PHONE, RENDERER } from './phone.mjs';
import { renderCanvases } from './chrome.mjs';
import {
  OPTIONS,
  helpText,
  kebab,
  merge,
  readCommandLine,
  readConfig,
  readScriptSets,
} from './options.mjs';
import { buildPlan, readScript } from './script.mjs';
import { composition } from './compose.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, 'build');
const root = join(here, '..', '..');

// MicroEmulator 2.0.4 from Maven Central (LGPL), checked against Maven's SHA-1 files.
const MAVEN = 'https://repo1.maven.org/maven2/org/microemu';
const JARS = ['microemulator', 'microemu-device-large', 'microemu-nokiaui', 'microemu-jsr-135'];

// Where each key of MicroEmulator's "large" device is clicked: the centres of the buttons in its
// device.xml, moved 21 px down (the window's menu bar above the skin).
const CLICK = {
  soft1: [76, 434],
  soft2: [216, 433],
  select: [145, 436],
  up: [143, 411],
  down: [143, 459],
  left: [110, 435],
  right: [178, 435],
  1: [66, 480],
  2: [145, 486],
  3: [224, 479],
  4: [66, 519],
  5: [145, 521],
  6: [224, 517],
  7: [66, 555],
  8: [145, 561],
  9: [224, 556],
  star: [66, 594],
  0: [145, 596],
  pound: [224, 593],
};

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: opts.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    ...opts,
  });
  if (r.error) fail(`${cmd}: ${r.error.message}`);
  if (r.status !== 0 && !opts.allowFail)
    fail(`${cmd} ${args.slice(0, 3).join(' ')}… failed (${r.status})\n${r.stderr ?? ''}`);
  return r;
}

const duration = (file) =>
  Number(
    run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
      capture: true,
    }).stdout.trim(),
  );

async function ensureJars() {
  const dir = join(build, 'jars');
  mkdirSync(dir, { recursive: true });
  for (const a of JARS) {
    const file = join(dir, `${a}-2.0.4.jar`);
    if (existsSync(file)) continue;
    const url = `${MAVEN}/${a}/2.0.4/${a}-2.0.4.jar`;
    console.log(`downloading ${url}`);
    const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
    const sha1 = (await (await fetch(url + '.sha1')).text()).trim().slice(0, 40);
    const got = createHash('sha1').update(bytes).digest('hex');
    if (got !== sha1) fail(`${a}: checksum ${got} does not match Maven's ${sha1}`);
    writeFileSync(file, bytes);
  }
  return dir;
}

function ensureImage() {
  const hash = createHash('sha1')
    .update(readFileSync(join(here, 'Dockerfile')))
    .digest('hex')
    .slice(0, 10);
  const tag = `parapet-emulator:${hash}`;
  if (run('docker', ['image', 'inspect', tag], { capture: true, allowFail: true }).status !== 0) {
    console.log(`building ${tag} (once)`);
    run('docker', ['build', '-t', tag, here]);
  }
  return tag;
}

/** The phone, its glass and every pressed key, painted once per scale and glow colour. */
async function ensureSkin(scale, glow) {
  const version = createHash('sha1').update(RENDERER).digest('hex').slice(0, 8);
  const dir = join(build, 'skin', `${version}-x${scale}-${glow.replace('#', '')}`);
  const phone = join(dir, 'phone.png');
  if (!existsSync(phone)) {
    mkdirSync(dir, { recursive: true });
    const w = PHONE.w * scale;
    const h = PHONE.h * scale;
    const jobs = [
      { w, h, call: `drawPhone(ctx, ${scale})`, out: phone },
      { w, h, call: `drawGlass(ctx, ${scale})`, out: join(dir, 'glass.png') },
    ];
    for (const k of KEY_NAMES)
      jobs.push({
        w,
        h,
        call: `drawPressed(ctx, ${scale}, ${JSON.stringify(k)}, ${JSON.stringify(glow)})`,
        out: join(dir, `key-${k}.png`),
      });
    console.log(`painting the phone at ${scale}x`);
    await renderCanvases({ source: RENDERER, fontsCss: FONTS_CSS, jobs });
  }
  return dir;
}

/** Seconds as whole microseconds, the unit of record.sh's timeline. */
const us = (s) => Math.round(s * 1e6);

const planText = (plan) =>
  plan
    .map(([op, a, b]) =>
      op === 'wait'
        ? `wait\t${us(a)}`
        : op === 'align'
          ? `align\t${us(a)}\t${us(b)}`
          : `press\t${a}\t${CLICK[a][0]}\t${CLICK[a][1]}\t${us(b)}`,
    )
    .join('\n') + '\n';

/** Records a take: plays the plan in the container and waits for its files to show up. */
async function record(session, plan, s) {
  const jars = await ensureJars();
  const image = ensureImage();
  rmSync(session, { recursive: true, force: true });
  mkdirSync(session, { recursive: true });
  writeFileSync(join(session, 'plan.tsv'), planText(plan));
  console.log('recording the original in MicroEmulator');
  const slash = (p) => p.replace(/\\/g, '/');
  const mount = (from, to, ro = true) => ['-v', `${slash(from)}:${to}${ro ? ':ro' : ''}`];
  run('docker', [
    'run',
    '--rm',
    ...mount(jars, '/work/jars'),
    ...mount(session, '/work/session', false),
    ...mount(s.jar ?? ORIGINAL_JAR, '/game/game.jar'),
    ...mount(join(here, 'record.sh'), '/emu/record.sh'),
    ...mount(join(here, 'Pace.java'), '/emu/Pace.java'),
    ...['-e', `FPS=${s.fps}`, '-e', `GAME_FRAME=${s.gameFrame}`, '-e', `BOOT=${s.boot}`],
    ...['-e', `UNLOCK=${s.unlock ? 1 : 0}`, '-e', `FRAME_METHOD=${s.frameMethod}`],
    image,
    'bash',
    '/emu/record.sh',
  ]);
  // Docker Desktop shows a container's writes to a bind mount on the host with a delay.
  const probe = () =>
    existsSync(join(session, 'presses.tsv')) &&
    run(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'csv=p=0',
        join(session, 'screen.mp4'),
      ],
      {
        capture: true,
        allowFail: true,
      },
    ).status === 0;
  for (let i = 0; i < 120 && !probe(); i++) await new Promise((r) => setTimeout(r, 500));
  if (!probe()) fail(`the recording did not appear in ${session}`);
}

// --- Settings: defaults < --config < the script's `set` lines < the command line.
let cmd;
try {
  cmd = readCommandLine(process.argv.slice(2));
} catch (e) {
  fail(String(e));
}
if (cmd.help || !cmd.script) {
  console.log(helpText());
  process.exit(cmd.help ? 0 : 1);
}
let s;
let plan;
try {
  const { commands, sets } = readScript(cmd.script);
  s = merge(cmd.config ? readConfig(cmd.config) : {}, readScriptSets(sets, root), cmd.cli);
  plan = buildPlan(commands, s, root);
} catch (e) {
  fail(`${basename(cmd.script)}: ${e}`);
}
const name = basename(cmd.script).replace(/\.[^.]+$/, '');
const out = s.out ?? join(here, 'out', `${name}.mp4`);

// --- The take: one per script; --reuse composes the last one again if it was recorded the same way.
const session = join(build, 'sessions', name);
const take = {
  plan: planText(plan),
  ...Object.fromEntries(OPTIONS.filter((o) => o.take).map((o) => [o.name, s[o.name]])),
};
const takeFile = join(session, 'take.json');
const recorded =
  existsSync(takeFile) && existsSync(join(session, 'screen.mp4'))
    ? JSON.parse(readFileSync(takeFile, 'utf8'))
    : null;
if (s.reuse && recorded) {
  const differ = Object.keys(take).filter((k) => recorded[k] !== take[k]);
  if (differ.length)
    fail(
      `--reuse: the last take of ${name} was recorded with another ${differ.map((k) => (k === 'plan' ? 'script' : kebab(k))).join(', ')}; record anew without --reuse`,
    );
  console.log(`reusing the take in ${session}`);
} else {
  if (s.reuse) console.log(`no take of ${name} to reuse yet: recording one`);
  await record(session, plan, s);
  writeFileSync(takeFile, JSON.stringify(take, null, 2) + '\n');
}

const log = readFileSync(join(session, 'capture.log'), 'utf8');
const start = Number(/start: ([\d.]+)/.exec(log)?.[1]);
if (!Number.isFinite(start)) fail('the recorder did not report its start time');
const presses = readFileSync(join(session, 'presses.tsv'), 'utf8')
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const [key, down, up] = l.split('\t');
    return { key, from: Number(down) - start, to: Number(up) - start };
  });
const length = duration(join(session, 'screen.mp4'));

// --- The video.
const skin = s.layout === 'screen' ? null : await ensureSkin(s.scale, s.glow);
let comp;
try {
  comp = composition({ s, session, skin, presses, duration: length, out });
} catch (e) {
  fail(String(e));
}
mkdirSync(dirname(out), { recursive: true });
console.log(
  `composing: ${s.layout}, ${comp.description.video.width}×${comp.description.video.height}, ${comp.description.video.duration} s`,
);
run('ffmpeg', comp.args);
const settings = Object.fromEntries(
  OPTIONS.filter((o) => o.name !== 'out' && o.name !== 'reuse').map((o) => [o.name, s[o.name]]),
);
writeFileSync(
  out.replace(/\.mp4$/i, '') + '.json',
  JSON.stringify(
    { script: basename(cmd.script), take: { duration: length }, ...comp.description, settings },
    null,
    2,
  ) + '\n',
);
console.log(`wrote ${out}`);
