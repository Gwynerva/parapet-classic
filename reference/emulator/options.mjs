// The tool's settings: one table of options, read in order from the defaults, a JSON config file
// (--config), `set` lines in the script and the command line, each overriding the one before.
// `take` options shape the recording itself; the rest only how the take is composed.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const PRESETS = [
  'ultrafast',
  'superfast',
  'veryfast',
  'faster',
  'fast',
  'medium',
  'slow',
  'slower',
  'veryslow',
];

export const OPTIONS = [
  // The take: changing one of these needs a new recording.
  {
    name: 'fps',
    kind: 'int',
    min: 10,
    max: 120,
    def: 60,
    take: true,
    help: 'frames a second of the recording and of the video',
  },
  {
    name: 'gameFrame',
    kind: 'number',
    min: 8,
    max: 200,
    def: 35,
    take: true,
    help: "how long the game's frames last, ms (35 ≈ 28.6 a second, one physics step a frame; routes need 35)",
  },
  {
    name: 'boot',
    kind: 'number',
    min: 0,
    max: 60,
    def: 2,
    take: true,
    help: 'seconds the emulator gets to start before recording',
  },
  {
    name: 'tail',
    kind: 'number',
    min: 0,
    max: 600,
    def: 1.5,
    take: true,
    help: 'seconds recorded after the last command',
  },
  {
    name: 'unlock',
    kind: 'bool',
    def: false,
    take: true,
    help: "every level open in the level menu (the menu's lock check says yes; the races are untouched)",
  },
  {
    name: 'jar',
    kind: 'path',
    def: null,
    take: true,
    help: 'the game jar (default: the original in packages/content/playman/original)',
  },
  {
    name: 'frameMethod',
    kind: 'enum',
    values: ['t', 's'],
    def: 't',
    take: true,
    help: "the game's once-a-frame method the pace hooks: t in 1.0.8 (the original here), s in 1.0.4",
  },

  // The picture.
  {
    name: 'layout',
    kind: 'enum',
    values: ['phone', 'side', 'screen'],
    def: 'phone',
    help: 'phone: the phone alone; side: the phone with its screen enlarged beside it; screen: the screen alone',
  },
  {
    name: 'scale',
    kind: 'int',
    min: 1,
    max: 12,
    def: 3,
    help: 'pixels per pixel of the phone and of the game on its screen (1: a 335 × 825 phone)',
  },
  {
    name: 'zoom',
    kind: 'int',
    min: 1,
    max: 16,
    def: 3,
    help: 'pixels per game pixel of the enlarged screen (layouts side and screen)',
  },
  {
    name: 'screenSide',
    kind: 'enum',
    values: ['right', 'left'],
    def: 'right',
    help: 'where the enlarged screen stands in layout side',
  },
  {
    name: 'gap',
    kind: 'int',
    min: 0,
    max: 4000,
    def: 120,
    help: 'space between the phone and the enlarged screen',
  },
  {
    name: 'border',
    kind: 'int',
    min: 0,
    max: 64,
    def: 6,
    help: 'width of the frame around the enlarged screen',
  },
  { name: 'borderColor', kind: 'color', def: '#2a313b', help: 'colour of that frame' },
  { name: 'pad', kind: 'int', min: 0, max: 4000, def: 48, help: 'space around the picture' },
  { name: 'bg', kind: 'color', def: '#0b0e13', help: 'the background' },
  {
    name: 'frame',
    kind: 'size',
    def: null,
    help: 'put the picture in the middle of a frame of that size (1920x1080), made smaller only if it does not fit; none: no frame',
  },
  { name: 'glow', kind: 'color', def: '#8fd3ff', help: 'the colour a pressed key lights up in' },
  {
    name: 'glowTail',
    kind: 'number',
    min: 0,
    max: 2,
    def: 0.08,
    help: 'seconds a key stays lit after its release, so that a tap shows',
  },
  { name: 'keys', kind: 'bool', def: true, help: 'light up the pressed keys' },
  { name: 'glass', kind: 'bool', def: true, help: "the reflection on the phone's glass" },

  // The edit.
  {
    name: 'cut',
    kind: 'cuts',
    def: null,
    help: 'the parts of the take to keep, in seconds of the take: 1.2-9.6,14.6-31,52.8- (none: all of it)',
  },
  {
    name: 'xfade',
    kind: 'number',
    min: 0,
    max: 5,
    def: 0.4,
    help: 'crossfade between the parts of a cut, seconds (0: hard cuts)',
  },
  {
    name: 'fadeIn',
    kind: 'number',
    min: 0,
    max: 10,
    def: 0,
    help: 'fade in from the background at the start, seconds',
  },
  {
    name: 'fadeOut',
    kind: 'number',
    min: 0,
    max: 10,
    def: 0,
    help: 'fade out to the background at the end, seconds',
  },
  {
    name: 'speed',
    kind: 'number',
    min: 0.1,
    max: 10,
    def: 1,
    help: "playback speed (1.0254 = 35 / 34.133 runs the game at the remake's pace)",
  },

  // The file.
  {
    name: 'out',
    kind: 'path',
    def: null,
    help: 'the video (default: out/<script>.mp4); a .json with the layout and the presses goes beside it',
  },
  {
    name: 'crf',
    kind: 'int',
    min: 0,
    max: 51,
    def: 14,
    help: 'x264 quality: lower is better and bigger, 0 is lossless',
  },
  { name: 'preset', kind: 'enum', values: PRESETS, def: 'slow', help: 'x264 speed against size' },
  {
    name: 'tune',
    kind: 'enum',
    values: ['none', 'animation', 'film', 'grain', 'stillimage'],
    def: 'animation',
    help: 'x264 tuning; animation suits pixel art',
  },
  {
    name: 'pixFmt',
    kind: 'enum',
    values: ['yuv420p', 'yuv444p'],
    def: 'yuv420p',
    help: 'yuv420p plays everywhere; yuv444p keeps colour edges sharp (for masters to edit)',
  },
  {
    name: 'reuse',
    kind: 'bool',
    def: false,
    help: "compose the script's last take again instead of recording anew",
  },
];

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
export const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const find = (key) => OPTIONS.find((o) => o.name === camel(key));

/** A value given as text (or as JSON in a config) for one option, checked; throws a message. */
function parse(opt, raw, base) {
  const text = typeof raw === 'string' ? raw.trim() : raw;
  const bad = (why) => {
    throw `must be ${why} (got ${JSON.stringify(raw)})`;
  };
  switch (opt.kind) {
    case 'int':
    case 'number': {
      const n = Number(text);
      if (!Number.isFinite(n) || (opt.kind === 'int' && !Number.isInteger(n)))
        bad(`a ${opt.kind === 'int' ? 'whole ' : ''}number`);
      if (n < opt.min || n > opt.max) bad(`between ${opt.min} and ${opt.max}`);
      return n;
    }
    case 'bool':
      if (typeof text === 'boolean') return text;
      if (/^(true|yes|on|1)$/i.test(text)) return true;
      if (/^(false|no|off|0)$/i.test(text)) return false;
      return bad('true or false');
    case 'enum':
      if (!opt.values.includes(text)) bad(`one of ${opt.values.join(', ')}`);
      return text;
    case 'color':
      if (!/^#[0-9a-f]{6}$/i.test(text)) bad('a colour like #ffb000');
      return text.toLowerCase();
    case 'size': {
      if (text === null || text === 'none') return null;
      const m = /^(\d+)x(\d+)$/.exec(text);
      if (!m) bad('a size like 1920x1080, or none');
      return [Number(m[1]), Number(m[2])];
    }
    case 'path':
      return text === null ? null : resolve(base, text);
    case 'cuts': {
      if (text === null || text === 'none') return null;
      const parts = Array.isArray(text)
        ? text
        : String(text)
            .split(',')
            .map((p) => p.split('-'));
      const cuts = parts.map(([a, b]) => {
        const from = Number(a);
        const to = b === undefined || b === '' || b === null ? null : Number(b);
        if (!Number.isFinite(from) || from < 0 || (to !== null && !(to > from)))
          bad('parts like 1.2-9.6, the last may be open: 52.8-');
        return [from, to];
      });
      cuts.forEach(
        ([a], i) => i && a < (cuts[i - 1][1] ?? Infinity) && bad('parts in order, not overlapping'),
      );
      return cuts;
    }
  }
  return bad('unknown kind');
}

/** One `--name value`, `--name=value`, `--name` / `--no-name` (booleans) or `set name value`. */
function assign(into, key, value, base, where) {
  let opt = find(key);
  if (!opt && key.startsWith('no-') && find(key.slice(3))?.kind === 'bool') {
    opt = find(key.slice(3));
    value = 'false';
  }
  if (!opt) throw `${where}: no such option (see --help)`;
  try {
    into[opt.name] = parse(opt, value, base);
  } catch (e) {
    throw `${where} ${e}`;
  }
}

/** The command line: the script, an optional --config file and option overrides. */
export function readCommandLine(argv) {
  const cli = {};
  let script = null;
  let config = null;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') help = true;
    else if (a.startsWith('--')) {
      let key = a.slice(2);
      let value;
      const eq = key.indexOf('=');
      if (eq >= 0) [key, value] = [key.slice(0, eq), key.slice(eq + 1)];
      if (key === 'config') {
        config = resolve(value ?? argv[++i]);
        continue;
      }
      const opt = find(key.replace(/^no-/, ''));
      if (value === undefined) {
        const next = argv[i + 1];
        const flag =
          opt?.kind === 'bool' &&
          (key.startsWith('no-') ||
            next === undefined ||
            !/^(true|false|yes|no|on|off)$/i.test(next));
        value = flag ? 'true' : argv[++i];
      }
      assign(cli, key, value, process.cwd(), `--${key}`);
    } else if (!script) script = resolve(a);
    else throw `unexpected argument ${a}`;
  }
  return { script, config, cli, help };
}

/** A JSON config: an object of options (names in kebab-case or camelCase); paths are relative to it. */
export function readConfig(file) {
  const into = {};
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw `${file}: ${e.message}`;
  }
  for (const [key, value] of Object.entries(data))
    assign(into, kebab(key), value, dirname(file), `${file}: ${kebab(key)}`);
  return into;
}

/** `set name value` lines of a script, already split: [name, value, line]. Paths are relative to the repository. */
export function readScriptSets(sets, root) {
  const into = {};
  for (const [key, value, line] of sets) assign(into, key, value, root, `line ${line}: set ${key}`);
  return into;
}

/** Defaults, then each layer in turn. */
export function merge(...layers) {
  const s = Object.fromEntries(OPTIONS.map((o) => [o.name, o.def]));
  for (const layer of layers) Object.assign(s, layer);
  return s;
}

export function helpText() {
  const rows = OPTIONS.map((o) => {
    const kind = o.kind === 'enum' ? o.values.join('|') : o.kind === 'bool' ? '' : `<${o.kind}>`;
    const def = o.def === null ? 'none' : Array.isArray(o.def) ? o.def.join('x') : String(o.def);
    return (
      `  --${kebab(o.name)} ${kind}`.padEnd(40) + ` ${o.help} [${def}]${o.take ? ' (take)' : ''}`
    );
  });
  return [
    'usage: node reference/emulator/run.mjs <script.txt> [--config <file.json>] [--<option> <value>]...',
    '',
    'Options (also as `set <option> <value>` in the script, or as keys of the --config file;',
    'the command line overrides the script, which overrides the config; booleans: --x, --no-x):',
    ...rows,
    '',
    'Options marked (take) shape the recording: --reuse refuses a take recorded with other ones.',
  ].join('\n');
}
