# @parapet/content

The data of Parapet Classic, split by where it comes from.

## `playman/` — the original game

Everything in this folder comes from _Playman Extreme Running_ (2007, Mr.Goodliving /
RealNetworks) and belongs to its rights holders. Nothing else does: should the original ever
have to go, deleting this folder (and having players bring their own jar) leaves only our work.

- `playman/original/` — the original J2ME jar.
- `playman/extracted/` — produced by `npm run extract` from the jar: sprites and the atlas,
  composite scenes (`scenes/k*.json`), levels, the move table, physics tables, mission table,
  rival recordings, strings and music. Regenerate instead of editing. The client imports it
  through the `@playman` alias.

### Clean-up applied by the extractor

The mission icons of the menus (sprites 141-150) are scanned sketches whose thick outlines
carry anti-aliasing speckles and many intermediate greys, drawn for the light cards of the
original. `packages/tools/src/cleanSprites.ts` snaps them to four tones (outline, shadow,
paper, ink) and absorbs single-pixel speckles; everything else is extracted untouched.

## Ours

The client imports these through the `@content` alias.

- `fonts/` — bitmap font atlases built by `npm run build-font` from the free vector fonts in
  `fonts/src/` (licences next to each font). The game never loads system fonts.
- `i18n/` — the translations, one folder per language with area files; see
  [`i18n/README.md`](i18n/README.md) for adding a language or fixing a translation.
- `skins/skins.json` — the original's ten characters as data: each entry maps to the character
  index used by the body-part swap rules (0 Blaise, 1 Playman, 2–9 the rivals).
- `bosses/` — the bosses of the contests, one per level: their records, outfits, effects,
  little worlds and the contests' theme; see [`bosses/README.md`](bosses/README.md).
- `moves/demos.json` — the demos of the Moves menu: for each move a little level written as
  text (`#` block, `=` floor, `[` `]` ledges, `|` `!` walls, `H` `h` ladders, `P` pole, `n` `m`
  posts, `x` stone without collision, `S` the start; see `runtime/src/moves/demoLevel.ts`),
  the key presses by step, the steps fast-forwarded before the view starts (`from`), when it
  starts over (`steps`) and the move states it must show (`expect`). `npm run demo -- show
<move>` prints a demo step by step, `npm run demo -- search <move> up@100..130 …` finds
  press timings that work (and keep working one or two steps off), `npm run demo -- check`
  (and the tests) prove every demo shows its move without a fall.
- `audio/loudness.json` — the loudness of every music track measured on our synthesiser
  (`/dev/loudness.html` on the dev server); the game plays each at the same level. A test
  fails when the synthesiser changes, so the table is measured again.
