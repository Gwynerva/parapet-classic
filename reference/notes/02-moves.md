# 02. Move state machine

Main finding: the parkour is almost entirely **data** — a table of 135 states with transition lists (blob 16 in `b1`) — while the code implements a small generic engine: 81 transition conditions, 22 impulse types ("z-types") and about 30 snap/root-motion types ("x-types").

## State table (`var_int_arr_I`, 2366 int32)

States 0–134 are 14-int records; transition lists start at int 1890.

| Field  | Meaning                                                                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [0]    | duration in time units; −1 = `100 + (w >> 3)` (depends on the stored speed)                                                                  |
| [1]    | state entered when the timer expires (−1 = none)                                                                                             |
| [2]    | z-type (physics / impulse)                                                                                                                   |
| [3..5] | its parameters B, C, D                                                                                                                       |
| [6]    | animation clip offset in blob 17                                                                                                             |
| [7]    | animation playback mode                                                                                                                      |
| [8]    | flags (below)                                                                                                                                |
| [9]    | x-type: snap on entry and per-step root motion                                                                                               |
| [10]   | parent state whose transition list is checked after this one's                                                                               |
| [11]   | transition list index: `count`, then `(condWord, target)` pairs; `condWord` packs up to 4 condition ids, one per byte, all ANDed; 0 = always |
| [12]   | scoring type                                                                                                                                 |
| [13]   | points                                                                                                                                       |

Flags `[8]`:

| Bit                                        | Meaning                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| 0x1                                        | HANDS: the hands/head point is the anchor (`e.c`) instead of the feet         |
| 0x2                                        | force gravity and detach from surfaces every step                             |
| 0x4                                        | unused (the decompiled test is always true)                                   |
| 0x8                                        | no collision                                                                  |
| 0x10                                       | lock facing; on leaving to a state without 0x800 the facing flips (line 7770) |
| 0x40                                       | keep the input buffer `Q` on entry (line 7781)                                |
| 0x80                                       | single (contact) probe only                                                   |
| 0x100                                      | extra hands probe 32 units ahead that accepts only ledge corners (line 8492)  |
| 0x800                                      | face against the velocity                                                     |
| 0x8000                                     | store `w = v` on entry (line 9295)                                            |
| 0x20, 0x200, 0x400, 0x1000, 0x2000, 0x4000 | animation only (0x200 → 15 fps, 0x400 → 10 fps, 0x20 no blending)             |

## Transitions and timer (`boolean_h`, line 9321; `O`, line 9239)

Each step checks the current state's list, then the parent chain; the first match calls `O(target)`. If nothing matches: `K -= (0 < K < 30 ? K : 30)`; when `K < 0`, set `K = −2` and enter `[1]` if it exists. A state of duration D therefore gets **ceil(D/30)+1 physics passes** before it auto-advances. Duration-0 states with no next state persist indefinitely; their `E` stays 0, so "E == 0" impulses fire every step.

Entry effects (lines 7769–7792): facing flip/lock, `Q` reset unless 0x40, snap `a(e, x)`, physics init `a(e, z, B, C, D, dur)`, `c = flags & 1`.

## Conditions (`boolean_d(int)`, line 3612)

"Contact" means the current contact probe `[b]`. "Facing-wall" means `k` is 8 or 11 when facing right, 9 or 12 when facing left. `int_n` (line 8988) reads a tile relative to the feet or head; while standing (`r == 0`) it returns the tile under the feet.

| Id           | Meaning                                                                               |
| ------------ | ------------------------------------------------------------------------------------- |
| 0            | always true                                                                           |
| 1            | onSurface                                                                             |
| 2            | feet hit and onSurface                                                                |
| 3            | hands hit tile 1 or 21 (solid)                                                        |
| 4            | hands hit                                                                             |
| 5            | feet not hit                                                                          |
| 6–9          | pressed this step (`bB`): BACK, FWD, UP, DOWN                                         |
| 10–13        | buffered (`Q`) BACK, FWD, UP, DOWN, **and `bB == 0`** (line 9085)                     |
| 14           | tile under feet is air (walked off)                                                   |
| 15/16, 17/18 | downhill slope / not, uphill slope / not (H bit 7/6 by facing)                        |
| 19           | on any slope                                                                          |
| 20           | contact `k ≠ 0`                                                                       |
| 21           | hit a non-pole surface                                                                |
| 22           | head tile ∈ {5,6,23,13,14} and hands within 2 units of a tile row                     |
| 23           | no facing-wall above the head                                                         |
| 24           | ladder or free space above the head                                                   |
| 25           | hands on a grabbable ledge corner (k11 facing right / k12 facing left) of tile 5/6/23 |
| 26/27        | same, on post tiles 13/14                                                             |
| 28           | not 25                                                                                |
| 29           | feet hit a ladder (tile 17 facing right, 18 facing left)                              |
| 30           | ladder ahead at head height                                                           |
| 31           | hands hit a ladder                                                                    |
| 32           | contact is a facing-wall                                                              |
| 33           | contact is any wall or ledge                                                          |
| 34           | on flat `k=1` over tile 15/16                                                         |
| 35           | standing on an edge tile with the drop in front (tile 6 facing right / 5 facing left) |
| 36           | feet hit                                                                              |
| 37           | hands hit a floor or slope                                                            |
| 38           | contact is not the hands, and onSurface                                               |
| 39           | position within the tile past 174 (facing right) or before 850 (facing left)          |
| 40/41        | feet tile is not / is a ladder                                                        |
| 42           | head tile is a ladder                                                                 |
| 43/44        | top-of-ladder tests                                                                   |
| 45           | ray `(q·400/1024, +2000)` hits ground                                                 |
| 46           | contact hit                                                                           |
| 47/48        | feet hit / feet on tile 20                                                            |
| 49           | 38 and not tile 20                                                                    |
| 50/51        | hands on tile 19 / not                                                                |
| 52           | `                                                                                     | u   | > 2560`                                |
| 53           | `K < 300`                                                                             |
| 54           | `K > 325` and state 56                                                                |
| 55           | solid tile below and behind the head                                                  |
| 56–60        | `                                                                                     | v   | ` > 6750 / 10200 / 9500 / 15000 / 6400 |
| 61           | not at a pole                                                                         |
| 62           | pole (tile 22) in the next tile, or in a pole tile before its centre                  |
| 63           | hands hit a pole (k15/16)                                                             |
| 64           | contact tile 13/14                                                                    |
| 65           | no floor ahead                                                                        |
| 66           | feet hit a facing-wall with air above (1-tile obstacle)                               |
| 67           | feet tile ∈ {13,14,25,26}                                                             |
| 68           | **wall lookahead**, below                                                             |
| 69           | contact wall k8/9 with no wall above or ahead-above (low obstacle)                    |
| 70           | `r > 1250`                                                                            |
| 71           | `                                                                                     | q   | > 1750`                                |
| 72           | facing-wall tile 5 units ahead of the feet (not edge tiles 5/6/13/14/25/26)           |
| 73           | same, at the head                                                                     |
| 74           | wall ahead and above                                                                  |
| 75           | tiles ahead and ahead-up are air                                                      |
| 76           | air below the head                                                                    |
| 77           | `(k+g+q)>>10 ≠ (k+g)>>10` (literal `q`, unscaled)                                     |
| 78           | false                                                                                 |
| 79           | `r > 0`                                                                               |
| 80           | `q ≠ 0`                                                                               |

**Condition 68 (wall lookahead)** is either of: a ray from the feet to `+(q·400/1024, r·400/1024)` (`boolean_a(e,n,n2)`, line 9069) hits `k ∈ {8,9,11,12}` and the tile above the hit is a facing-wall (wall at least 2 tiles tall); or the character already touches a facing-wall and the tile above or ahead-above is also wall.

This is how "press right before touching" works: not a timing window but **"armed" states** (28 tic-tac, 30 wall run, 47 wall flip, 122/124/126 pole) entered on a press while the lookahead is true, and left on actual contact.

## Input

- Bits: 1 UP, 2 DOWN, 4 RIGHT, 8 LEFT, 16 FWD, 32 BACK. RIGHT → `4 | (facingRight ? FWD : BACK)`, LEFT → `8 | (facingRight ? BACK : FWD)` — FWD/BACK are resolved at press time from the current facing (lines 5185–5197). Bits 4/8 are never read.
- Only **press** events exist; holding a key and auto-repeat do nothing (lines 1550, 1600).
- `bB` collects presses during a frame until the player's first step of that frame consumes it (line 10519); if no step runs that frame it carries over.
- `Q` buffers presses since entering the current state; cleared on entering any state without 0x40. Buffered conditions 10–13 fire only on a step with no new press.
- Rivals are not AI: they replay a recorded `bB` per step (`byte_a`, line 4919). The player's own run is recorded the same way (`a(byte)`, line 4907).

## Moves → states

"Exit points" are paid when the state is left (see 03).

- **Run.** Start state 0 (`B=2800`, 900 units) only applies after crash recovery; a new level drops straight into state 2 because `K=0` at load. Run states: 2 (`B=1000`, flat), 3 (`600`, downhill), 4 (`300`, uphill). State 2 is scoring type 4 and resets the flip counter.
  - Ground parent 1, in order: 3∧5→71 bonk; 25→99 ledge grab; 29→118 ladder; 14→15 fall; UP→18; DOWN∧34→26; DOWN∧35∧38→94; DOWN→21; BACK∧35∧38∧39→96; BACK∧62→124; BACK∧52→8; BACK→6; FWD∧71→56; 48→128.
  - States 0/2/3/4 first check 69→42 (automatic step-over, 42→45→46) and 68→38.
  - State 4 has UP→19.
- **Turn.** BACK on the ground goes to 6 (stop, 600 units) or 8 (390 units if `|u| > 2560`). Facing is locked, then flips on exit.
- **Jump.** UP → 18; on an uphill slope → 19. Then 18→12→16→15, or 19→11→12→16→15. Air states use parent 10 (input moves), then parent 9 (contacts).
- **Air parent 10, in order:** FWD∧62→122; BACK∧62→124; BACK∧72→29; BACK∧68→28; FWD∧68→47; DOWN∧62→126; DOWN∧79→22; buffered DOWN∧79→22; UP∧32∧28∧73→33; UP∧68∧28∧80→30; FWD→63; BACK→64.
- **Air parent 9, in order:** tile 20: 47∧56→131, 47→128; grabs at speed (`|v| > 6400`, no points): 25/26/27∧60→101, 29∧60→104; grabs: 25|26→100, 27→107, 29→103, 50→132; landings: 2∧57∧19→82, 2∧57→84, 2∧56→82, buffered UP∧75∧2→62, 2→2; low walls: 66∧67→83, 66∧70→81, 66∧1→42, 66→43; 3∧5→71; 32→13 (wall slide).
- **Landing.** DOWN while falling (or a DOWN buffered earlier in the jump, once falling) → 22 (210 units) → 23. On touchdown: `|v| ≤ 9500` → 25 (25 points) → run; over 9500 → 24 (50) → roll 21 (20); over 15000 → crash 84. Without DOWN: over 6750 → stumble 82 (fail); over 10200 → 84 (fail; 82 on a slope).
- **Roll.** DOWN while running → 21: speed blends toward 2750, body height 10, 850 units, 20 points.
- **Tic-tac / wall jump.** BACK with a wall within the 400-unit lookahead → 28 (armed, no timeout) → contact 32 → 29 (+50) → 20 (z15 jump). Facing is locked in 29, so it flips and the jump goes away from the wall. Also from contact: BACK∧72 in 10/13/14/31/33/36/37. On the ground: BACK in approach state 38 → 39 (+50, even if it times out) → 41 (pushed back 4000 for 300 units). Without BACK the wall gives a slow bounce 40 (2450 for 580 units) — hint string 168 is about this.
- **Wall run.** UP while touching a wall (73) → 33, or UP with the lookahead → 30 (armed) → contact → 33. On a ladder face → 31 (+50) → 32 → 106 → 119. Each kick sets `r = C` and lasts 600 units; 33 → 36 → 37 via UP (pressed or buffered) while `K < 300`. The UP that enters 33 stays buffered (33 keeps `Q`), so **one press gives two kicks**. Points: 2 per step while rising (type 5). From a wall run: BACK∧72 → tic-tac; FWD∧72 → wall flip; ledge conditions → 100.
- **Wall flip.** FWD with the lookahead → 47 (armed) → contact → 48 (+250): velocity (2480 away, 3100 up), facing against velocity. Then 49 (210 units, landing OK → 50) → 52, which needs DOWN → 53 → landing 51 (+100), otherwise 54 (fail). Hitting a wall during 48–53 → 85 (fail).
- **Ledge grab / pull-up.** Hands on a corner (25): ground → 99 → 110 → 112; air → 100 (+50); from a tiger jump → 102 (+100). 112 is the active hang (3990 units → idle 109). UP∧22∧23 → 115 (750 units: up 1536, forward 512) → 116 (`v = 2500`) → run. DOWN → 27 (drop). BACK → 117 (hold 125, then −3200 / −4150). Climb down: BACK at an edge while running → 96 → 97 → 98 → 112.
- **Ladder.** Touching a ladder while running auto-grabs: 118 → 119 (up at 2250, 2 points per step). DOWN → 120 (down at 4050); UP → 119. Top: 44 → 108 hang, or 43 → 121 hop. Bottom: 36 → 6. BACK → 117. From the air: 103 (+50) → 112.
- **Tiger jump (kong).** FWD while running at `|q| > 1750` → 56 (+100): hands rotate forward, hold 190 units, then jump. Then 57 → 58 if ground is ahead (45), else 61 → 15. Hitting a wall → 73 or 87 (fail). Hands touching a floor (37) → 59 → 60 → run.
- **Spider jump / monkey flip.** During 56/58 a buffered UP or DOWN fires when the hands pass the obstacle's far edge (55∧77∧76). UP → 66/67 (+250): hands pinned, `|q| = 2800`. DOWN → 68/69 (+250). Both → 70 (`q = 4000`) → run.
- **Monkey vault.** Buffered UP in the air when the feet land on top of an obstacle with clear space ahead (75) → 62 (+200): hop (+400, −400).
- **Dash.** DOWN while standing on an edge tile facing the drop → 94 (stop, 450 units, +100) → 95 (+100): feet move +1024 forward and +1536 down, velocity (4055, +1000) → 22.
- **Front / back flip.** FWD → 63 (640 units, type 3, 100 points); BACK → 64 (750 units, 150 points). Then 65 (keeps `Q`): a buffered FWD/BACK chains another flip. Touching the ground mid-flip → 82; hitting a wall (21) → 72. Both are fails.
- **Pole.** The pole must be in the next tile (62) to arm 122/124/126; these wait for hands contact (63). Pole jump 123: hold 210, then (+3500, −4000), +50. Pole spin 125: hold 360, then (−3900, −2900), +50. Pole slide 127: `q = 0`, down speed capped at 3000, 2 points per step. FWD → 123, BACK → 125, ground → run.
- **Not in the game's move list:** overhead bar (tile 19): 132 (+50) → 133 (1800 per step, 2 points per step), BACK reverses (134), DOWN drops. Plank (tile 20): 128/129 ride at a constant 2500 (2 points per step), BACK reverses (130), landing on it at speed → 131 (+50, falls through).
- **Fail and recovery chains:** 71/72: friction ×0.879 per step, 810 units → 74 → 75 → 76 → 77 (`100 + w/8`) → 79 (810) → 80 → 0 or 6. 82: speed halved, 810 units. 83/84 → 86 (510) → 88 → 89 → 90 → 91 → 92/93. 85, 87, 54, 73 join these chains.

Dead ends: state 32 has no exit unless condition 30 holds; parent-only states 1, 9, 10 and 55 are never entered directly.
