# @parapet/classic

The faithful port of Playman Extreme Running as a Vite app: the original's twelve levels,
missions (warm-ups with the coach, Sprint with the rival ghost, Flag hunt, Score run,
Challenges), unlock progression, the Prize ending, the Moves menu and the music, plus our
own Free run and the public leaderboards.

- `src/main.ts` boots the runtime (viewport, fonts, dictionaries, content, music) and the
  screen stack.
- `src/app/screens/` are the screens of the original's flow: title, character, level and
  mission select, play (`PlayScreen` drives `MissionFlow`), results, records, options,
  identity, moves, about, prize.
- `src/app/ui/` holds the HUD and the sprite ids of the menu graphics.
- `src/assets/content.ts` loads the generated content through the `@content` alias.

Development shortcuts (dev server only): `?level=N&mode=M` jumps into a run (`M` is one of
`free`, `sprint`, `flags`, `score`, `challenge`, `warmup1`, `warmup2`; add `&rival=1` for the
ghost), `?replay=/dev/l0-flags.json` plays a recorded input log, `?touch=1` shows the touch
buttons on a desktop. `debug.html` is a bare-bones level viewer.

The page loads nothing from outside its own origin (see the CSP in `index.html`); the API
calls go to `/api`, proxied to `@parapet/server` in development.
