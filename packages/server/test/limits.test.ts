import { describe, expect, it } from 'vitest';
import { perPeriod, RateLimiter } from '../src/limits.ts';

describe('RateLimiter', () => {
  it('allows the capacity, then refuses with a retry delay, then refills', () => {
    const limiter = new RateLimiter(perPeriod(3, 3000));
    let now = 1_000_000;
    expect(limiter.take('a', now)).toEqual({ ok: true });
    expect(limiter.take('a', now)).toEqual({ ok: true });
    expect(limiter.take('a', now)).toEqual({ ok: true });
    const refused = limiter.take('a', now);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.retryAfterMs).toBe(1000);
    // Another key has its own bucket.
    expect(limiter.take('b', now)).toEqual({ ok: true });
    now += 1000;
    expect(limiter.take('a', now)).toEqual({ ok: true });
    expect(limiter.take('a', now).ok).toBe(false);
  });

  it('forgets full buckets on the sweep', () => {
    const limiter = new RateLimiter(perPeriod(1, 1000));
    limiter.take('a', 0);
    expect(limiter.size).toBe(1);
    limiter.take('b', 120_000);
    expect(limiter.size).toBe(1); // "a" refilled long ago and was dropped
  });
});
