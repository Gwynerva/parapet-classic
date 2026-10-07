/**
 * Leaderboard API client. Types come from `@parapet/protocol`; the endpoints are relative to
 * `/api` (proxied to the server by Vite in development).
 *
 *   POST /api/runs                                        submitRun
 *   GET  /api/leaderboard/:levelId/:mode?sort=&limit=     fetchLeaderboard
 *   GET  /api/health                                      fetchHealth
 */
import {
  defaultLeaderboardSort,
  type ClaimNameResponse,
  type ErrorCode,
  type ErrorResponse,
  type HealthResponse,
  type LeaderboardResponse,
  type LeaderboardSort,
  type NameStatusResponse,
  type PlayerResponse,
  type RecoverNameResponse,
  type ReplayResponse,
  type RunMode,
  type RunRank,
  type RunRecord,
  type RunSubmission,
  type SubmitOutcome,
  type SubmitRunResponse,
} from '@parapet/protocol';

export const API_BASE = '/api';
export const DEFAULT_TIMEOUT_MS = 15000;

export interface ApiOptions {
  /** Defaults to `/api` (same origin). */
  baseUrl?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Injectable for tests. */
  fetch?: typeof fetch;
}

export type ApiErrorCode = ErrorCode | 'network' | 'timeout' | 'http' | 'aborted';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(message: string, status: number, code: ApiErrorCode) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface SubmitResult {
  run: RunRecord;
  rank: RunRank;
  outcome: SubmitOutcome;
}

export interface ClaimedName {
  name: string;
  token: string;
  recoveryCode: string;
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { ok?: unknown }).ok === false &&
    typeof (value as { error?: unknown }).error === 'string'
  );
}

async function request<T>(path: string, init: RequestInit, opts: ApiOptions): Promise<T> {
  const fetchFn = opts.fetch ?? globalThis.fetch;
  if (typeof fetchFn !== 'function') throw new ApiError('fetch is unavailable', 0, 'network');
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onAbort = (): void => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', onAbort, { once: true });
  }
  let response: Response;
  try {
    response = await fetchFn(`${opts.baseUrl ?? API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) throw new ApiError('request timed out', 0, 'timeout');
    if (opts.signal?.aborted) throw new ApiError('request aborted', 0, 'aborted');
    throw new ApiError(error instanceof Error ? error.message : 'network error', 0, 'network');
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const error = isErrorResponse(body) ? body : null;
    throw new ApiError(
      error?.error ?? `HTTP ${response.status}`,
      response.status,
      error?.code ?? 'http',
    );
  }
  return body as T;
}

/** Submits a finished run for verification; resolves with the stored record and its ranks. */
export async function submitRun(
  submission: RunSubmission,
  opts: ApiOptions = {},
): Promise<SubmitResult> {
  const body = await request<SubmitRunResponse>(
    '/runs',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(submission),
    },
    opts,
  );
  if (!body || typeof body !== 'object') throw new ApiError('malformed response', 200, 'http');
  if (!body.ok) throw new ApiError(body.error, 200, body.code);
  return { run: body.run, rank: body.rank, outcome: body.outcome };
}

function postJson<T>(path: string, payload: unknown, opts: ApiOptions): Promise<T> {
  return request<T>(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    opts,
  );
}

/** Claims a free public name; the token and the recovery code come back exactly once. */
export async function claimName(name: string, opts: ApiOptions = {}): Promise<ClaimedName> {
  const body = await postJson<ClaimNameResponse>('/names', { name }, opts);
  if (!body || typeof body !== 'object') throw new ApiError('malformed response', 201, 'http');
  if (!body.ok) throw new ApiError(body.error, 200, body.code);
  return { name: body.name, token: body.token, recoveryCode: body.recoveryCode };
}

/** Recovers a claimed name with its code; issues a new token and a new code. */
export async function recoverName(
  name: string,
  recoveryCode: string,
  opts: ApiOptions = {},
): Promise<ClaimedName> {
  const body = await postJson<RecoverNameResponse>('/names/recover', { name, recoveryCode }, opts);
  if (!body || typeof body !== 'object') throw new ApiError('malformed response', 200, 'http');
  if (!body.ok) throw new ApiError(body.error, 200, body.code);
  return { name: body.name, token: body.token, recoveryCode: body.recoveryCode };
}

export async function checkName(name: string, opts: ApiOptions = {}): Promise<NameStatusResponse> {
  return request<NameStatusResponse>(
    `/names/${encodeURIComponent(name)}`,
    { method: 'GET', headers: { accept: 'application/json' } },
    opts,
  );
}

export async function fetchPlayer(name: string, opts: ApiOptions = {}): Promise<PlayerResponse> {
  const body = await request<PlayerResponse>(
    `/players/${encodeURIComponent(name)}`,
    { method: 'GET', headers: { accept: 'application/json' } },
    opts,
  );
  if (!body || !Array.isArray(body.bests)) throw new ApiError('malformed response', 200, 'http');
  return body;
}

export async function fetchReplay(id: string, opts: ApiOptions = {}): Promise<ReplayResponse> {
  const body = await request<ReplayResponse>(
    `/runs/${encodeURIComponent(id)}/replay`,
    { method: 'GET', headers: { accept: 'application/json' } },
    opts,
  );
  if (!body || !Array.isArray(body.input)) throw new ApiError('malformed response', 200, 'http');
  return body;
}

/** URL of a leaderboard, exported so the server routes can be kept in step. */
export function leaderboardPath(
  levelId: number,
  mode: RunMode,
  sort: LeaderboardSort,
  limit?: number,
): string {
  const query = new URLSearchParams({ sort });
  if (limit !== undefined) query.set('limit', String(limit));
  return `/leaderboard/${encodeURIComponent(String(levelId))}/${encodeURIComponent(mode)}?${query.toString()}`;
}

export async function fetchLeaderboard(
  levelId: number,
  mode: RunMode,
  sort: LeaderboardSort = defaultLeaderboardSort(mode),
  opts: ApiOptions & { limit?: number } = {},
): Promise<LeaderboardResponse> {
  const body = await request<LeaderboardResponse>(
    leaderboardPath(levelId, mode, sort, opts.limit),
    { method: 'GET', headers: { accept: 'application/json' } },
    opts,
  );
  if (!body || !Array.isArray(body.entries)) throw new ApiError('malformed response', 200, 'http');
  return body;
}

export async function fetchHealth(opts: ApiOptions = {}): Promise<HealthResponse> {
  return request<HealthResponse>('/health', { method: 'GET' }, opts);
}
