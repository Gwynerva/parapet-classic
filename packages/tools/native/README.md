# Native simulation

A bit-exact C port of the per-step simulation as the optimal-run search sees it
(`packages/tools/src/optimal/engine.ts`): `stepRunner` with everything it calls (conditions,
root motion, impulses, ray march, tile shapes) and `MissionRules.check` for Sprint (type 0) and
Flag hunt (type 1). Scoring and events are left out, as the search runs with `score = null` and
ignores events.

`sim_expand(data, row, out, press, finished, steps)` returns exactly what
`Engine.expand(row, 0, out, 0, succ)` returns with the default 16 presses: the same successor
rows, byte for byte, in the same order, with the same `press` index and `finished` flag.

It builds with gcc (`build.sh`; MinGW on Windows) and is not part of CI: `src/optimal/nativeDiff.ts`
is its test, run by hand.

| File        | What                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `sim.h`     | API: `sim_load`, `sim_load_file`, `sim_start`, `sim_canon`, `sim_expand` |
| `sim.c`     | the port                                                                 |
| `simtest.c` | driver: `diff` (compare with the TS engine) and `bench`                  |
| `build.sh`  | builds `build/simtest` with gcc                                          |

## Row layout contract

A state is `SIM_STATE_INTS` = 93 int32 values, exactly `writeState` / `readState` in
`engine.ts`:

| Index | Field                                                                                                                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–18  | x, y, handsDx, handsDy, handsDeltaX, handsDeltaY, rootDeltaX, rootDeltaY, vx, vy, tangentSpeed, renderHandsDx, renderHandsDy, renderX, renderY, subStepAcc, contactProbe, accelX, accelY |
| 19    | flags: 1 handsPinned, 2 facingRight, 4 handsAnchored, 8 facingLocked                                                                                                                     |
| 20–42 | snapType, snapY, impulseType, paramA–D, phaseTime, phaseDuration, scratchG–J, impulseX, impulseY, accX, accY, jumpPowerA, jumpPowerB, inputBuffer, storedSpeed, moveId, moveTimer        |
| 43    | 0                                                                                                                                                                                        |
| 44–91 | four probes of 12 (hands, body, feet, lookahead): 0, px, py, pushX, pushY, nx, ny, 0, tile, tx, ty, surface                                                                              |
| 92    | the rules' `remainingMask` (flags left and next checkpoint follow from it)                                                                                                               |

Successor rows are canonical (`inputBuffer` masked with the move's `liveBuffer` bits), as
`Engine.expand` writes them. If `STATE_INTS` or the layout changes in `engine.ts`, change
`sim.c` (`readState`, `writeState`, `ROW_*`) and bump the blob version in both places.

## Data

The C side never reads the game's JSON. `src/optimal/exportNative.ts` builds a TS `Engine` for a
level and mode and writes what it holds as one little-endian int32 blob: the tile map
(checkpoints stamped, birds removed), `killRows`, the finish and flag count, the physics tables,
the sine table, the move table (durations, next, impulse parameters, flags, snap types, parents,
transitions with their conditions), the `liveBuffer` masks and the start row. The format is
described at the top of `exportNative.ts`.

```sh
node packages/tools/src/optimal/exportNative.ts 3 sprint packages/tools/native/build/data-3-sprint.bin
```

`sim_load` checks the data once against what the port assumes. The TS reads several tables
without bounds checks, and an out-of-range read there would be `undefined`. The checks cover
surfaces 0–17, the table sizes, move indices and the press masks.

## Build, test, benchmark

```sh
bash packages/tools/native/build.sh             # -> packages/tools/native/build/simtest(.exe)
node packages/tools/src/optimal/nativeDiff.ts   # all levels, both modes, 100k expansions each
node packages/tools/src/optimal/nativeDiff.ts --per 20000 --bench 1.5   # plus the benchmark
```

`nativeDiff.ts` builds the driver and exports the blobs into `build/`. For every level and mode
it then random-walks the TS engine and records every expansion into a cases file. The walks
come in four kinds: free walks from the start or from rows kept from deep in earlier walks;
replays and branches of the local TAS runs in `packages/tools/tas-out`, when they exist; and
short walks from fuzzed rows (off the map, fast falls, odd timers). `simtest diff` then expands
the same rows and compares every successor row, press and finished flag. Options: `--per N`,
`--levels 0,3`, `--modes flags`, `--seed S`, `--bench SECONDS`.

`simtest bench data.bin cases.bin [seconds]` times `sim_expand` over a cases file's input rows.
`--bench` runs it and the TS `Engine.expand` on the same rows, level by level. Its "steps" are
TS-equivalent steps, one per press group.

## Arithmetic

The TS computes with doubles and truncates only where it says so. The port holds every value in
an `int64_t`, which holds exactly what the double holds (all integers here are far below 2^53),
and spells the truncations out:

- `(a / b) | 0` becomes `tdiv(a, b)`: truncation toward zero, then ToInt32. Division by zero
  gives 0, since `Infinity | 0` and `NaN | 0` are both 0.
- `a >> n` becomes `shr`, which takes ToInt32 first; `a << n` becomes `shl`, which wraps; `a & m`
  takes ToInt32 first.
- A value is cut to int32 again only when a row is written (an `Int32Array` store).

Behaviour that had to be mirrored on purpose:

- `killRows[renderX >> 10]` outside the map is `undefined` in TS, and `undefined << 10` is 0. A
  runner off the side of the map gets kill row 0.
- Short-circuit order: `hands.hit = !handsPinned && rayMarch(...)` skips the march, along with
  its side effects on the probe. Conditions run in table order and stop at the first false one,
  which decides which input conditions are read (the step context's `inputReads` mask).
- `tileRelative` bounds-checks with `col > width` (not `>=`). `tileAt` then returns -1 anyway.
- Sprint and flag hunt rules only. `flagsLeft` comes from the mask, as in `Engine.load`.

## Speed

Three things make an expansion cheaper than 16 steps, and none of them changes a result:

1. The part of the step before the transition check (sweep, collision response, jump power)
   never reads the presses or the input buffer. It runs once per expansion; only the rest runs
   once per press group. The TS ORs the press into the buffer first; nothing reads the buffer
   before the transitions, so the port does it there.
2. The first transition check of every group starts from the same state. Its `tileRelative`
   results, its condition results (except input conditions 6–13 and the lookahead rays) and its
   first lookahead ray (result and probe) are shared across the groups. So is the list of
   transitions known to fail there without side effects.
3. Grouping presses uses per-condition press bit masks instead of re-testing every press.

`SimData` is read-only after loading, and all per-expansion state lives on the stack, so threads
can share one `SimData`.

Measured on a Ryzen 5 5600X (one thread, gcc 16 -O2 -march=native), on the last 20k cases of
each level and mode, while another job kept the machine busy: about 1.7 million expansions/s
and 4.1 million TS-equivalent steps/s. The TS engine on the same rows managed about 190 000
expansions/s and 445 000 steps/s, so the port is about 9x faster (8–11x per level). With the
machine quieter, the C side reached 2.6–2.9 million expansions/s.
