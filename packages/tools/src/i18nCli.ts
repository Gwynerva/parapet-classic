// Entry point: `npm run i18n -- [check | new <code>]` — helps translators (see i18n/README.md).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REFERENCE_LOCALE } from '@parapet/runtime/i18n/locales.ts';
import { checkLocales, hasErrors } from './i18nCheck.ts';
import { fontCoverage, gameSources, I18N_DIR, loadLocales, unusedKeys } from './i18nFiles.ts';

const USAGE = `usage: npm run i18n -- [check | new <code>]

  check        check every language against English: unknown or misplaced keys, changed
               {arguments}, characters the game's fonts cannot draw, untranslated keys;
               and English against the code: keys nothing shows
  new <code>   start a language: i18n/<code>/ with meta.json and empty area files
               (<code> is a BCP 47 language code such as de, uk, pt-BR)`;

function check(): number {
  const locales = loadLocales();
  let errors = 0;
  const reference = locales.find((l) => l.code === REFERENCE_LOCALE)!;
  const unused = unusedKeys(Object.keys(reference.messages), gameSources());
  if (unused.length > 0) {
    console.log(`${REFERENCE_LOCALE}: keys the game never shows (remove them in every language):`);
    for (const key of unused) console.log(`    ${key}`);
    errors++;
  }
  for (const report of checkLocales(locales, fontCoverage())) {
    const bundle = locales.find((l) => l.code === report.code)!;
    const total = Object.keys(locales[0]!.messages).length;
    const done = total - report.missing.length;
    console.log(`${report.code} (${bundle.meta.englishName}): ${done}/${total} keys translated`);
    const section = (title: string, lines: string[]): void => {
      if (lines.length === 0) return;
      console.log(`  ${title}:`);
      for (const line of lines) console.log(`    ${line}`);
    };
    section('not in English (remove or rename)', report.unknown);
    section('in another file than in English', report.misplaced);
    section('arguments differ from English', report.argumentMismatch);
    section('does not parse', report.broken);
    section('characters the fonts lack (see i18n/README.md)', report.missingGlyphs);
    if (report.code !== REFERENCE_LOCALE && report.missing.length > 0) {
      section('untranslated (shown in English)', report.missing);
    }
    if (hasErrors(report)) errors++;
  }
  return errors > 0 ? 1 : 0;
}

function create(code: string | undefined): number {
  if (!code || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(code)) {
    console.error('new: give a BCP 47 code such as de, uk or pt-BR');
    return 2;
  }
  const dir = join(I18N_DIR, code);
  if (existsSync(dir)) {
    console.error(`${dir} already exists`);
    return 1;
  }
  const reference = loadLocales().find((l) => l.code === REFERENCE_LOCALE)!;
  const own = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  const english = new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  mkdirSync(dir, { recursive: true });
  const meta = { name: own.charAt(0).toLocaleUpperCase(code) + own.slice(1), englishName: english };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  for (const area of Object.keys(reference.areas)) {
    writeFileSync(join(dir, `${area}.json`), '{}\n');
  }
  console.log(`created ${dir}`);
  console.log(
    `translate the keys of i18n/${REFERENCE_LOCALE}/*.json into the same files, then run`,
  );
  console.log('  npm run i18n -- check');
  return 0;
}

function main(argv: readonly string[]): number {
  const [command = 'check', arg] = argv;
  switch (command) {
    case 'check':
      return check();
    case 'new':
      return create(arg);
    case '--help':
    case '-h':
      console.log(USAGE);
      return 0;
    default:
      console.error(USAGE);
      return 2;
  }
}

process.exitCode = main(process.argv.slice(2));
