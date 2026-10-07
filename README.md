# Parapet Classic

A browser remake of the 2007 J2ME parkour game _Playman Extreme Running_, made to keep the game
playable and to document how it works. The movement is reproduced exactly (verified step by
step against the original class files); the code is rewritten cleanly as a readable reference
for this kind of game. The whole game is a static site: no server, no accounts, nothing loaded
from anywhere but its own origin.

**Play:** https://gwynerva.github.io/parapet-classic/

What plays: the twelve levels with their missions as the original defines them (warm-ups with
the coach, Sprint against the rival, Flag hunt, Score run, the Challenges with their required
moves), unlock progression and the Prize ending, the Moves menu, the original music through a
built-in synthesiser, plus our own Free run and local records with replays. The UI follows the
original's flow and graphics but re-flows for wide screens, tablets and phones in either
orientation.

## Racing ghosts

Every record keeps its input log, so any run can come back as a ghost: an "echo" of the runner
re-simulated next to you on the same level and mode. It can never affect your run (it lives in
a world of its own), and the gap shows at every checkpoint.

- **Your record.** "Record ghost" in the mission list races the echo of your own best run.
- **Challenge links.** After a run, "Copy challenge link" puts the run into a link
  (`…/#r=<code>`, about a kilobyte for a minute of play). Whoever opens it races your echo
  straight away; their browser re-runs your input to get your time, so a link cannot claim a
  result the run did not achieve.
- **Replay files.** "Save replay file" downloads the same run as a `.parapet-replay` file; open
  one from the menu, drop it onto the window, or paste a link with Ctrl+V.

## The original and its rights holders

_Playman Extreme Running_ (2007) was made by Mr.Goodliving and published by RealNetworks. The
original game file in `packages/content-classic/original/`, the graphics, levels, music, texts
and move data extracted from it belong to their rights holders. Parapet Classic is a
non-commercial fan project, not affiliated with or endorsed by them. If you hold rights to the
game and want something removed, please open an issue.

## Layout

- `packages/sim` — deterministic integer simulation (no DOM): moves, collisions, rules, mission
  evaluation, replays (`replayCodec`) and their re-simulation (`verify`).
- `packages/runtime` — browser runtime: viewport, fonts, i18n, input, renderers (including the
  echo holograms), camera, mission flow, message boxes, audio, storage, clipboard and files.
- `packages/classic` — the game (Vite + TypeScript + Canvas 2D).
- `packages/tools` — extracts sprites, levels, move tables, music and more from the original jar
  into `packages/content-classic`; builds the bitmap fonts.
- `packages/content-classic` — data of the original game (generated) plus fonts, translations
  and skins.
- `reference/` — everything learned about the original game: formats, physics, flow, menus,
  curiosities and bugs, plus a headless Java oracle that runs the original class files and
  produces the reference traces.

## Getting started

```bash
npm install
npm run extract        # decode the original jar into packages/content-classic/generated
npm run dev            # http://localhost:5173
npm run check          # prettier, typecheck, tests
npm run build          # packages/classic/dist, a static site
npm run preview:pages  # serve the build under /parapet-classic/ like GitHub Pages
```

Requires Node 24+. Pushes to `main` that pass the checks are published to GitHub Pages by the
CI workflow.

## Development

- `npm run build-font` rebuilds the bitmap fonts from the bundled TTFs.
- `npm run decompile` reproduces the decompiled source under `reference/decompiled/` (Docker or
  a local JDK).
- `reference/oracle` runs the original class files headlessly and writes the golden traces the
  simulation, animator and camera tests compare against.
- Development shortcuts of the client (dev server only): `?level=N&mode=M` jumps into a run,
  `?replay=/dev/l0-flags.json` plays a recorded input log, `?touch=1` shows the touch buttons.
  `debug.html` is a bare level viewer (`G` cycles the echo looks).
