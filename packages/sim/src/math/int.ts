/**
 * Java `int` arithmetic helpers.
 *
 * The original game runs on 32-bit integer math (CLDC 1.1 without floats). Every value in the
 * simulation is an integer; positions use 1024 units per tile. JS numbers are exact for integers
 * below 2^53, so plain `+`, `-` and `*` match Java as long as no intermediate exceeds 2^31, which
 * the physics never does. Division must truncate toward zero, hence `idiv`.
 */

/** Java integer division (truncates toward zero). */
export function idiv(a: number, b: number): number {
  return (a / b) | 0;
}

/** Java `Math.abs` for ints (`int_g(int)` in the decompiled source). */
export function iabs(n: number): number {
  return n < 0 ? -n : n;
}

/** `int_e(int,int)` in the decompiled source. */
export function imin(a: number, b: number): number {
  return b < a ? b : a;
}

/** Exact integer square root (`int_o`, line 9139). */
export function isqrt(n: number): number {
  let root = 0;
  let bit = 0x10000000;
  while (bit !== 0) {
    const t = root + bit;
    root >>= 1;
    if (t <= n) {
      n -= t;
      root += bit;
    }
    bit >>= 2;
  }
  return root;
}

/** Octagonal approximation of sqrt(a² + b²) (`int_f`, line 9116). */
export function approxLength(a: number, b: number): number {
  if (a < 0) a = -a;
  if (b < 0) b = -b;
  let small: number;
  let big: number;
  if (a < b) {
    small = a;
    big = b;
  } else {
    small = b;
    big = a;
  }
  let n = small * 441 + big * 1007;
  if (big < small << 4) {
    n -= big * 40;
  }
  return n >> 10;
}

/**
 * Sine table of 512 entries built by the original recurrence (`short_arr_a`, line 3447).
 * `shift` is the argument `n` (the table holds `value >> (30 - n)`), `offset` is the `bl` flag
 * (true starts the table at index 128, i.e. a cosine table).
 */
export function buildSineTable(shift: number, offset: boolean): Int16Array {
  const table = new Int16Array(512);
  const sh = BigInt(30 - shift);
  const base = offset ? 128 : 0;
  let prev = 0x40000000n;
  let cur = 1073660973n;
  table[base] = Number(BigInt.asIntN(16, prev >> sh));
  table[(base + 1) & 0x1ff] = Number(BigInt.asIntN(16, cur >> sh));
  for (let i = 2; i < 128; i++) {
    const next = ((cur * 2147321946n) >> 30n) - prev;
    table[(base + i) & 0x1ff] = Number(BigInt.asIntN(16, next >> sh));
    prev = cur;
    cur = next;
  }
  for (let i = 127; i >= 0; i--) {
    table[(base + 256 - i) & 0x1ff] = -table[(base + i) & 0x1ff]!;
  }
  for (let i = 255; i > 0; i--) {
    table[(base + 256 + i) & 0x1ff] = -table[(base + i) & 0x1ff]!;
  }
  return table;
}
