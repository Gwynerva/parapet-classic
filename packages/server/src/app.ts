/**
 * The HTTP API, framework-free. `createApp` returns a plain `(req, res)` handler so tests can
 * drive it with mock streams and `main.ts` can hand it to `http.createServer`.
 *
 *   GET  /api/health
 *   GET  /api/leaderboard/:levelId/:mode?sort=time|score&limit=N
 *   POST /api/runs                 RunSubmission; with `identity` the run is published as the
 *                                  player's personal best, without it is only verified
 *   POST /api/names                { name } → token + recovery code (claims the name)
 *   POST /api/names/recover        { name, recoveryCode } → new token + code
 *   GET  /api/names/:name          whether the name is valid and free
 *   GET  /api/players/:name        the player's personal bests
 *   GET  /api/runs/:id/replay      the input log of a stored top run
 */
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SIM_VERSION } from '@parapet/sim';
import {
  defaultLeaderboardSort,
  isLeaderboardSort,
  isRunMode,
  LEADERBOARD_DEFAULT_LIMIT,
  LEADERBOARD_MAX_LIMIT,
  LEADERBOARD_MODES,
  LEVEL_COUNT,
  nameKey,
  validatePublicName,
  validateSubmission,
  type ClaimNameResponse,
  type ErrorCode,
  type ErrorResponse,
  type HealthResponse,
  type LeaderboardResponse,
  type NameStatusResponse,
  type PlayerResponse,
  type RecoverNameResponse,
  type ReplayResponse,
  type RunRank,
  type RunRecord,
  type RunSubmission,
  type SubmitOutcome,
  type SubmitRunResponse,
} from '@parapet/protocol';
import type { BoardStore } from './boards.ts';
import { loadRunData } from './content.ts';
import { perPeriod, RateLimiter, type RateLimit } from './limits.ts';
import { authenticate, claimName, MemoryNameStore, recoverName, type NameStore } from './names.ts';
import { checkPlausibility, type PlausibilityVerdict } from './plausibility.ts';
import { verifyRun, type VerifyComputed, type VerifyResult } from './verify.ts';

export const MAX_BODY_BYTES = 2 * 1024 * 1024;
export const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173'];

export interface AppLimits {
  runsPerAddress: RateLimit;
  runsPerName: RateLimit;
  claimsPerAddress: RateLimit;
}

export const DEFAULT_LIMITS: AppLimits = {
  runsPerAddress: perPeriod(20, 60 * 60 * 1000),
  runsPerName: perPeriod(60, 60 * 60 * 1000),
  claimsPerAddress: perPeriod(5, 24 * 60 * 60 * 1000),
};

export interface AppOptions {
  /** Replace the replay verifier (tests). */
  verify?: (submission: RunSubmission) => VerifyResult;
  /** Replace the plausibility check (tests). */
  plausibility?: (submission: RunSubmission, computed: VerifyComputed) => PlausibilityVerdict;
  names?: NameStore;
  maxBodyBytes?: number;
  /** Clock for timestamps and rate limits (tests). */
  now?: () => Date;
  allowedOrigins?: readonly string[];
  /** Rate limits; `false` disables them (tests). */
  limits?: AppLimits | false;
  /** Where flagged runs are reported (default: console). */
  log?: (message: string) => void;
}

export type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  invalid: 400,
  mismatch: 422,
  unsupported: 422,
  limit: 413,
  'rate-limited': 429,
  'name-taken': 409,
  'name-invalid': 400,
  unauthorized: 401,
  'not-found': 404,
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, code: ErrorCode, error: string, retryAfter?: number): void {
  const body: ErrorResponse = { ok: false, error, code };
  if (retryAfter !== undefined) {
    body.retryAfter = retryAfter;
    res.setHeader('Retry-After', String(retryAfter));
  }
  sendJson(res, STATUS_BY_CODE[code], body);
}

class BodyTooLarge extends Error {}

async function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : (chunk as Buffer);
    size += buf.length;
    if (size > maxBytes) throw new BodyTooLarge(`request body exceeds ${maxBytes} bytes`);
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function parseLimit(raw: string | null): number | null {
  if (raw === null || raw === '') return LEADERBOARD_DEFAULT_LIMIT;
  if (!/^\d{1,6}$/.test(raw)) return null;
  const n = Number(raw);
  if (n < 1) return null;
  return Math.min(n, LEADERBOARD_MAX_LIMIT);
}

function clientAddress(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  if (first && first.trim()) return first.trim();
  return req.socket?.remoteAddress ?? 'local';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createApp(boards: BoardStore, options: AppOptions = {}): RequestHandler {
  const verify = options.verify ?? verifyRun;
  const plausibility =
    options.plausibility ??
    ((submission: RunSubmission, computed: VerifyComputed): PlausibilityVerdict =>
      checkPlausibility(submission, computed, loadRunData(submission.levelId, false).mission));
  const names = options.names ?? new MemoryNameStore();
  const maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES;
  const now = options.now ?? ((): Date => new Date());
  const allowedOrigins = options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  const log = options.log ?? ((message: string): void => console.warn(message));
  const limits = options.limits === undefined ? DEFAULT_LIMITS : options.limits;
  const limiters = limits
    ? {
        runsPerAddress: new RateLimiter(limits.runsPerAddress),
        runsPerName: new RateLimiter(limits.runsPerName),
        claimsPerAddress: new RateLimiter(limits.claimsPerAddress),
      }
    : null;

  function limited(limiter: RateLimiter | undefined, key: string, res: ServerResponse): boolean {
    if (!limiter) return false;
    const verdict = limiter.take(key, now().getTime());
    if (verdict.ok) return false;
    sendError(res, 'rate-limited', 'too many requests', Math.ceil(verdict.retryAfterMs / 1000));
    return true;
  }

  async function readJson(req: IncomingMessage, res: ServerResponse): Promise<unknown | undefined> {
    let raw: Buffer;
    try {
      raw = await readBody(req, maxBodyBytes);
    } catch (err) {
      if (err instanceof BodyTooLarge) {
        sendError(res, 'limit', err.message);
        return undefined;
      }
      throw err;
    }
    try {
      return JSON.parse(raw.toString('utf8')) as unknown;
    } catch {
      sendError(res, 'invalid', 'request body is not valid JSON');
      return undefined;
    }
  }

  function health(res: ServerResponse): void {
    const body: HealthResponse = {
      ok: true,
      simVersion: SIM_VERSION,
      runs: boards.count(),
      names: names.count(),
    };
    sendJson(res, 200, body);
  }

  function leaderboard(res: ServerResponse, url: URL, levelRaw: string, modeRaw: string): void {
    if (!/^\d{1,2}$/.test(levelRaw) || Number(levelRaw) >= LEVEL_COUNT) {
      return sendError(res, 'invalid', `levelId must be between 0 and ${LEVEL_COUNT - 1}`);
    }
    const levelId = Number(levelRaw);
    if (!isRunMode(modeRaw) || !LEADERBOARD_MODES.includes(modeRaw)) {
      return sendError(res, 'invalid', `mode must be one of ${LEADERBOARD_MODES.join(', ')}`);
    }
    const sortRaw = url.searchParams.get('sort');
    const sort =
      sortRaw === null || sortRaw === '' ? defaultLeaderboardSort(modeRaw, levelId) : sortRaw;
    if (!isLeaderboardSort(sort)) return sendError(res, 'invalid', 'sort must be time or score');
    const limit = parseLimit(url.searchParams.get('limit'));
    if (limit === null) return sendError(res, 'invalid', 'limit must be a positive integer');
    const body: LeaderboardResponse = {
      levelId,
      mode: modeRaw,
      sort,
      entries: boards.list(levelId, modeRaw, sort, limit),
    };
    sendJson(res, 200, body);
  }

  async function submitRun(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const parsed = await readJson(req, res);
    if (parsed === undefined) return;
    const validation = validateSubmission(parsed);
    if (!validation.ok) return sendError(res, 'invalid', validation.error);
    const submission = validation.value;
    const address = clientAddress(req);
    if (limited(limiters?.runsPerAddress, address, res)) return;

    let playerKey = '';
    let playerName = submission.playerName;
    if (submission.identity) {
      const key = nameKey(submission.identity.name);
      const record = authenticate(names, key, submission.identity.token);
      if (!record) return sendError(res, 'unauthorized', 'the name is not claimed with this token');
      if (limited(limiters?.runsPerName, key, res)) return;
      playerKey = key;
      playerName = record.name;
      names.update({ ...record, lastSeenAt: now().toISOString() });
    }

    const verdict = verify(submission);
    if (!verdict.ok) return sendError(res, verdict.code, verdict.error);
    const sanity = plausibility(submission, verdict.computed);
    const run: RunRecord = {
      id: randomUUID(),
      levelId: submission.levelId,
      mode: submission.mode,
      withRival: submission.withRival,
      playerName,
      playerKey,
      character: submission.character,
      time: verdict.computed.time,
      score: verdict.computed.score,
      finished: verdict.computed.finished,
      timeUp: verdict.computed.timeUp,
      won: verdict.computed.won,
      steps: verdict.computed.steps,
      hash: verdict.computed.hash,
      simVersion: submission.simVersion,
      rulesetId: submission.rulesetId,
      flagged: sanity.flagged,
      submittedAt: now().toISOString(),
    };
    const sort = defaultLeaderboardSort(run.mode, run.levelId);
    let outcome: SubmitOutcome;
    let rank: RunRank;
    if (sanity.flagged) {
      outcome = 'flagged';
      rank = { byTime: null, byScore: null };
      log(
        `flagged run ${run.id} on ${run.levelId}/${run.mode} by "${playerName}" (${address}): ${sanity.reason}`,
      );
    } else if (!playerKey) {
      outcome = 'verify-only';
      const position = boards.hypotheticalRank(run, sort);
      rank =
        sort === 'time' ? { byTime: position, byScore: null } : { byTime: null, byScore: position };
    } else {
      const result = boards.upsert(run, submission.input);
      if (result.stored) {
        outcome = 'stored';
        rank = { byTime: boards.rank(run, 'time'), byScore: boards.rank(run, 'score') };
      } else {
        outcome = 'not-best';
        rank = {
          byTime: boards.rank(result.best, 'time'),
          byScore: boards.rank(result.best, 'score'),
        };
      }
    }
    const body: SubmitRunResponse = { ok: true, run, rank, outcome };
    sendJson(res, outcome === 'stored' ? 201 : 200, body);
  }

  async function claim(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const parsed = await readJson(req, res);
    if (parsed === undefined) return;
    if (!isRecord(parsed)) return sendError(res, 'invalid', 'body must be an object');
    const validation = validatePublicName(parsed['name']);
    if (!validation.ok) return sendError(res, validation.code, validation.error);
    if (limited(limiters?.claimsPerAddress, clientAddress(req), res)) return;
    const result = claimName(names, validation.name, validation.key, now());
    if (!result.ok) return sendError(res, 'name-taken', 'this name is already taken');
    const body: ClaimNameResponse = {
      ok: true,
      name: result.record.name,
      token: result.token,
      recoveryCode: result.recoveryCode,
    };
    sendJson(res, 201, body);
  }

  async function recover(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const parsed = await readJson(req, res);
    if (parsed === undefined) return;
    if (!isRecord(parsed)) return sendError(res, 'invalid', 'body must be an object');
    const validation = validatePublicName(parsed['name']);
    if (!validation.ok) return sendError(res, validation.code, validation.error);
    const code = parsed['recoveryCode'];
    if (typeof code !== 'string' || code.length > 32) {
      return sendError(res, 'invalid', 'recoveryCode must be a string');
    }
    if (limited(limiters?.claimsPerAddress, clientAddress(req), res)) return;
    const result = recoverName(names, validation.key, code, now());
    if (!result.ok) return sendError(res, 'unauthorized', 'unknown name or wrong recovery code');
    const body: RecoverNameResponse = {
      ok: true,
      name: result.record.name,
      token: result.token,
      recoveryCode: result.recoveryCode,
    };
    sendJson(res, 200, body);
  }

  function nameStatus(res: ServerResponse, raw: string): void {
    const validation = validatePublicName(raw);
    const body: NameStatusResponse = validation.ok
      ? { name: validation.name, valid: true, available: names.get(validation.key) === undefined }
      : { name: raw, valid: false, available: false };
    sendJson(res, 200, body);
  }

  function player(res: ServerResponse, raw: string): void {
    const validation = validatePublicName(raw);
    if (!validation.ok) return sendError(res, validation.code, validation.error);
    const record = names.get(validation.key);
    if (!record) return sendError(res, 'not-found', 'unknown player');
    const body: PlayerResponse = { name: record.name, bests: boards.bestsOf(validation.key) };
    sendJson(res, 200, body);
  }

  function replay(res: ServerResponse, id: string): void {
    if (!/^[0-9a-f-]{36}$/.test(id)) return sendError(res, 'invalid', 'malformed run id');
    const stored = boards.replay(id);
    if (!stored) return sendError(res, 'not-found', 'no replay for this run');
    const body: ReplayResponse = {
      id,
      levelId: stored.run.levelId,
      mode: stored.run.mode,
      withRival: stored.run.withRival,
      input: stored.input,
    };
    sendJson(res, 200, body);
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const origin = req.headers.origin;
    const allowed =
      typeof origin === 'string' && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    if (allowed) res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
    res.setHeader('Vary', 'Origin');
    const method = req.method ?? 'GET';
    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    const parts = url.pathname.split('/').filter((p) => p.length > 0);
    const part = (i: number): string => decodeURIComponent(parts[i] ?? '');
    if (parts[0] === 'api') {
      if (parts[1] === 'health' && parts.length === 2) {
        if (method !== 'GET') return sendError(res, 'invalid', 'method not allowed');
        return health(res);
      }
      if (parts[1] === 'leaderboard' && parts.length === 4) {
        if (method !== 'GET') return sendError(res, 'invalid', 'method not allowed');
        return leaderboard(res, url, part(2), part(3));
      }
      if (parts[1] === 'runs' && parts.length === 2) {
        if (method !== 'POST') return sendError(res, 'invalid', 'method not allowed');
        return submitRun(req, res);
      }
      if (parts[1] === 'runs' && parts.length === 4 && parts[3] === 'replay') {
        if (method !== 'GET') return sendError(res, 'invalid', 'method not allowed');
        return replay(res, part(2));
      }
      if (parts[1] === 'names' && parts.length === 2) {
        if (method !== 'POST') return sendError(res, 'invalid', 'method not allowed');
        return claim(req, res);
      }
      if (parts[1] === 'names' && parts.length === 3 && parts[2] === 'recover') {
        if (method !== 'POST') return sendError(res, 'invalid', 'method not allowed');
        return recover(req, res);
      }
      if (parts[1] === 'names' && parts.length === 3) {
        if (method !== 'GET') return sendError(res, 'invalid', 'method not allowed');
        return nameStatus(res, part(2));
      }
      if (parts[1] === 'players' && parts.length === 3) {
        if (method !== 'GET') return sendError(res, 'invalid', 'method not allowed');
        return player(res, part(2));
      }
    }
    sendError(res, 'not-found', `no route for ${method} ${url.pathname}`);
  }

  return (req, res) => {
    handle(req, res).catch((err: unknown) => {
      console.error(err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, error: 'internal error', code: 'invalid' }));
      } else {
        res.end();
      }
    });
  };
}
