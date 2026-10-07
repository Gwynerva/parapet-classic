# Glossary: obfuscated names → Parapet names

CFR names on the left (class `d` unless stated). Fill in as the port proceeds.

## Global state (class `d`)

| Original                | Ours                  | Meaning                                                   |
| ----------------------- | --------------------- | --------------------------------------------------------- |
| `var_e_arr_a[]`         | `world.runners`       | entities (rivals 0..ay−1, player ay)                      |
| `ax`                    | loop index            | entity being stepped                                      |
| `ay`                    | `playerIndex`         | index of the human player                                 |
| `var_c_arr_a[3*ax + p]` | `runner.probes[p]`    | collision probes: 0 hands, 1 body, 2 feet                 |
| `var_c_a`               | `runner.lookaheadHit` | last lookahead ray hit                                    |
| `var_int_arr_I`         | `moveTable`           | 135 × 14 state records + transition lists                 |
| `var_int_arr_J[ax]`     | `runner.moveId`       | current state                                             |
| `var_int_arr_K[ax]`     | `runner.moveTimer`    | state timer (K in the notes)                              |
| `var_int_d` (8800)      | `GRAVITY`             | gravity per 1024 time units                               |
| `var_int_arr_C/D/E/F/G` | `tables.C/D/E/F/G`    | speed-cap and slope tables                                |
| `var_int_arr_A/B/H`     | `tables.A/B/H`        | tile → B column, contact following pairs, tile flag masks |
| `var_short_arr_l`       | `level.killRows`      | per-column pit row                                        |
| `var_short_arr_m`       | `level.tiles`         | tile map                                                  |
| `bB`                    | `pressedBits`         | presses collected this frame                              |
| `cf`                    | `accumulator`         | game-time accumulator                                     |
| `cg`                    | `clock`               | game clock (ms)                                           |
| `aM`                    | `screenState`         | screen/flow state (5 = playing)                           |
| `aN`                    | `missionType`         | 0 Sprint, 1 Flags, 2 Score, 3 Challenge, 4/5 Warm-up      |
| `bD, bE`                | `camera.x/y`          | camera top-left                                           |
| `bz`                    | `flowMeter`           | combo meter 0..5120                                       |
| `int_z`                 | `missionTable`        | 12 × 28 mission data                                      |

## Entity (class `e`)

| Original                 | Ours                          | Meaning                                   |
| ------------------------ | ----------------------------- | ----------------------------------------- |
| `var_int_a`              | `subStepAcc`                  | sub-step time accumulator                 |
| `var_int_b` (`b`)        | `contactProbe`                | index of the contact probe                |
| `var_int_c`, `var_int_d` | `accelX`, `accelY`            | constant acceleration (0, gravity)        |
| `k, l`                   | `x, y`                        | feet position                             |
| `g, h`                   | `handsDx, handsDy`            | hands offset from the feet                |
| `e, f`                   | `handsDeltaX/Y`               | per-step hands offset delta (root motion) |
| `i, j`                   | `rootDeltaX/Y`                | per-step feet delta (root motion)         |
| `q, r`                   | `vx, vy`                      | velocity                                  |
| `u, v`                   | `prevVx, prevVy`              | previous velocity                         |
| `t`                      | `tangentSpeed`                | stored tangential speed                   |
| `m, n, o, p`             | `renderHandsDx/Dy, renderX/Y` | interpolated render coordinates           |
| `O, P`                   | `jumpPowerA, jumpPowerB`      | regeneration timers (0..65536)            |
| `Q`                      | `inputBuffer`                 | buffered presses since state entry        |
| `E, F`                   | `phaseTime, phaseDuration`    | time in state / phase length              |
| `K, L`                   | `impulseX, impulseY`          | pending impulse                           |
| `M, N`                   | `accX, accY`                  | acceleration applied this step            |
| `w`                      | `storedSpeed`                 | speed stored on entry (flag 0x8000)       |
| `x`                      | `snapType`                    | x-type                                    |
| `z`, `A..D`              | `impulseType`, `paramB/C/D`   | z-type and its parameters                 |
| `var_boolean_a` (`a`)    | `handsPinned`                 | hands are pinned to a point               |
| `var_boolean_b` (`b`)    | `facingRight`                 | facing                                    |
| `var_boolean_c` (`c`)    | `handsAnchored`               | anchor is the hands (flag 0x1)            |
| `var_boolean_d` (`d`)    | `facingLocked`                | facing locked (flag 0x10)                 |

## Probe (class `c`)

| Original               | Ours           | Meaning                         |
| ---------------------- | -------------- | ------------------------------- |
| `var_boolean_a`        | `hit`          | hit this step                   |
| `var_boolean_b`        | `isHands`      | static: this is the hands probe |
| `var_int_a, var_int_b` | `px, py`       | contact point                   |
| `c, d`                 | `pushX, pushY` | push-out epsilon                |
| `e, f`                 | `nx, ny`       | surface normal ×1024            |
| `g`                    | `distSq`       | squared distance to the hit     |
| `h`                    | `tile`         | tile id hit                     |
| `i, j`                 | `tx, ty`       | tile coordinates                |
| `k`                    | `surface`      | surface type (persists)         |

## Key methods

| Original                         | Ours                                                   | Line               |
| -------------------------------- | ------------------------------------------------------ | ------------------ |
| `int_m(int)`                     | `stepRunner`                                           | 7656               |
| `boolean_h(int)`                 | `updateMoveTransitions`                                | 9321               |
| `O(int)`                         | `enterMove`                                            | 9239               |
| `boolean_d(int)`                 | `conditions[id]`                                       | 3612               |
| `a(e,int,int,int)`               | `applyImpulse`                                         | 8206               |
| `a(e,int)` / `void_a(e,int,int)` | `snapOnEntry` / `applyRootMotion`                      | 7905 / 8137        |
| `boolean_a(e)`                   | `isOnSurface`                                          | 8442               |
| `c(e,int)`                       | `sweepProbes`                                          | 8457               |
| `a(c,int,int,int,int,bool×4)`    | `rayMarch`                                             | 8520               |
| `a(c,int,int,int,int,bool,bool)` | `followSurface`                                        | 8628               |
| `a(c,7 ints,bool×3)`             | `testTileShape`                                        | 8731               |
| `int_n(int)`                     | `tileRelative`                                         | 8988               |
| `boolean_a(e,int,int)`           | `lookaheadRay`                                         | 9069               |
| `int_f(int,int)` / `int_o(int)`  | `approxLength` / `isqrt`                               | 9116 / 9139        |
| `m(int,int)`                     | `loadLevel`                                            | 9588               |
| `boolean_c()`                    | `mode.checkEnd`                                        | 9477               |
| `aG()` / `aF()` / `aD()`         | `scoring.step` / `scoring.fail` / `scoring.multiplier` | 7496 / 7278 / 7457 |
| `byte_a(int)` / `a(byte)`        | `replay.nextInput` / `recorder.push`                   | 4919 / 4907        |
| `void_a(e)` / `b(int,boolean)`   | `camera.update`                                        | 9351 / 9436        |
