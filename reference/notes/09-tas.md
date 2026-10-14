# 09. Tool-assisted runs: the bosses' records

The boss contests (Flag hunt and Sprint without the rival, on every level) are raced against
times found by a search over the simulation (`packages/tools/src/tas`). Only the times reach
the game, with two seconds of poses around each flag (the glimpses a boss shows of its route,
`packages/content/bosses/glimpses.json`); the inputs stay local. What the search taught about
the game:

## How the developers played

The original's twelve rival recordings (05 §Rivals) are the only human input the jar holds.
Every entry is a single press on a single step: `UP`, `DOWN`, or an arrow already resolved to
FORWARD or BACK. There is no held key and no two keys at once. A run has 21 to 65 presses, half
of them a second or more apart (median gap 35 steps); the closest pairs are 1 to 3 steps
apart. The runner does most of the work itself: a press starts a move that plays out on its
own.

These habits became the search's limits: single presses of one key, at least 3 steps
(≈ 100 ms) apart, and no press that only works on its exact step.

## The search

- A step costs about a microsecond in Node; `World.saveState()/restoreState()` make the
  world cheap to branch from.
- The archive keeps, per cell (progress, tile, footing, facing, speed), the earliest moment
  any run reached it. Picking cells by "clock + lower bound of what is left" and playing a few
  random presses from there finds Mill Brook's flag hunt within five million steps.
- The lower bound is the horizontal tour through the remaining flags at top speed (about 3.7
  units per ms, with a margin for the snaps of ledge grabs). Mill Brook's flags lie on one
  line west of the start: the bound says 10.4 s, the best run takes 14.37 s.
- A finished run only counts when no press is frame-perfect: moved one step early or late
  (the later presses unchanged or moved along), it must still finish within 300 ms. Turned
  down runs ban their precise press, and the cells reached through it, so the archive stops
  building on it. Without the bans, the earliest arrivals kept leading back to the same
  precise press, thousands of times per level. (The first records, of 0.3.0, let one such
  press through after half the search's budget and two in its last quarter; eleven of the
  24 kept one or two. All were searched again for 0.5.0 without any.)
- For style the archive keeps a cell per place and per level of style, a state after any
  stumble, crash or fall is dropped, a time cap prunes instead of the best time, and finished
  runs rank by style, then time (`style.ts`, `run --style`).
- Polishing tries every press deleted, moved by up to 8 steps or swapped, and new presses in
  the pauses. A last pass drops every press the run does without: the raw runs had 49 to 209
  presses, the tidied ones 14 to 56, as many as the developers used.

## What it found

Since 0.5.0 the bosses race **stylish** runs: the showiest found within 15 % of the fastest
human run (see Style below). Next to them, the fastest human run and the showiest within 5 %.

| Level           | Mode      | Boss (+15 %) | Fastest | +5 %  | Original's record | Mission target |
| --------------- | --------- | ------------ | ------- | ----- | ----------------- | -------------- |
| 1 Mill Brook    | Flag hunt | 16.29        | 14.37   | 15.00 | 25.00             | 80.00          |
| 1 Mill Brook    | Sprint    | 31.86        | 27.99   | 29.37 | 35.00             | 61.50 (rival)  |
| 2 North Hill    | Flag hunt | 39.21        | 34.53   | 35.58 | 46.00             | 120.00         |
| 2 North Hill    | Sprint    | 33.27        | 28.95   | 29.94 | 38.00             | 50.95 (rival)  |
| 3 Main St.      | Flag hunt | 27.39        | 24.42   | 25.62 | 36.00             | 120.00         |
| 3 Main St.      | Sprint    | 34.14        | 30.39   | 31.56 | 37.00             | 47.55 (rival)  |
| 4 East End      | Flag hunt | 44.64        | 38.97   | 40.38 | 58.00             | 120.00         |
| 4 East End      | Sprint    | 31.17        | 27.48   | 28.74 | 34.00             | 41.65 (rival)  |
| 5 Juniper Point | Flag hunt | 38.40        | 33.63   | –     | 55.00             | 70.00          |
| 5 Juniper Point | Sprint    | 39.24        | 34.53   | 35.88 | 41.00             | 45.53 (rival)  |
| 6 Oak Valley    | Flag hunt | 47.79        | 41.91   | 43.98 | 55.00             | 80.00          |
| 6 Oak Valley    | Sprint    | 45.36        | 40.26   | 41.79 | 49.00             | 50.84 (rival)  |
| 7 Grass Bay     | Flag hunt | 38.88        | 34.23   | –     | 49.00             | 80.00          |
| 7 Grass Bay     | Sprint    | 37.50        | 32.91   | 34.14 | 46.00             | 45.26 (rival)  |
| 8 Sand Cape     | Flag hunt | 41.58        | 36.51   | 38.28 | 45.00             | 80.00          |
| 8 Sand Cape     | Sprint    | 25.17        | 21.96   | 22.80 | 29.00             | 30.59 (rival)  |
| 9 Central Park  | Flag hunt | 31.44        | 27.63   | 28.71 | 40.00             | 65.00          |
| 9 Central Park  | Sprint    | 36.81        | 32.01   | 33.54 | 42.00             | 41.48 (rival)  |
| 10 Bird Bay     | Flag hunt | 45.81        | 40.32   | –     | 58.00             | 75.00          |
| 10 Bird Bay     | Sprint    | 45.27        | 39.54   | 41.34 | 55.00             | 49.76 (rival)  |
| 11 West Harbour | Flag hunt | 47.16        | 41.28   | 43.20 | 70.00             | 95.00          |
| 11 West Harbour | Sprint    | 75.69        | 66.03   | –     | 90.00             | 85.85 (rival)  |
| 12 Pine Island  | Flag hunt | 29.52        | 25.92   | 27.18 | 40.00             | 49.00          |
| 12 Pine Island  | Sprint    | 39.48        | 35.97   | 37.59 | 47.00             | 45.91 (rival)  |

Times in seconds; the original's record is the default holder's time in the save data
(05 §Save data); the Sprint target is the rival's recording plus its start delay. No run in
the table has a frame-perfect press; "–" is a contest where no stylish run without a stumble
was found within 5 % (below).

- The fastest human runs are 16 to 43 % below the original's default records, the bosses'
  stylish ones 4 to 35 %, and every Sprint still beats the developers' rival comfortably (the
  rivals' runs are relaxed: on Mill Brook it finishes in 58.5 s plus a 3 s handicap, against
  the boss's 31.9 s).
- In eleven of twelve flag hunts the fastest order is the order the level data lists the
  flags in: the designers numbered them along the way. Central Park is the exception, where
  the fourth and fifth flags are faster swapped.
- The precise moments the first search let through were of two kinds. A landing roll is one:
  `DOWN` on the exact step the feet touch rolls on at speed; one step early it starts a
  different move in the air (64) and the landing ends in a crash. The other is in sprints: a
  checkpoint flag counts only when the feet or the body centre are in its tile, so a long jump
  that grazes it works on one step and flies over it on the next. Doing without them cost at
  most 0.7 s (West Harbour's flag hunt), and seven of the eleven came out faster without: the
  longer search found better routes.
- No record is more than the four keys pressed a few dozen times. Whether a human can match
  one is now the contest.

## Style

To see what tricks cost, every contest was searched a second and a third time for style:
the most within 5 % and within 15 % of its fastest human run, under the same human limits and
never stumbling, crashing or falling. A trick's worth is its points in the original's Score
mode, and every repeat of a kind is worth half the one before, so variety pays; the tiger jump
counts next to nothing (`packages/tools/src/tas/style.ts`).

- **Style is cheap at first, then dear.** Within 5 % (20 contests) a run gains 860 style points
  on average for 4.3 % of time, 1.6 ms a point; within 15 % (all 24), 1223 points for 13.7 %,
  3.8 ms a point. The first two thirds of the style cost a third of the time.
- **What a trick costs**, roughly (a stylish run's loss shared among the kinds it added by the
  points each brought):

  | Trick                | Points | In the fastest runs | ms per added trick |
  | -------------------- | ------ | ------------------- | ------------------ |
  | tiger jump (kong)    | 100    | 173, in all 24      | ~0                 |
  | tic-tac              | 50     | 47                  | 76                 |
  | pole spin, pole jump | 50     | 6, 6                | 104, 161           |
  | front flip           | 100    | 8                   | 149                |
  | back flip            | 150    | 4                   | 220                |
  | dash                 | 100    | 8                   | 234                |
  | kong onto a ledge    | 100    | 4                   | 250                |
  | monkey flip          | 250    | 0                   | 474                |
  | monkey vault         | 200    | 0                   | 534                |
  | spider jump          | 250    | 1                   | 536                |
  | wall flip            | 250    | 0                   | 883                |

- **The game pays for speed, not for style.** The fast tricks are in every fastest run anyway:
  the tiger jump is the quickest way over most obstacles, tic-tacs and poles cost next to
  nothing. The showy ones cost a quarter of a second to almost a second each and earn nothing
  in a timed mission; only the Score mode pays for them. A fastest run never does a wall flip,
  a monkey vault or a monkey flip, and a spider jump once in 24.
- **The fastest runs stumble on purpose.** Four of them go through a fail state: Grass Bay's
  flag hunt lands a back flip badly and stumbles (82), Juniper Point's stumbles off a low wall,
  West Harbour's sprint stumbles three times (twice out of a flip) and Bird Bay's flag hunt
  stumbles once and crashes (84) taking its last flag. A stumble halves the speed for 810 ms, which is cheaper than
  the clean way round. No stylish run within 5 % of those four was found without a stumble.
