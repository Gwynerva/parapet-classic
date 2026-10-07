/**
 * Token-bucket rate limiting in memory, keyed by a string (an address, a name). Each key has
 * `capacity` tokens that refill at `refillPerMs`; a request takes one. Buckets that are full
 * again are forgotten on the next sweep, so the map stays small.
 */

export interface RateLimit {
  capacity: number;
  /** Tokens added per millisecond. */
  refillPerMs: number;
}

export type LimitVerdict = { ok: true } | { ok: false; retryAfterMs: number };

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/** `n` requests per `periodMs`. */
export function perPeriod(n: number, periodMs: number): RateLimit {
  return { capacity: n, refillPerMs: n / periodMs };
}

export class RateLimiter {
  private readonly limit: RateLimit;
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  constructor(limit: RateLimit) {
    this.limit = limit;
  }

  /** Try to take one token for `key` at time `now` (ms). */
  take(key: string, now: number): LimitVerdict {
    this.sweep(now);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.limit.capacity, updatedAt: now };
      this.buckets.set(key, bucket);
    } else {
      bucket.tokens = Math.min(
        this.limit.capacity,
        bucket.tokens + Math.max(0, now - bucket.updatedAt) * this.limit.refillPerMs,
      );
      bucket.updatedAt = now;
    }
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { ok: true };
    }
    const retryAfterMs = Math.ceil((1 - bucket.tokens) / this.limit.refillPerMs);
    return { ok: false, retryAfterMs };
  }

  get size(): number {
    return this.buckets.size;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < 60000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      const tokens = bucket.tokens + (now - bucket.updatedAt) * this.limit.refillPerMs;
      if (tokens >= this.limit.capacity) this.buckets.delete(key);
    }
  }
}
