# @parapet/content-classic

Game data consumed by the client and the server.

- `original/` — the original J2ME jar (proprietary; keep this package out of public distributions).
- `generated/` — produced by `npm run extract` from the original jar: sprites and the
  atlas, composite scenes (`scenes/k*.json`), levels, the move table, physics tables, mission
  table, rival recordings, strings and music. Regenerate instead of editing.
- `fonts/` — bitmap font atlases built by `npm run build-font -w @parapet/tools` from the vector
  fonts in `fonts/src/` (licences next to each font). The game never loads system fonts.
- `i18n/` — UI dictionaries per locale (`en.json`, `ru.json`), keys by meaning, ICU-like plural
  syntax.
- `skins/` — character skins as data: each entry maps to the original character index used by
  the body-part swap rules (0 Blaise, 1 Playman, 2–9 the rivals).

## Clean-up applied by the extractor

The mission icons of the menus (sprites 141-150) are scanned sketches whose thick outlines
carry anti-aliasing speckles and many intermediate greys, drawn for the light cards of the
original. `packages/tools/src/cleanSprites.ts` snaps them to four tones (outline, shadow,
paper, ink) and absorbs single-pixel speckles; everything else is extracted untouched.
