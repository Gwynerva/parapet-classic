# The optimal-run tools

Scripts for two questions about a contest: is there a run no player and no machine can beat,
and what does the original's physics do when nothing holds the presses back? The first is the
search for the perfect run (exact breadth-first searches with merged states, beam and segment
searches, free polish); the second is the glitch hunt (Go-Explore with any chord on any step,
watching for what a parkour game should not do). What they found is told in
[`reference/notes/10-optimal.md`](../../../../reference/notes/10-optimal.md); this page is
about running them.

All of them simulate without human limits: any subset of UP, DOWN, FORWARD and BACK on any
step, unlike the TAS search in `../tas/`, which plays like a person (one key at a time, a gap
between presses). `engine.ts` is the simulation as these searches see it: a state is a flat row
of ints, a step is the world's step without scoring or events, and `expand` finds every
distinct successor of a state while simulating only the presses the step can tell apart.

## Prerequisites

- The extracted game data: `npm run extract` (from the repository root) fills
  `packages/content/playman/extracted`.
- A record to start from, for the scripts that take one: `packages/tools/tas-out/<level>-<mode>.json`
  (level 0 to 11, mode `flags` or `sprint`). `npm run tas -- run --level <level> --mode <mode>`
  searches one; or copy a published one from `docs/tas-records/<nn>-<name>-<mode>.json`
  (there the number is the level plus one: `01-mill-brook-flags.json` is `0-flags.json`).
  `tas-out` is git-ignored.
- For `nativeDiff.ts`, gcc and the native build in [`../../native`](../../native/README.md).

Every usage line below runs from `packages/tools`:

```sh
cd packages/tools
node src/optimal/explore.ts 0 flags 12
```

The scripts take a level (0 to 11) and a mode (`flags` or `sprint`) first, unless the table
says otherwise; the ones with defaults fall back to level 0 in flags. A bad level or mode
stops the script with a usage line (`common.ts`). The full command line of each script is in
the comment at the top of its file.

## The scripts

| Script                  | What it does                                                                                                                                                                                               | Writes under `tas-out/`                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `airspots.ts`           | Along a record, where the air run is easiest: the spots whose tiger jump and UP windows are widest.                                                                                                        |                                        |
| `beam.ts`               | Frame-by-frame beam search from the start, states merged exactly, pruned by the admissible bound and ranked by the guide; not a proof.                                                                     | `optimal/<level>-<mode>-beam.json`     |
| `chain.ts`              | Segment-exact search along the whole run: each segment between flags searched exhaustively from every state that reached the previous flag within `delta` steps, cut by the hunt's envelope.               | `optimal/<level>-<mode>-chain.json`    |
| `common.ts`             | What the scripts share: `readArgs` (the level and mode), `readRecord` (the record file), `resultPath` and `writeResult` (`tas-out/<folder>/<name>.json`).                                                  |                                        |
| `diversity.ts`          | How much of a layer's width is real: the distinct physical situations next to the distinct full states, step by step.                                                                                      |                                        |
| `engine.ts`             | The simulation as a search sees it: state rows (`writeState`, `readState`, the row offsets `X`, `Y`, `VX`, `MOVE`, `MASK` and the rest), `liveBuffer`, and `Engine.expand` with its grouping of presses.   |                                        |
| `explore.ts`            | Measures the problem: breadth-first by steps with exact merging and no bound, printing the width of every step.                                                                                            |                                        |
| `exportNative.ts`       | Writes the data blob the C port loads (one level in one mode); `<level> <mode> <out.bin>`.                                                                                                                 | the path given                         |
| `goal.ts`               | One segment of a record searched by a free Go-Explore from the record's state at its previous flag, for the earliest arrival at the next one.                                                              | `goal/<level>-<mode>-seg<n>.json`      |
| `guide.ts`              | A guide for ranking states (not a bound): Dijkstra over tile cells with rough speeds, the best order through the flags left, and the `SOLID` tile set.                                                     |                                        |
| `hunt.ts`               | Glitch hunt: Go-Explore over cells with any chord on any step, watching every step for jumps, walls entered, the pit, flicker, frozen states and speed over the cap; keeps the first example of each kind. | `hunt/<level>-<mode>.json`             |
| `hunt2.ts`              | The hunt's second round: move transitions no stored record makes, height gained in the air, the body inside solid tiles, the top speed, every air-run launch flown to its landing.                         | `hunt2/<level>-<mode>.json`            |
| `layer.ts`              | A search layer: the distinct states of one step in one buffer, merged by full-row comparison (never on a hash alone).                                                                                      |                                        |
| `nativeDiff.ts`         | Differential test and benchmark of the C port against the TS engine over random walks on every level and mode; options `--per`, `--levels`, `--modes`, `--seed`, `--bench`.                                | `../native/build/` (blobs, cases)      |
| `oracle.ts`             | Checks a route on the original game: runs the original classes on the JVM (`reference/oracle`) and compares move, position and speed on every step; `<level> <mode> <kind/move or file.json>`.             | `oracle/<name>.txt`, `.jsonl`          |
| `orders.ts`             | Every flag order of a level ranked by the guide, next to the order the record takes; `[level]`, all levels without one.                                                                                    |                                        |
| `polish.ts`             | Free polish: frame-level hill climbing on a run (the record, the beam's or the best so far), every step tried as every chord, presses moved or dropped.                                                    | `optimal/<level>-<mode>.json`          |
| `recipe.ts`             | A human recipe for a glitch: the shortest run under a player's limits that makes it happen, its needless presses dropped and each press's window measured; `<glitch> <level> <mode>`.                      | `recipes/<glitch>-<level>-<mode>.json` |
| `route.ts`              | Routes of the free search as text (`step:LETTERS`, letters U D F B) and their playback on a plain `World`.                                                                                                 |                                        |
| `seg2.ts`               | One segment searched exhaustively from the record's own state at its previous flag, cut by the hunt's envelope: is anything faster than the record's segment? `<level> <mode> <segment>`.                  |                                        |
| `segment.ts`            | The checkpoint-to-checkpoint idea measured: exact search from the start to the first flag, pruning by a given speed; prints the layer widths.                                                              |                                        |
| `show.ts`               | Replays a hunt finding (`kind/move`) or any route file and prints its last steps: move, position, speed, facing, flags taken.                                                                              |                                        |
| `toRoute.ts`            | Turns a recipe into a route the emulator plays (U D L R instead of U D F B); `<recipe.json> <out.json>`.                                                                                                   | the path given                         |
| `trace.ts`              | Prints a record's progress every 50 steps: position, flags left, the bound's distance.                                                                                                                     |                                        |
| `../tas/orderSearch.ts` | The TAS search in a forced flag order under the bosses' human limits, then polished, so an order can be compared with the record's on equal terms; `<level> <order, e.g. 10243>`.                          | `orders/<level>-<order>.json`          |

`chain.ts` and `seg2.ts` read the hunt's file for the level (`hunt/<level>-<mode>.json`): its
measured windows are the envelope that cuts their searches, so run `hunt.ts` first. `show.ts`
and `oracle.ts` look findings up in the same file.

## From a glitch to the phone

1. `node src/optimal/hunt.ts <level> <mode>` finds it, with the presses that reproduce it from
   the start (any chord on any step, so not what a thumb can do).
2. `node src/optimal/recipe.ts <glitch> <level> <mode>` finds the shortest run under a player's
   limits that makes it happen and measures how precise each press has to be:
   `recipes/<glitch>-<level>-<mode>.json`.
3. `node src/optimal/toRoute.ts tas-out/recipes/<glitch>-<level>-<mode>.json <out.json>` turns
   the recipe's keys into the arrows a phone takes.
4. The emulator's `route` command plays that file on the original jar, step for step
   ([`reference/emulator/README.md`](../../../../reference/emulator/README.md)); `oracle.ts`
   checks a route against the original classes without the phone.
