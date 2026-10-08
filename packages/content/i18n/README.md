# Translations

Every language is a folder named by its [BCP 47](https://www.rfc-editor.org/info/bcp47) code
(`en`, `ru`, `de`, `pt-BR`, …). The game finds the folders by itself: adding a language is adding
a folder, no code changes. On the first launch the game picks the language from the browser's
preferences and stores it; players can switch in Options.

```
i18n/
  en/            English, the reference every other language is checked against
    meta.json    the language's name in itself and in English
    ui.json      menus, options, about, controls, characters, sharing, records
    game.json    modes, missions, HUD, results, rules, hints, ghosts
    levels.json  level names and descriptions, rival names
    moves.json   move names and descriptions
    story.json   briefings and warm-up tutorial pages
    bosses.json  the bosses: names, descriptions, briefings, effects, outfits
  ru/            the same files in Russian
```

Keys are flat and dotted (`menu.start`, `moves.run.desc`) and live in the same file in every
language. A key a language lacks is shown in English, so a translation can grow step by step.

## Add a language

```bash
npm run i18n -- new de      # i18n/de/ with meta.json and empty area files
npm run i18n -- check       # what is missing or wrong, per language
```

Copy the keys of `en/<file>.json` into the same file of your language and translate the values.
Open a pull request whenever you like; untranslated keys simply stay English.

## Fix a translation

Edit the value in the language's file and open a pull request. `npm run i18n -- check` (also
part of `npm test`) must stay clean.

## Message syntax

- `{name}` inserts a value. Keep every `{…}` of the English text, with the same names; do not
  add new ones.
- Plurals: `{n, plural, one {# flag} other {# flags}}`. Use the categories of your language
  (`one`, `few`, `many`, `other`, … as in the
  [CLDR plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html));
  `#` is the number. `other` is required.
- `'` is an apostrophe; `'{'` writes a literal brace.
- Words in CAPITALS are highlighted moves and terms, as in the original game.
- `\n` starts a new line in the longer texts.

A boss's `gender` (`bosses/<boss>/boss.json`) tells which forms the texts about it use in
languages with grammatical gender; for `neutral` ones, write without gendered forms. The player's gender is unknown: address them without gendered forms where the language
allows it.

## Fonts

The game draws all text with its own bitmap fonts (`../fonts`), built from Terminus (text) and
Russo One (headings) by `npm run build-font`. They cover Latin-1 and Cyrillic. When `check`
reports characters the fonts lack, add the range to `DEFAULT_CHARSET` in
`packages/tools/src/buildFont.ts`, run `npm run build-font` and commit the rebuilt
`fonts/*.png` and `fonts/*.json` with the translation. Terminus covers Latin Extended-A
(Polish, Czech, Turkish, …) completely and Russo One most of it.
