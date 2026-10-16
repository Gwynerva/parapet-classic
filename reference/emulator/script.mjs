// The script language: one command a line, `# ` starts a comment. `set` lines carry options (see
// options.mjs); the rest become the plan record.sh plays, a timeline of waits and presses.
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { KEY_ALIASES, KEY_NAMES } from './phone.mjs';

// A route's keys (packages/tools/tas-out/*.json, `presses` as "step:K"): L and R are left and
// right, which the game turns into forward or back by the runner's facing. The game takes the
// digits 2 8 4 6 and the joystick alike (notes/08, key groups); phones were mostly played on the
// digits, so a route plays on them unless the script asks for `arrows`.
const ROUTE_KEYS = {
  digits: { U: '2', D: '8', L: '4', R: '6' },
  arrows: { U: 'up', D: 'down', L: 'left', R: 'right' },
};

const COMMANDS = ['set', 'boot', 'tail', 'wait', 'press', 'repeat', 'route'];

/** Lines as [command, args, line number]; `set`, `boot` and `tail` come back apart, as options. */
export function readScript(file) {
  const commands = [];
  const sets = [];
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((raw, n) => {
      // A comment: `#` at the start of a line, or `#` and a space after a command (so that a
      // colour such as `set glow #ffb000` is not one).
      const line = raw
        .replace(/^\s*#.*$/, '')
        .replace(/\s#(\s.*)?$/, '')
        .trim();
      if (!line) return;
      const [cmd, ...args] = line.split(/\s+/);
      if (!COMMANDS.includes(cmd))
        throw `line ${n + 1}: unknown command "${cmd}" (${COMMANDS.join(', ')})`;
      if (cmd === 'set') {
        if (args.length < 2) throw `line ${n + 1}: set <option> <value>`;
        sets.push([args[0], args.slice(1).join(' '), n + 1]);
      } else if (cmd === 'boot' || cmd === 'tail') sets.push([cmd, args[0], n + 1]);
      else commands.push([cmd, args, n + 1]);
    });
  return { commands, sets };
}

/**
 * Presses of a route, timed from the press before it (the one that starts the race). With 35 ms
 * frames the game takes one physics step a frame (Pace.java). The original reads the starting
 * press one frame before the race's step 0, so step n's press goes n + 1 frames after it (found
 * by trying: so Mill Brook's sprint route finishes in 0:28.02, its 27.99 s plus that frame;
 * `shift` moves the presses by more steps, for experiments). The starting press is sent a
 * quarter of a frame past a tick of the game's frame grid (`align`), and so is every route press
 * after it: each reaches the game well before the tick of the frame that reads it.
 */
function routePresses(plan, file, keys, shift, frameMs, fail) {
  if (frameMs !== 35) fail(`route ${file}: needs game-frame 35, one physics step a frame`);
  const route = JSON.parse(readFileSync(file, 'utf8'));
  const anchor = plan.findLastIndex(([op]) => op === 'press');
  if (anchor < 0)
    fail(
      `route ${file}: it times its presses from the press that starts the race; there is none before it`,
    );
  const frame = frameMs / 1000;
  const presses = String(route.presses)
    .trim()
    .split(/\s+/)
    .map((p) => {
      const [n, k] = p.split(':');
      if (!keys[k]) fail(`route ${file}: unknown key "${k}" in ${p}`);
      return { at: Math.max(1, Number(n) + 1 + shift) * frame, key: keys[k] };
    });
  plan.splice(anchor, 0, ['align', frame, frame / 4]);
  const start = plan[anchor + 1];
  start[2] = Math.min(start[2], Math.max(0.01, (presses[0]?.at ?? Infinity) - 0.015));
  // Seconds from the starting press to where the plan stands after it (its hold and any waits).
  let t = plan.slice(anchor + 1).reduce((sum, [op, a, b]) => sum + (op === 'wait' ? a : b), 0);
  presses.forEach(({ at, key }, i) => {
    const next = presses[i + 1]?.at ?? Infinity;
    const start = Math.max(at, t);
    const hold = Math.max(0.01, Math.min(0.1, next - start - 0.015));
    if (start > t) plan.push(['wait', start - t]);
    plan.push(['press', key, hold]);
    t = start + hold;
  });
}

/** The plan: [`wait`, s], [`press`, key, hold] and [`align`, frame, phase], ending with the tail. */
export function buildPlan(commands, settings, root) {
  const plan = [];
  for (const [cmd, args, n] of commands) {
    const fail = (msg) => {
      throw `line ${n}: ${msg}`;
    };
    const key = (k) => {
      const name = KEY_ALIASES[k] ?? k;
      if (!KEY_NAMES.includes(name)) fail(`unknown key "${k}"`);
      return name;
    };
    const num = (v, what) => {
      const x = Number(v);
      if (!Number.isFinite(x) || x < 0) fail(`${what} must be a number of seconds`);
      return x;
    };
    if (cmd === 'wait') plan.push(['wait', num(args[0], 'wait')]);
    else if (cmd === 'press')
      plan.push(['press', key(args[0]), args[1] ? num(args[1], 'hold') : 0.15]);
    else if (cmd === 'repeat') {
      const times = Number(args[0]);
      if (!Number.isInteger(times) || times < 1) fail('repeat <times> <every> <key>');
      const every = num(args[1], 'interval');
      const k = key(args[2]);
      for (let i = 0; i < times; i++)
        plan.push(['press', k, 0.15], ['wait', Math.max(0, every - 0.15)]);
    } else if (cmd === 'route') {
      const file = isAbsolute(args[0] ?? '') ? args[0] : join(root, args[0] ?? '');
      if (!existsSync(file)) fail(`no route file ${file}`);
      const set = args.slice(1).find((r) => ROUTE_KEYS[r]) ?? 'digits';
      const shift = args.slice(1).find((r) => !ROUTE_KEYS[r]) ?? 0;
      if (!Number.isInteger(Number(shift)))
        fail(`"${shift}" is neither a key set (digits, arrows) nor a shift in steps`);
      routePresses(plan, file, ROUTE_KEYS[set], Number(shift), settings.gameFrame, fail);
    }
  }
  plan.push(['wait', settings.tail]);
  return plan;
}
