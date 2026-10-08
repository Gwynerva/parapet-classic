# 08. Mission flow, tutorials, results, menus, text markup and audio

What the original does around the simulation: the screen states of a mission, the warm-ups
with the coach, the challenge rules, the results and name entry, unlock progression, the
Prize ending, the menus and the music. Line numbers refer to `reference/decompiled/d.java`;
string numbers to `packages/content/playman/extracted/strings/ru.json`. Names follow
`glossary.md`.

Two corrections to earlier assumptions: strings 56–75 are the Moves-menu descriptions, not
warm-up hints (the warm-up text is 170–178 plus the in-play hints 168 and 169); and in the
challenge bit field `bC`, bit 4 is the spider jump (move 67) and bit 8 the monkey vault
(move 62).

## Key groups

`boolean_a(key, n)` with `n ≥ 65536` tests a key-code group `S[n & 0xFFFF … + (n >> 16)]`
(line 1621); codes are stored as keycode + 56.

| Group                             | Keys                          | Used as                      |
| --------------------------------- | ----------------------------- | ---------------------------- |
| 131072 / 131074 / 131076 / 131078 | Up/2, Down/8, Left/4, Right/6 | directions                   |
| 196616                            | left soft, 5, fire            | SELECT                       |
| 131092                            | right soft, left soft         | pause                        |
| 196625                            | left soft, 5, fire            | menu confirm                 |
| 131085 / 131087                   | Up/2, Down/8                  | menu up / down               |
| 131098 / 131100                   | Right/6, Left/4               | slider + / −                 |
| 262166                            | 5, both soft keys, fire       | skip splash                  |
| raw 49                            | right soft                    | back / retry / delete / "No" |
| raw 52                            | Right arrow                   | name entry: commit character |

## 1. Screen-state flow (`x(n)` 5246 sets a state up, `ad()` 5515 advances)

A mission starts in `bg()` (10375): load the level, then `void_h(aN, ck)` (5126) resets
`aM = -1` and calls `x(0)`. In a single-player Sprint the rival (`Y()`) is loaded after
`x(0)`. Every `x()` resets `aZ = 0`.

**Key routing** (`U(n)` 10442). While a message box is visible (`aH != -1 && v >= aH`), keys
go to `boolean_e()` (5029) first: SELECT turns the page and closes the box on the last page
(`aH = -1`); DOWN / UP turn pages; the right soft key retries (`bk()`) when the box allows it
(`E`), other soft keys pause. After the box closes, `boolean_f(n)` (5173) still runs on the
same press; in every state except 1 and 5 SELECT then calls `ad()`, so one press closes the
box and advances the state.

**The message box** (`a(n, str, delay, C, D)` 4987, drawn by `aa()` 5053): font 0 at x = 4,
width 232, max height 240; flag 8 shrinks the box to the text. Background `0xDCD4D0` with a
black border. Optional title bar (string `aL`, white, `fontH + 8` tall, page 0 only) coloured
by `aJ`: 1 = `0x911F00` (failure), 2 = `0xFF410E` (success). `aH = v + delay` delays the
box. `C = true` (`Z()` 5021) moves the camera target to `(bV − 512, bW − 10240 + 1536)` so
the coach sits bottom left, turns the player towards the coach (the test `k < bV >> 1`
compares against half the coach x because of Java precedence, probably a bug), plays idle
clip 228 and draws the speech-bubble tail, sprite 183, at `(x + w/8, bottom of box)`.
`D = true` keeps the characters animating. Soft keys: left = 28 "OK" or 27 "Далее" when
more pages follow; right = 31 "Удал" (name entry), 26 "Еще раз" (retry when `E`) or
nothing. The HUD is not drawn while a box is visible (`bj()` 10610).

Outside state 5 physics does not run (`boolean_d` 10589): only the camera spring
`b(ch << 10, false)` and, when `D` is set, the animation `z()`.

| State | Set-up                       | Shown / strings                                                                                                                                                                                                                                                 | Advances on → next                                                                        |
| ----- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 0     | `ad()` at once               | —                                                                                                                                                                                                                                                               | Prize flag `K` → 11; warm-up → 1; multiplayer → 3; else → 2 (5517)                        |
| 1     | `ab()` 5209 (tutorial)       | strings `170 + aZ` (warm-up 1) or `174 + aZ` (warm-up 2); 2000 ms delay when `aZ == 1`; C, D; for `aZ == 1` `P(0)` points the camera at checkpoint 0 (the flag)                                                                                                 | SELECT: `if (aZ < int_h()) { ++aZ; ab(); } else ad()` (5175); `int_h()` = 2 → 3 pages → 5 |
| 2     | 5258 (briefing)              | 183 Sprint, 184 Flag hunt, 185 Score (`%1` = target `aR`), Challenge 186 / 187 / 188 / 189 / 190 / 191 / 192 for levels 2 / 3 / 5 / 6 / 8 / 10 / 11. C only in Sprint (camera at `bV`/`bW`, the rival's start cell; no coach drawn). D. Idle clip on the player | SELECT → 4 in Sprint, else 5                                                              |
| 3     | 5300 (multiplayer get ready) | `ac()` resets entities; 165 with `%1` = player name; resets `ca = 0, cb = 1`; D                                                                                                                                                                                 | SELECT → 4 / 5                                                                            |
| 4     | `aP()` 9392 (flyover)        | camera tour (below); HUD visible, no box                                                                                                                                                                                                                        | SELECT → 5 (only input that advances)                                                     |
| 5     | 5314 (play)                  | `ac()`: entities reset, ghost/rival snapshots reloaded (`X()`), `bN = bM = -1`, recorder header `V()`; music `a(true)`; `cf = cg = 0`; `aP = 0`; flags left `aS` = 1 for challenges on levels 2/3/5/6, 0 for other challenges, 5 otherwise                      | `boolean_c()` → `ad()`: warm-up → 6, multiplayer → 10, else → 7                           |
| 6     | 5340 (warm-up done)          | `n(ci, cj)` marks the mission complete; 173 (warm-up 1) or 177 (warm-up 2); C, D                                                                                                                                                                                | SELECT → 13                                                                               |
| 7     | 5349 (results)               | sections 3 and 4                                                                                                                                                                                                                                                | `aT > 0` → 8; unlocked level `aO != -1` → 9; Prize flag `J` → 11; else 13                 |
| 8     | 5458 (name entry)            | modal text input (section 5), then `ad()`                                                                                                                                                                                                                       | `aO` → 9, `J` → 11, else 13                                                               |
| 9     | 5465 (level unlocked)        | title 163 "Уровень отк.!" (`aJ = 2`), body 164 with `%1` = level name `97 + aO`; offers retry                                                                                                                                                                   | SELECT → 13                                                                               |
| 10    | 5473 (multiplayer result)    | 166 (name, score, time) or 167 when time == 0                                                                                                                                                                                                                   | SELECT: `w(ay)` saves the ghost; next player → 3; after the last `void_k(12)` → 13        |
| 11    | 5485 (Prize)                 | section 6                                                                                                                                                                                                                                                       | SELECT → `bi()` (10444)                                                                   |
| 12    | never entered                | —                                                                                                                                                                                                                                                               | —                                                                                         |
| 13    | `bi()` 10428                 | frees the recorder and tables, `V = true` stops the loop; `R = !K` returns to the menu                                                                                                                                                                          | —                                                                                         |

**Sprint flyover (state 4).** `aP()` sets `U = true` and starts leg `Q(1)` (9398). Leg
targets: leg 0 = start `(bR, bS)` as `(cell << 10) − (3840, 5120)`; legs 1..bX = checkpoint
`bJ − 1` as `(cell << 10) + 512 − (3840, 5120)` (centred); leg `bX + 1` = finish. Each leg
starts from the current camera position. Leg length `bL = ((isqrt256(dx² + dy²) + 1) << 5 +
20000) >> 1` with dx, dy in quarter tiles, advanced by `bK += ch · 16` per frame (9440):
about 2 ms per pixel plus 625 ms per leg, in game time. Position `from + (to − from) ·
(3t² − 2t³)` (9421), clamped to the level (9455). When a leg ends: `Q((bJ + 1) % (bX + 2))`,
so the tour runs cp0 → … → cp4 → finish → start → cp0 … forever until SELECT. In state 5
`void_a(e)` clears `U` and the ±60/80 px leash pulls the camera back to the player.

Timers: the box delay `aH` (2000 ms for the second tutorial page, 1000 ms for hints 168/169,
otherwise 0) and `aI`, how long the box has been shown (results-icon blink). Nothing
auto-advances except the Prize timeline and the 13 s splash.

## 2. Warm-ups (missions 4 and 5 of level 0)

**Coach.** Position from the mission section's npc cell (`m()` 9621): `bV = x << 10`,
`bW = y << 10`. Warm-up 1: coach (1, 8), start (3, 8), finish (2, 8), flag (25, 4).
Warm-up 2: coach (29, 10), start (31, 10), finish (30, 10), flag (75, 9). Drawn by `ak()`
(5911) at `(bV + 512, bW + 1024)`, standing mid-cell on the floor, always facing right. Not
drawn when `bV == −1`, nor in Sprint unless the state is 11. Animation: clip 483 (30
keyframes 434–440) looped over 5000 ms of real time `u`, but only while a message box is
visible; otherwise keyframe 434. Skin (`a(n, int[])` 5944): drawn with `var_boolean_M = true`,
so it gets the level's rival character `z[ci·28 + 12]`; level 0 = 2 = Spike (heads 87–91,
male body swap). In state 11 the coach is character 0.

**Tutorial pages (state 1).** Strings 170–172 (warm-up 1) or 174–176 (warm-up 2), indexed by
`aZ`, advanced only by SELECT. The second page (171 / 175, "get the flag and come back")
waits 2000 ms; during the wait the camera pans to the flag (`P(0)`) and the HUD is drawn,
then the box appears over the flag view. The third page brings the camera back to the coach.
After it SELECT starts play. No physics runs before that.

**In-play hints** (`boolean_c` case 4/5, 9569):

```
if (J[player] == 40 && (bN & 2)) { bN ^= 2; box(168, delay 1000, C=false, D=false) }  // slow wall bounce: "press BACK before the wall"
else if ((J == 86 || J == 82) && (bN & 4)) { bN ^= 4; box(169, delay 1000, ...) }      // stumble / crash: "press DOWN before landing"
```

`bN` is reset to −1 in `ac()` (states 3 and 5), `bg()` and `bk()`, so each hint appears at
most once per attempt. These are the only in-play triggers. The game pauses while a hint
box is visible: `cf` stops accumulating (10482), so no physics steps run, movement input is
ignored (5186), the camera spring settles and the characters freeze (`D = false`). During the
1000 ms delay before the box appears, play continues.

**Flag and end.** Collecting the flag sets `ca = 2, cb = 3` (9564). The end test (9576):
the finish cell (`n == bT`, `n2 == bU` or `bU − 1`) with flag 0 taken (`(bM & 1) == 0`).
The finish is the cell next to the coach; the finish marker sprite 191 is drawn there (9793).
The player is then snapped standing: `h = n = −1536`, `l = p = ((bU + 1) << 10) − 1`,
`c = false`; `ad()` → state 6. No time limit; the HUD has no timer case for types 4/5 (9863),
it shows the checkpoint dot, score and multiplier. Reaching the finish without the flag does
nothing.

**Dead code.** String 178 ("P.S. … menu 'Движения'") is unreachable: it needs `ab()` case 6
with `aZ = 1` (5221) and `int_h()` returning 2 for `aN == 5` in state 6, but `boolean_f`
only calls `ab()` in state 1. A warm-up that completes an unlock threshold never reaches
state 9 (6 → 13).

**Level-art pulse** (`aV()` 9847):

```
if (aN == 4 || aN == 5 || aN == 3 && ci ∈ {2, 3, 5, 6}):
    t = |sin(u >> 2 & 0x1FF)| << 6          // 0..65536, period ≈ 1024 ms
    drawScene(bZ, frameA = ca, frameB = cb, t, -camX, -camY)
else: static frame 4 (levels 0, 2, 3, 6), 2 (level 5), 0 (others)
```

`ca = 0, cb = 1` at level load (`S()` 9832), in `x(3)` and on retry; they switch to 2/3 when
the flag is taken in warm-ups and in the challenges of levels 2, 3 and 6. Level 5 never
switches. The "arrows" are sprite 223 inside the background scene (transforms 0 = →, 1 = ↓,
3 = ↑, 4 = ←); frames 0/1 (and 2/3) differ by about 8 px along the arrow, so the pulse makes
them bob; frame 4 has none. In `k3` (level 0) frames 0/1 hold 13 arrows at tiles x ≈ 40–79
(the way out of warm-up 2) and frames 2/3 12 arrows for the way back; warm-up 1's area
(x ≤ 25) has none. Challenge scenes with arrows: `k8` (level 2) 9 then 4, `k2` (level 3) 3
then 1, `k5` (level 5) 6 (3 frames only), `k12` (level 6) 5 then 3.

## 3. Challenge missions (type 3)

**Move bits.** Set in `O(n)` (enterMove, 9265–9291) on entering a move, for whichever
entity is being stepped:

| Move | Bit  | Move name        | Required by   |
| ---- | ---- | ---------------- | ------------- |
| 20   | 0x1  | tic-tac take-off | never checked |
| 48   | 0x2  | wall flip        | level 3       |
| 67   | 0x4  | spider jump      | level 5       |
| 62   | 0x8  | monkey vault     | level 5       |
| 69   | 0x10 | monkey flip      | level 5       |
| 123  | 0x20 | pole jump        | level 6       |
| 125  | 0x40 | pole spin        | level 6       |

The pole slide (127) is named in strings 189 and 203 but never required. `bC = 0` only in
`aM()` (9218), called at level load (`aL()`) and on retry (`bk()`); `x(5)` does not reset it.

**Time limit and end test.** `aQ`/`aR` come from the goal word at menu selection (6782);
challenge goals have the high bit set, so `aQ = 0` and `aR` = limit: level 2 25 s, level 3
20 s, level 5 40 s, level 6 30 s, level 8 30 s, level 10 20 s, level 11 20 s. The HUD counts
down `aR − cg` and blinks during the last 10 s (9892). End (9555): time up (`aR > 0 &&
aR − cg <= 0`), or the player at the finish with `aS == 0`. `aS` = 1 on levels 2/3/5/6 (the
flag is needed); on levels 8/10/11 `aS = 0`, so reaching the finish ends the run at once on
levels 8 and 10; level 11 has no finish, only the timer ends it.

**Results** (`x(7)` 5359):

```
levels 2, 3, 5, 6:  time up → title 182 (red)
                    L3 && !(bC & 2)                        → body 201 (no title)
                    L5 && !(bC & 4 && bC & 8 && bC & 0x10) → body 202
                    L6 && !(bC & 0x20 && bC & 0x40)        → body 203
                    else n(ci, cj); title 180 (orange); success
levels 8, 10, 11:   target 2000 / 3200 / 5000 (hard-coded at 5393)
                    score < target → body 204 (no title)
                    else n(ci, cj); template 193 with %1 = string 180; success
```

The briefing for level 3 (187) is truncated in the data. `boolean_b()` is not used for
challenges.

## 4. Score run (type 2) and Sprint (type 0) results

**Win test** `boolean_b()` (5111): `aQ` 0 (time limit) or 2 (Sprint): win ⇔ `aR >= time`;
`aQ` 1 (score target): win ⇔ `aR <= score`. `aQ`/`aR` (6782): goal word −2 → `aQ = 2`;
high bit set → `aQ = 0`, `aR` = low 31 bits; otherwise `aQ = 1`, `aR` = word. Flag hunt
goals are time limits (`aQ = 0`), so a flag hunt is won when the time is within the limit;
the run itself is not cut off in single player.

**Sprint target.** `Y()` (4891–4898) sets `aR` = big-endian int32 at bytes 114–117 of the
rival recording (the rival's total time) **plus `aG = z[7]`**, the handicap. The rival does
not step while `cg < aG` (10498), so the player wins when their time is at most the rival's
finish time on the shared clock.

**End conditions** (9488): Sprint — finish cell with `bM` bit 4 clear (all five checkpoints
in order). Score run — finish; if `z[4] − cg < 0` the run ends with `H = true` (time up) and
time = limit (single player) or 0 (multiplayer).

**Result title** (`x(7)` 5411): `H` → 182 "Время вышло!" (red); `aT > 0 && win` → 181
"Выполнено!" (orange); win → 180 "Выполнено!" (orange); otherwise 179 "Неудача!" (red). A
win calls `n(ci, cj)`. Body: template 193 with `%1` = goal line from
`java_lang_String_a()` (4525): `aQ` 0 → 195 "Время:" + limit; 2 → 194 "Время:" + `aR`;
1 → 196 "Счет:" + target; `%2` = player time, `%3` = score. The label "Score:" in 193 is
untranslated English. If not a win, `aT = 0`. The box offers "Еще раз" only when `aT == 0`.

## 5. Name entry (state 8)

**Trigger.** `aT = int_i(score, time)` (10200) in `x(7)` unless time ran out: bit 1 = stored
best score < score; bit 2 = stored `−best time` < `−time` (faster). A slot storing 0 can
never be beaten, so the challenges of levels 8/10/11 (default time 0) never get time
records. Cleared unless the run was a success; warm-ups and multiplayer never get here.

**UI** (`java_lang_String_b()` 5010): box titled `198 + aT − 1` (198 score, 199 time, 200
"Впечатляет!" for both), body 197, `aJ = 2`, right soft key 31 "Удал". Then the blocking
input loop `a(S[33], name0, 28, 8)` (2925): maximum length 8 (the 28 is unused). Input field
(`aT()` 9800) inside the box at `(aj + 5, ak + am − 1.5·fontH − 4)`, width `al − 9`, height
`fontH + 4`: white 1 px frame, fill `0x2A1815`, white text with a `_` cursor blinking every
300 ms. Keys (`void_o` 2979): multi-tap on 0–9 (the same key within 1000 ms cycles the last
character, otherwise append; at 8 characters the last one is replaced); Right arrow commits;
right soft deletes; left soft or fire confirms. Character set (blobs 0 and 1 of `b0`):
`0: " 0"`, `1: ".,?!1-/:_+&*<>"`, `2: "abc2"` … `9: "wxyz9"`, lower-case ASCII only; the
default name "Игрок" cannot be typed back. Afterwards `void_a(0, name)` saves the default
name and `a(score, time, name, 1 − by)` (10215) updates every improved slot.

**Record stores.** `accession` (10136/10178): 120 × (UTF name, int character, int value);
slot `2·(level·5 + mission)` = score, the next slot = −time ms; defaults (`bd` 10168): names
by slot/5 (Spike, Trix, Dart, Viper, Ninja, Big D, Chili, Tung), character `z[12]`, values
`z[13 + 3m + 2]` / `−z[13 + 3m + 1]`. `str` (`G()` 4116): 9 UTF strings, slot 0 = the
single-player name (default S[34]), 1–8 = multiplayer names (S[35] "Игрок %1"). Stored
character: Playman = 1, Blaise = 0 (`1 − by`).

## 6. Unlock progression

`n(level, m)` (10301) sets `ropt[9 + level] |= 1 << m` and saves. Called by `x(6)` and a
successful `x(7)`. If the bit count changed (first completion): `S = true` and `aO =
int_v(total)`, the level whose `z[8]` **equals** the new total (10344), or −1. Total = sum of
bit counts (`int_j` 10334, `int_i` 3481). Lock check `boolean_j(L) = total >= z[L·28 + 8]`
(10355): a locked level shows thumbnail 163 instead of `164 + L`, SELECT does nothing
(6753), and the text area shows string 137 with `%1 = z[8] − total` (6666). State 9 appears
only when the total exactly reaches a threshold (0, 4, 7, 9, 14, 16, 19, 22, 25, 27, 30, 41).

**Prize (state 11).** In `x(7)`, if `!L` and every level is complete (`boolean_i`, all
`z[2]` bits): `L = true`, `S[587] = 0` (main-menu item 28 "Приз" appears), `S[591] = 2`
(hides item 29, the locked text 160), `J = true`. Menu path `C(28)` (6248): `K = true,
ci = 11, aN = 3`, loads level 11, then 0 → 11. The results path goes 7/8 → 11 without
reloading, so it plays in whatever level is loaded. `x(11)`: player at `(bR, bS) = (53, 4)`,
Playman (skin 1); coach at `bV = 52224, bW = 4096` (cell 51, 4), Blaise (skin 0); camera
`k(49408, −2048)`; text layout of S[161] (the prize URL) at x = 12, y = 52, w = 216, font
1024; stops the music and plays sound 0 once; pause menu: retry hidden, "Завершить игру"
shown. Timeline (`boolean_d` 10528, by `n = v − aU`): 4–6 s birds fly off one by one; 6 s
four fireworks (`M()` 4425: rocket sprite 179, bursting after 3.5–4.5 s into particle type 5,
sky flashes `0x99007E` / `0x0092A8` / `0x129101` fading over 512 ms); 6–9 s camera rises
from y −2048 to −10240 with smoothstep; from 14 s another 4–7 fireworks every 5 s;
`aV ≥ 5` (14 s) title 162 "Поздравления!" at (120, 34); `aV ≥ 6` (19 s) the URL text box,
scrollable with UP/DOWN; SELECT exits.

## 7. Text markup (layout `a(…)` 2436, render `void_c` 2797)

Every layout passes `bl2 = true`, so the default alignment is centred (2463). `%n` (single
digit) is replaced at its first occurrence by `a(String, String, int)` (1526).

| Code                     | Meaning                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `\x13n:`                 | font via `int_r` (10065): 0 = the call's base font, 1 = id 1024 (bold small proportional with a 1 px black outline, 1061), 2 = id 0 (bold small, no outline)                                                                                                                                                |
| `\x1bn:`                 | colour via `int_q` (10026): 0 = restore the starting colour; 2 / default `0x4A3835`; 3, 4, 7, 8, 20 white; 5 black; 6, 22, 23 `0x911F00`; 21, 30 `0xFF410E`; 24 `0x71615C`                                                                                                                                  |
| `\x14` / `\x15` / `\x16` | alignment left / right / centre for the following text. Left then right on one line works like a tab (label left, value right: strings 89, 194–196); leaving right- or centre-aligned text starts a new line                                                                                                |
| `\x19n:`                 | inline object sized by `int_s` (10077), drawn by `d()` (10099): 1 = Moves-menu demo (box = demo bounds); 2–11 = 21×21 head icon of character `n − 2` (sprite `int_l`: 81, 82, 87, 92 … 122); 13 = 33×25 mission icon; 14/15 = invisible spacer of sprite 0's size (15×14); 16 = flag icon; others = nothing |
| `\x1cn:`                 | the same objects as a block at line start: floated left / right, or centred on its own lines. Used for the results icon                                                                                                                                                                                     |
| `\x18`                   | starts or ends a row band (`var_short_arr_e`) for the multiplayer tables `J()` (7145) with stripes `0x93827C` / `0xB8AAA3`                                                                                                                                                                                  |
| `\n`, space              | line break (also drops below a float); runs of spaces collapse                                                                                                                                                                                                                                              |

Fonts: 0 = bold small proportional, 1 = bold medium, 2 = bold large, 16 = plain small system
(10689). Segments and objects are vertically centred in their line. Examples: string 89
(controls) has the action at the left (white, outlined) and the key at the right in colour 23
(dark red, no outline); `\x1b23:ВВЕРХ\x1b2:` is a key name in dark red inside brown body
text; the results icon (`\x1c13:`) is drawn only on success and alternates every 256 ms for
the first 2000 ms between the done and not-done icons of the menu's level and mission.

Parapet does not port the markup: the dictionaries hold plain text with placeholders for
key names, and the screens draw the icons.

## 8. Moves menu ("Движения", menu 11)

Set up by `D(11)` → `al()` (5967): blob 2 = 20 × (clip offset, frame count, string id
56–75); blob 3 = per-keyframe bounding boxes. Text per move (`am()` 5974): `"\x1b24:\x15" +
(ba + 1) + "/20\n" + S[56 + ba]` — a grey right-aligned counter, then the description, which
starts with `\x16\x19 1:\n\x13 0:\x1b 2:` (centred demo object, then brown body text);
layout font 0, x = 0, y below the bars, w = 240, padding 4. Demo (`d(1, …)` 10120): keyframes
`short_h[off + 1 … off + count]` cycling every 128 ms of real time (`u >> 7`), linearly
tweened (`t = (u << 9) & 0xFFFF`), positioned so the bounding-box minimum sits at the object
origin (+ pivot 67/71); move 17 (pole slide) bobs ±1 px; drawn with the selected character's
skin (`1 − by`, Playman by default). Screen (`an()` 6029): background `0xB8AAA3`, header bar
`b()` (4567) orange `0xFF410E` with dark-red text and a `0x2A1815` border, grey sub-bar with
the move name `36 + ba` and blinking left/right arrows (sprite 162), scroll triangles, right
soft key 7 "Наз.". Controls (`A()` 6002): RIGHT / LEFT = next / previous move (wraps 0–19);
UP / DOWN = scroll; right soft = back.

## 9. Level and mission select (menu 5, `E(5)` 6420, input `H()` 6971)

**Character select first** (`ar()` 6370): title 135; name-tag graffiti sprite 67 (Playman)
or 66 (Blaise); body text 133 / 134; LEFT/RIGHT toggles `by`, SELECT continues.

**Level select (`bi = 0`).** Header 95. A dark bar "N. LevelName" slides in from the side
with blinking arrows. Map of 12 cards: x = `L · 128`, y = `(L/3 % 2) · 64 + hash(L · 431)/2
% 21`, scrolled to the focus over 256 ms. Each card: thumbnail `164 + L`, or 163 if locked,
on a white card with grey borders; levels with ≥ 4 missions get a rival graffiti tag sprite
`68 + k` under the card (68 = Spike on level 0 … 75 under level 11). A row of mission icons
(`e()` 6338) spaced 30 px, from `int_a(level, m, done)` (4669): 141/142 warm-up (book),
143/144 challenge (trophy), 145/146 Sprint (stopwatch), 147/148 flags, 149/150 score (star);
odd ids = not done, even = done. Text box: level description `109 + L`, or string 137 if
locked. LEFT/RIGHT walks `bl = bn · 3 + bj` across 0–11. Soft keys 6 "Выбор" / 7 "Наз.".

**Mission select (`bi = 2`).** Header 96. Orange level-name bar; dark mode bar (`121 +
type`) with arrows. Mission icons; the selected one bobs. Text (`I()` 7048): 127 / 128 for
the two warm-ups; otherwise `"\x16%1"` with the records template (`java_lang_String_a(L, m)`
10230). The mode description scrolls along the bottom as a ticker, 1 px per 16 ms, colour
`0x4A3835`: 91 Challenge, 92 Sprint, 93 Flags, 94 Score; empty for warm-ups. Soft keys 149
"Воспр." / 7 "Наз.". The goal is not shown in the menu, only in the briefing. Multiplayer
skips the warm-ups and the score challenges of levels 8/10/11 (`int_i()` 6323).

**Records template (string 136).** `%1` = best score, `%2` = the score holder's name, `%6` =
`\x19(2 + char):` head icon, `%8` = colour 30 (orange) if the holder is Playman or Blaise,
else 3 (white). If a time is stored: `%3` = time, `%4` = time holder, `%5` = S[130]
"Рекорд:", `%7` / `%9` = icon and colour; otherwise blank. There is no separate records
screen; string 144 "Рекорды" is never used.

**After a mission** (`B(0)` 6181): back to mission select at the next mission if that one is
not yet done; the icon of the mission just completed flickers for 2 s (`bo`); if the level is
now fully complete, jump to the next incomplete level on the level-select screen.

## 10. Audio

**Playback.** `void_a(id, priority, loops)` (944) plays only if `ropt[0]` (sound on) is set
and never interrupts a higher-priority sound that is still playing (`loops ≤ 0` counts as
forever). `void_e()` (1026) stops. Volume `void_d(v)` (839): level = `((v·100 >> 6)·128)

> > 8`, 50 % at most; `ropt[3]` is 0–64.

**Sound-on prompt.** At boot `void_j()` (1230) forces `ropt[0] = 0` and stashes `ropt[3]`,
so every launch first shows the prompt built by `boolean_a(7)` (1931): string 5 "%1?" with
138 → "Включить звук?", soft keys 3 "Да" / 4 "Нет". Yes (`void_l(7)` 2006) restores the
stashed volume, or 64 if it was 0.

| Moment                        | Code                    | Sound                                                                                                                                                                            |
| ----------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| splash                        | `ao()` 6052             | 0 at priority 128, once; stopped after 13 s by `ap()`; the splash auto-skips at 13 s; soft key 139 "Пропустить"                                                                  |
| menu entry                    | `at()` 7220             | load group 1, stop, play 1 at priority 0, looped                                                                                                                                 |
| re-entering a menu after play | `B()` 6172              | 1 again                                                                                                                                                                          |
| level load                    | `bg()` 10378            | stop the menu group; `Q()` loads group 1 for warm-ups, else `2 + theme`                                                                                                          |
| states 1–4                    | —                       | silence                                                                                                                                                                          |
| play start                    | `x(5)` → `a(true)` 4489 | warm-ups: 1 at priority 200, looped. Others: `ropt[5 + theme] = (r + 1) % 3` (advanced on every start, retry included), then `2 + 3·theme + (r + 2) % 3` at priority 200, looped |
| pause                         | `x()` 1822              | stop                                                                                                                                                                             |
| resume                        | `C(11)`                 | `a(false)`: the same track again                                                                                                                                                 |
| app hidden                    | `hideNotify` 1316       | stop and pause                                                                                                                                                                   |
| results                       | —                       | the in-game track keeps playing until the level is unloaded (`bh()` → `R()`)                                                                                                     |
| Prize                         | `x(11)` 5502            | stop, then 0 once; stopped again on exit                                                                                                                                         |

**How the tracks are written.** The menu track (1) is a pad of only 81 notes whose life is in
about 1,400 channel volume changes (CC7): every chord swells from almost nothing and fades
again, and the first chord starts at volume 0. A player that takes a note's volume at its start
plays it nearly silent; ours follows the controller while the notes sound. Every track also
ends with a marker chord, key 36 at velocity 1 on all sixteen channels (a kick on the drum
channel) about 85 ms before the end: inaudible on the phone, a thud at every loop on a
synthesiser that honours velocity 1, so we drop it. The menu track's last chords end exactly at
the loop point and the next pass starts from the quiet swell, which made the loop sound cut
off; our player lets those chords ring on and fade over the start of the next pass.

**Options menu ("Функции", menu 1).** "Звук" is a slider (`void_f(0, …)` 2378): SELECT
toggles 0 ↔ 64; Right/6 and Left/4 step ±8, wrapping; an 8-segment bar 60 px wide; 0 sets
`ropt[0] = 0` and stops the music; changes apply at once and are saved. "Вибрация" toggles
vibration (160 ms test buzz when turned on). "Подсветка" toggles the backlight.
