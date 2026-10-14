/**
 * Small number helpers of the runtime (the simulation's integer maths is `@parapet/sim`'s
 * `math/int.ts`): clamping, easing and a deterministic random generator for what is drawn and
 * heard, never for what is simulated.
 */

/** `n` within `lo..hi`. */
export function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/** Smooth 0..1 easing of `t` (clamped to 0..1): slow out, slow in. */
export function smoothstep(t: number): number {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
}

/**
 * Marsaglia's xorshift32: the same numbers for the same seed on every device (blinks, effect
 * particles, starry skies, the synthesiser's noise).
 */
export class Xorshift32 {
  private s: number;

  constructor(seed: number) {
    this.s = seed | 0 || 0x9e3779b9;
  }

  /** The next value, an unsigned 32-bit integer. */
  next(): number {
    let s = this.s;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    this.s = s;
    return s >>> 0;
  }

  /** The next value in [0, 1). */
  unit(): number {
    return this.next() / 4294967296;
  }
}

/**
 * Real time between draws for what moves on its own (sparks, cloth, effect particles): 0 on the
 * first draw, at most 100 ms (a hidden tab or a stall does not throw them across the screen).
 */
export class FrameTimer {
  private last = -1;

  /** Milliseconds since the previous call, clamped to 0..100. */
  tick(nowMs: number): number {
    const dt = this.last < 0 ? 0 : clamp(nowMs - this.last, 0, 100);
    this.last = nowMs;
    return dt;
  }
}
