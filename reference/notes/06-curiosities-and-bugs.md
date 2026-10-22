# 06. Curiosities and bugs of the original

A running list of how the 2007 developers did things, and where they slipped. Append to it whenever the port turns up something new. The best of them are told, measured and animated in [`reference/findings`](../findings) (linked below).

## Clever tricks

- **PNGs assembled at runtime.** Sprites ship as raw palette indices; the game builds a PNG in memory with its own CRC-32 table, uncompressed zlib blocks (one per IDAT) and an Adler-32 in a separate IDAT, then hands it to `Image.createImage`. Cheaper on jar size than storing PNGs with headers, and it dodges per-phone PNG quirks. ([14](../findings/14-whats-in-the-jar/))
- **The character is vector art.** No sprite sheets: one object in `k0` with 463 keyframes and 19 layers of sprites (65 sprite ids; a keyframe may put any of them in any layer, which is how an arm passes behind the body and in front of it), tweened between keyframes on every frame; 67 keyframes are used by no clip. Every character but Blaise is a swap of the heads (and for the men the torso and arms) and hides the ponytail; ghosts are the same skeleton with every part replaced by an 8×8 dot. ([08](../findings/08-one-vector-runner/))
- **Backgrounds are keyframed vector scenes.** Rectangles and sprites with per-frame parameters; mission state (flag collected, tutorial pulse) is just another keyframe pair. About three quarters of the 5,855 primitives of the twelve levels are plain rectangles. ([09](../findings/09-vector-backgrounds/))
- **The whole parkour is a data table.** 135 states × 14 ints, 81 condition predicates, 22 impulse types, ~30 snap types. "Press right before touching" is implemented as _armed_ states entered when a 400/1024-of-velocity lookahead ray sees a wall, not as a timing window: on the wall run demo the ray widens the window for a wall run from 9 steps to 23. ([04](../findings/04-the-parkour-is-a-table/), [02](../findings/02-armed-not-timed/))
- **No key holding.** The engine reacts only to key-press events; a buffer `Q` keeps presses until the state changes, and buffered conditions fire only on a step with no new press. This is why the game feels "rhythmic": a monkey vault pressed anywhere in the jump starts on the landing, and any key pressed on the landing step loses it. ([01](../findings/01-keys-are-pressed-never-held/))
- **Rivals are replays.** Each level ships a recorded input stream (plus a 114-byte physics snapshot); the rival runs the same physics. No AI at all; every one of the 445 recorded presses lasts one tick. ([11](../findings/11-rivals-are-replays/))
- **Fixed-point everything.** 1024 units per tile, velocities in units per 1024 time units, 30-unit steps, integer square root, octagonal norm approximation, recurrence-built sine table. Game time is real time × 900/1024, capped at 150 per frame, so the game slows down rather than skipping on slow phones. ([06](../findings/06-fixed-point-maths/), [07](../findings/07-slow-phones-slow-down/))
- **Instant states chain.** States with duration 0 and a next state run back to back inside one step, each with its own physics pass.
- **Landing keeps only horizontal speed.** The floor response takes the previous horizontal velocity as the new tangential speed and discards the vertical part entirely; the landing grades read the vertical speed alone. ([05](../findings/05-landing-keeps-horizontal-speed/))
- **Camera look-ahead is velocity-based** with a spring and a hard ±60/80 px leash, and it is cancelled when a wall is less than 4 tiles ahead. At running speed it aims 98 px ahead and the leash stops it at 60. ([10](../findings/10-the-camera/))
- **A tiger jump on flat ground lifts the camera by almost two tiles.** The launch speed (vy = −4706, more than a plain jump's −4325) aims the camera 180 px up in a single step, far above the 1.2 tiles the body actually rises. The camera then hangs at the top while the target swings down, and it sinks for over a second after the landing, when the move folds the hands offset back into the feet (the feet drop 1248 units in one step). The remake's game camera leaves out the upward look-ahead and follows the lower of feet and hands (`Camera.original` keeps the original for the traces and the Lab): the same jump lifts it by 0.7 tile, at most 52 units a step.

## Bugs and oddities

- The crash combo penalty (`f.g`, computed in `aF`) is **never subtracted** from the score: the score never decreases. ([13](../findings/13-the-score-never-drops/))
- The jump-power regeneration timer `O` is never decreased, so the "scale jump by `O`" in z-type 0 is a no-op.
- One UP press at the start of a wall run stays buffered (state 33 keeps `Q`), so **one press yields two kicks**, but only when it starts the wall run on contact: pressed earlier it arms state 30, which has no `0x40`, and the press is spent; that wall run kicks once. ([03](../findings/03-one-press-two-kicks/))
- Checkpoint markers are written as tiles 49+i into the map at load time, overwriting whatever the two cells held. In the shipped data no stamp lands on a collision tile, but four land on birds (tile 63), which then never appear: East End Sprint checkpoint 1 (26, 9), Bird Bay Sprint checkpoint 3 (95, 9), Bird Bay Flag hunt checkpoint 5 (15, 11), West Harbour Sprint checkpoint 1 (13, 3). ([12](../findings/12-level-map-quirks/))
- A column with no floor tiles gets `killRow = 0`, so the pit check uses row 0. It happens only in the outermost columns of six levels, behind their end walls (L4 0 and 87, L5 0 and 149, L8 0 and 117, L9 149, L10 0 and 149, L11 0 and 98), where no runner goes.
- Rival recordings start about one tile away from the current mission start positions (e.g. level 0: x = 30 vs 31); the position comes from the recording's snapshot, so they still line up.
- Challenge time limits in the data are 30/20/20 s for levels 8/10/11 while the help text says 20 s for all three.
- State 32 has no exit unless condition 30 holds; parent-only states 1, 9, 10 and 55 are never entered; state 5 (stop) is reached by no transition, only by the frame loop when a rival's recording runs out.
- Condition 77 adds `q` to a position without scaling (`(k+g+q)>>10`), mixing velocity and position units.
- Rivals set the shared "move bits" and dust effects as if they were the player (lines 9253–9292).
- Decompiler artefacts to keep in mind: `c2.h == 26` appears twice at line 8669 (one is probably 25 in the original); `n5` is used uninitialised at line 8659 (treat as 0).
- Half slopes (surface types 2–5, tiles 9–12) and tiles 15, 16, 23–26 have tables but no collision code — leftovers of a richer tile set; no map uses them.
- There are no sound effects at all — the phone vibrates instead; the music is 14 MIDI files glued into one resource.
- Wall contact by the feet counts as airborne for `onSurface`.
- The original build ships a Russian `l` file with an untranslated placeholder string 141: "remember to replace this text (RLI_HELPTEXT in %GAMENAME%.lng)".

## Found while writing the extractor

- Rival recordings have no end marker in the file: the blob is the 114-byte snapshot, the total time and 5-byte `(ticks, input)` entries up to the exact end. The writer appends the last entry twice, and the reader stops at the blob length, so `totalTime == 30 * (sum of ticks - duplicated last entry)` for all 12 recordings. The -1 only ever exists in RAM (the recorder buffer is pre-filled with -1).
- The rival blobs for levels 9 and 10 are swapped inside `b0` (blobs 14 and 13); the mission table points at the right ones, so the game never notices.
- The "coach" coordinate pair of a Sprint section is actually the rival's start cell: every recording's snapshot starts there. The rival standing one tile left of the player is by design.
- Sections of mission types a level does not offer are a lone -1. Level 11's Challenge has no finish but has a coach; levels 8 and 10 have Challenge sections without a flag.
- The animation blob is a clean chain of 68 clips; 10 of them are orphans nobody references.
- Ground parent 1 carries an unreachable transition `25 -> 100` right after `FWD & 71 -> 56`, shadowed by the earlier `25 -> 99`; state 5's `78 -> 5` is shadowed the same way by its `78 -> 2`.
- Scene primitives have 3 parameters (sprite, nested) or 5 (rectangle, tiled), never 6, and every background references the shared props of `k1` across files rather than objects of its own file.
- Sprite pack `g3` (HUD and particles) is entirely 32-bit BGRA; everything else is 8-bit paletted.
- The MIDI durations stored in `i` are 0 for the prize music (which plays 87 s), 127067 ms for the menu track (which plays 43.6 s) and the same 43157 ms for all twelve in-game tracks (which play 43.6–43.7 s) — a placeholder nobody replaced.
- Decompiler artefact in the clip setter `c(int,int,int)` (line 5738): CFR shows `if ((flags & 1) != 0) g.c = true`, but the bytecode assigns `g.c = (flags & 1) != 0` unconditionally. The oracle's animation traces caught the difference (the anchor flag must clear on entering a feet-anchored move).

## Found while taking the original apart (1.0.0)

- The octagonal norm `int_f` is not even continuous: the `−40·big` correction starts where the larger part is under 16 times the smaller (3.58° off an axis), and a vector just on one side of that is measured 3.9 % longer than one just on the other. Its "circle" is 16 straight pieces with 8 steps. ([06](../findings/06-fixed-point-maths/))
- `isqrt` (`int_o`) starts at bit 2^28, so it is exact below 2^30 and returns 32767 from there on; speeds never get near it.
- The frame clock cuts each frame's game time to whole units, so the faster the screen the slower the game: 95.6 % of its own pace at 60 frames a second, 82 % at 240, and frozen above about 875. Parapet did the same with the browser's frame times until 1.0.0, which carries the fraction over (`FrameUnits`) and so keeps the original's own pace on any screen. ([07](../findings/07-slow-phones-slow-down/))
- The jump's rising state lifts the feet 160 units halfway through (snap type 12); a wall run armed before that meets the wall 160 units lower. ([02](../findings/02-armed-not-timed/))
- A tenth of the jar (`MC_KoMpOtIk.gif`, 26 KB) is a distributor's picture the code never opens. ([14](../findings/14-whats-in-the-jar/))
