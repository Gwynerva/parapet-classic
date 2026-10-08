# 09. Tool-assisted runs: the bosses' records

The boss contests (Flag hunt and Sprint without the rival, on every level) are raced against
times found by a search over the simulation (`packages/tools/src/tas`). Only the times reach
the game; the inputs stay local. What the search taught about the game:

## How the developers played

The original's twelve rival recordings (05 §Rivals) are the only human input the jar holds.
Every entry is a single press on a single step: `UP`, `DOWN`, or an arrow already resolved to
FORWARD or BACK. There is no held key and no two keys at once. A run has 30 to 65 presses, half
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
  precise press, thousands of times per level.
- Polishing tries every press deleted, moved by up to 8 steps or swapped, and new presses in
  the pauses. A last pass drops every press the run does without: the raw runs had 49 to 209
  presses, the tidied ones 14 to 56, as many as the developers used.

## What it found

| Level           | Mode      | Boss  | Original's record | Mission target | Precise moments |
| --------------- | --------- | ----- | ----------------- | -------------- | --------------- |
| 1 Mill Brook    | Flag hunt | 14.37 | 25.00             | 80.00          | 0               |
| 1 Mill Brook    | Sprint    | 28.14 | 35.00             | 61.50 (rival)  | 0               |
| 2 North Hill    | Flag hunt | 34.53 | 46.00             | 120.00         | 0               |
| 2 North Hill    | Sprint    | 28.77 | 38.00             | 50.95          | 1               |
| 3 Main St.      | Flag hunt | 25.38 | 36.00             | 120.00         | 0               |
| 3 Main St.      | Sprint    | 30.66 | 37.00             | 47.55          | 1               |
| 4 East End      | Flag hunt | 39.00 | 58.00             | 120.00         | 0               |
| 4 East End      | Sprint    | 27.69 | 34.00             | 41.65          | 0               |
| 5 Juniper Point | Flag hunt | 33.75 | 55.00             | 70.00          | 1               |
| 5 Juniper Point | Sprint    | 34.53 | 41.00             | 45.53          | 0               |
| 6 Oak Valley    | Flag hunt | 41.91 | 55.00             | 80.00          | 0               |
| 6 Oak Valley    | Sprint    | 40.71 | 49.00             | 50.84          | 1               |
| 7 Grass Bay     | Flag hunt | 34.23 | 49.00             | 80.00          | 0               |
| 7 Grass Bay     | Sprint    | 33.09 | 46.00             | 45.26          | 0               |
| 8 Sand Cape     | Flag hunt | 36.51 | 45.00             | 80.00          | 0               |
| 8 Sand Cape     | Sprint    | 21.93 | 29.00             | 30.59          | 1               |
| 9 Central Park  | Flag hunt | 27.63 | 40.00             | 65.00          | 0               |
| 9 Central Park  | Sprint    | 31.41 | 42.00             | 41.48          | 1               |
| 10 Bird Bay     | Flag hunt | 40.38 | 58.00             | 75.00          | 2               |
| 10 Bird Bay     | Sprint    | 40.71 | 55.00             | 49.76          | 1               |
| 11 West Harbour | Flag hunt | 40.59 | 70.00             | 95.00          | 2               |
| 11 West Harbour | Sprint    | 66.33 | 90.00             | 85.85          | 1               |
| 12 Pine Island  | Flag hunt | 25.92 | 40.00             | 49.00          | 0               |
| 12 Pine Island  | Sprint    | 36.12 | 47.00             | 45.91          | 1               |

Times in seconds; the original's record is the default holder's time in the save data
(05 §Save data); the Sprint target is the rival's recording plus its start delay.

- Her times are 15 to 45 % below the original's default records, and every Sprint beats the
  developers' rival comfortably (the rivals' runs are relaxed: on Mill Brook it finishes in
  58.5 s plus a 3 s handicap, against her 28.1 s).
- In eleven of twelve flag hunts the fastest order is the order the level data lists the
  flags in: the designers numbered them along the way. Central Park is the exception, where
  the fourth and fifth flags are faster swapped.
- The precise moments are of two kinds. A landing roll is one: `DOWN` on the exact step the
  feet touch rolls on at speed; one step early it starts a different move in the air (64)
  and the landing ends in a crash. The other is in sprints: a checkpoint flag counts only when
  the feet or the body centre are in its tile, so a long jump that grazes it works on one step
  and flies over it on the next.
- No record is more than the four keys pressed a few dozen times. Whether a human can match
  one is now the contest.
