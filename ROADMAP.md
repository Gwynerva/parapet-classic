# Parapet Classic roadmap

Parapet Classic is a preservation project: the original game, playable in a browser, faithful
in every movement, with its workings documented in `reference/`. Improvements are welcome where
they make the game more comfortable to play (wide screens, phones, ghosts to race) and never
where they would change how it plays. Ideas for a new game built on these lessons live in their
own project, Parapet World, which shares no code or content with this one.

## 0. MVP (done)

- Exact port of the original movement (verified against the Java oracle and the twelve rival
  recordings).
- All twelve levels in Free run, Sprint with the original rival, and Flag hunt.
- Pixel-perfect rendering with a wider view, own bitmap fonts, `ru`/`en`, keyboard, touch and
  gamepad, local records and replays.

## 1. Finish the original (done)

Everything the original offers, with the UI redone "in the spirit" of the original rather than
pixel for pixel: the same flow (level select, mission list with goals, briefing, run, results,
records) laid out for wide screens and phones.

Done (2026-10-07): missions of all types with their rules and goals (`evaluateMission`),
warm-ups with the coach, tutorial pages and in-play hints, the Sprint flyover, unlock
progression, the Prize ending, name entry, the Moves menu, music through the built-in
synthesiser, vibration, and the adaptive UI toolkit (layout classes, message box, HTML text
input) with every screen re-flowing on resize. Not done: the original's sound-on prompt
(replaced by autoplay on the first gesture).

### Adaptive UI

One screen system for a 21:9 monitor and a phone in either orientation, switching layouts on
the fly (rotation, window resize, split screen) without restarting the current screen:

- Screens describe content, not pixels: a small layout model (stack, columns, list, card) with
  breakpoints on the logical viewport (compact portrait, compact landscape, regular) resolved
  at every resize; the game view keeps its own integer scaling.
- Pointer-first on touch (tap targets, no swipes), key/gamepad-first on desktop, both always
  available; the touch buttons and the HUD stay inside the safe area.

## 2. Static site and ghosts (done)

The game needs nothing but static hosting (GitHub Pages): an earlier leaderboard server was
retired (its last state is the `snapshot/with-server` tag). Competition comes from replays
instead:

- A replay is the run's input log plus the level, mode, versions and content hashes, encoded
  compactly (`sim/replayCodec.ts`) into a link fragment or a `.parapet-replay` file.
- Whoever opens one re-simulates it (`sim/verify.ts`): the result shown is computed on their
  device, so a replay cannot claim more than its input achieves. Replays from another
  simulation version or other level data are refused rather than replayed wrongly.
- The replay races next to the player as a ghost in a world of its own (`RunSession`), so it
  cannot change the player's run. Checkpoint splits give the gap; the results compare both runs.
- Ghosts and the original's rivals are drawn as "echoes": the atlas recoloured into a
  hologram (`runtime/render/EchoSkin.ts`, `EchoRenderer.ts`). A player's echo is their own
  character in a colour derived from their name; the story rivals are a featureless grey
  silhouette.
- Clipboard, downloads and file dialogs run inside the browser's input handler
  (`Screen.onGesture`), as Safari and iOS require.

## 3. Bosses, languages (done)

- **Contests.** Two extra races per level, Flag hunt and Sprint without the rival, against
  records found by a tool-assisted search under human limits (`packages/tools/src/tas`,
  `reference/notes/09-tas.md`). Only times and split times ship; the routes stay secret, and
  the boss shows itself only before the start and once its time is up.
- **Twelve bosses.** A character per level with its own name, texts, outfits (one at random
  every run) and little world on the character screen; won for normal play in Sprint, with its
  effect in Flag hunt.
- **Looks of any shape.** Pixel-art outfits as text over the original skeleton
  (`runtime/render/Look.ts`, `LookSheet.ts`): parts of any size with pivots, pictures per side
  of the body, gear on layers (`hips` for skirts), cloth on a damped chain blown by the
  runner's speed (`fx/Ribbon.ts`), kits to extend; `npm run look` exports an atlas to paint,
  imports it back and draws sheets, poses and line-ups.
- **Effects as data.** One particle system for every boss (`runtime/render/fx`): emitters on
  moves and tricks, afterimages, cloth, the presence by the start.
- **The theme**, written as a tracker score (`runtime/audio/Score.ts`) and played by the same
  synthesiser as the original's music.
- **Languages as folders.** One folder per language under `packages/content/i18n`, found by
  the build; `npm run i18n` checks keys, arguments and font coverage. The first launch takes
  the browser's language and keeps it.
- **Content split.** `packages/content/playman` holds the original game and what is extracted
  from it, and nothing of ours.

## 4. At home on phones (done)

- **The screen.** The viewport re-measures on every hint of a size change (ResizeObserver,
  visual viewport, pixel ratio, full screen, rotation) and once a second, and resizes at the
  start of a frame, so no black bars and no blank frame. Full screen from the first tap on touch
  screens, a corner button, F and the options; on iPhones from the Home Screen (a web app
  manifest and our own icons). The phone's Back button pauses or steps back, and leaves the
  game only when pressed twice on the main menu; the installed app has an Exit.
- **The menus.** Every screen laid out by pure, tested functions for sizes from 240×320 to
  960×540; menus centred where they stand alone; press feedback on release for everything
  tappable, drag and wheel scrolling, Tab between rows; long text that scrolls by itself
  (`TextScroller`); a touch pause button. About the game in three tabs with the credits and a
  link to the source. A level with real recorded runs behind the menus.
- **Moves.** Every move shown on a little level of grey blocks, with a run-up and a run-out
  (`packages/content/moves/demos.json`, authored with `npm run demo`, proven by tests).
- **Characters.** The rivals open with their levels; the boss contests with a level's
  missions.
- **Music.** Channel volume changes are applied as they happen (the menu pad swells again),
  the end-of-track marker chord is dropped, loops cross-fade, every change fades, the volume is
  a slider, and every track plays at the same measured loudness
  (`packages/content/audio/loudness.json`).

## 5. Found and smooth (done)

- **Smooth on big screens.** The canvas has the screen's pixels and draws in logical ones: the
  world, the runners and the parallax layers move a screen pixel at a time instead of a whole
  big pixel every few frames, while every picture stays on its own pixel grid
  (`runtime/render/View.ts`: `worldGrid`, `objectGrid`, `splitPixel`).
- **Found by search engines and chats.** A description, link previews with our own picture,
  structured data, favicons for every browser, a sitemap; a README with a banner drawn by the
  game itself (`/dev/art.html`).
- **Counted, anonymously.** Visits and a few moments of play through GoatCounter, opt-in per
  deployment: no cookies, nothing personal.
- **A looks page for artists** on the dev server (`/dev/looks.html`), and the bosses' art
  generators in the repository (`packages/tools/art`).
- **Challenges that travel well.** Links of half the length (`<site>/r/#<code>`, replay format
  2: bits, versions and content as short keys, adaptive codes for the pauses, a prefix code for
  the presses; format 1 still opens), a preview of their own (a runner racing its echo), and
  "Open replay" with a field to paste into and the challenger's card before the race.

## Next

- **Contests** re-searched with longer budgets to remove the last frame-perfect moments.

- **Offline play.** A service worker caching the build makes the site playable without a
  connection (it already installs as an app); nothing in the game needs the network.
- **Hot-seat.** The original's multiplayer (players take turns, earlier players run as
  ghosts) is now cheap: every turn is a replay and every earlier player a ghost world.
- **Readable Java reconstruction.** A deobfuscated, commented reconstruction of the original
  source, buildable against the oracle stubs so the oracle can prove it faithful. It is derived
  from the proprietary code, so it belongs in a private repository, never in this one.
- **Bring your own jar.** Should hosting the original content become impossible, the extractor
  (pure TypeScript) can run in the browser on a copy of the game the player supplies, leaving
  only our own code in the repository.

## Package layout

```
reference/          notes, Java oracle (documentation only, never a dependency)
packages/
  sim/              deterministic mechanics, replays and their verification
  runtime/          browser platform, rendering, UI toolkit (subpath imports)
  classic/          the game
  tools/            extraction from the jar, font build
  content/          playman/ (the original jar and what is extracted from it), fonts,
                    translations, the bosses (records, looks, effects, worlds, theme)
```

1. **`sim` is the only home of mechanics.** No DOM, no floats; the move table and levels are
   data. Replays carry the simulation version, ruleset id and content hashes.
2. **`runtime` is one package with internal boundaries**: platform (viewport, input, storage,
   audio, clipboard, files), render (sprites, scenes, characters, echoes, levels, camera), ui
   (fonts, i18n, screens, widgets). It knows no level or menu; `classic` composes it.
3. **Not doing**: a general-purpose engine (Phaser/Pixi) or an ECS. The original's data-driven
   state machine is the right architecture for these mechanics, and both alternatives would
   make the exact port and determinism harder.
