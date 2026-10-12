/**
 * The glimpse codec (`src/content/glimpses.ts`): seeded synthetic tracks with every kind of
 * pose come back exactly, broken codes decode to null and poses it cannot store are refused.
 */
import { describe, expect, it } from 'vitest';
import { toBase64Url } from '@parapet/sim';
import {
  decodeGlimpse,
  encodeGlimpse,
  glimpseProblems,
  GLIMPSE_AFTER_STEPS,
  GLIMPSE_BEFORE_STEPS,
  GLIMPSE_FORMAT,
  type GlimpsePose,
  type GlimpseTrack,
} from '../src/content/glimpses.ts';

/** mulberry32: a small seeded PRNG, 0 <= value < 1. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How a synthetic pose got its keyframes and its tween, counted to show every kind occurs. */
type Kind = 'still' | 'keep' | 'advance' | 'other' | 'predicted' | 'nearly' | 'byte';

/**
 * A runner-like track: a random walk with the pace changing a little every step, now and then
 * a snap far away, hands and facing switches, a clip that holds, advances or jumps, and tweens
 * that run on evenly, nearly evenly or anyhow.
 */
function syntheticTrack(seed: number, count: number, kinds: Map<Kind, number>): GlimpseTrack {
  const rnd = random(seed);
  const int = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));
  const note = (k: Kind): void => void kinds.set(k, (kinds.get(k) ?? 0) + 1);
  const poses: GlimpsePose[] = [];
  let x = int(-200_000, 200_000);
  let y = int(-50_000, 50_000);
  let vx = int(-400, 400);
  let vy = int(-400, 400);
  let a = int(0, 450);
  let b = int(0, 450);
  let tween = 0;
  let pace = int(0, 255);
  let flipX = rnd() < 0.5;
  let anchored = false;
  for (let i = 0; i < count; i++) {
    let cut = i === 0;
    if (i > 0 && rnd() < 0.05) {
      x += int(-20_000, 20_000);
      y += int(-20_000, 20_000);
      cut = true;
    } else {
      vx += int(-60, 60);
      vy += int(-60, 60);
      x += vx;
      y += vy;
    }
    if (rnd() < 0.05) {
      anchored = !anchored;
      cut = true;
    }
    if (rnd() < 0.03) flipX = !flipX;
    if (rnd() < 0.02) cut = true;
    const r = rnd();
    let t: number;
    if (r < 0.15) {
      note('still');
      b = rnd() < 0.5 ? b : int(0, 450);
      a = b;
      t = 0;
    } else {
      if (r < 0.5) {
        note('keep');
      } else if (r < 0.8) {
        note('advance');
        a = b;
        b = int(0, 450);
      } else {
        note('other');
        a = int(0, 0xffff);
        b = rnd() < 0.5 ? b : int(0, 0xffff);
      }
      const s = rnd();
      if (s < 0.5) {
        note('predicted');
        t = (tween + pace) & 0xff;
      } else if (s < 0.8) {
        note('nearly');
        t = (tween + pace + (rnd() < 0.5 ? 1 : -1)) & 0xff;
      } else {
        note('byte');
        t = int(0, 255);
      }
      if (a === b && t === 0) t = 1;
    }
    pace = (t - tween) & 0xff;
    tween = t;
    poses.push({ x, y, a, b, t: t * 256, flipX, anchored, cut });
  }
  return { poses, at: int(0, count - 1) };
}

describe('glimpse codec', () => {
  it('codes seeded synthetic tracks exactly', () => {
    const kinds = new Map<Kind, number>();
    let cuts = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const track = syntheticTrack(seed, 1 + ((seed * 37) % 120), kinds);
      cuts += track.poses.filter((p) => p.cut).length;
      const code = encodeGlimpse(track);
      expect(code, `seed ${seed}`).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(decodeGlimpse(code), `seed ${seed}`).toEqual(track);
    }
    for (const k of ['still', 'keep', 'advance', 'other', 'predicted', 'nearly', 'byte'] as const) {
      expect(kinds.get(k) ?? 0, k).toBeGreaterThan(10);
    }
    expect(cuts).toBeGreaterThan(40);
  });

  it('codes a track that stands still, and one of a single pose', () => {
    const pose: GlimpsePose = {
      x: 0,
      y: 0,
      a: 5,
      b: 5,
      t: 0,
      flipX: false,
      anchored: false,
      cut: true,
    };
    const still = {
      poses: [pose, ...Array.from({ length: 66 }, () => ({ ...pose, cut: false }))],
      at: 33,
    };
    expect(decodeGlimpse(encodeGlimpse(still))).toEqual(still);
    const one = { poses: [{ ...pose, x: -7, t: 0xff00, flipX: true, anchored: true }], at: 0 };
    expect(decodeGlimpse(encodeGlimpse(one))).toEqual(one);
  });

  it('decodes nothing from broken codes', () => {
    const code = encodeGlimpse(syntheticTrack(7, 67, new Map()));
    for (let n = 0; n < code.length; n++) {
      expect(decodeGlimpse(code.slice(0, n)), `first ${n} characters`).toBeNull();
    }
    for (const bad of ['+', '/', '=', ' ', 'é', '\n']) {
      expect(decodeGlimpse(code.slice(0, 10) + bad + code.slice(11)), bad).toBeNull();
    }
    expect(decodeGlimpse(code + 'AA')).toBeNull();
    expect(decodeGlimpse(code + 'AAAA')).toBeNull();
    // A pose count of 0, an `at` past the poses, a first pose that is no cut.
    expect(decodeGlimpse(toBase64Url(Uint8Array.of(0, 0)))).toBeNull();
    expect(decodeGlimpse(toBase64Url(Uint8Array.of(1, 1, 0x0c, 0, 0, 5)))).toBeNull();
    expect(decodeGlimpse(toBase64Url(Uint8Array.of(1, 0, 0x08, 0, 0, 5)))).toBeNull();
    expect(decodeGlimpse(toBase64Url(Uint8Array.of(1, 0, 0x0c, 0, 0, 5)))).toEqual({
      poses: [{ x: 0, y: 0, a: 5, b: 5, t: 0, flipX: false, anchored: false, cut: true }],
      at: 0,
    });
  });

  it('refuses what it cannot store exactly', () => {
    const pose: GlimpsePose = {
      x: 0,
      y: 0,
      a: 1,
      b: 2,
      t: 512,
      flipX: false,
      anchored: false,
      cut: true,
    };
    const bad = (p: Partial<GlimpsePose>, at = 0): GlimpseTrack => ({
      poses: [{ ...pose, ...p }],
      at,
    });
    expect(() => encodeGlimpse(bad({}))).not.toThrow();
    expect(() => encodeGlimpse(bad({ t: 100 }))).toThrow(/tween/);
    expect(() => encodeGlimpse(bad({ t: 65536 }))).toThrow(/tween/);
    expect(() => encodeGlimpse(bad({ t: -256 }))).toThrow(/tween/);
    expect(() => encodeGlimpse(bad({ a: -1 }))).toThrow(/keyframe/);
    expect(() => encodeGlimpse(bad({ b: 0x10000 }))).toThrow(/keyframe/);
    expect(() => encodeGlimpse(bad({ x: 0.5 }))).toThrow(/position/);
    expect(() => encodeGlimpse(bad({ y: 2 ** 40 }))).toThrow(/position/);
    expect(() => encodeGlimpse(bad({ cut: false }))).toThrow(/cut/);
    expect(() => encodeGlimpse(bad({}, 1))).toThrow();
    expect(() => encodeGlimpse(bad({}, -1))).toThrow();
    expect(() => encodeGlimpse({ poses: [], at: 0 })).toThrow();
  });
});

describe('glimpses file checks', () => {
  const clip = encodeGlimpse({ ...syntheticTrack(3, 67, new Map()), at: 33 });
  const set = { runSha256: 'a'.repeat(64), clips: [clip] };
  const file = {
    format: GLIMPSE_FORMAT,
    simVersion: 'sim',
    rulesetId: 'rules',
    beforeSteps: GLIMPSE_BEFORE_STEPS,
    afterSteps: GLIMPSE_AFTER_STEPS,
    levels: [
      { levelId: 0, contentHash: { level: 1, moves: 2, tables: 3 }, flags: set, sprint: set },
    ],
  };

  it('pass a sound file', () => {
    expect(glimpseProblems(file)).toEqual([]);
  });

  it('find what is wrong', () => {
    expect(glimpseProblems(null)).toEqual(['not an object']);
    expect(glimpseProblems({ ...file, format: 2 })).toContain('format 2');
    expect(glimpseProblems({ ...file, beforeSteps: 30 })).toContain('beforeSteps 30');
    const long = encodeGlimpse({ ...syntheticTrack(4, 80, new Map()), at: 33 });
    const broken = { ...set, clips: [clip.slice(0, -2), long] };
    const level = { ...file.levels[0]!, flags: broken, sprint: undefined };
    const problems = glimpseProblems({ ...file, levels: [level, level] });
    expect(problems).toContain('level 0 flags clip 0: does not decode');
    expect(problems).toContain('level 0 flags clip 1: longer than the file says');
    expect(problems).toContain('level 0 sprint: missing');
    expect(problems).toContain('a level without a levelId of its own');
  });
});
