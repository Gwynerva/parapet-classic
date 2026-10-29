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
- `packages/classic` — the game (Vite + TypeScript + Canvas 2D), and the Lab page (`lab/`).
- `packages/lab` — the experiments on the original behind the findings and the Lab: runs of the
  simulation recorded step by step, drawn into RGBA frames and SVG charts (no DOM, no files, so
  the same code runs in Node and in the browser).
- `packages/tools` — extracts sprites, levels, move tables, music and more from the original jar
  into `packages/content/playman`; builds the bitmap fonts; checks translations; searches the
  bosses' records; draws and checks looks; the bosses' art generators (`art/`).
- `packages/content` — `playman/`: the original jar and everything extracted from it, and
  nothing else; next to it our own fonts, translations (`i18n/`, one folder per language) and
  the bosses: records, looks, effects and worlds (`bosses/`), and our scores (`music/`).
- `reference/` — everything learned about the original game: notes on its formats, physics,
  flow, menus, curiosities and bugs (`notes/`), the findings told and animated for everyone
  (`findings/`), a headless Java oracle that runs the original class files and produces the
  reference traces, and the emulator that films the original on a painted phone (`emulator/`).
- `docs/` — this page, the guide for speedrunners (`SPEEDRUN.md`), the TAS reel
  (`TAS-REEL.md`), the 24 machine records (`tas-records/`) and the pictures of the README and
  the releases. The release history is [`CHANGELOG.md`](../CHANGELOG.md).

## Architecture

1. **`sim` is the only home of mechanics.** No DOM, no floats; the move table and the levels are
   data, and the code that runs them maps line by line to the original's (`d.java`). Replays
   carry the simulation version, the ruleset and the content's hashes.
2. **`runtime` is one package with internal boundaries**: platform (viewport, input, storage,
   audio, clipboard, files), render (sprites, scenes, characters, echoes, levels, camera), ui
   (fonts, i18n, screens, widgets). It knows no level or menu; `classic` composes it. Its
   renderers paint through a painter (`ScenePainter`, `TilePainter`), on a canvas in the game
   and into bytes for the findings and the Lab (`SceneRaster`, `RasterText`).
3. **`lab` experiments on data, never on code.** A "what if" is a copy of the move table with a
   rule changed (`patchMoves`); what an experiment watches it computes on a copy of the runner.
4. **Not doing**: a general-purpose engine (Phaser, Pixi) or an ECS. The original's data-driven
   state machine is the right architecture for these mechanics, and either would make the exact
   port and determinism harder.

## Getting started

```bash
npm install
npm run extract        # decode the original jar into packages/content/playman/extracted
npm run dev            # http://localhost:5173
npm run check          # prettier, typecheck, tests
npm run build          # packages/classic/dist, a static site
npm run preview:pages  # serve the build under /parapet-classic/ like GitHub Pages
```

Requires Node 24+. The types are checked by TypeScript 7, the native compiler (`npm run
typecheck`: every package in about half a second). The CI workflow (`.github/workflows/ci.yml`)
runs the checks on Node 24, the oldest supported, and on Node 26, which builds the site; pushes
to `main` that pass them are published to GitHub Pages.

## Tools

- `npm run build-font` rebuilds the bitmap fonts from the bundled TTFs.
- `npm run i18n -- check` checks every translation against English (keys, `{arguments}`,
  characters the fonts lack); `npm run i18n -- new <code>` starts a language. See
  [`packages/content/i18n`](../packages/content/i18n/README.md).
- `npm run tas -- run | tidy | verify | publish | report | analyze | campaign` searches and
  publishes the bosses' records (runs stay in the git-ignored `packages/tools/tas-out`; the
  optimal ones are published in [`docs/tas-records`](tas-records/README.md)); `npm run look -- atlas | import |
sheet | poses | lineup | rotate` draws and checks the bosses' looks (see
  [`packages/content/bosses`](../packages/content/bosses/README.md)). The looks, effects and
  worlds were drawn by the Python scripts in [`packages/tools/art`](../packages/tools/art).
- `packages/tools/src/optimal/` searches for the perfect run without human limits (every state
  of a step merged exactly, segments between flags searched to the end, a glitch hunt with
  recipes to reproduce what it finds) and `packages/tools/native/` is a bit-exact C port of
  the step for it (gcc or MinGW; not built in CI). The folder's
  [README](../packages/tools/src/optimal/README.md) lists the scripts, what each needs and
  writes, and [`reference/notes/10-optimal.md`](../reference/notes/10-optimal.md) tells what
  they found.
- `npm run demo -- check | show <move> | search <move> <key@a..b>…` authors the Moves menu's
  demos (`packages/content/moves/demos.json`); `npm run icons` redraws the app icons and the
  favicons.
- `npm run decompile` reproduces the decompiled source under `reference/decompiled/` (Docker or
  a local JDK).
- `npm run emulator -- <script>` records the original playing in an emulator, laid into a
  painted phone, driven by a script of presses or by a record's route
  ([`reference/emulator`](../reference/emulator/README.md); Docker, Chrome and ffmpeg).
- `npm run findings -- [<page>…] [--no-video] [--check]` measures the findings about the original
  again, writes their charts, pictures and numbers into `reference/findings/<page>/` and encodes
  the animations that changed (ffmpeg 6 or newer on the PATH, or `FFMPEG`): a GIF at 25 frames a
  second and an MP4 at 60. A fingerprint of every animation's frames in `manifest.json` keeps
  another ffmpeg build from churning the binaries. The pages' text is written by hand; the
  generated parts sit between `<!-- findings:… -->` comments. The pages are
  `packages/lab/src/findings/` (and `packages/tools/src/findings/` for the two that read files);
  `npm test` checks them without ffmpeg.
- `reference/oracle` runs the original class files headlessly and writes the golden traces the
  simulation, animator and camera tests compare against.

## The dev server

Shortcuts of the client (dev server only):

- `?level=N&mode=M` jumps into a run (`M` one of `free`, `sprint`, `flags`, `score`,
  `challenge`, `warmup1`, `warmup2`; `&rival=1` for the rival);
- `?tas=<level>-<mode>` plays a local TAS run (the optimal one in `packages/tools/tas-out`,
  levels from 0; `?tas=style-15/<level>-<mode>` the stylish one the boss races; `&autopilot=1`
  races the boss with it), and `?contestTime=<ms>` makes the boss's time beatable;
- `?touch=1` shows the touch buttons on a desktop, `?vp=292x633` lays the game out for a
  phone's screen, `?coarse=1` treats the mouse as a finger, and `?backdrop=1` shows the menus'
  backdrop alone, bright and without any menu.

The Lab is at `/lab/`. `debug.html` is a bare level viewer, the one dev page the build keeps
(left out of offline play and of search engines): `C` cycles the characters, `O` a boss's
outfits, `G` the echo looks, `V` a magnified sheet of poses. The pages of the dev server, never
published:

- `/dev/looks.html` — a boss's outfit running both ways with its effect in its world, a sheet
  of poses and its atlas; drop a painted atlas on it to see it at once, Save writes the look.
- `/dev/showcase.html` — a boss's outfit with its effect running through its world or doing any
  move of the Moves menu, "every flourish" making the effects that come now and then come
  every time; `#manual=1` steps it from a script for pictures.
- `/dev/art.html` — the promotional pictures drawn with the game's renderers, the bosses in the
  middle of their tricks with every flourish of their effects: the README's banner and Play
  button, a collage of all twelve in their worlds without the logo (`docs/`) and the link
  previews (`packages/classic/public/og-*.png`).
- `/dev/reel.html` — footage of how the bosses' records were found: a boss runs its local TAS
  record through the level among hundreds of pale attempts that went wrong, and the page
  records itself in 4K. See [TAS-REEL.md](TAS-REEL.md) (`PARAPET_FOOTAGE` in the server's
  environment sends the videos to a folder of one's own).
- `/dev/sprites.html` — a gallery of the extracted sprites.
- `/dev/loudness.html` — measures the original's music tracks and saves the levels they are
  played at (`packages/content/audio/loudness.json`).
- `/dev/live.html` — renders our scores (`packages/content/music`) as the menus and the runs
  with a boss play them, measures them and saves `packages/content/audio/live-loudness.json`.

The tools made for the videos about the game (the infographics, the offline music renderer)
are not in the repository: a dev page stays only while it makes or checks something the game
or its documentation keeps.

## The published site

The build takes two settings from the environment (the CI workflow passes them from the
repository's variables, Settings → Secrets and variables → Actions → Variables):

- `VITE_SITE_URL` (repository variable `SITE_URL`) — where the site lives, for the canonical
  link, the link previews and the structured data in the page (default
  `https://gwynerva.github.io/parapet-classic/`).
- `VITE_GOATCOUNTER` (repository variable `GOATCOUNTER`) — the site's code at
  [goatcounter.com](https://www.goatcounter.com/) (`parapet-classic`), or the address of a
  GoatCounter of our own (`https://stats.example.org`): the published site then counts visits
  and a few moments of play anonymously (`packages/classic/src/app/analytics.ts`) and its page
  lets pictures come from that host. Without it nothing is counted.

The build also writes `sitemap.xml` and `robots.txt` for `VITE_SITE_URL` (a robots file counts
only at a domain's root, on a domain of the site's own), the Lab (`lab/`), and
`r/index.html`: the game again,
one folder down, with the link preview of a challenge (`public/og-race.png`). Challenge links
open it with the replay code as the query (`r/?<code>`; chats keep a query where some drop a
fragment). Link previews are read from a page's HTML as served, so one preview serves every
challenge; search engines that run the script see each race as a page of its own (title,
description and canonical address from the replay, `src/app/racePage.ts`), and a race page
without a race asks to stay out of the index. Links are offered up to 4000 characters (a
server takes about 8 KB of address, a Telegram message 4096 characters); a longer run is sent
as a file.

Last, the build writes `sw.js`, a service worker that keeps every file the game needs (the
game's pages and the Lab, the scripts, the pictures, every music track and the name field's font; not the debug
page, the link previews or the search engines' files), so the site, once opened, plays with no
connection (`src/app/offline.ts`). Its cache is named by a hash of those files: a new build
comes on the next launch, while a page already open plays on with its own files (the build
before is kept for it). The dev server registers no worker. To try it, `npm run build`, `npm
run preview:pages`, open the site, stop the server and reload: the game, a challenge link
(`r/?<code>`) and `?app=1` still open.
