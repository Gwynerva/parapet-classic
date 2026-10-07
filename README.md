# Parapet

A browser remake of the 2007 J2ME parkour game _Playman Extreme Running_, with the original
movement mechanics reproduced exactly (verified step by step against the original class files)
and a clean, data-driven codebase built for extension: skins, levels, new moves, fair
leaderboards and, later, multiplayer in one big city (see `ROADMAP.md`).

What plays today: the twelve levels with their missions as the original defines them
(warm-ups with the coach, Sprint against the rival ghost, Flag hunt, Score run, the
Challenges with their required moves), unlock progression and the Prize ending, the Moves
menu, the original music through a built-in synthesiser, plus our own Free run, local records
with replays and public leaderboards under a claimed name. The UI follows the original's flow
and graphics but re-flows for wide screens, tablets and phones in either orientation.

- `packages/sim` — deterministic integer simulation core (no DOM): moves, collisions, rules,
  mission evaluation, content hashes. Shared by the client and the server.
- `packages/runtime` — browser runtime shared by the games: viewport, fonts, i18n, input,
  renderers, camera, mission flow, message boxes, audio, storage, API client.
- `packages/classic` — the faithful port of the original game (Vite + TypeScript + Canvas 2D).
- `packages/server` — replay verification, claimed names and bounded leaderboards.
- `packages/protocol` — types and validators shared between client and server.
- `packages/tools` — extracts sprites, levels, move tables, music and more from the original
  jar into `packages/content-classic`; builds the bitmap fonts.
- `packages/content-classic` — data of the original game (generated) plus fonts, translations
  and skins.
- `reference/` — everything learned about the original game: formats, physics, flow, menus,
  curiosities and bugs, plus a headless Java oracle that produces the reference traces.

## Getting started

```bash
npm install
npm run extract      # decode the original jar into packages/content-classic/generated
npm run dev          # client on http://localhost:5173
npm run server       # API on http://localhost:8787 (the client proxies /api to it)
npm run check        # prettier, typecheck, tests
npm run deploy       # build and ship to the test server (see deploy/README.md)
```

Requires Node 24+. The original jar lives in `packages/content-classic/original/`.

The game loads nothing from outside its own origin: fonts, data and music are bundled, and
the only network calls go to its own server. Publishing a run needs a public name claimed in
Options (the server hands out a token for the device and a recovery code); local records never
leave the device. See `packages/server/README.md` for the trust model.

## Development

- `npm run build-font` rebuilds the bitmap fonts from the bundled TTFs.
- `npm run decompile` reproduces the decompiled source under `reference/decompiled/` (Docker or
  a local JDK).
- `reference/oracle` runs the original class files headlessly and writes the golden traces the
  simulation, animator and camera tests compare against.
- Development shortcuts of the client (dev server only): `?level=N&mode=M` jumps into a run,
  `?replay=/dev/l0-flags.json` plays a recorded input log, `?touch=1` shows the touch buttons.
