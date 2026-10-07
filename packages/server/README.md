# @parapet/server

The leaderboard service: verifies replays with the same simulation the client runs, keeps one
personal best per player and board, and hands out claimed names. No framework, no database;
state lives in two JSON files under `data/` (ignored by git). Run it with `npm run server`
from the repository root (port 8787; the Vite dev server proxies `/api` to it).

## Endpoints

| Method | Path                                           | What it does                                                                                                                                                                           |
| ------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`                                  | Simulation version, number of stored runs and claimed names.                                                                                                                           |
| GET    | `/api/leaderboard/:levelId/:mode?sort=&limit=` | Top of a board, best first. Modes: sprint, flags, score, challenge. Default sort: time, or score where the mode scores.                                                                |
| POST   | `/api/runs`                                    | A `RunSubmission`. Without `identity` the run is only verified (the response carries the would-be rank); with it the run becomes the player's personal best when it beats the old one. |
| POST   | `/api/names`                                   | `{ name }` claims a free name: the response carries the token the device keeps and a one-time recovery code.                                                                           |
| POST   | `/api/names/recover`                           | `{ name, recoveryCode }` issues a new token and a new code (the old ones stop working).                                                                                                |
| GET    | `/api/names/:name`                             | Whether the name is valid and free.                                                                                                                                                    |
| GET    | `/api/players/:name`                           | The player's personal bests.                                                                                                                                                           |
| GET    | `/api/runs/:id/replay`                         | The input log of a stored top run (for watching it as a ghost).                                                                                                                        |

Errors are JSON `{ ok: false, code, error }` with codes `invalid` (400), `unauthorized` (401),
`not-found` (404), `name-taken` (409), `limit` (413), `mismatch` / `unsupported` (422) and
`rate-limited` (429, with `Retry-After`).

## Trust model

- **The client is never trusted.** Every submission is replayed by the server (`verify.ts`),
  which derives the time, the score and whether the mission goal was met; a claim that differs
  from the replay is a `mismatch`. The replay also carries the simulation version, the ruleset
  id and hashes of the level, move table and physics tables, so a run recorded on edited
  content is refused (`unsupported`) rather than ranked.
- **Identity without accounts.** A name is claimed once; the server stores the SHA-256 of the
  token and of the recovery code, never the secrets. Names collide on a normalised key (NFKC,
  lower case, separators dropped, Cyrillic look-alikes folded into Latin), so `Pаrapet` with a
  Cyrillic `а` cannot impersonate `Parapet`.
- **Plausibility** (`plausibility.ts`) is a soft net on top of the replay: a sprint far faster
  than the designers' own run, a score the step count cannot carry, a run of a few steps. Such
  runs are reported in the log and kept off the boards (`outcome: "flagged"`), never refused,
  so an honest breakthrough can be reviewed.
- **Rate limits** (`limits.ts`): 20 submissions per hour per address, 60 per hour per name and
  5 name claims per day per address, as token buckets in memory. `X-Forwarded-For` is honoured,
  so put a trusted proxy in front when deploying.

## Storage and retention

`boards.ts` keeps, per board, one personal best per player key. A board holds at most 5000
players (the worst are dropped on insert) and only the top 100 runs keep their input log for
replays; verify-only and flagged runs are not stored. Data therefore grows with the number of
players, never with traffic. The `BoardStore` and `NameStore` interfaces are the seam for a
database later; `JsonBoardStore` / `JsonNameStore` write `data/runs.json` and `data/names.json`
atomically (temporary file plus rename).

## Environment

`PORT` (8787), `ALLOWED_ORIGINS` (comma-separated CORS origins, default the Vite dev server),
`DATA_DIR` (default `packages/server/data`).

## Command line

```bash
node packages/server/src/cli.ts verify-replay <file.json>
```

Replays a submission saved as JSON and prints the claimed and computed values.
