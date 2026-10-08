// Entry point: `node src/fontCli.ts [--only <name>] [--out <dir>]` (npm run build-font).
// Rasterises the bundled vector fonts in packages/content/fonts/src into bitmap font atlases.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFont, REQUIRED_CHARSET } from './buildFont.ts';
import { TrueTypeFont } from './ttf.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FONTS_DIR = resolve(REPO_ROOT, 'packages', 'content', 'fonts');
const SOURCES_DIR = join(FONTS_DIR, 'src');

interface FontSpec {
  name: string;
  file: string;
  size: number;
}

/**
 * Terminus TTF embeds the original Terminus bitmaps (6×12 and 8×16 cells among others), which
 * the builder copies verbatim, so the text fonts are the hand-drawn pixel design with full
 * Latin-1 + Cyrillic coverage. Russo One is a vector display face; 16 and 24 px give a chunky,
 * readable pixel rendering from its outlines.
 */
export const FONT_SPECS: readonly FontSpec[] = [
  { name: 'text-12', file: 'terminus/TerminusTTF-4.49.3.ttf', size: 12 },
  { name: 'text-16', file: 'terminus/TerminusTTF-4.49.3.ttf', size: 16 },
  { name: 'display-16', file: 'russo-one/RussoOne-Regular.ttf', size: 16 },
  { name: 'display-24', file: 'russo-one/RussoOne-Regular.ttf', size: 24 },
];

const USAGE = `usage: node src/fontCli.ts [--only <name>] [--out <dir>]

Rasterises the vector fonts in packages/content/fonts/src into <name>.png + <name>.json.

  --only <name>  build a single font (${FONT_SPECS.map((f) => f.name).join(', ')})
  --out <dir>    output directory (default: packages/content/fonts)
  --help         show this text`;

interface CliArgs {
  only: string | undefined;
  out: string;
  help: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { only: undefined, out: FONTS_DIR, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    const value = (): string => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };
    switch (arg) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--only':
        args.only = value();
        break;
      case '--out':
        args.out = resolve(value());
        break;
      default:
        throw new Error(`unknown option ${arg}`);
    }
  }
  return args;
}

function formatCodePoints(codePoints: readonly number[]): string {
  return codePoints.map((c) => `U+${c.toString(16).toUpperCase().padStart(4, '0')}`).join(' ');
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
  const specs = args.only ? FONT_SPECS.filter((f) => f.name === args.only) : FONT_SPECS;
  if (specs.length === 0) {
    console.error(`error: unknown font ${args.only}\n\n${USAGE}`);
    return 2;
  }
  mkdirSync(args.out, { recursive: true });
  let problems = 0;
  for (const spec of specs) {
    const font = new TrueTypeFont(readFileSync(join(SOURCES_DIR, spec.file)), spec.file);
    const built = buildFont(font, { name: spec.name, size: spec.size });
    writeFileSync(join(args.out, `${spec.name}.png`), built.png);
    writeFileSync(join(args.out, `${spec.name}.json`), JSON.stringify(built.data) + '\n');
    const glyphCount = Object.keys(built.data.glyphs).length;
    const crisp =
      built.glyphPixels === 0 ? 100 : 100 - (100 * built.partialPixels) / built.glyphPixels;
    console.log(
      `${spec.name}: ${spec.file} @ ${spec.size}px (${built.source}) -> ` +
        `${built.width}x${built.height} atlas, ${glyphCount} glyphs, ` +
        `line ${built.data.lineHeight}/baseline ${built.data.baseline}, ` +
        `${crisp.toFixed(1)}% of glyph pixels fully in or out of the outline`,
    );
    const required = built.missing.filter((c) => REQUIRED_CHARSET.includes(c));
    const optional = built.missing.filter((c) => !REQUIRED_CHARSET.includes(c));
    if (required.length > 0) {
      problems++;
      console.log(`  MISSING required glyphs: ${formatCodePoints(required)}`);
    }
    if (optional.length > 0)
      console.log(`  missing optional glyphs: ${formatCodePoints(optional)}`);
  }
  return problems > 0 ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
