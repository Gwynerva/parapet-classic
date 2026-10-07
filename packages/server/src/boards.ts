/**
 * Leaderboards with bounded storage. A board is one (level, mode); it keeps one personal
 * best per player key and at most `BOARD_MAX_PLAYERS` of them (the worst are dropped), and
 * only the top `REPLAY_KEEP` runs keep their input log for watching. Verify-only runs are
 * never stored. `MemoryBoardStore` is the base; `JsonBoardStore` persists after every change
 * by writing a temporary file and renaming it.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  defaultLeaderboardSort,
  type InputRun,
  type LeaderboardSort,
  type RunMode,
  type RunRecord,
} from '@parapet/protocol';

export const BOARD_MAX_PLAYERS = 5000;
export const REPLAY_KEEP = 100;

export type UpsertOutcome =
  { stored: true; replaced: RunRecord | null } | { stored: false; best: RunRecord };

export interface BoardStore {
  /** Store `run` as the player's personal best when it beats the current one. */
  upsert(run: RunRecord, input: InputRun[]): UpsertOutcome;
  /** Runs of one board, best first (flagged runs excluded). */
  list(levelId: number, mode: RunMode, sort: LeaderboardSort, limit: number): RunRecord[];
  /** 1-based position of `run` on its board, or null when it is not on it. */
  rank(run: RunRecord, sort: LeaderboardSort): number | null;
  /** Position `run` would take on its board if it were stored. */
  hypotheticalRank(run: RunRecord, sort: LeaderboardSort): number;
  /** The player's personal bests on every board. */
  bestsOf(playerKey: string): RunRecord[];
  /** The input log of a stored run, when it is still kept. */
  replay(id: string): { run: RunRecord; input: InputRun[] } | null;
  count(): number;
}

/** Best first: time ascending or score descending, with stable tie-breaks. */
export function compareRuns(sort: LeaderboardSort): (a: RunRecord, b: RunRecord) => number {
  return (a, b) => {
    const primary = sort === 'time' ? a.time - b.time : b.score - a.score;
    if (primary !== 0) return primary;
    const secondary = sort === 'time' ? b.score - a.score : a.time - b.time;
    if (secondary !== 0) return secondary;
    if (a.submittedAt !== b.submittedAt) return a.submittedAt < b.submittedAt ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

function boardKey(levelId: number, mode: RunMode): string {
  return `${levelId}:${mode}`;
}

interface Board {
  /** Personal bests by player key. */
  bests: Map<string, RunRecord>;
}

export class MemoryBoardStore implements BoardStore {
  protected readonly boards = new Map<string, Board>();
  protected readonly replays = new Map<string, InputRun[]>();
  protected readonly byId = new Map<string, RunRecord>();

  protected board(levelId: number, mode: RunMode): Board {
    const key = boardKey(levelId, mode);
    let board = this.boards.get(key);
    if (!board) {
      board = { bests: new Map() };
      this.boards.set(key, board);
    }
    return board;
  }

  protected sorted(levelId: number, mode: RunMode, sort: LeaderboardSort): RunRecord[] {
    return [...this.board(levelId, mode).bests.values()]
      .filter((r) => !r.flagged)
      .sort(compareRuns(sort));
  }

  upsert(run: RunRecord, input: InputRun[]): UpsertOutcome {
    const board = this.board(run.levelId, run.mode);
    const sort = defaultLeaderboardSort(run.mode, run.levelId);
    const current = board.bests.get(run.playerKey);
    if (current && compareRuns(sort)(current, run) <= 0)
      return { stored: false, best: { ...current } };
    if (current) {
      this.byId.delete(current.id);
      this.replays.delete(current.id);
    }
    const stored = { ...run };
    board.bests.set(run.playerKey, stored);
    this.byId.set(stored.id, stored);
    this.replays.set(
      stored.id,
      input.map((r) => ({ ...r })),
    );
    this.trim(board, sort);
    this.changed();
    return { stored: true, replaced: current ? { ...current } : null };
  }

  /** Drop the worst players beyond the cap and the replays beyond the top. */
  private trim(board: Board, sort: LeaderboardSort): void {
    const ranked = [...board.bests.values()].sort(compareRuns(sort));
    for (let i = BOARD_MAX_PLAYERS; i < ranked.length; i++) {
      const r = ranked[i]!;
      board.bests.delete(r.playerKey);
      this.byId.delete(r.id);
      this.replays.delete(r.id);
    }
    let kept = 0;
    for (const r of ranked.slice(0, BOARD_MAX_PLAYERS)) {
      if (r.flagged) continue;
      kept++;
      if (kept > REPLAY_KEEP) this.replays.delete(r.id);
    }
  }

  list(levelId: number, mode: RunMode, sort: LeaderboardSort, limit: number): RunRecord[] {
    return this.sorted(levelId, mode, sort)
      .slice(0, Math.max(0, limit))
      .map((r) => ({ ...r }));
  }

  rank(run: RunRecord, sort: LeaderboardSort): number | null {
    const index = this.sorted(run.levelId, run.mode, sort).findIndex((r) => r.id === run.id);
    return index === -1 ? null : index + 1;
  }

  hypotheticalRank(run: RunRecord, sort: LeaderboardSort): number {
    const cmp = compareRuns(sort);
    let better = 0;
    for (const r of this.sorted(run.levelId, run.mode, sort)) {
      if (r.id !== run.id && r.playerKey !== run.playerKey && cmp(r, run) < 0) better++;
    }
    return better + 1;
  }

  bestsOf(playerKey: string): RunRecord[] {
    const out: RunRecord[] = [];
    for (const board of this.boards.values()) {
      const r = board.bests.get(playerKey);
      if (r) out.push({ ...r });
    }
    return out.sort((a, b) => a.levelId - b.levelId || a.mode.localeCompare(b.mode));
  }

  replay(id: string): { run: RunRecord; input: InputRun[] } | null {
    const run = this.byId.get(id);
    const input = this.replays.get(id);
    if (!run || !input) return null;
    return { run: { ...run }, input: input.map((r) => ({ ...r })) };
  }

  count(): number {
    return this.byId.size;
  }

  protected changed(): void {
    // persistence hook
  }
}

interface BoardFile {
  runs: RunRecord[];
  replays: Record<string, InputRun[]>;
}

export class JsonBoardStore extends MemoryBoardStore {
  readonly file: string;

  constructor(file: string) {
    super();
    this.file = file;
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<BoardFile> | null;
      if (!parsed || !Array.isArray(parsed.runs)) {
        throw new Error(`${file} is not a board store (expected { "runs": [...] })`);
      }
      for (const run of parsed.runs) {
        // Records of the first schema (no player key) belonged to no claimed name: drop them.
        if (typeof run.playerKey !== 'string' || run.playerKey === '') continue;
        this.board(run.levelId, run.mode).bests.set(run.playerKey, run);
        this.byId.set(run.id, run);
      }
      for (const [id, input] of Object.entries(parsed.replays ?? {})) {
        if (this.byId.has(id)) this.replays.set(id, input);
      }
    }
  }

  protected override changed(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    const data: BoardFile = { runs: [...this.byId.values()], replays: {} };
    for (const [id, input] of this.replays) data.replays[id] = input;
    writeFileSync(tmp, JSON.stringify(data) + '\n', 'utf8');
    renameSync(tmp, this.file);
  }
}
