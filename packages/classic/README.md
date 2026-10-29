# @parapet/classic

The faithful port of Playman Extreme Running as a Vite app: the original's twelve levels,
missions (warm-ups with the coach, Sprint against the rival, Flag hunt, Score run,
Challenges), unlock progression (a level opens once the one before is complete), the Prize
ending, the Moves menu and the original's music (with scores of our own in the menus and the
runs with a boss), plus our own Free run and races against ghosts: your record, or anyone's run shared as a link or file.

- `src/main.ts` boots the runtime (viewport, fonts, dictionaries, content, music) and the
  screen stack.
- `src/app/screens/` are the screens of the original's flow: title, character, level and
  mission select, play (`PlayScreen` drives `MissionFlow`), results, records and their
  actions, options, moves, about, prize, and the manual-copy box for challenge links.
- `src/app/ui/` holds the HUD, the ghost labels and the signs at the screen's edge
  (`GhostOverlay`) and the sprite ids of the menu graphics.
- `src/app/ghosts.ts` checks incoming replays, re-runs them and starts ghost races and the
  boss contests; it also sends runs out as challenge links and replay files.
  `screens/OpenReplayScreen.ts` takes a link or code pasted into a real text field (so the
  system's own paste works, on phones too), the clipboard or a file, and shows the challenger's card (name, level, mission,
  character, the verified time) before the race.
- `src/app/bosses.ts` is the bosses' data (`packages/content/bosses`): their records per level
  and mode, outfits, effects and worlds, which character number each version is (with its
  effect, or plain) and what a player has won. On the level a boss is `ui/BossPresence.ts`
  (where it waits: `ui/bossSpots.ts`) and its glimpses `ui/BossGlimpse.ts`; on
  the character screen it runs through its world in `ui/CharacterStage.ts` (a silhouette over
  a stand-in for the world until it is won).
- `src/i18n/locales.ts` finds the languages (`packages/content/i18n/<code>/`) at build time.
- `src/assets/content.ts` loads the generated content through the `@playman` alias.

The dev server's shortcuts (`?level=…`, `?tas=…`, `?vp=…`) and pages (`debug.html`,
`/dev/*.html`) are listed in [`docs/DEVELOPMENT.md`](../../docs/DEVELOPMENT.md). The helpers in
`dev/` are served by a dev-server middleware (`build/devEndpoints.ts`), which also takes their
saves, and never reach the build.

- `lab/index.html` and `src/lab/` are the Lab: the experiments of `packages/lab` on the game's
  own content, as cards to play with (`cards.ts`), in English and Russian (`text.ts`).

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
site's address in them comes from `VITE_SITE_URL`. Challenge links open `r/?<code>`, the same
page one folder down with a race's preview (`public/og-race.png`), which the build writes from
`index.html`; `src/app/racePage.ts` gives each race page its own title, description and
canonical address for search engines. Ghost races (`src/app/ghosts.ts`) take their replays from
challenge links (`r/?<code>`), replay files, drops and pastes, or the local records.
