# 06. Curiosities and bugs of the original

A running list of how the 2007 developers did things, and where they slipped. Append to it whenever the port turns up something new.

## Clever tricks

- **PNGs assembled at runtime.** Sprites ship as raw palette indices; the game builds a PNG in memory with its own CRC-32 table, uncompressed zlib blocks (one per IDAT) and an Adler-32 in a separate IDAT, then hands it to `Image.createImage`. Cheaper on jar size than storing PNGs with headers, and it dodges per-phone PNG quirks.
- **The character is vector art.** No sprite sheets: one object in `k0` with 463 keyframes and 19 body-part sprites, tweened between keyframes on every frame. Changing a character's sex is a swap of sprite ids; ghosts are the same skeleton with every part replaced by an 8×8 dot.
- **Backgrounds are keyframed vector scenes.** Rectangles and sprites with per-frame parameters; mission state (flag collected, tutorial pulse) is just another keyframe pair.
- **The whole parkour is a data table.** 135 states × 14 ints, 81 condition predicates, 22 impulse types, ~30 snap types. "Press right before touching" is implemented as _armed_ states entered when a 400/1024-of-velocity lookahead ray sees a wall, not as a timing window.
- **No key holding.** The engine reacts only to key-press events; a buffer `Q` keeps presses until the state changes, and buffered conditions fire only on a step with no new press. This is why the game feels "rhythmic".
- **Rivals are replays.** Each level ships a recorded input stream (plus a 114-byte physics snapshot); the rival runs the same physics. No AI at all.
- **Fixed-point everything.** 1024 units per tile, velocities in units per 1024 time units, 30-unit steps, integer square root, octagonal norm approximation, recurrence-built sine table. Game time is real time × 900/1024, capped at 150 per frame, so the game slows down rather than skipping on slow phones.
- **Instant states chain.** States with duration 0 and a next state run back to back inside one step, each with its own physics pass.
- **Landing keeps only horizontal speed.** The floor response takes the previous horizontal velocity as the new tangential speed and discards the vertical part entirely.
- **Camera look-ahead is velocity-based** with a spring and a hard ±60/80 px leash, and it is cancelled when a wall is less than 4 tiles ahead.

## Bugs and oddities

- The crash combo penalty (`f.g`, computed in `aF`) is **never subtracted** from the score: the score never decreases.
- The jump-power regeneration timer `O` is never decreased, so the "scale jump by `O`" in z-type 0 is a no-op.
- One UP press at the start of a wall run stays buffered (state 33 keeps `Q`), so **one press yields two kicks**.
- Checkpoint markers are written as tiles 49+i into the map at load time, **overwriting any collision tile** in those cells.
- A column with no floor tiles gets `killRow = 0`, so the pit check uses row 0 (possible edge cases on L8, columns 0 and 117).
- Rival recordings start about one tile away from the current mission start positions (e.g. level 0: x = 30 vs 31); the position comes from the recording's snapshot, so they still line up.
- Challenge time limits in the data are 30/20/20 s for levels 8/10/11 while the help text says 20 s for all three.
- State 32 has no exit unless condition 30 holds; parent-only states 1, 9, 10 and 55 are never entered.
- Condition 77 adds `q` to a position without scaling (`(k+g+q)>>10`), mixing velocity and position units.
- Rivals set the shared "move bits" and dust effects as if they were the player (lines 9253–9292).
- Decompiler artefacts to keep in mind: `c2.h == 26` appears twice at line 8669 (one is probably 25 in the original); `n5` is used uninitialised at line 8659 (treat as 0).
- Half slopes (surface types 2–5, tiles 9–12) and tiles 15, 16, 23–26 have tables but no collision code — leftovers of a richer tile set.
- There are no sound effects at all — the phone vibrates instead; the music is 14 MIDI files glued into one resource.
- Wall contact by the feet counts as airborne for `onSurface`.
- The original build ships a Russian `l` file with an untranslated placeholder string 141: "remember to replace this text (RLI_HELPTEXT in %GAMENAME%.lng)".

## Found while writing the extractor

- Rival recordings have no end marker in the file: the blob is the 114-byte snapshot, the total time and 5-byte `(ticks, input)` entries up to the exact end. The writer appends the last entry twice, and the reader stops at the blob length, so `totalTime == 30 * (sum of ticks - duplicated last entry)` for all 12 recordings. The -1 only ever exists in RAM (the recorder buffer is pre-filled with -1).
- The rival blobs for levels 9 and 10 are swapped inside `b0` (blobs 14 and 13); the mission table points at the right ones, so the game never notices.
- The "coach" coordinate pair of a Sprint section is actually the rival's start cell: every recording's snapshot starts there. The rival standing one tile left of the player is by design.
- Sections of mission types a level does not offer are a lone -1. Level 11's Challenge has no finish but has a coach; levels 8 and 10 have Challenge sections without a flag.
- The animation blob is a clean chain of 68 clips; 10 of them are orphans nobody references.
- Ground parent 1 carries an unreachable transition `25 -> 100` right after `FWD & 71 -> 56`, shadowed by the earlier `25 -> 99`.
- Scene primitives have 3 parameters (sprite, nested) or 5 (rectangle, tiled), never 6, and every background references the shared props of `k1` across files rather than objects of its own file.
- Sprite pack `g3` (HUD and particles) is entirely 32-bit BGRA; everything else is 8-bit paletted.
- The MIDI durations stored in `i` are 0 for the splash jingle, 127067 ms for the menu track and the same 43157 ms for all twelve in-game tracks — a placeholder nobody replaced.
- Decompiler artefact in the clip setter `c(int,int,int)` (line 5738): CFR shows `if ((flags & 1) != 0) g.c = true`, but the bytecode assigns `g.c = (flags & 1) != 0` unconditionally. The oracle's animation traces caught the difference (the anchor flag must clear on entering a feet-anchored move).
