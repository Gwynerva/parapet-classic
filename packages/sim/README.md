# @parapet/sim

Deterministic simulation core of Parapet. No DOM, no floats, no randomness: integer math with
Java `int` semantics, a fixed step of 30 time units (about 34 ms of real time) and
press-only input, exactly like the original game. The same package runs in the browser client
and on the server that verifies replays.

## Concepts

- **Units.** 1024 units per tile, 32 px per tile. Velocities are units per 1024 time units.
- **Runner** (`RunnerState`) — a player or a rival: feet position, hands offset, velocity,
  timers, three collision probes and the current move.
- **Moves** (`MoveTable`, from `moves.json`) — the 135-state machine of the original with
  transition lists, impulse types ("z-types") and snap/root-motion types ("x-types"). New moves
  are new table rows.
- **Conditions** (`evalCondition`) — the 81 predicates referenced by transition lists.
- **Collision** — a grid ray march over tile shapes, a literal port of the original.
- **Rules** (`MissionRules`) — checkpoints, flags, finish and time limits per mission type.
- **World** — level + runners + rules + clock; `step(bits)` advances everything by one step.
- **Replays** — input logs as runs of `(ticks, bits)`; `World.recorder` records the player,
  `World.replay(log)` reproduces a run. Rivals are the original recordings replayed through the
  same physics.

## Quick start

```ts
import { createRun } from '@parapet/sim';

const world = createRun({ mode: 'sprint', level, mission, moves, tables, rival });
world.step(Input.UP); // presses collected since the previous step, 0 when none
world.player.x; // feet position in units
world.rules.result; // { finished, timeUp, time, splits } once the run ended
const log = world.recorder.finish(); // input log for the leaderboard
```

Press bits: `UP = 1`, `DOWN = 2`, `RIGHT = 4 | (facingRight ? FORWARD : BACK)`,
`LEFT = 8 | (facingRight ? BACK : FORWARD)` with `FORWARD = 16`, `BACK = 32`. The forward/back
bits are resolved by the client at press time from the player's current facing.

## Tests

- `test/golden.test.ts` — traces produced by the Java oracle (`reference/oracle`) from the
  original class files; every field of every step must match bit for bit.
- `test/determinism.test.ts` — replay round trips with seeded random input, and every original
  rival recording reaching its finish.

Run `npx vitest run packages/sim`.
