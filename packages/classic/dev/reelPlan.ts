/**
 * The part of the TAS reel that works out what plays: the record's attempts (presses moved,
 * dropped, swapped or added, kept only when they do worse than the record), how they fade, and
 * small helpers. Shared by the reel (`reel.ts`) and the TAS film (`film.ts`).
 */
import { MoveTable, type World, type WorldState } from '@parapet/sim';
import { keyBits, type ContestMode, type Press } from '../../tools/src/tas/model.ts';

/** How long an attempt is followed past the moment the record takes the next flag. */
export const LATE_STEPS = 45;
/**
 * Between flags a smaller wave of attempts sets off every this many steps (3 s), so a long
 * stretch never runs out of them; none closer than half that to a flag's wave.
 */
export const WAVE_STEPS = 100;
/** An attempt that reaches the next flag no more than this late counts as the record's. */
export const SAME_STEPS = 2;
/** How far (units, x plus y) an attempt must stray from the record to be seen. */
export const MIN_STRAY = 768;
/** Opacity of an attempt in the hologram layer, and of the layer. */
export const ATTEMPT_ALPHA = 0.45;
export const LAYER_ALPHA = 0.9;
export const FADE_IN_MS = 250;
export const FADE_OUT_MS = 700;
/** A batch fades out over this long once the record takes its flag, one attempt after another. */
export const RETIRE_SPREAD_MS = 1600;
/** A crashed or fallen attempt lies there this long before it fades. */
export const WRONG_LINGER_MS = 1100;

/** Small seedable PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Flags or checkpoints taken. */
export function progressOf(world: World, mode: ContestMode): number {
  return mode === 'flags' ? 5 - world.rules.flagsLeft : world.rules.nextCheckpoint;
}

/** Plays `presses` from the world's step on: the bits of this step (`next` is the press index). */
export function bitsAt(world: World, presses: readonly Press[], cursor: { next: number }): number {
  while (cursor.next < presses.length && presses[cursor.next]!.step < world.stepCount) {
    cursor.next++;
  }
  const p = presses[cursor.next];
  if (!p || p.step !== world.stepCount) return 0;
  cursor.next++;
  return keyBits(p.key, world.player.facingRight);
}

/** A batch of attempts: where they set off (the record's state then) and how they go. */
export interface Batch {
  from: number;
  state: WorldState;
  /** A flag's wave (true) or one between flags. */
  flag: boolean;
  /** Where the next batch sets off: the attempts change the record's presses before it. */
  until: number;
  /** The step the record takes its next flag on (or finishes). */
  flagAt: number;
  attempts: Press[][];
}

/** The record and its attempts, worked out before the level plays. */
export interface Plan {
  levelId: number;
  presses: Press[];
  timeMs: number;
  batches: Batch[];
}

export interface Content {
  world: () => World;
  moves: MoveTable;
}

/** One press or two of the record's, between `from` and `until`, changed. */
export function mutate(
  presses: readonly Press[],
  from: number,
  until: number,
  rand: () => number,
): Press[] {
  const v = presses.slice();
  const count = rand() < 0.3 ? 2 : 1;
  for (let m = 0; m < count; m++) {
    const inside: number[] = [];
    v.forEach((p, i) => {
      if (p.step >= from && p.step < until) inside.push(i);
    });
    const r = rand();
    const key = (1 + Math.floor(rand() * 4)) as Press['key'];
    if (inside.length === 0 || r < 0.15) {
      v.push({ step: from + Math.floor(rand() * Math.max(1, until - from)), key });
      continue;
    }
    const i = inside[Math.floor(rand() * inside.length)]!;
    const p = v[i]!;
    if (r < 0.55) {
      const d = (1 + Math.floor(rand() * 8)) * (rand() < 0.5 ? -1 : 1);
      v[i] = { step: Math.max(from, p.step + d), key: p.key };
    } else if (r < 0.8) {
      v.splice(i, 1);
    } else {
      v[i] = { step: p.step, key: key === p.key ? (((key % 4) + 1) as Press['key']) : key };
    }
  }
  v.sort((a, b) => a.step - b.step);
  return v.filter((p, i) => i === 0 || p.step !== v[i - 1]!.step);
}

/**
 * Whether an attempt goes wrong where the record does not: it crashes or falls, or takes the
 * next flag late (or not before the next batch), and strays from the record far enough to be
 * seen.
 */
export function goesWrong(
  content: Content,
  mode: ContestMode,
  sim: World,
  batch: Omit<Batch, 'attempts'>,
  presses: readonly Press[],
  track: { x: Int32Array; y: Int32Array },
): boolean {
  sim.restoreState(batch.state);
  const start = progressOf(sim, mode);
  const cursor = { next: 0 };
  let stray = 0;
  let wrong = false;
  while (sim.stepCount < batch.until + LATE_STEPS) {
    const going = sim.step(bitsAt(sim, presses, cursor));
    for (const e of sim.events) {
      if (e.type === 'pit') wrong = true;
      if (e.type === 'move' && content.moves.get(e.to).scoreType === 0) wrong = true;
    }
    const s = sim.stepCount;
    if (s < track.x.length) {
      stray = Math.max(
        stray,
        Math.abs(sim.player.x - track.x[s]!) + Math.abs(sim.player.y - track.y[s]!),
      );
    }
    const late = s > batch.flagAt + SAME_STEPS;
    if (!going) return (!sim.rules.result?.finished || late) && stray >= MIN_STRAY;
    if (progressOf(sim, mode) > start) return (wrong || late) && stray >= MIN_STRAY;
  }
  return stray >= MIN_STRAY || wrong;
}

/**
 * Plays the record once, cutting it at its flags and between them, and finds the attempts of
 * every batch: `perBatch` at a flag, half as many between.
 */
export function makePlan(
  content: Content,
  mode: ContestMode,
  levelId: number,
  presses: Press[],
  perBatch: number,
  status: (text: string) => void,
  until = 0,
): Plan {
  const world = content.world();
  const xs = [world.player.x];
  const ys = [world.player.y];
  const cuts: { step: number; state: WorldState; flag: boolean }[] = [
    { step: 0, state: world.saveState(false), flag: true },
  ];
  const cursor = { next: 0 };
  let progress = progressOf(world, mode);
  for (;;) {
    const going = world.step(bitsAt(world, presses, cursor));
    xs.push(world.player.x);
    ys.push(world.player.y);
    if (!going || (until > 0 && world.stepCount >= until)) break;
    const now = progressOf(world, mode);
    if (now !== progress) {
      progress = now;
      // A wave just before a flag's would hardly be seen.
      const last = cuts.at(-1)!;
      if (!last.flag && world.stepCount - last.step < WAVE_STEPS / 2) cuts.pop();
      cuts.push({ step: world.stepCount, state: world.saveState(false), flag: true });
    } else if (world.stepCount - cuts.at(-1)!.step >= WAVE_STEPS) {
      cuts.push({ step: world.stepCount, state: world.saveState(false), flag: false });
    }
    if (world.stepCount > 20000) throw new Error('the record does not finish');
  }
  const end = world.stepCount;
  const track = { x: Int32Array.from(xs), y: Int32Array.from(ys) };
  const sim = content.world();
  const batches: Batch[] = cuts.map((cut, k) => {
    status(`level ${levelId}: attempts for wave ${k + 1} of ${cuts.length}…`);
    const batch = {
      from: cut.step,
      state: cut.state,
      flag: cut.flag,
      until: cuts[k + 1]?.step ?? end,
      flagAt: cuts.find((c, i) => i > k && c.flag)?.step ?? end,
    };
    const rand = rng(levelId * 1000 + k + 1);
    const seen = new Set<string>();
    const attempts: Press[][] = [];
    const wanted = cut.flag ? perBatch : Math.round(perBatch / 2);
    for (let tries = 0; attempts.length < wanted && tries < wanted * 25; tries++) {
      const variant = mutate(presses, batch.from, batch.until, rand);
      const key = variant.map((p) => `${p.step}${p.key}`).join(' ');
      if (seen.has(key)) continue;
      seen.add(key);
      if (goesWrong(content, mode, sim, batch, variant, track)) attempts.push(variant);
    }
    return { ...batch, attempts };
  });
  return { levelId, presses, timeMs: world.rules.result?.time ?? world.clock, batches };
}

/** An attempt on screen. */
export interface Live {
  world: World;
  presses: Press[];
  cursor: { next: number };
  born: number;
  fadeAt: number;
  wrongAt: number;
  ended: boolean;
}

/** When an attempt starts to fade out (reel time). */
export function fadeStart(a: Live): number {
  return Math.min(a.fadeAt, a.wrongAt + WRONG_LINGER_MS);
}

/** Opacity of an attempt at reel time `t`. */
export function opacity(a: Live, t: number): number {
  let o = Math.min(1, Math.max(0, (t - a.born) / FADE_IN_MS));
  const fadeAt = fadeStart(a);
  if (t > fadeAt) o *= Math.max(0, 1 - (t - fadeAt) / FADE_OUT_MS);
  return o;
}

export function formatClock(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
}
