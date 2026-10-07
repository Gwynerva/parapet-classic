# Parapet roadmap

Ideas and plans beyond the MVP, roughly in the order they build on each other. Nothing here is
scheduled; the point is to keep the architecture honest about where it is going.

## 0. MVP (done)

- Exact port of the original movement (done, verified against the Java oracle and the twelve
  rival recordings).
- All twelve levels in Free run, Sprint with the original rival ghost, and Flag hunt.
- Pixel-perfect rendering with a wider view, own bitmap fonts, `ru`/`en`, keyboard, touch and
  gamepad, local records and replays.
- Server skeleton that verifies replays and keeps a leaderboard.

## Package layering (near-term restructuring)

The code base is meant to end up as layers with one-directional dependencies. Reviewed against
current practice (headless simulation, data-driven content, monorepo with few focused packages,
enforced boundaries), the target layout is:

```
reference/               notes, Java oracle, readable Java reconstruction  (documentation only)
packages/
  schemas/               data formats: types + validators (levels, moves, scenes, skins, fonts, i18n)
  sim/                   deterministic mechanics; registries for conditions/impulses; versioned rulesets
  protocol/              client <-> server messages for REST and realtime
  net/                   lockstep input relay, step numbering, snapshots, interpolation buffers
  runtime/               browser platform, rendering and UI toolkit (subpath exports:
                         runtime/platform, runtime/render, runtime/ui, runtime/audio)
  classic/               the faithful port of the original game (app)
  world/                 Parapet World, the open city (app, later)
  server/                api (leaderboards, replay verification) + realtime (rooms), storage adapters
  tools/                 extraction, font build, content validation, editor CLI
  content-classic/       data extracted from the original jar (isolated, can be made private)
  content-world/         our own content (later)
```

Rules and reasoning:

1. **`reference/java` is documentation, not a dependency.** A deobfuscated reconstruction of the
   original with real names and comments, buildable against the oracle stubs so it cannot rot;
   the oracle runs it next to the original class files and identical traces prove it faithful.
   Like the jar, the extracted assets and the decompiled source, it is proprietary material:
   keep all of it in places that can be excluded or moved to a private repository. The games
   must build with placeholder content.
2. **`sim` stays the only home of mechanics.** No DOM, no floats, no assumptions about one level,
   one player or a menu. Conditions and impulse types become registries so that `world` can add
   behaviour without forking the original table, which is registered as the "classic" ruleset.
   Replays reference a ruleset id and content hashes (level, move table) so leaderboards stay
   honest when content changes; `SIM_VERSION` alone is not enough once there is an editor.
3. **`schemas` is the single source of truth for data formats.** Consumed by sim, runtime, tools,
   the server and the future editor; loaders validate at the boundary. `sim` and `runtime`
   depend on schemas, never on a specific content package.
4. **`runtime` is one package with enforced internal boundaries**, not a dozen micro-packages
   and not a monolith: platform (viewport, input, storage, audio), render (sprites, scenes,
   characters, levels, camera), ui (fonts, i18n, screens, widgets). Shared screens such as
   results and leaderboards live in ui; apps compose them.
5. **`net` sits between sim and transport.** Deterministic sync logic (lockstep with a fixed
   input delay, step-stamped presses, late-join snapshots, interest filtering) is shared by the
   client and the server; WebSocket handling is transport and lives in the apps and the server.
6. **The server is modular from the start**: an api module (REST, verification, leaderboards), a
   realtime module (rooms, relay, authoritative results) and storage adapters (JSON file today,
   SQLite/Postgres later). Identity starts as anonymous device ids; accounts are a later layer.
7. **Boundaries are checked by tooling**, not convention: dependency-cruiser (or ESLint boundary
   rules) in CI, plus typecheck, tests and formatting on every push.
8. **Not doing**: a general-purpose engine (Phaser/Pixi) or an ECS. The original's data-driven
   state machine is the right architecture for these mechanics, and both alternatives would make
   the exact port and determinism harder.

Status: `sim`, `protocol`, `runtime`, `classic`, `server`, `tools` and `content-classic` exist in
this layout; `schemas`, `net`, `world` and `content-world` are still to come. The ruleset id and
content hashes in replays are not implemented yet.

## 1. Finish the original (in progress)

Everything the original offers, with the UI redone "in the spirit" of the original rather than
pixel for pixel: the same flow (level select, mission list with goals, briefing, run, results,
records) laid out for wide screens and phones. Every piece is written as a reusable part for
Parapet World (see "One big world"), not as a one-off for the classic app.

- Missions as the original defines them per level: warm-ups with the coach and the tutorial
  arrows (Mill Brook), Challenges with their per-level conditions, Score runs with a target,
  Sprint win/lose against the rival's time, unlock progression over the 45 missions, the Prize
  ending, level briefings and the Moves menu with animated demos.
- Music: the original MIDI through a bundled software synthesiser (no external soundfont
  downloads), with the original rotation per theme. Vibration on fails where supported.
- Hot-seat multiplayer only if it costs nothing once ghosts of local replays exist.

Status (2026-10-07): done — missions of all types with their rules and goals (`evaluateMission`),
warm-ups with the coach, tutorial pages and in-play hints, the Sprint flyover, unlock
progression, the Prize ending, name entry, the Moves menu, music through the built-in
synthesiser, vibration; the adaptive UI toolkit (layout classes, message box, HTML text input)
with every screen re-flowing on resize; public leaderboards with claimed names, rate limits,
plausibility flags and bounded storage. Not done: hot-seat multiplayer, the original's
sound-on prompt (replaced by autoplay on the first gesture), the ruleset registries and the
`schemas` / `net` / `world` packages of the layering plan.

### Adaptive UI

One screen system for a 21:9 monitor and a phone in either orientation, switching layouts on
the fly (rotation, window resize, split screen) without restarting the current screen:

- Screens describe content, not pixels: a small layout model (stack, columns, list, card) with
  breakpoints on the logical viewport (compact portrait, compact landscape, regular) resolved
  at every resize; the game view keeps its own integer scaling.
- Pointer-first on touch (tap targets, no swipes), key/gamepad-first on desktop, both always
  available; the touch buttons and the HUD stay inside the safe area.
- Shared widgets live in `runtime/ui` (menu, list, dialog, results table, leaderboard) so the
  classic app and Parapet World compose the same parts.

### Public leaderboards

Beyond the device-local records: publish a verified run under a chosen name.

- Identity without accounts: a name is claimed once per device with a random secret
  (name + token); the server rejects a taken name and the token proves ownership of later
  submissions. Accounts can come later as a layer on top.
- Verification first: the server re-simulates every input log (it already does) and derives
  the result itself; the client's claim is never trusted. A replay carries the sim version, a
  ruleset id and content hashes; mismatches are rejected rather than ranked.
- Spam and cheat limits: per-token and per-IP submission rate limits, input-log sanity checks
  (press rate, run length, step count against the claimed time), a floor on plausible times
  per level derived from the verified bests, and a review flag on outliers.
- Bounded storage: a board keeps the top N per (level, mode) plus every player's personal best;
  everything else is dropped on insert, so data grows with the number of players, never with
  traffic. Input logs are small (a few bytes per press) and keep replays watchable.

## New modes beyond the original

- **Max score.** A time-limited run on tracks built for it (loops and arenas with a mix of
  obstacles) where the goal is the highest score rather than the finish line. The original
  scoring already rewards flow through the meter and the multiplier; this mode adds a reason to
  vary the moves: repeating the same trick in a row pays less each time, chaining distinct
  tricks restores or raises the bonus, so the best lines alternate vaults, flips, wall runs and
  pole tricks instead of spamming one jump. Candidate rules: a per-move decay counter that
  resets after a few other moves, a "variety" multiplier on top of the flow meter, and a bonus
  for using every move family within the limit. Leaderboard by score, replay-verified like the
  rest. The extension lives in the ruleset as data (score types plus a decay table), so the
  classic ruleset stays untouched.

- **Procedural arenas (endless mastery).** A mode where the level is generated from a seed, so
  no route can be memorised, only the moves themselves. It fits the architecture as it is: the
  simulation takes a tile map as data, a generator only has to emit tiles plus start,
  checkpoints and finish, and determinism makes seed + generator version + input log a
  verifiable replay, so seeded boards work on the existing server.
  - Generation from a library of hand-authored or mined "chunks" (slices of the original levels
    between checkpoints, tagged by the move families they require and by their entry/exit
    ports: height, approach speed), stitched under constraints; the simulator doubles as a
    solver (a search over the move table proves that a route exists and grades it).
  - Daily and weekly seeds: everyone runs the same arena for a day, with its own leaderboard;
    seeds are shareable codes.
  - Drills: the generator biased toward the move family a player fails most (from replay
    stats), a "wall-flip gym" that gets harder as the success rate climbs.
  - Endless format: chunks are appended ahead and dropped behind while running, score by
    distance and flow, difficulty rising with distance.
  - Roguelike runs: a sequence of arenas with a budget of fails, a choice of the next chunk
    type at forks, modifiers (mirrored arena, fog, time scale) applied per segment.
  - Remixes of the original: recombine the twelve levels' segments into new routes.
  - In Parapet World: the outskirts of the city regenerate weekly, infinite towers, event
    gates whose route is generated at start.
  - Tooling: the same generator assists the level editor (fill a region, propose a route);
    the mined chunk library is a style guide for human designers.

## Monetization and analytics (opt-in integrations)

The game core stays isolated from external services (no CDN, no third-party scripts in the
runtime). Monetization and analytics are explicit, opt-in app-level integrations with their own
CSP entries, configured per deployment and disabled by default:

- **Analytics (gtag / GA4 or a privacy-friendly alternative).** A thin `analytics` adapter in the
  apps with a handful of events (run started/finished, mode, level, result) and consent handling;
  the gtag script is loaded only when enabled, and the CSP is widened for that origin only.
- **Banners under the game.** The page layout reserves an optional ad slot below or beside the
  canvas (never over the play area); the viewport rules already handle a smaller available
  height. Slots are filled by a pluggable provider (AdSense or a self-served image + link).
- **In-game advertising as level dressing.** The original already has billboards (the "Playman"
  signs are scene sprites). Ads become a content feature: billboard objects in the scene data
  whose sprite/texture comes from an "ad campaign" manifest, self-served from the game's own
  server (so the isolation rule still holds), with placements curated per level or per district
  of the open world. Environment objects (posters, shop fronts, rooftop signs) can carry the
  same mechanism. Impressions are counted by the client when a billboard is on screen.
- Fairness first: nothing bought or shown may change the simulation.

## 2. Content pipeline and editor

- Level editor in the browser: paint tiles from the catalogue, place start/finish/checkpoints,
  pick a background theme, test-run instantly (the simulation already takes levels as JSON).
- Skins as data: a manifest that swaps body-part sprites; a tool that imports sprite sheets.
- Custom level sharing through the server (levels are small JSON documents; replays reference a
  level hash so leaderboards stay honest per level version).

## 3. One big world ("the city")

The idea: instead of picking levels from a menu, every player runs around one huge, connected
map and physically reaches the start gate of a run to activate it. Zones differ in difficulty
(low rooftops near the start, cranes and towers further out), other players are visible all the
time, and races start when someone touches a gate.

Why the current architecture already supports it:

- A level is a tile map; the world is just a very large one. The only engine work is a
  chunked map (load/unload tiles and background art per chunk) and a camera that never clamps.
- The simulation is deterministic and runs N runners with independent input streams. Runners do
  not collide with each other in parkour, so showing other players needs no physics between them.
- One step of one runner costs a few hundred integer operations; a server core can simulate
  hundreds of runners thirty times per second. Network traffic is presses only: a few bytes per
  press, nothing per step while running straight.
- Fairness stays replay-based: the server receives inputs, not positions, and can re-simulate
  any run it wants to put on a leaderboard.

Building blocks, in order:

1. **Chunked world map** with regions ("zones") that carry metadata: name, difficulty, theme,
   background art, music. The twelve original levels become districts stitched together with
   connecting rooftops.
2. **Gates.** A run is a trigger tile at a start line plus its checkpoints/finish. Touching the
   gate starts a timer for that player; the run ends at the finish or when the player leaves the
   route corridor. Several players can be in the same run at once, each on their own timer.
3. **Rooms of dozens of players.** A room is a world instance; the server relays input events
   with step numbers (lockstep with a small fixed delay, no rollback needed because runners
   never interact). Late joiners receive a snapshot of every runner (`RunnerState` is plain
   numbers) and start stepping from there.
4. **Interest management.** Clients only need runners within a few screens; the server filters
   by zone/chunk and the client extrapolates briefly when a packet is late.
5. **Authoritative results.** Run results are computed by the server from the relayed inputs,
   so leaderboards and live races share one source of truth.

Directions this opens up:

- **Live races at gates.** Standing at a gate starts a countdown; everyone there starts together
  and sees each other for the whole route. Smaller gates for duels, big ones for events.
- **Ghost lines everywhere.** The best replay of every run is always available as a translucent
  ghost you can follow to learn the route — the original's rival mechanic turned into a learning
  tool. Friends' ghosts, your own previous best, the world record.
- **Zone progression without menus.** Harder zones are reachable only by routes that require
  the advanced moves (wall flips, pole spins), so the world itself teaches and gates the skills.
- **Territory and "street cred".** Flow meter becomes a visible stat; holding the fastest line
  on a route tags it with your name until someone beats it. Districts could be "owned" by crews.
- **Asynchronous play.** Daily and weekly routes seeded from the world (same gate, rotating
  checkpoints), with replay verification so there is no need for everyone to be online together.
- **Spectating and replay theatre.** Any run on a leaderboard can be watched in the world at
  its real location, with a free camera; live spectating of races from the rooftops.
- **Co-op and relay formats.** Relay races where each runner covers one segment, tag/chase modes
  where catching means matching a line within a few frames, "follow the leader" trick chains.
- **Cosmetics tied to exploration.** Hidden flags and hard-to-reach spots unlock skins; the
  skin system is data-only so cosmetics never touch the simulation.
- **Dynamic world dressing.** Time of day and weather in the background layers (purely visual),
  seasonal districts, events that temporarily open new gates.
- **In-world building.** The level editor as a build mode inside the city: players design routes
  in a sandbox district, submit them, and verified community routes get real gates.
- **Mechanics experiments in isolated districts.** New tiles or moves can be introduced in a
  test zone without touching the proven original set; the move table is data, so an experimental
  district can even run its own table.

Things to keep in mind:

- Keep the original move table untouched in the main districts; the fidelity is the product.
- Interpolation between steps is per-runner; with many visible runners the client needs one
  animator per runner (cheap) and sprite batching is unnecessary at this scale.
- The 30 ms step and the 150-unit frame cap mean a slow device slows its own simulation; in a
  networked room the client must instead run at the server's step count and catch up, so the
  loop needs a "network-paced" mode (steps are driven by received step numbers).
- Anti-cheat beyond replay verification (input timing analysis, rate limits) only once there is
  something worth cheating for.
