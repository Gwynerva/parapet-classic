// Entry point: `node src/cli.ts extract [--jar <path>] [--out <dir>]`
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract } from './extract.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DEFAULT_JAR = resolve(
  REPO_ROOT,
  'packages',
  'content',
  'playman',
  'original',
  'Playman_Extreme_Running_240x320.jar',
);
const DEFAULT_OUT = resolve(REPO_ROOT, 'packages', 'content', 'playman', 'extracted');

const USAGE = `usage: node src/cli.ts extract [--jar <path>] [--out <dir>]

Decodes the original J2ME jar into JSON, PNG and MIDI files.

  --jar <path>   jar to read      (default: packages/content/playman/original/Playman_Extreme_Running_240x320.jar)
  --out <dir>    output directory (default: packages/content/playman/extracted)
  --help         show this text`;

interface CliArgs {
  command: string | undefined;
  jar: string;
  out: string;
  help: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { command: undefined, jar: DEFAULT_JAR, out: DEFAULT_OUT, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    const eq = arg.indexOf('=');
    const name = arg.startsWith('--') && eq > 0 ? arg.slice(0, eq) : arg;
    const inline = arg.startsWith('--') && eq > 0 ? arg.slice(eq + 1) : undefined;
    const value = (): string => {
      if (inline !== undefined) return inline;
      const next = argv[++i];
      if (next === undefined) throw new Error(`${name} needs a value`);
      return next;
    };
    switch (name) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--jar':
        args.jar = resolve(value());
        break;
      case '--out':
        args.out = resolve(value());
        break;
      default:
        if (arg.startsWith('-')) throw new Error(`unknown option ${arg}`);
        if (args.command !== undefined) throw new Error(`unexpected argument ${arg}`);
        args.command = arg;
    }
  }
  return args;
}

function main(argv: readonly string[]): number {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
    return 2;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (args.command !== 'extract') {
    console.error(USAGE);
    return 2;
  }
  const started = performance.now();
  const result = extract(args.jar, args.out);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const c = result.counts;
  console.log(`extracted ${result.jar}`);
  console.log(`  -> ${result.outDir}`);
  console.log(
    `  ${c.sprites} sprites, ${c.palettes} palettes, ${c.scenes} scenes (${c.sceneObjects} objects), ` +
      `${c.moveStates} move states, ${c.animClips} clips, ${c.levels} levels, ${c.strings} strings, ${c.music} MIDI tracks`,
  );
  console.log(`  ${c.files} files, ${((c.bytes ?? 0) / 1024).toFixed(0)} KiB, ${seconds} s`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
