# reference/oracle — the original game as a physics oracle

A headless harness that runs the **original, unmodified** class files of Playman Extreme Running
(`packages/content-classic/original/Playman_Extreme_Running_240x320.jar`, classes `S a b c d e f g`, class-file version 45) on a
plain JVM. The J2ME / Nokia APIs the game needs are replaced by the stubs in `stubs/`; the driver
`src/Oracle.java` initialises the game through reflection, loads a level, and then drives the
physics step directly with scripted presses, writing one JSON object per step. The resulting
traces in `packages/sim/test/golden/` are the golden tests for the TypeScript simulation.

Nothing in `build/` is committed; it is recreated from the jar and the sources here.

## Running

```
node reference/oracle/run.mjs --golden                           # re-run every golden script -> packages/sim/test/golden/*.jsonl.gz
node reference/oracle/run.mjs <level> <missionType> <script.txt> <out.jsonl>
node reference/oracle/run.mjs <script.txt> <out.jsonl>           # level/mission from "# level:" / "# mission:" lines
node reference/oracle/run.mjs --random <seed> <steps> <level> <missionType> <out.jsonl> [minWait maxWait]
node reference/oracle/run.mjs --build                            # compile only
```

`--golden` runs the hand-written scripts in `packages/sim/test/golden/scripts/*.txt` and the generated
ones stored next to their traces (`packages/sim/test/golden/*.txt`); each produces `<name>.jsonl`, stored gzipped as `<name>.jsonl.gz` (the tests inflate them).

`--random` writes a pseudo-random script to `<out>.txt` (next to the trace) and runs it. The
generator is a 32-bit LCG `s = (s * 1664525 + 1013904223) mod 2^32` seeded with `seed`; it repeats
"advance, key = `UDRL`[floor(s / 2^32 · 4)], press it for one step; advance, wait
minWait + floor(s / 2^32 · (maxWait − minWait + 1)) idle steps" until `steps` steps are scheduled
(the last wait is clamped). The default wait range is 2..13 (`2 + floor(rnd · 12)`); the golden set
also uses 6..40 (sparse presses, long chains play out) and 1..4 (button mashing).

`run.mjs` looks for a JDK in `JAVA_HOME`, on `PATH` and (on Windows) under the usual vendor
directories; without one it runs everything in Docker with `eclipse-temurin:17-jdk`. On Windows
`build.ps1` does the same with a local JDK only (`.\build.ps1 0 4 script.txt out.jsonl`).

Steps performed: extract the jar into `build/classes`, compile `stubs/` into `build/stubs`,
compile the driver into `build/oracle`, then
`java -cp build/classes;build/stubs;build/oracle Oracle <level> <missionType> <script> <out>`.

One process is one run: the game's state is all static, so the driver never re-initialises.

## Input scripts

A text file, one entry per line: `<ticks> <keys>`. The entry runs `ticks` physics steps and presses
`keys` on the **first** of them only (the original only has press events; holding does nothing).
`#` starts a comment; `# level: N` and `# mission: N` are read by `run.mjs` when the level is not
given on the command line.

| keys            | press byte (`bB`)                                                      |
| --------------- | ---------------------------------------------------------------------- |
| `-`             | 0                                                                      |
| `U`             | 1 (UP)                                                                 |
| `D`             | 2 (DOWN)                                                               |
| `R`             | `4 \| (facingRight ? 16 : 32)` — FWD when facing right, BACK otherwise |
| `L`             | `8 \| (facingRight ? 32 : 16)`                                         |
| `F`, `B`        | literal 16 FWD / 32 BACK                                               |
| `0x..`, decimal | raw byte                                                               |

Letters can be combined (`UR`). `L`/`R` are resolved with the player's facing (`e.b`) at the moment
of the press, exactly like `boolean_f(int)` (decompiled line 5173) does for the phone keys.

Example (`l0-jump.txt`): run 20 steps, jump, 100 more steps:

```
# level: 0
# mission: 4
20 -
1 U
100 -
```

## Output: JSON lines

Line 1 is the metadata object; every following line is the state **after** one step (`step` 0 is
the state right after loading, before any step). All numbers are the game's `int` values.

```json
{
  "meta": {
    "schema": 4,
    "game": "...",
    "level": 0,
    "missionType": 4,
    "missionIndex": 0,
    "script": "l0-jump.txt",
    "steps": 121,
    "stepUnits": 30,
    "mapW": 80,
    "mapH": 17,
    "startX": 3,
    "startY": 8,
    "finishX": 2,
    "finishY": 8,
    "gravity": 8800,
    "playerIndex": 0,
    "rivalStartDelay": 0,
    "screenState": 5
  }
}
```

`playerIndex` is `ay`: 0 except in Sprint, where the rival occupies entity 0 and the player is 1.
`rivalStartDelay` is `aG` (`z[level*28+7]`, ms of game clock before the rival starts moving).

Per step:

| field              | source (original name) | meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `step`             | —                      | number of steps executed so far                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `input`, `key`     | `bB`                   | press byte consumed by this step and the script key it came from                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `move`, `timer`    | `J[ay]`, `K[ay]`       | current state id and its timer (`-2` = expired)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `k`, `l`           | `e.k`, `e.l`           | feet position (tile = 1024)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `g`, `h`           | `e.g`, `e.h`           | hands offset from the feet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `q`, `r`           | `e.q`, `e.r`           | velocity (units per 1024 time units; a step is 30)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `u`, `v`           | `e.u`, `e.v`           | velocity at the start of the step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `t`                | `e.t`                  | stored tangential speed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `O`, `P`           | `e.O`, `e.P`           | jump-power regeneration timers (max 65536)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `Q`                | `e.Q`                  | buffered presses since state entry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `E`, `F`           | `e.E`, `e.F`           | time in the current phase, phase duration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `K`, `L`, `M`, `N` | `e.K`..                | pending impulse and acceleration applied this step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `w`                | `e.w`                  | speed stored on state entry (flag 0x8000)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `x`, `z`           | `e.x`, `e.z`           | x-type (snap/root motion) and z-type (impulse) of the current state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `a`, `b`, `c`, `d` | `e.a`.. (booleans)     | hands pinned, facing right, hands anchored, facing locked                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `contact`          | `e.b` (int)            | index of the contact probe (0 hands, 1 body, 2 feet)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `probes[i]`        | `c[3*ay+i]`            | `hit` (`c.a`: hit this step), `k` (`c.k`: surface type, persists), `tile` (`c.h`), `x`, `y` (`c.a`, `c.b` contact point) — order: hands, body, feet                                                                                                                                                                                                                                                                                                                                                                                                               |
| `anim`             | `g[ay]` (class `g`)    | animation state after `z(30720)`: ints `a`..`n` and booleans `ba`, `bb`, `bc` (= `a:Z`, `b:Z`, `c:Z`), see the table below                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `draw`             | `aj()`                 | the draw parameters `aj()` (line 5886) computes: `x`, `y` render position (world units; hands offset added when hands-anchored; tweened towards `anim.h/i` while blending across an anchor change), `flip` (facing as drawn, with the 0x1000 rule; the game passes `flip ? 0 : 4`), `blend` (`anim.f != -1` and the state has no 0x20), `s` / `s2` (previous / current keyframe id from blob 17: `h[f % e + g]`, `h[b % a + c]`; `null` where the game would throw), `t` (`blend ? j << 8 : -1`)                                                                  |
| `score`, `mult`    | `f[ay].a`, `f[ay].b`   | score and current multiplier                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `meter`            | `bz`                   | flow meter 0..5120                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `clock`            | `cg`                   | game clock (+30 per step)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `flags`            | `bM`                   | uncollected flag/checkpoint bits (-1 = all present)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `ended`            | `boolean_c()`          | the mission ended during this step; the trace stops here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `endReason`        | `aM`, `var_boolean_H`  | only on the ended line: `finished`, `time-up`, `warm-up-complete`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `cam`              | camera statics         | after the player's `a(e)` + `b(30720, true)`: `x`, `y` = `bD`, `bE` camera top-left (world units, clamped to the map); `tx`, `ty` = `bF`, `bG` target (not clamped by `k()`); `vx`, `vy` = `bH`, `bI` spring velocity; `U` = `var_boolean_U` flyover mode; `bJ`, `bK`, `bL` flyover leg, progress, leg length. At step 0: as left by `bg()` → `k(k−3840, l−5120)` and the screen flow (warm-ups: the briefing text box calls `Z()`, which points the target at the coach, `l(bV−512, bW−8704)`; Sprint: `aP()`/`Q(1)` flyover state, cleared by `a(e)` on step 1) |
| `rivals`           | entities `0..ay-1`     | one object per rival (empty outside Sprint): `input` (the byte `byte_a` returned, `-1` once the recording is exhausted, `null` on steps where the rival was not stepped because `cg < aG`) followed by the same per-entity fields as the player (`move` … `probes`, `anim`, `draw`)                                                                                                                                                                                                                                                                               |

Field letters are the original obfuscated member names (see `reference/notes/glossary.md`), so a
JSON key `b` is the boolean `e.b` (facing) and the int `e.b` is exposed as `contact`.

Schema 2 differs from schema 1 only by `meta.rivalStartDelay`, `rivals` and `endReason`; schema 3
adds `anim` and `draw` to the player line and to every rival object; schema 4 adds `cam` to the
player line.

Camera (`k(II)V` line 9370 initialises `bD = bF = x`, `bE = bG = y`, `bH = bI = 0`, `U = false` and
clamps `bD`/`bE` to `0..(bP<<10)−7680` / `≤ (bQ<<10)−10240`; `a(Le;)V` line 9351 (follow) clears `U`
and sets the target through `l(II)V` from the render position `o`/`p`, the velocity lookahead
`q·3840/4143`, `r·5120/4143` (zeroed horizontally when a wall is ahead) and a height-dependent
vertical offset; `b(IZ)V` line 9436 moves the spring: `bH = clamp(bH + (bF−bD)·200>>16, ±((bF−bD)>>3)·n>>15)`,
`bI` likewise with 240 and half the limit, `bD += bH`, `bE += bI`, then (with `true`) clamps the
camera to ±1920 / ±2560 around the player and to the map. In flyover mode (`U`, Sprint screen state 4:
`aP()` → `Q(I)V` per checkpoint leg) `b()` eases `bD`/`bE` from the leg start to the next checkpoint
by `bK`/`bL` instead; the oracle never runs the flyover, so `U` is already false on the first step.

Class `g` fields (CFR name → class-file name → meaning; set by the clip setter `c(III)V` line 5702,
advanced by `z(I)V` line 5786, consumed by `aj()`):

| JSON     | class file   | CFR             | meaning                                                                                |
| -------- | ------------ | --------------- | -------------------------------------------------------------------------------------- |
| `a`      | `a:I`        | `var_int_a`     | frame count of the current clip (`var_short_arr_h[clip]`)                              |
| `b`      | `b:I`        | `var_int_b`     | current frame index                                                                    |
| `c`      | `c:I`        | `var_int_c`     | first keyframe index of the current clip in blob 17 (`clip + 1`)                       |
| `d`      | `d:I`        | `d`             | playback mode (state table field [7])                                                  |
| `e`      | `e:I`        | `e`             | frame count of the previous clip (blend source)                                        |
| `f`      | `f:I`        | `f`             | previous frame index; −1 = no blend source                                             |
| `g`      | `g:I`        | `g`             | first keyframe index of the previous clip                                              |
| `ba`     | `a:Z`        | `var_boolean_a` | facing the clip was set for, stored inverted (`!facingRight` at set time)              |
| `h`, `i` | `h:I`, `i:I` | `h`, `i`        | anchor snapshot (render position, plus hands offset when hands-anchored) for the tween |
| `j`      | `j:I`        | `j`             | blend/tween progress 0..255                                                            |
| `bb`     | `b:Z`        | `var_boolean_b` | previous hands-anchored flag                                                           |
| `bc`     | `c:Z`        | `var_boolean_c` | current hands-anchored flag                                                            |
| `k`      | `k:I`        | `k`             | clip time accumulator (time units)                                                     |
| `l`      | `l:I`        | `l`             | clip duration (the state timer at entry)                                               |
| `m`, `n` | `m:I`, `n:I` | `m`, `n`        | emote id and the game clock at which it expires                                        |

## What the driver does

Everything is reached by reflection on the real member names and descriptors (CFR's names such as
`var_int_arr_J` are just `J:[I` in the class file; overloads by return type are resolved by
matching the return type, e.g. `c()Z` vs `c()V`).

Initialisation (the equivalent of `run()` → `l()`, `v()`, the menu's `at()` and the level start
`bg()`; the oracle note in `reference/notes/` has the full account):

1. `new d()` (public no-arg constructor) and store it in `d.a:Ld;` so `getResourceAsStream` works.
   The game thread is never created or started. `d.f:Z` (loading UI) stays `false`, otherwise the
   progress callbacks would spin waiting for a paint.
2. `l()` config file `i`; `g()` timing; `j()` options (RecordStore absent → defaults); `e(0)`
   sound bank; `y()`; `bf()`; `j(0)` strings; `c(0)` sprite sheet g0 (through `Image.createImage`).
3. The menu entry `at()` as the game runs it: `g(0, 26437)` background k0, `G()` names, `af()`
   animation state, the mission table `z = a(2, 16906, 1344, null)`, the high-score records `bc()`
   (needed by the results screen `x(7)` when a mission ends on the time limit or the finish), music
   and unlock flags. `Random` is seeded beforehand (cosmetics only).
4. Menu selection: `ci` level, `cj` mission index (the mission whose nibble in `z[level*28+3]`
   equals the requested type), `aN` type, `aQ`/`aR` goal, `ck = 0` (single player), `bn = level/3`.
5. `bg()`: level strings/sprites/sounds, `m(ci, aN)` loads the tile map, the state table `I`,
   tables `A..H`, entities and probes, scoring, recorder, particles, camera, then `void_h(aN, ck)`
   puts the screen state machine at 0 and `ad()` advances to 1/2/3.
6. `ad()` until `aM == 5`: `x(5)` resets the entities (`ac()`), starts the music and zeroes the clock.

Each scripted step repeats one step of the frame loop `boolean_d()` (line 10473). Rivals
(entities `0..ay-1`, only in Sprint) go first, with `ax = n`: nothing while `cg < aG` (start delay,
single player); otherwise `bB = a(I)B` (`byte_a`, the next recorded press), and when that returns
`-1` with the rival not in state 5, `O(5)` plus the z-type re-init
`a(e, I[5*14+2..5], p(5))` exactly as lines 10500–10503 do; then `m(30)`, `z(30720)`, `q(30)`,
`bB = 0` — no scoring, no end check, no camera. Then the player (`ax = ay`): `bB = press;
a((byte)bB)` (recorder); `cg += 30` (so rivals see the pre-increment clock); `m(30)` (physics);
`c()` (mission end / checkpoints); then `z(30720)` (animation), `aG()` (scoring), `q(30)`
(particles), `bB = 0` and the camera (`a(e)`, `b(30720, true)`). The rival's recording header
(`W()`, read during `x(5)` → `ac()` → `X()`) sets its initial state, so a rival can start in a
state other than 0.

Differences from the phone: there is no real time, so the hint boxes that pause the game after a
bonk in the warm-ups never block stepping (`var_int_v` stays 0); sound, vibration, backlight and
drawing are no-ops; RecordStore data lives in memory for the duration of the process.

## Stubs

`stubs/` holds just enough of MIDP 2.0 and the Nokia UI API for the constant pool of the three
classes that reference them: `MIDlet`, `Display`, `Displayable`, `Canvas`, `game.GameCanvas`,
`Font` (height 12, 6 px per character), `Graphics` (no-ops), `Image` (`createImage(byte[],int,int)`
parses width/height from the PNG IHDR the game assembles in memory), `media.Manager/Player/
PlayerListener/Control/control.VolumeControl` (a silent dummy player), `rms.RecordStore` (in-memory,
"not found" at start-up), `com.nokia.mid.ui.DirectUtils/DirectGraphics/DeviceControl` and
`com.nokia.mid.sound.Sound`. `Player`, `VolumeControl`, `Control`, `PlayerListener` and
`DirectGraphics` must be interfaces (the game uses `invokeinterface`).
