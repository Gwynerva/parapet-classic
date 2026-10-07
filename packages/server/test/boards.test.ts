import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { RunRecord } from '@parapet/protocol';
import { compareRuns, JsonBoardStore, MemoryBoardStore, REPLAY_KEEP } from '../src/boards.ts';

function record(patch: Partial<RunRecord> & { id: string; playerKey: string }): RunRecord {
  return {
    levelId: 2,
    mode: 'sprint',
    withRival: false,
    playerName: patch.playerKey,
    character: 0,
    time: 40000,
    score: 1000,
    finished: true,
    timeUp: false,
    won: true,
    steps: 1334,
    hash: 1,
    simVersion: 'parapet-sim@0.2.0',
    rulesetId: 'classic',
    flagged: false,
    submittedAt: '2026-10-06T12:00:00.000Z',
    ...patch,
  };
}

const input = [{ ticks: 3, bits: 1 }];

describe('MemoryBoardStore', () => {
  it('keeps one personal best per player and ranks them', () => {
    const store = new MemoryBoardStore();
    expect(store.upsert(record({ id: 'a1', playerKey: 'alice', time: 30000 }), input)).toEqual({
      stored: true,
      replaced: null,
    });
    const slower = store.upsert(record({ id: 'a2', playerKey: 'alice', time: 35000 }), input);
    expect(slower.stored).toBe(false);
    if (!slower.stored) expect(slower.best.id).toBe('a1');
    const faster = store.upsert(record({ id: 'a3', playerKey: 'alice', time: 25000 }), input);
    expect(faster).toMatchObject({ stored: true, replaced: { id: 'a1' } });
    store.upsert(record({ id: 'b1', playerKey: 'bob', time: 28000, score: 5000 }), input);
    expect(store.count()).toBe(2);
    expect(store.list(2, 'sprint', 'time', 10).map((r) => r.id)).toEqual(['a3', 'b1']);
    expect(store.list(2, 'sprint', 'score', 10).map((r) => r.id)).toEqual(['b1', 'a3']);
    expect(store.rank(record({ id: 'b1', playerKey: 'bob' }), 'time')).toBe(2);
    expect(store.rank(record({ id: 'a1', playerKey: 'alice' }), 'time')).toBeNull();
    expect(store.replay('a1')).toBeNull();
    expect(store.replay('a3')?.input).toEqual(input);
    expect(store.bestsOf('alice').map((r) => r.id)).toEqual(['a3']);
  });

  it('computes the position a verify-only run would take', () => {
    const store = new MemoryBoardStore();
    store.upsert(record({ id: 'a', playerKey: 'alice', time: 20000 }), input);
    store.upsert(record({ id: 'b', playerKey: 'bob', time: 30000 }), input);
    expect(store.hypotheticalRank(record({ id: 'x', playerKey: '', time: 25000 }), 'time')).toBe(2);
    expect(store.hypotheticalRank(record({ id: 'x', playerKey: '', time: 10000 }), 'time')).toBe(1);
    expect(store.hypotheticalRank(record({ id: 'x', playerKey: '', time: 90000 }), 'time')).toBe(3);
  });

  it('keeps flagged runs off the lists and scores boards by score', () => {
    const store = new MemoryBoardStore();
    store.upsert(
      record({ id: 'f', playerKey: 'eve', mode: 'score', score: 99999, flagged: true }),
      input,
    );
    store.upsert(record({ id: 'g', playerKey: 'gus', mode: 'score', score: 500 }), input);
    store.upsert(record({ id: 'g2', playerKey: 'gus', mode: 'score', score: 400, time: 1 }), input);
    expect(store.list(2, 'score', 'score', 10).map((r) => r.id)).toEqual(['g']);
  });

  it('drops the replays beyond the top of a board', () => {
    const store = new MemoryBoardStore();
    for (let i = 0; i < REPLAY_KEEP + 5; i++) {
      store.upsert(record({ id: `r${i}`, playerKey: `p${i}`, time: 10000 + i * 10 }), input);
    }
    expect(store.replay('r0')).not.toBeNull();
    expect(store.replay(`r${REPLAY_KEEP - 1}`)).not.toBeNull();
    expect(store.replay(`r${REPLAY_KEEP}`)).toBeNull();
    expect(store.count()).toBe(REPLAY_KEEP + 5);
  });

  it('orders ties by the other value, then by submission time and id', () => {
    const cmp = compareRuns('time');
    const a = record({ id: 'a', playerKey: 'a', time: 1, score: 10 });
    const b = record({ id: 'b', playerKey: 'b', time: 1, score: 20 });
    expect(cmp(a, b)).toBeGreaterThan(0);
    const c = record({
      id: 'c',
      playerKey: 'c',
      time: 1,
      score: 10,
      submittedAt: '2026-10-07T00:00:00.000Z',
    });
    expect(cmp(a, c)).toBeLessThan(0);
  });
});

describe('JsonBoardStore', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('persists runs and replays and reloads them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'parapet-boards-'));
    dirs.push(dir);
    const file = join(dir, 'nested', 'runs.json');
    const store = new JsonBoardStore(file);
    store.upsert(record({ id: 'a', playerKey: 'alice', time: 20000 }), input);
    store.upsert(record({ id: 'b', playerKey: 'bob', time: 30000 }), input);
    expect(existsSync(file)).toBe(true);
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { runs: unknown[]; replays: object };
    expect(parsed.runs).toHaveLength(2);
    expect(Object.keys(parsed.replays)).toEqual(['a', 'b']);
    const reloaded = new JsonBoardStore(file);
    expect(reloaded.count()).toBe(2);
    expect(reloaded.list(2, 'sprint', 'time', 10).map((r) => r.id)).toEqual(['a', 'b']);
    expect(reloaded.replay('b')?.input).toEqual(input);
    expect(reloaded.bestsOf('alice')).toHaveLength(1);
  });

  it('rejects a file that is not a board store', () => {
    const dir = mkdtempSync(join(tmpdir(), 'parapet-boards-'));
    dirs.push(dir);
    const file = join(dir, 'runs.json');
    const store = new JsonBoardStore(file);
    store.upsert(record({ id: 'a', playerKey: 'a' }), input);
    const text = readFileSync(file, 'utf8');
    expect(text.endsWith('\n')).toBe(true);
    expect(() => new JsonBoardStore(join(dir, 'runs.json.' + process.pid + '.tmp'))).not.toThrow();
  });
});
