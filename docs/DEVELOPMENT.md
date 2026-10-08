# Development

Parapet Classic is a browser remake of the 2007 J2ME parkour game _Playman Extreme Running_,
made to keep the game playable and to document how it works. The movement is reproduced
exactly (verified step by step against the original class files); the code is rewritten
cleanly as a readable reference for this kind of game. The whole game is a static site: no
server, no accounts, nothing loaded from anywhere but its own origin (and, on the published
site, an anonymous visit count).

## Layout

- `packages/sim` — deterministic integer simulation (no DOM): moves, collisions, rules, mission
  evaluation, replays (`replayCodec`) and their re-simulation (`verify`).
- `packages/runtime` — browser runtime: viewport, fonts, i18n, input, renderers (including the
  echo holograms and the bosses' looks and effects), camera, mission flow, message boxes,
  audio, storage, clipboard and files.
- `packages/classic` — the game (Vite + TypeScript + Canvas 2D).
- `packages/tools` — extracts sprites, levels, move tables, music and more from the original jar
  into `packages/content/playman`; builds the bitmap fonts; checks translations; searches the
  bosses' records; draws and checks looks; the bosses' art generators (`art/`).
- `packages/content` — `playman/`: the original jar and everything extracted from it, and
  nothing else; next to it our own fonts, translations (`i18n/`, one folder per language) and
  the bosses: records, looks, effects, worlds and theme (`bosses/`).
- `reference/` — everything learned about the original game: formats, physics, flow, menus,
  curiosities and bugs, plus a headless Java oracle that runs the original class files and
  produces the reference traces.
- `docs/` — this page and the README's pictures.

## Getting started

```bash
npm install
npm run extract        # decode the original jar into packages/content/playman/extracted
npm run dev            # http://localhost:5173
npm run check          # prettier, typecheck, tests
npm run build          # packages/classic/dist, a static site
npm run preview:pages  # serve the build under /parapet-classic/ like GitHub Pages
```

Requires Node 24+. Pushes to `main` that pass the checks are published to GitHub Pages by the
CI workflow (`.github/workflows/ci.yml`).

## Tools

- `npm run build-font` rebuilds the bitmap fonts from the bundled TTFs.
- `npm run i18n -- check` checks every translation against English (keys, `{arguments}`,
  characters the fonts lack); `npm run i18n -- new <code>` starts a language. See
  [`packages/content/i18n`](../packages/content/i18n/README.md).
- `npm run tas -- run | verify | publish | report` searches and publishes the bosses' records
  (runs stay in the git-ignored `packages/tools/tas-out`); `npm run look -- atlas | import |
sheet | poses | lineup | rotate` draws and checks the bosses' looks (see
  [`packages/content/bosses`](../packages/content/bosses/README.md)). The looks, effects and
  worlds were drawn by the Python scripts in [`packages/tools/art`](../packages/tools/art).
- `npm run demo -- check | show <move> | search <move> <key@a..b>…` authors the Moves menu's
  demos (`packages/content/moves/demos.json`); `npm run icons` redraws the app icons and the
  favicons.
- `npm run decompile` reproduces the decompiled source under `reference/decompiled/` (Docker or
  a local JDK).
- `reference/oracle` runs the original class files headlessly and writes the golden traces the
  simulation, animator and camera tests compare against.

## The dev server

Shortcuts of the client (dev server only): `?level=N&mode=M` jumps into a run,
`?replay=/dev/l0-flags.json` plays a recorded input log, `?touch=1` shows the touch buttons,
`?tas=<level>-<mode>` plays the boss's local run (`&autopilot=1` races it with it),
`?contestTime=<ms>` makes its time beatable, `?vp=292x633` lays the game out for a phone's
screen and `?coarse=1` treats the mouse as a finger.

Pages of the dev server, never published:

- `debug.html` — a bare level viewer (`C` cycles the characters, `O` a boss's outfits, `G` the
  echo looks, `V` a magnified sheet of poses).
- `/dev/looks.html` — a boss's outfit running both ways with its effect in its world, a sheet
  of poses and its atlas; drop a painted atlas on it to see it at once, Save writes the look.
- `/dev/art.html` — the promotional pictures drawn with the game's renderers: the README's
  banner and Play button (`docs/`) and the link preview (`packages/classic/public/og-image.png`).
- `/dev/sprites.html` — a gallery of the extracted sprites.
- `/dev/loudness.html` — measures the music tracks and saves the levels they are played at.

## The published site

The build takes two settings from the environment (the CI workflow passes them from the
repository's variables, Settings → Secrets and variables → Actions → Variables):

- `VITE_SITE_URL` — where the site lives, for the canonical link, the link previews and the
  structured data in the page (default `https://gwynerva.github.io/parapet-classic/`).
- `VITE_GOATCOUNTER` (repository variable `GOATCOUNTER`) — the site's code at
  [goatcounter.com](https://www.goatcounter.com/): the published site then counts visits and a
  few moments of play anonymously (`packages/classic/src/app/analytics.ts`). Without it nothing
  is counted.
