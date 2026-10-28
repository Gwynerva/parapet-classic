# 10. The perfect run, and the glitches found looking for it

Is there a run of a contest that cannot be beaten, not by any player and not by any machine,
and can it be found? This note is the answer worked out for the 1.1.0 release (`parapet-sim@0.2.0`,
the same simulation as 1.0.0), the measurements behind it, and the glitches of the original that
the search turned up on the way. The tools are in `packages/tools/src/optimal/` and
`packages/tools/native/`; their runs stay in `packages/tools/tas-out/` (git-ignored, like the
bosses' records).

## In short

- **A perfect run exists.** The game is a finite deterministic machine: integers only, no
  randomness, and a fixed step (time = steps × 30 ms). So every contest has a minimum number of
  steps, and some run reaches it. Ties are frame-exact; "unbeatable" means "no fewer steps".
- **Proving one by trying everything is out of reach.** Even with identical states merged
  exactly, the number of distinct situations grows about 1.2 times every step and shows no sign
  of levelling off. A 479-step contest would need astronomically many. A faster simulation only
  moves that wall by a few dozen steps.
- **Searching between flags works, but buys frames, not seconds.** Cut at the flags and with
  every state dropped that could no longer reach the next flag in time, an exhaustive search
  finishes a segment in minutes. It beats the records' segments by 2 to 11 steps; the gains do
  not add up along a run, because the state a faster arrival leaves the runner in is a worse
  start for the next segment.
- **The records are close to the limit of their routes.** No other flag order beats any record,
  and every faster segment the searches found is plain running done more precisely, not a new
  trick.
- **The original has more glitches than were known.** Most notably an _air run_: the jump turns
  the speed of a fall into horizontal speed, up to 10,055 against the ground cap of 3,400 to
  5,250, and a _sky lift_ that throws the runner above the map, never to come back. All of them
  are the original's (checked on the original classes and on the 1.0.4 jar); none of them made a
  record faster.

## Why it cannot simply be brute-forced

A step offers 16 different presses (any combination of up, down, forward and back; left and
right only turn into forward or back). Sixteen to the power of 479 is a number with 577 digits,
but most of those runs end in the same place: what matters is how many _different_ situations a
step can hold. Counting them from the start of Mill Brook's flag hunt:

- after 44 steps there are 3 million distinct states, and the number grows by a quarter every
  step;
- nine tenths of that is noise: presses kept in the input buffer that nothing will ever read,
  and leftovers of the collision probes. Dropping what provably cannot matter shrinks a layer
  about tenfold;
- what remains is real variety (position, speed, move, timer): 164,000 situations at step 50,
  906,000 at step 60, still growing about 1.2 times a step.

At that rate, step 479 would hold far more states than any computer can store, and a computer
150 times faster gets about 25 steps further. The state space is finite (the map is finite and
every number is bounded), but the reachable part is far too large to enumerate.

<details>
<summary>The numbers</summary>

Breadth-first search from the start of Mill Brook's flag hunt, all 16 presses each step:

| Step | Full states | Without dead buffer bits | Physical (x, y, speed, hands, move, timer, facing, flags) | Position and move |
| ---: | ----------: | -----------------------: | --------------------------------------------------------: | ----------------: |
|   12 |       2,409 |                      201 |                                                       159 |                85 |
|   24 |      39,284 |                    3,271 |                                                     1,288 |               619 |
|   36 |     338,761 |                   33,638 |                                                     9,814 |             5,159 |
|   44 |   2,997,763 |                        – |                                                         – |                 – |

Merging on the physical situation alone (an underestimate of the exact count): 1,812 states at
step 10, 17,805 at 20, 100,597 at 30, 1,018,041 at 40, 163,670 at 50 with the stricter key,
906,392 at 60.

Of the 16 presses, a step usually cannot tell most apart: 1.4 to 1.9 simulations per state
suffice, giving 5.4 to 5.8 distinct successors.

</details>

<details>
<summary>How the states are compared</summary>

`optimal/engine.ts` keeps a run's state as one row of 93 ints: every field of the runner the
physics reads, the three probes and the lookahead probe, and the flags taken. It leaves out what
provably cannot change the future: the clock, `prevVx/prevVy` (overwritten before they are
read), `Probe.hit` and `Probe.distSq` (set by the sweep before every read), the score and the
render-only counters, and input buffer bits that no move can read before the buffer is cleared
(a fixpoint over the move graph: a move's own buffered conditions 10–13, those of the moves it
can enter keeping the buffer, and those of the pit's move 11, which keeps it from anywhere). A
test steps a full `World` and the engine side by side over thousands of random steps on four
levels and checks that the rows stay equal.

A step reads the presses only through conditions 6–13. The sim records which of them a step
evaluated (`inputReads`, opt-in, never read by the physics); presses that agree on all of them
take the same path, so they are simulated once. A test checks the grouped successors against
all 16 presses simulated one by one.

</details>

## Searching between flags

The idea (the author's): don't try to search a whole run, search from one flag to the next, and
drop every state that, at the fastest any runner can move, could no longer reach the flag in
time. With the record's own time for the segment as the budget, the explosion is cut where it
starts to matter: on Mill Brook the search drops 3.5 million states in a single step near the
flag. The first flag, which the record takes on step 85, turns out reachable on step 80, and the
search proves nothing reaches it sooner, _if_ its speed limit is right.

The catch is that limit. A proof needs the fastest a runner can ever cover k steps, and the
runner can move far faster than it runs: a tiger jump snaps the body 1.6 tiles forward in one
step, and the air run below flies at up to 300 units a step. Bounding that from the code is the
hard part; the searches here use the fastest the glitch hunt ever saw on each level, with a
margin, so they are strong evidence, not proofs. (The old bound in `tas/bound.ts`, 4.6 units per
ms, is not a true bound either: random play beats it over 80-step windows. It only steers the
bosses' search, so their records are unaffected.)

The second catch is the hand-over. The best arrival at a flag is not the best start for the next
segment, so a frontier of every state arriving within a few steps of the earliest is carried
over, and the work grows steeply with the slack: the cost multiplies by about e^(0.18 · slack),
doubling every four steps of it. On Mill Brook the first segment gained 5 steps; the second,
from 36,567 carried states, peaked at 30 million states (11 GB) and kept only 2.

<details>
<summary>Segment results</summary>

| Search                                        | Contest, segment                          | Record |                  Found | Cost                    |
| --------------------------------------------- | ----------------------------------------- | -----: | ---------------------: | ----------------------- |
| exhaustive, 146 units/step cut                | Mill Brook flags, start → flag 1          |     85 |                     80 | 97 s, peak 1.7 M states |
| exhaustive chain, hunt envelope, frontier ±4  | Mill Brook flags, start → flag 1          |     85 |                     80 | 434 s, peak 11.1 M      |
| same, continued                               | Mill Brook flags, → flag 2                |    137 |                    135 | 2,781 s, peak 30.7 M    |
| exhaustive from the record's state            | Pine Island flags, flag 2 → 3             |    423 |                    414 | –                       |
| exhaustive from the record's state            | Pine Island flags, other segments         |      – | gave up at 25 M states | –                       |
| exhaustive from the record's state at 600–640 | Oak Valley sprint, → checkpoint 2         |    681 |            none faster | 1 s, peak 10,854        |
| free Go-Explore from the record's state       | Pine Island flags, flag 1 → 2             |    338 |                    327 | 200 M steps             |
| same                                          | Pine Island flags, flag 3 → 4             |    593 |                    587 | 200 M steps             |
| same                                          | Pine Island flags, flag 4 → 5             |    864 |                    858 | 300 M steps             |
| same                                          | Pine Island sprint, checkpoint 5 → finish |  1,171 |                  1,166 | 200 M steps             |

Steps are absolute from the start. "From the record's state" segments are not chained: each starts
where the record was, so their gains cannot be summed into one run.

Other searches over whole runs, all without the human limits (chords, presses on any step, frame-
perfect timing allowed):

- **Frame-level polish** of every record (each step tried as all 16 presses, every press moved by
  up to 6 steps, random pairs of nearby edits): 18 records do not move; North Hill sprint 965 → 964,
  Juniper Point sprint 1,151 → 1,148, Oak Valley sprint 1,342 → 1,341, Grass Bay sprint 1,097 → 1,095,
  Bird Bay sprint 1,318 → 1,317, West Harbour sprint 2,201 → 2,200.
- **Beam search** (exact merging, up to 200,000 states a step, ranked by a wall-aware distance
  field): did not beat Mill Brook's flag hunt in 285 M steps; its best states ran level with the
  record all the way.

</details>

## Other flag orders

Ranked by a time-around-the-blocks estimate over all 120 orders, the records' orders come first
on eleven of the twelve flag hunts. Grass Bay was the exception: 1-0-2-4-3 looked 13 % shorter than
the record's 0-1-2-3-4. Fourteen alternatives were searched under the bosses' human limits
(`tas/orderSearch.ts`, the search with a forced order), the two closest again with the records'
budget: **none beat a record.** The closest is Main St. 0-1-2-4-3, 0.39 s behind. Grass Bay's
promising order came out 17 s slower: the estimate cannot see which walls take a slow climb.

<details>
<summary>The orders tried</summary>

| Level         | Order     |                              Time |                                Record |
| ------------- | --------- | --------------------------------: | ------------------------------------: |
| Mill Brook    | 1-0-2-3-4 |                             18.33 |                                 14.37 |
| North Hill    | 1-0-2-3-4 |             no run in 150 M steps |                                 34.53 |
| Main St.      | 0-1-2-4-3 |               24.81 (500 M steps) |                                 24.42 |
| East End      | 0-2-1-3-4 |                            no run |                                 38.97 |
| Juniper Point | 0-1-2-4-3 |                             39.00 |                                 33.63 |
| Oak Valley    | 0-1-2-4-3 |                            no run |                                 41.91 |
| Grass Bay     | 1-0-2-4-3 |                     51.66 (500 M) |                                 34.23 |
| Grass Bay     | 1-0-2-3-4 |                             45.81 |                                 34.23 |
| Grass Bay     | 0-1-2-4-3 |                             44.46 |                                 34.23 |
| Sand Cape     | 0-1-4-3-2 |                             37.50 |                                 36.51 |
| Central Park  | 0-1-2-3-4 |                             29.79 | 27.63 (its record swaps the last two) |
| Bird Bay      | 0-2-1-3-4 | polished back to 0-1-2-3-4, 56.76 |                                 40.32 |
| West Harbour  | 0-1-3-2-4 | polished back to 0-1-2-3-4, 41.49 |                                 41.28 |
| Pine Island   | 0-1-3-2-4 |                            no run |                                 25.92 |

</details>

## Glitches of the original

A Go-Explore without human limits (`optimal/hunt.ts`, `hunt2.ts`) played every contest for
tens of millions of steps with detectors for what a parkour game should not do. Every glitch
below was replayed on the original's classes (`reference/oracle`, identical move, position and
speed on every step) and the ones filmed also on the 1.0.4 jar in an emulator. Footage of the
first three: `Ф59_glitch-air-run`, `Ф59_glitch-sky-lift`, `Ф59_glitch-zip-up` in the video's
folder; emulator takes in `reference/emulator/scripts/k790-*.txt`.

- **The air run.** Sometimes a ground move (running, turning, stopping) carries on while the
  runner is in the air: a tiger jump whose landing roll starts over an edge rolls on in mid-air
  and ends in a "run"; running off a roof onto one a little lower keeps the run; a roll, a turn
  or a spider jump can end the same way. A jump from such a run takes the length of the whole
  velocity, fall included, and points it up and forward: the runner leaves at up to 10,055 units
  of horizontal speed, three times the running speed, and keeps it until it lands. The strongest
  form turns in mid-air first (BACK): the turn kills the horizontal speed, the runner falls
  straight down gaining speed, and UP at the end throws it back the way it came. On Pine Island
  UP works on 21 of 25 steps there, so a player can do it. Its windows elsewhere: tiger jump
  within 4 steps of the right one, then UP within 6. _No search used it to go faster:_ it needs a
  roof edge and a drop where the route wants them, and landing from the high jump it makes often
  ends in a stumble.
- **The sky lift.** The pit check puts a runner that fell too deep two tiles above the lowest
  floor of its column. The map's first and last columns have no floor at all on six levels, so
  there that "floor" is the top of the map: roll under the edge wall into the last column and the
  runner is thrown above the map in one step (51 tiles on Pine Island), keeps its speed outwards,
  and falls and is thrown up again forever beyond the map's edge. An exhaustive search of every
  press for 200 steps afterwards finds no way back. The roll has to start on exactly one step.
- **Through the floor and back.** In the landing grip after an air-run roll (move 45, hands
  anchored) the body can sink below a roof and is then snapped back onto it by the hands: 2.7 tiles
  up in one step on the oracle trace, 4.6 in another run. On screen the runner dips out of view
  for a frame and pops up.
- **Known before:** the facing flicker of a wall flip that drops down a wall, and the spider
  jump off flat ground (06). Both are in the 1.0.4 build too.
- **Not glitches:** a body "inside" walls is the thin wall tiles (17, 18) passed in a flip or the
  ledged block (6) rolled under; rises of 5–6 tiles without support are the air run's own jump;
  apparent soft-locks always had a way out a few steps later.

<details>
<summary>Under the hood</summary>

- Air run: move 60 (the tiger jump's landing roll, parent 21) has `next` = 2 and nothing checks
  for a floor; 2's own transitions to falling do not fire within the lookahead ray's reach of the
  ground (condition 45). Jump 18 (impulse 0, 5650/1450) builds its velocity from the speed's
  length. Oracle: North Hill flags 1,530 steps, q = −8,136; Pine Island flags 1,036 steps,
  q = −10,055; both identical to the remake.
- Sky lift: `step.ts` pit check, `y = killRows[col] << 10 − 2048`; `Level.killRows` is the lowest
  row holding a tile 1, 3, 5–8, which is 0 in the edge columns of levels 5, 6, 9, 10, 11, 12 (by
  the game's numbering) and `undefined << 10 = 0` beyond the map. Oracle: Pine Island flags 941
  steps; emulator: Bird Bay on the 1.0.4 jar.
- Through the floor: Bird Bay flags, oracle 1,773 steps, y 11,451 → 8,744 in move 45 (snap 8,
  flags 0x9).
- Windows (`optimal/recipe.ts`, the press moved alone with the others fixed): air run on Pine
  Island tiger jump −2/+1, UP −1/+4; sky lift on Bird Bay roll 1 step; the air turn's UP 21 of 25.

</details>

## The 1.0.4 build

The speedrun.com download (`PER_K790.jar`, 1.0.4 for the Sony Ericsson K790, July 2007) next to
the original kept here (1.0.8, September 2007, repacked by MC_KoMpOtIk): levels and physics tables
are byte for byte the same, and the bytecode of the whole physics (conditions, ray march, probes,
runner step, relative tiles) matches instruction for instruction once the obfuscated names are
set aside. 1.0.4 plays a sound when a flag is taken where 1.0.8 vibrates; the rest is strings
and the sound system. The remake's Mill Brook sprint record finishes on the 1.0.4 jar in 0:28.02,
as on 1.0.8. In the emulator a route has to be played one step later than in the remake (the
`route` command's shift 1) for frame-exact tricks to land.

## Tools

- `optimal/engine.ts` (state rows, grouped expansion), `layer.ts` (exact merging), `explore.ts`,
  `diversity.ts` (layer widths), `segment.ts`, `seg2.ts`, `chain.ts` (between flags), `beam.ts`,
  `polish.ts`, `goal.ts` (free Go-Explore over a segment), `orders.ts` and `tas/orderSearch.ts`
  (flag orders), `hunt.ts`, `hunt2.ts` (glitches), `recipe.ts`, `toRoute.ts`, `airspots.ts`
  (human recipes and windows), `oracle.ts`, `show.ts` (replays), `headlessReel.mjs` (footage).
- `packages/tools/native`: the step in C, byte for byte the same successors as `Engine.expand`
  over 2.4 million expansions on every level and mode, about nine times faster per thread. The
  searches above still run in TypeScript; moving the segment search onto it would buy about a
  hundred times the throughput, which the growth above turns into a few more steps of slack.
