/**
 * API tests. The end-to-end part builds a genuine finished run with the simulation, verifies
 * it, publishes it under a claimed name and then tampers with it; the rest drives the routes
 * with a fake verifier so the board, identity and limit logic is tested without the sim.
 */
import { describe, expect, it } from 'vitest';
import { SIM_VERSION } from '@parapet/sim';
import type {
  ClaimNameResponse,
  ErrorResponse,
  HealthResponse,
  LeaderboardResponse,
  NameStatusResponse,
  PlayerResponse,
  RecoverNameResponse,
  ReplayResponse,
  RunSubmission,
  SubmitRunResponse,
} from '@parapet/protocol';
import { createApp, type AppOptions } from '../src/app.ts';
import { MemoryBoardStore } from '../src/boards.ts';
import { hasContent } from '../src/content.ts';
import { perPeriod } from '../src/limits.ts';
import { MemoryNameStore } from '../src/names.ts';
import { replaySubmission, verifyRun } from '../src/verify.ts';
import { buildSubmission, findFinishedRun } from './helpers/driver.ts';
import { call, type MockResponse } from './helpers/http.ts';

function asError(json: unknown): ErrorResponse {
  const body = json as ErrorResponse;
  expect(body.ok).toBe(false);
  return body;
}

function asAccepted(json: unknown): Extract<SubmitRunResponse, { ok: true }> {
  const body = json as SubmitRunResponse;
  expect(body.ok).toBe(true);
  if (!body.ok) throw new Error(body.error);
  return body;
}

function asClaimed(json: unknown): Extract<ClaimNameResponse, { ok: true }> {
  const body = json as ClaimNameResponse;
  expect(body.ok).toBe(true);
  if (!body.ok) throw new Error(body.error);
  return body;
}

async function claim(app: ReturnType<typeof createApp>, name: string): Promise<MockResponse> {
  return call(app, 'POST', '/api/names', { body: { name } });
}

/** Test apps have no rate limits unless a test asks for them. */
function app(
  boards = new MemoryBoardStore(),
  options: AppOptions = {},
): ReturnType<typeof createApp> {
  return createApp(boards, { limits: false, log: () => undefined, ...options });
}

describe.skipIf(!hasContent())('POST /api/runs with the real simulation', () => {
  const world = findFinishedRun(0, 'flags');
  const genuine = buildSubmission(world, {
    levelId: 0,
    mode: 'flags',
    playerName: 'Runner',
    character: 1,
  });

  it('the driver produced a finished flag hunt', () => {
    expect(world.rules.result).toMatchObject({ finished: true, timeUp: false });
    expect(genuine.claimed.time).toBeGreaterThan(0);
    expect(genuine.claimed.steps).toBeGreaterThan(0);
    expect(genuine.input.length).toBeGreaterThan(1);
  });

  it('verifyRun agrees with the client', () => {
    const verdict = verifyRun(genuine);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.computed).toEqual({ ...genuine.claimed, won: true });
  });

  it('verifies a run without identity and publishes it with one', async () => {
    const boards = new MemoryBoardStore();
    const handler = app(boards);
    const anonymous = await call(handler, 'POST', '/api/runs', { body: genuine });
    expect(anonymous.status).toBe(200);
    expect(anonymous.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const checked = asAccepted(anonymous.json);
    expect(checked.outcome).toBe('verify-only');
    expect(checked.rank).toEqual({ byTime: 1, byScore: null });
    expect(boards.count()).toBe(0);

    const claimed = asClaimed((await claim(handler, 'Runner')).json);
    const published = await call(handler, 'POST', '/api/runs', {
      body: { ...genuine, identity: { name: 'runner', token: claimed.token } },
    });
    expect(published.status).toBe(201);
    const body = asAccepted(published.json);
    expect(body.outcome).toBe('stored');
    expect(body.rank).toEqual({ byTime: 1, byScore: 1 });
    expect(body.run).toMatchObject({
      levelId: 0,
      mode: 'flags',
      withRival: false,
      playerName: 'Runner',
      playerKey: 'runner',
      character: 1,
      time: genuine.claimed.time,
      score: genuine.claimed.score,
      steps: genuine.claimed.steps,
      hash: genuine.claimed.hash,
      finished: true,
      timeUp: false,
      won: true,
      flagged: false,
      simVersion: SIM_VERSION,
    });
    expect(body.run.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(boards.count()).toBe(1);

    const health = await call(handler, 'GET', '/api/health');
    expect(health.json as HealthResponse).toEqual({
      ok: true,
      simVersion: SIM_VERSION,
      runs: 1,
      names: 1,
    });
    const board = (await call(handler, 'GET', '/api/leaderboard/0/flags'))
      .json as LeaderboardResponse;
    expect(board.sort).toBe('time');
    expect(board.entries).toEqual([body.run]);
    const replay = (await call(handler, 'GET', `/api/runs/${body.run.id}/replay`))
      .json as ReplayResponse;
    expect(replay.input).toEqual(genuine.input);
    const player = (await call(handler, 'GET', '/api/players/Runner')).json as PlayerResponse;
    expect(player.bests.map((r) => r.id)).toEqual([body.run.id]);
  });

  it('rejects a tampered score, time and input log with a mismatch', async () => {
    const boards = new MemoryBoardStore();
    const handler = app(boards);
    const score = await call(handler, 'POST', '/api/runs', {
      body: { ...genuine, claimed: { ...genuine.claimed, score: genuine.claimed.score + 1 } },
    });
    expect(score.status).toBe(422);
    expect(asError(score.json)).toMatchObject({
      code: 'mismatch',
      error: expect.stringMatching(/score/),
    });
    const time = await call(handler, 'POST', '/api/runs', {
      body: { ...genuine, claimed: { ...genuine.claimed, time: genuine.claimed.time - 30 } },
    });
    expect(asError(time.json)).toMatchObject({
      code: 'mismatch',
      error: expect.stringMatching(/time/),
    });
    const shorter = await call(handler, 'POST', '/api/runs', {
      body: { ...genuine, input: genuine.input.slice(0, -1) },
    });
    expect(asError(shorter.json).code).toBe('mismatch');
    expect(boards.count()).toBe(0);
  });

  it('rejects an honest run that did not finish', async () => {
    const half = genuine.input.slice(0, Math.floor(genuine.input.length / 2));
    const partial: RunSubmission = { ...genuine, input: half };
    const computed = replaySubmission(partial);
    expect(computed.finished).toBe(false);
    const r = await call(app(), 'POST', '/api/runs', {
      body: { ...partial, claimed: { ...computed, won: undefined } },
    });
    expect(r.status).toBe(400);
    expect(asError(r.json)).toMatchObject({
      code: 'invalid',
      error: expect.stringMatching(/finish/),
    });
  });

  it('rejects free runs, other simulation versions and other content', async () => {
    const handler = app();
    const free = await call(handler, 'POST', '/api/runs', { body: { ...genuine, mode: 'free' } });
    expect(free.status).toBe(422);
    expect(asError(free.json).code).toBe('unsupported');
    const other = await call(handler, 'POST', '/api/runs', {
      body: { ...genuine, simVersion: 'parapet-sim@0.0.0' },
    });
    expect(asError(other.json)).toMatchObject({
      code: 'unsupported',
      error: expect.stringMatching(/parapet-sim@0\.0\.0/),
    });
    const content = await call(handler, 'POST', '/api/runs', {
      body: { ...genuine, contentHash: { ...genuine.contentHash, level: 1 } },
    });
    expect(asError(content.json)).toMatchObject({
      code: 'unsupported',
      error: expect.stringMatching(/level/),
    });
  });
});

/** A fake verifier that trusts the claim, for route tests that do not need the sim. */
function trusting(): AppOptions {
  return {
    verify: (s) => ({ ok: true, computed: { ...s.claimed, won: true } }),
    plausibility: () => ({ flagged: false, reason: null }),
  };
}

function submission(
  patch: Partial<RunSubmission> & { time: number; score: number },
): RunSubmission {
  const { time, score, ...rest } = patch;
  return {
    protocolVersion: 2,
    simVersion: SIM_VERSION,
    rulesetId: 'classic',
    contentHash: { level: 1, moves: 2, tables: 3 },
    levelId: 4,
    mode: 'sprint',
    withRival: true,
    playerName: 'P',
    character: 0,
    input: [{ ticks: 5, bits: 0 }],
    claimed: { finished: true, timeUp: false, time, score, steps: 5, hash: 7 },
    ...rest,
  };
}

describe('identity', () => {
  it('claims names once, reports availability and recovers with the code', async () => {
    const handler = app(undefined, trusting());
    const free = (await call(handler, 'GET', '/api/names/Alice')).json as NameStatusResponse;
    expect(free).toEqual({ name: 'Alice', valid: true, available: true });
    const claimed = await claim(handler, 'Alice');
    expect(claimed.status).toBe(201);
    const secrets = asClaimed(claimed.json);
    expect(secrets.name).toBe('Alice');
    const again = await claim(handler, 'alice');
    expect(again.status).toBe(409);
    expect(asError(again.json).code).toBe('name-taken');
    const confusable = await claim(handler, 'Аlice'); // Cyrillic А
    expect(confusable.status).toBe(409);
    const taken = (await call(handler, 'GET', '/api/names/ALICE')).json as NameStatusResponse;
    expect(taken.available).toBe(false);
    const invalid = (await call(handler, 'GET', '/api/names/a')).json as NameStatusResponse;
    expect(invalid.valid).toBe(false);
    expect((await claim(handler, 'a')).status).toBe(400);

    const wrong = await call(handler, 'POST', '/api/names/recover', {
      body: { name: 'Alice', recoveryCode: 'XXXXXXXX' },
    });
    expect(wrong.status).toBe(401);
    const recovered = await call(handler, 'POST', '/api/names/recover', {
      body: { name: 'Alice', recoveryCode: secrets.recoveryCode },
    });
    expect(recovered.status).toBe(200);
    const fresh = recovered.json as Extract<RecoverNameResponse, { ok: true }>;
    expect(fresh.token).not.toBe(secrets.token);

    const stale = await call(handler, 'POST', '/api/runs', {
      body: submission({ time: 1000, score: 1, identity: { name: 'Alice', token: secrets.token } }),
    });
    expect(stale.status).toBe(401);
    expect(asError(stale.json).code).toBe('unauthorized');
    const ok = await call(handler, 'POST', '/api/runs', {
      body: submission({ time: 1000, score: 1, identity: { name: 'Alice', token: fresh.token } }),
    });
    expect(ok.status).toBe(201);
    expect((await call(handler, 'GET', '/api/players/nobody')).status).toBe(404);
  });

  it('rate-limits claims per address', async () => {
    const handler = createApp(new MemoryBoardStore(), {
      ...trusting(),
      limits: {
        runsPerAddress: perPeriod(100, 60000),
        runsPerName: perPeriod(100, 60000),
        claimsPerAddress: perPeriod(2, 60000),
      },
    });
    expect((await claim(handler, 'One1')).status).toBe(201);
    expect((await claim(handler, 'Two2')).status).toBe(201);
    const third = await claim(handler, 'Three3');
    expect(third.status).toBe(429);
    expect(third.headers['retry-after']).toMatch(/^\d+$/);
    expect(asError(third.json).code).toBe('rate-limited');
    // Another address has its own budget.
    const other = await call(handler, 'POST', '/api/names', {
      body: { name: 'Four4' },
      headers: { 'x-forwarded-for': '10.0.0.9' },
    });
    expect(other.status).toBe(201);
  });
});

describe('boards and routing', () => {
  async function publisher(handler: ReturnType<typeof createApp>, name: string) {
    const secrets = asClaimed((await claim(handler, name)).json);
    return (patch: Parameters<typeof submission>[0]) =>
      call(handler, 'POST', '/api/runs', {
        body: submission({ ...patch, identity: { name, token: secrets.token } }),
      });
  }

  it('keeps personal bests, ranks by time and by score and reports not-best', async () => {
    const boards = new MemoryBoardStore();
    const handler = app(boards, trusting());
    const alice = await publisher(handler, 'Alice');
    const bob = await publisher(handler, 'Bob');
    const a = asAccepted((await alice({ time: 30000, score: 500 })).json);
    expect(a.rank).toEqual({ byTime: 1, byScore: 1 });
    const b = asAccepted((await bob({ time: 20000, score: 100 })).json);
    expect(b.rank).toEqual({ byTime: 1, byScore: 2 });
    const worse = await alice({ time: 35000, score: 900 });
    expect(worse.status).toBe(200);
    const notBest = asAccepted(worse.json);
    expect(notBest.outcome).toBe('not-best');
    expect(notBest.rank).toEqual({ byTime: 2, byScore: 1 });
    const better = asAccepted((await alice({ time: 15000, score: 50 })).json);
    expect(better.outcome).toBe('stored');
    expect(better.rank).toEqual({ byTime: 1, byScore: 2 });
    expect(boards.count()).toBe(2);

    const byTime = (await call(handler, 'GET', '/api/leaderboard/4/sprint'))
      .json as LeaderboardResponse;
    expect(byTime.entries.map((e) => [e.playerName, e.time])).toEqual([
      ['Alice', 15000],
      ['Bob', 20000],
    ]);
    const byScore = (await call(handler, 'GET', '/api/leaderboard/4/sprint?sort=score'))
      .json as LeaderboardResponse;
    expect(byScore.entries.map((e) => e.score)).toEqual([100, 50]);
    const limited = (await call(handler, 'GET', '/api/leaderboard/4/sprint?limit=1'))
      .json as LeaderboardResponse;
    expect(limited.entries).toHaveLength(1);
    const score = (await call(handler, 'GET', '/api/leaderboard/4/score'))
      .json as LeaderboardResponse;
    expect(score).toEqual({ levelId: 4, mode: 'score', sort: 'score', entries: [] });
    const challenge = (await call(handler, 'GET', '/api/leaderboard/8/challenge'))
      .json as LeaderboardResponse;
    expect(challenge.sort).toBe('score');
  });

  it('keeps flagged runs off the board and answers verify-only with a would-be rank', async () => {
    const boards = new MemoryBoardStore();
    const handler = app(boards, {
      ...trusting(),
      plausibility: (s) => ({
        flagged: s.claimed.time < 100,
        reason: s.claimed.time < 100 ? 'fast' : null,
      }),
    });
    const alice = await publisher(handler, 'Alice');
    expect(asAccepted((await alice({ time: 30000, score: 1 })).json).outcome).toBe('stored');
    const flagged = asAccepted((await alice({ time: 50, score: 1 })).json);
    expect(flagged.outcome).toBe('flagged');
    expect(flagged.run.flagged).toBe(true);
    expect(boards.count()).toBe(1);
    const anonymous = asAccepted(
      (await call(handler, 'POST', '/api/runs', { body: submission({ time: 40000, score: 1 }) }))
        .json,
    );
    expect(anonymous.outcome).toBe('verify-only');
    expect(anonymous.rank).toEqual({ byTime: 2, byScore: null });
    expect(boards.count()).toBe(1);
  });

  it('validates leaderboard parameters', async () => {
    const handler = app(undefined, trusting());
    expect((await call(handler, 'GET', '/api/leaderboard/12/sprint')).status).toBe(400);
    expect((await call(handler, 'GET', '/api/leaderboard/x/sprint')).status).toBe(400);
    expect((await call(handler, 'GET', '/api/leaderboard/0/free')).status).toBe(400);
    expect((await call(handler, 'GET', '/api/leaderboard/0/warmup1')).status).toBe(400);
    expect((await call(handler, 'GET', '/api/leaderboard/0/sprint?sort=speed')).status).toBe(400);
    expect((await call(handler, 'GET', '/api/leaderboard/0/sprint?limit=0')).status).toBe(400);
    expect((await call(handler, 'GET', '/api/leaderboard/0/sprint?limit=999999')).status).toBe(200);
  });

  it('answers 404 and 405 with JSON and serves CORS preflight', async () => {
    const handler = app(undefined, trusting());
    const missing = await call(handler, 'GET', '/nope');
    expect(missing.status).toBe(404);
    expect(asError(missing.json).error).toMatch(/no route/);
    expect((await call(handler, 'GET', '/api/runs')).status).toBe(400);
    expect((await call(handler, 'POST', '/api/health')).status).toBe(400);
    expect((await call(handler, 'GET', '/api/runs/not-an-id/replay')).status).toBe(400);
    expect((await call(handler, 'GET', `/api/runs/${'0'.repeat(36)}/replay`)).status).toBe(404);
    const preflight = await call(handler, 'OPTIONS', '/api/runs');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-methods']).toMatch(/POST/);
    const foreign = await call(handler, 'OPTIONS', '/api/runs', {
      headers: { origin: 'https://evil.example' },
    });
    expect(foreign.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('rejects malformed, invalid and oversized bodies', async () => {
    const handler = app(undefined, { ...trusting(), maxBodyBytes: 200 });
    const bad = await call(handler, 'POST', '/api/runs', { body: '{not json' });
    expect(bad.status).toBe(400);
    expect(asError(bad.json).code).toBe('invalid');
    const invalid = await call(handler, 'POST', '/api/runs', { body: { protocolVersion: 2 } });
    expect(asError(invalid.json)).toMatchObject({
      code: 'invalid',
      error: expect.stringMatching(/simVersion/),
    });
    const big = await call(handler, 'POST', '/api/runs', {
      body: submission({ time: 1, score: 1, playerName: 'x'.repeat(24) }),
    });
    expect(big.status).toBe(413);
    expect(asError(big.json).code).toBe('limit');
  });
});
