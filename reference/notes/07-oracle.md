# 07. The Java oracle (reference/oracle)

A headless harness that runs the original, obfuscated class files on a plain JVM against stub
implementations of the J2ME APIs, drives the physics step by step with scripted input and dumps
the entity state after every step. The traces live in `packages/sim/test/golden/` and are
compared bit for bit by `packages/sim/test/golden.test.ts`.

## Running

```bash
node reference/oracle/run.mjs --build                      # compile stubs + driver
node reference/oracle/run.mjs <level> <missionType> <script.txt> <out.jsonl>   # the golden set is kept as .jsonl.gz
node reference/oracle/run.mjs --golden                     # regenerate every trace in packages/sim/test/golden
```

`run.mjs` uses a local JDK (JAVA_HOME, PATH or the Windows vendor directories) and falls back to
Docker `eclipse-temurin:17-jdk`. Both paths produce byte-identical traces. `build.ps1` is the
Windows-only variant.

Script format: `# level: N`, `# mission: T` headers, then one `ticks keys` line per block —
run `ticks` steps and press `keys` on the first step only. Keys: `U D L R` (resolved to the
original bits with the player's current facing, like `boolean_f` at d.java 5173), `F`/`B` for
literal forward/back, or a raw number.

## How the init works

The game is static state in class `d`. The driver reproduces the subset of the real flow that
is needed, by reflection on the real obfuscated names (CFR's `var_<type>_<name>` / `<ret>_<name>`
renames are undone by matching name + descriptor):

1. `Class.forName("d")` (static initialiser needs `Font.getFont`, `Image[]`, the `a` PlayerListener), then `new d()` stored into the static instance field `d.a:Ld;` because resources load through `getClass().getResourceAsStream`. The game thread is never created. The "loading UI" flag `d.f:Z` must stay false, otherwise every loader busy-waits for `paint()`.
2. `l()` (config `i`), `g()` (timing), `j()` (options; RecordStore missing → defaults), `e(0)` (sound bank), `y()`, `bf()` (sine table `short_arr_a(10,true)`, particles), `j(0)` (strings), `c(0)` (sprite sheet g0 → `Image.createImage` on the PNGs the game assembles). This is `v()` without enabling the loading UI.
3. From the menu entry `at()` (line 7216): `g(0, 26437)` loads `k0`, `af()` loads the animation blob and `g[10]` (mandatory: `O(int)` calls the clip setter), `z = a(2, 16906, 1344)` loads the mission table. `Random` is seeded with 0 (only cosmetic uses).
4. Menu selection (line 6782): `ci` level, `cj` first mission of the requested type, `aN` type, `aQ/aR` from the goal word, `ck = 0` single player, `bn = level/3`.
5. `bg()` (line 10375) starts the level: loaders, `m(ci, aN)` = loadLevel, tables, entities (`aJ`), score structs, camera, recorder buffers, `cf = cg = 0`, bird particles, `void_h(aN, ck)`, and `Y()` (rival recording, `ay = 1`) for Sprint.
6. `ad()` until the screen state `aM == 5` (once for types 1–5, twice for Sprint because of the flyover). `x(5)` resets entities and score and starts the recorder header.

Per step (the player part of `boolean_d`, line 10473): `bB = bits`; `a(byte)` recorder; `cg += 30`; `m(30)` physics; `c()` end check (ends the trace); else `z(30720)` animation, `aG()` scoring, `q(30)` particles, `bB = 0`, camera.

Differences from a phone: no real time (`var_int_v` stays 0, so the warm-up hint boxes never pause the game), audio/vibration/lights/drawing are no-ops, RecordStore is in memory.

## Stubs

`javax.microedition.midlet.MIDlet`, `lcdui.{Display, Displayable, Canvas, Font, Graphics, Image}`, `lcdui.game.GameCanvas`, `media.{Manager, Player (interface), PlayerListener, Control}`, `media.control.VolumeControl (interface)`, `rms.RecordStore` (+ exceptions), `com.nokia.mid.ui.{DirectUtils, DirectGraphics (interface), DeviceControl}`, `com.nokia.mid.sound.Sound`. `Image.createImage(byte[],int,int)` validates the PNG signature and reads the IHDR size; fonts report height 12 and width 6 per character. Player, VolumeControl and DirectGraphics are called with `invokeinterface`, so they must be interfaces.

## Trace schema (schema 4)

Schema 2 added `rivals` (stepped rivals with the same fields as the player plus `input`),
schema 3 added `anim` (the fields of the animation state class `g`: a..n, ba, bb, bc) and `draw`
(x, y, flip, blend, s, s2, t — the values `aj()` computes before drawing), schema 4 added `cam`
(bD/bE position, bF/bG target, bH/bI spring velocity, flyover state U/bJ/bK/bL). These drive
`packages/runtime/test/animator.test.ts` and `camera.test.ts`, which match the original on
every step of every trace (the camera on the original 240×320 viewport).

### Schema 1 fields

Line 1: `{"meta":{"schema":1,"game","level","missionType","missionIndex","script","steps","stepUnits":30,"mapW","mapH","startX","startY","finishX","finishY","gravity":8800,"playerIndex","screenState":5}}`.

Then one object per step, step 0 being the state after loading: `step, input, key, move (J), timer (K), k, l, g, h, q, r, u, v, t, O, P, Q, E, F, K, L, M, N, w, x, z, a, b, c, d` (the entity fields with their original names; `b` is the facing boolean), `contact` (contact probe index), `probes` (3 × `{hit, k, tile, x, y}`, hands/body/feet), `score, mult, meter, clock, flags (bM), ended`.

## Observations from the first traces (level 0, warm-up 1)

- Idle run: state 0 → 2 on the first step, one gravity tick before the floor contact, then vx 1000, 2000, 2698, 2948 … reaching the flat-floor cap 3400 at about step 55; the run impulse B = 1000 fires every 3–4 steps and is scaled by the F table.
- Jump: launch q 3630, r −4325 (−4068 after the same step's gravity), apex about 1.12 tiles above the floor, 18 → 12 after 600 units, floor reached while still in 12 → straight back to 2; landing keeps only the horizontal speed.
- Roll: speed (3010 + 2750) / 2 = 2880 held for 850 units, 20 points on exit.
- Turn: fast turn (state 8) for 390 units, facing flips on exit, the wall bounce (state 40) pushes back at 2450.
- Tiger jump: hands rotate for 190 units, launch r = −4706 with +400 horizontal, +100 points, hands landing through states 58 → 60 → 2.

## Known caveats

- Static state: one JVM process is one run.
- The driver writes `\n` explicitly (no CRLF on Windows); `run.mjs` avoids `shell: true` and Git-Bash style `JAVA_HOME` paths.

## Coverage (26 traces: 6 scripted, 20 seeded-random with wait ranges 1..4, 2..13 and 6..40)

Player and rival move ids seen at step boundaries cover 92 of the 135 states. Of the 43 unseen:

- 1, 9, 10, 55 are parent-only and are never entered.
- 0 (run start) only follows the crash chain 80 -> 0 and is the load state of every trace.
- Duration-0 states with a next state chain inside one step and never appear at a step boundary, although their entry effects run: 29, 42, 43, 46, 57, 59, 65, 66, 68, 70, 71, 74, 78, 81, 83, 84, 87, 95, 100, 101, 103-106, 108, 113, 118, 128, 132.
- Timed states genuinely not reached by the scripts: 24 (soft landing after a tall drop), 52/54 (wall-flip landing), 69 (monkey flip), 99/107 (ground ledge and post grabs), 114 (hang idle variant), 121 (ladder-top hop), 134 (bar reverse). Hand-written scripts for these are the next step if ever needed.

Init detail found while generating challenge traces: ending a mission goes through the results screen, which reads the high-score records that only the menu entry `at()` allocates; the driver now calls the real `at()`. A Challenge ends on `aR > 0 && aR - cg <= 0` without setting the time-up flag `var_boolean_H`; the results screen repeats the test to pick the "Time up" text.
