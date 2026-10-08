# @parapet/classic

The faithful port of Playman Extreme Running as a Vite app: the original's twelve levels,
missions (warm-ups with the coach, Sprint with the rival ghost, Flag hunt, Score run,
Challenges), unlock progression, the Prize ending, the Moves menu and the music, plus our
own Free run and races against ghosts: your record, or anyone's run shared as a link or file.

- `src/main.ts` boots the runtime (viewport, fonts, dictionaries, content, music) and the
  screen stack.
- `src/app/screens/` are the screens of the original's flow: title, character, level and
  mission select, play (`PlayScreen` drives `MissionFlow`), results, records and their
  actions, options, moves, about, prize, and the manual-copy box for challenge links.
- `src/app/ui/` holds the HUD, the ghost labels and edge arrows (`GhostOverlay`) and the
  sprite ids of the menu graphics.
- `src/app/ghosts.ts` checks incoming replays, re-runs them and starts ghost races and the
  boss contests; it also sends runs out as challenge links and replay files.
- `src/app/bosses.ts` is the bosses' data (`packages/content/bosses`): their records per level
  and mode, outfits, effects and worlds, which character number each version is (with its
  effect, or plain) and what a player has won. On the level a boss is `ui/BossPresence.ts`; on
  the character screen it runs through its world in `ui/CharacterStage.ts`.
- `src/i18n/locales.ts` finds the languages (`packages/content/i18n/<code>/`) at build time.
- `src/assets/content.ts` loads the generated content through the `@playman` alias.

Development shortcuts (dev server only): `?level=N&mode=M` jumps into a run (`M` is one of
`free`, `sprint`, `flags`, `score`, `challenge`, `warmup1`, `warmup2`; add `&rival=1` for the
ghost), `?replay=/dev/l0-flags.json` plays a recorded input log, `?touch=1` shows the touch
buttons on a desktop, `?tas=<level>-<mode>` plays the boss's local run from
`packages/tools/tas-out` (`&autopilot=1` races it with it, counting as the player's run) and
`?contestTime=<ms>` replaces its time; `?vp=WxH` fixes the logical size (a phone's layout on a
desktop) and `?coarse=1` treats the mouse as a finger. `debug.html` is a bare-bones level
viewer: `C` cycles the characters, `O` a boss's outfits, `G` the echo looks, `V` a magnified
sheet of poses. `/dev/looks.html` shows a boss's outfit running both ways with its effect, its
poses and its atlas, takes a painted atlas dropped on it and saves the look;
`/dev/art.html` draws the promotional pictures (the README's banner and Play button, the link
preview); `/dev/sprites.html?ids=141-150&scale=4` shows extracted sprites magnified and
`/dev/loudness.html` measures the music tracks on the synthesiser (its Save writes
`packages/content/audio/loudness.json`). The helpers in `dev/` are served by a dev-server
middleware (`vite.config.ts`), which also takes their saves, and never reach the build.

- `src/app/platform.ts`: full screen (the first tap on touch screens, the corner button, F,
  the options), the Back guard (`runtime/platform/HistoryGuard.ts`), the installed app's
  Exit, toasts. `public/` holds the web app manifest and the icons (`npm run icons`).
- `src/app/layouts.ts`: the screens' arrangements as pure functions, tested over a matrix of
  screen sizes (`test/layouts.test.ts`); `src/app/ui/ScreenFrame.ts` the shared heading and back
  button; `src/app/ui/MenuBackdrop.ts` the level behind the menus; `src/app/ui/MoveStage.ts`
  the Moves menu's demos; `src/app/characters.ts` which characters are open.

The page loads nothing from outside its own origin (see the CSP in `index.html`) and talks to
no server: the build is a static site. The one exception is opt-in for a deployment: with
`VITE_GOATCOUNTER` set at build time (docs/DEVELOPMENT.md), `src/app/analytics.ts` counts a
visit and a few moments of play with a 1×1 picture from goatcounter.com, which the build adds
to the CSP; no cookies, nothing personal, nothing under Do Not Track. `index.html` carries the
page's description, link previews (`public/og-image.png`), structured data and favicons; the
site's address in them comes from `VITE_SITE_URL`. Ghost races (`src/app/ghosts.ts`) take
their replays from challenge links (`#r=<code>`), replay files, drops and pastes, or the local
records.
