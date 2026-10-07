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

## Next

- **Offline play.** A service worker caching the build makes the site installable and playable
  without a connection; nothing in the game needs the network.
- **Shorter links.** The replay format has a version byte; a deflated variant
  (`CompressionStream`) would roughly halve the links of long runs.
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
  content-classic/  data extracted from the original jar, fonts, translations, skins
```

1. **`sim` is the only home of mechanics.** No DOM, no floats; the move table and levels are
   data. Replays carry the simulation version, ruleset id and content hashes.
2. **`runtime` is one package with internal boundaries**: platform (viewport, input, storage,
   audio, clipboard, files), render (sprites, scenes, characters, echoes, levels, camera), ui
   (fonts, i18n, screens, widgets). It knows no level or menu; `classic` composes it.
3. **Not doing**: a general-purpose engine (Phaser/Pixi) or an ECS. The original's data-driven
   state machine is the right architecture for these mechanics, and both alternatives would
   make the exact port and determinism harder.
