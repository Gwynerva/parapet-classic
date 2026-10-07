# 05. Game modes, mission data, rivals, save data, audio

## Mission table `z[level·28 + …]` (blob 39, b2 @16906; decoded at line 6782)

| Index   | Meaning                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------- |
| 0       | name string id (97 + level: Mill Brook … Pine Island)                                                    |
| 1       | tile-map blob (27 + level)                                                                               |
| 2       | number of missions                                                                                       |
| 3       | mission types, one nibble per mission, LSB first (L0 = 0x21054 → 4, 5, 0, 1, 2; L1 = 0x210; L2 = 0x2103) |
| 4       | Score-run time limit (ms)                                                                                |
| 5       | multiplayer Sprint time limit (120000)                                                                   |
| 6       | rival recording blob (4 + level)                                                                         |
| 7       | rival start delay (ms; handicap)                                                                         |
| 8       | completed missions needed to unlock the level                                                            |
| 9, 10   | background k-file index and its length in shorts                                                         |
| 11      | background scene id = kIdx << 11                                                                         |
| 12      | rival character (skin)                                                                                   |
| 13 + 3m | per mission m: goal word; [+1] default best time; [+2] default best score                                |

Goal word: −2 → Sprint (target comes from the rival); high bit set → time limit = low 31 bits; otherwise a score target.

Mission type (nibble) → name string `121 + n`: 0 Sprint, 1 Flag hunt, 2 Score run, 3 Challenge, 4/5 Warm-up 1/2.

Mission lists: level 0: 4, 5, 0, 1, 2; levels 1, 4, 7, 9: 0, 1, 2; all others: 3, 0, 1, 2. The "12 levels + 2 warm-ups" of the menu are 12 levels; both warm-ups are missions inside L0 (Mill Brook). Unlock thresholds `z[8]`: 0, 4, 7, 9, 14, 16, 19, 22, 25, 27, 30, 41 of 45 missions.

## End conditions (`boolean_c`, line 9477)

| Mode        | Rule                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Sprint    | take the 5 checkpoints in order, then reach the finish while bit 4 of `bM` is clear. Win if time ≤ rival's recorded time + `z[7]`. There is a rival.                                                                                                                                                                                                                                                                 |
| 1 Flag hunt | collect 5 flags in any order. Win if time ≤ limit (hard cut-off only in multiplayer).                                                                                                                                                                                                                                                                                                                                |
| 2 Score run | reach the finish before `z[4]` (otherwise "Time up!"). Win if score ≥ target.                                                                                                                                                                                                                                                                                                                                        |
| 3 Challenge | level-specific (checked at line 5359). Levels 2/3/5/6: flag + finish within the limit; level 3 also needs a wall flip (`bC` bit 0x2), level 5 a spider jump, monkey vault and monkey flip (0x4, 0x8, 0x10), level 6 a pole jump and pole spin (0x20, 0x40). Levels 8/10/11: 2000 / 3200 / 5000 points (data limits 30/20/20 s, although the help text says 20 s for all). The bits are set on move entry; see 08 §3. |
| 4/5 Warm-up | get the flag, return to the coach NPC at (bV, bW); no time limit.                                                                                                                                                                                                                                                                                                                                                    |

- The finish counts when the player's centre cell equals (fx, fy) or (fx, fy−1).
- A checkpoint is detected from the tile under the body centre or the feet, minus 49.
- Screen-state flow (`x()` line 5246, `ad()` line 5515): 0 → (1 tutorial / 2 briefing / 3 "get ready") → 4 flyover (Sprint only) → 5 play → 6 / 7 / 10 results (Failure / Completed / Time up) → 8 name entry → 9 level unlocked → 11 prize → 13 back to menu. Finishing all 45 missions unlocks the Prize ending (state 11).
- A new score or time record goes to name entry (`aT` bit 0 = score, bit 1 = time).

## Rivals — recorded inputs, not AI

Recording format (written at lines 4782 / 4951, read at 4824 / 4919):

- Header: 28 big-endian int32 values (time accumulator, move, move timer, x, y, velocity and the other physics fields) + 2 flag bytes = 114 bytes.
- int32 total time (ms).
- Then 5-byte entries `(int32 tick count, int8 input)` until −1; the last entry is duplicated.
- Input bits as in 02: 1 up, 2 down, 4 right, 8 left, 16 forward, 32 back. Presses are collected once per tick (line 5173).

Playback: the rival runs the **same deterministic physics** with these inputs. When the recording is exhausted (`byte_a` returns -1) the frame loop forces the rival into move 5 (stop) with `O(5)` and re-initialises that move's impulse (`a(e, z, B, C, D, duration)`, lines 10500-10503) — without the snap, facing and buffer effects a normal transition would apply; the -1 is also OR-ed into the rival's input buffer. In single-player Sprint it waits `z[7]` ms before starting (line 10498). When the inputs run out it is forced into move 5. Replays only line up if the physics is reproduced exactly — which makes the 12 recordings a free parity test for the port.

Hot-seat multiplayer: 2–8 players with character choice 0–9; players play the level in turn, and earlier players' runs replay as dotted ghosts. Ranking: 10 / 6 / 5 / … points per rank in time and in score (line 4557), summed (line 7169).

## Save data

- **RecordStore "ropt"** (21 bytes, line 1216):

| Byte | Meaning                          |
| ---- | -------------------------------- |
| 0    | sound on                         |
| 1    | vibration                        |
| 2    | backlight                        |
| 3    | volume 0–64, step 8              |
| 4    | unused                           |
| 5–8  | music rotation per theme         |
| 9–20 | mission-completed bits per level |

- **RecordStore "accession"** (line 10136): 120 × (UTF name, int character, int value). Slot `2·(level·5 + mission)` = best score; the next slot = best time stored as −ms. Defaults are the rival names Spike, Trix, Dart, Viper, Ninja, Big D, Chili, Tung with the mission's default values.
- **RecordStore "str"**: 9 UTF strings — the single-player name and 8 multiplayer player names.

## Audio

MIDI only; there are no sound effects (vibration is used instead).

- Sound 0: splash / prize jingle, played once.
- Sound 1: menu music, looped; also used in the warm-ups.
- Sounds 2–13: in-game music = `2 + 3·theme + (rotation + 2) % 3`, looped (line 4489).
- A lower-priority sound does not cut off one that is still playing (line 944). Volume is set to about 50 % of the byte-3 setting.
