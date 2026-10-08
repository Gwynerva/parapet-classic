/**
 * The search for a fast run: an archive of "earliest arrival" states in the spirit of
 * Go-Explore.
 *
 * The level is cut into cells: progress (which flags are taken, or the next checkpoint), the
 * tile the runner's feet are in, whether it is on the ground, in the air or hanging, its
 * facing and a coarse speed. Each cell keeps the earliest moment any run reached it, with the
 * world state and the presses that led there. One iteration picks a promising cell (low clock
 * plus lower bound on what is left, and not picked too often), restores it and plays a few
 * random presses from there, recording every cell it reaches earlier than known. Runs that
 * finish compete for the best time, and every state that cannot beat it any more is dropped.
 * The order of the flags needs no special handling: different orders are different cells.
 *
 * Everything is seeded, and the budget is counted in simulation steps, so the same parameters
 * always give the same result.
 */
import { isOnSurface, type RunContent, type World, type WorldState } from '@parapet/sim';
import { LowerBound } from './bound.ts';
import type { FragileCount } from './constraints.ts';
import { keyBits, type ContestMode, type KeyCode, type Press } from './model.ts';
import { newWorld, MAX_RUN_CLOCK } from './timeline.ts';

export interface SearchParams {
  seed: number;
  /** Simulation steps to spend. */
  budgetSteps: number;
  /** Fewest steps between two presses. */
  minGap: number;
  /** Presses played from a cell per iteration. */
  pressesPerRollout: number;
  /** Mean of the random pause before a press, in steps (geometric). */
  meanWait: number;
  /** Longest pause before a press, in steps. */
  maxWait: number;
  /** Weights of the lower bound in the cell score, cycled per iteration (1 = A*, more = greedier). */
  greed: readonly number[];
  /** Cells sampled per selection; the best scoring one is played from. */
  tournament: number;
  /** Penalty per earlier pick, as a fraction of the score per doubling. */
  novelty: number;
  /** Cells kept at most; beyond that only earlier arrivals are recorded. */
  maxCells: number;
  /** Complete runs kept for polishing. */
  keepFinals: number;
  /**
   * Steps over which a press is compared with the same press one step early and one step
   * late (0: no check). A press is only played when one of the two leads to the same outcome:
   * no crash the press itself avoids, the same progress, about the same place and footing.
   * That keeps the search away from frame-perfect inputs such as a roll that only works on the
   * exact landing step.
   */
  windowSteps: number;
}

export const DEFAULT_SEARCH: Readonly<Omit<SearchParams, 'seed' | 'budgetSteps' | 'minGap'>> = {
  pressesPerRollout: 6,
  meanWait: 9,
  maxWait: 90,
  greed: [1, 1.5, 2.5, 4],
  tournament: 6,
  novelty: 0.12,
  maxCells: 700000,
  keepFinals: 12,
  windowSteps: 0,
};

/** Relative choices of the random policy and their weights (the rivals' habits: mostly UP). */
const ACTIONS = [
  { action: 'up', weight: 0.4 },
  { action: 'forward', weight: 0.22 },
  { action: 'back', weight: 0.18 },
  { action: 'down', weight: 0.2 },
] as const;

/** Whether a press off by one step ends up where the press itself does (`hasWindow`). */
function sameOutcome(now: Probe, other: Probe): boolean {
  if (other.failed && !now.failed) return false;
  if (other.finished !== now.finished || other.progress !== now.progress) return false;
  if (other.group !== now.group) return false;
  return Math.abs(other.x - now.x) <= 1536 && Math.abs(other.y - now.y) <= 1024;
}

/** Persistent list of presses, newest first, shared between the cells that extend it. */
interface PressNode {
  step: number;
  key: KeyCode;
  prev: PressNode | null;
  /** The press only worked on its exact step in a finished run (see `Search.ban`). */
  banned?: boolean;
  /** Cached result of `Search.tainted` for this node, valid while `epoch` is current. */
  epoch?: number;
  bad?: boolean;
}

/** Where a short look-ahead from a press ended (`Search.probe`). */
interface Probe {
  failed: boolean;
  finished: boolean;
  progress: number;
  group: number;
  x: number;
  y: number;
}

interface Cell {
  clock: number;
  bound: number;
  state: WorldState;
  presses: PressNode | null;
  lastPress: number;
  picks: number;
}

export interface FinalRun {
  time: number;
  presses: Press[];
}

export interface SearchProgress {
  steps: number;
  iterations: number;
  cells: number;
  best: number | null;
  /** Finished runs turned down for frame-perfect presses. */
  rejected: number;
}

export interface SearchResult extends SearchProgress {
  finals: FinalRun[];
}

/** Small, fast, seedable PRNG (mulberry32). */
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

function toArray(node: PressNode | null): Press[] {
  const out: Press[] = [];
  for (let n = node; n; n = n.prev) out.push({ step: n.step, key: n.key });
  return out.reverse();
}

export class Search {
  private readonly mode: ContestMode;
  private readonly params: SearchParams;
  private readonly world: World;
  private readonly bound: LowerBound;
  private readonly random: () => number;
  private readonly fragility: (presses: readonly Press[], limit: number) => FragileCount;
  private epoch = 0;
  private readonly banned: PressNode[] = [];
  private allowed = 0;
  private readonly cells = new Map<number, Cell>();
  private readonly list: Cell[] = [];
  private readonly finals: FinalRun[] = [];
  private best = MAX_RUN_CLOCK;
  private steps = 0;
  private iterations = 0;
  private rejected = 0;

  /**
   * `fragility` counts the frame-perfect presses of a finished run that would be the new best,
   * up to a limit. Runs with more than allowed neither count nor lower the target, so the
   * search goes on until it finds runs a human can repeat. None are allowed in the first half
   * of the budget, one after that and two in the last quarter, for levels where every fast
   * route has a precise moment.
   *
   * A turned-down run also bans its frame-perfect press: every cell reached through it is
   * tainted, picked no more and replaced by the next arrival that does without it. Otherwise
   * the archive, which keeps the earliest arrivals, would keep building on that press and
   * finish the same fragile run again and again.
   */
  constructor(
    content: RunContent,
    mode: ContestMode,
    params: SearchParams,
    fragility: (presses: readonly Press[], limit: number) => FragileCount = () => ({
      count: 0,
      index: -1,
    }),
  ) {
    this.mode = mode;
    this.params = params;
    this.fragility = fragility;
    this.world = newWorld(content, mode);
    this.bound = new LowerBound(this.world, mode);
    this.random = rng(params.seed);
    this.record(null, -Infinity);
  }

  get progress(): SearchProgress {
    return {
      steps: this.steps,
      iterations: this.iterations,
      cells: this.list.length,
      best: this.finals.length > 0 ? this.best : null,
      rejected: this.rejected,
    };
  }

  /** Plays a known run through the archive: its states become cells, its time the target. */
  seed(presses: readonly Press[]): void {
    const world = this.world;
    world.restoreState(this.list[0]!.state);
    let node: PressNode | null = null;
    let last = -Infinity;
    let i = 0;
    for (;;) {
      let bits = 0;
      const p = presses[i];
      if (p && p.step === world.stepCount) {
        bits = keyBits(p.key, world.player.facingRight);
        node = { step: p.step, key: p.key, prev: node };
        last = p.step;
        i++;
      }
      if (!this.advance(bits, node, last, false)) break;
    }
  }

  /** Runs until the step budget is spent; `report` is called every `reportSteps` steps. */
  run(report?: (p: SearchProgress) => void, reportSteps = 5_000_000): SearchResult {
    let nextReport = this.steps + reportSteps;
    const greed = this.params.greed;
    while (this.steps < this.params.budgetSteps) {
      const cell = this.pick(greed[this.iterations % greed.length] ?? 1);
      if (!cell) break;
      this.rollout(cell);
      this.iterations++;
      if (report && this.steps >= nextReport) {
        nextReport = this.steps + reportSteps;
        report(this.progress);
      }
    }
    return { ...this.progress, finals: this.finals.slice() };
  }

  private key(): number {
    const world = this.world;
    const p = world.player;
    const rules = world.rules;
    const progress = this.mode === 'flags' ? ~rules.remainingMask & 31 : rules.nextCheckpoint;
    const cx = (p.x >> 10) & 255;
    const cy = ((p.y >> 10) + 16) & 127;
    const group = p.handsAnchored ? 2 : isOnSurface(p) ? 0 : 1;
    const speed = Math.abs(p.vx);
    const sb = speed < 1500 ? 0 : speed < 3000 ? 1 : 2;
    return (
      ((((progress * 256 + cx) * 128 + cy) * 3 + group) * 2 + (p.facingRight ? 1 : 0)) * 3 + sb
    );
  }

  /** Stores the current state in its cell if it got there first. */
  private record(presses: PressNode | null, lastPress: number): void {
    const world = this.world;
    const key = this.key();
    const cell = this.cells.get(key);
    if (cell) {
      if (world.clock >= cell.clock && !this.tainted(cell.presses)) return;
      if (this.tainted(presses)) return;
      cell.clock = world.clock;
      cell.bound = this.bound.ms(world);
      cell.state = world.saveState(false);
      cell.presses = presses;
      cell.lastPress = lastPress;
      return;
    }
    if (this.list.length >= this.params.maxCells) return;
    const fresh: Cell = {
      clock: world.clock,
      bound: this.bound.ms(world),
      state: world.saveState(false),
      presses,
      lastPress,
      picks: 0,
    };
    this.cells.set(key, fresh);
    this.list.push(fresh);
  }

  /** One step; false when the rollout should stop (finished, or hopeless). */
  private advance(
    bits: number,
    presses: PressNode | null,
    lastPress: number,
    prune = true,
  ): boolean {
    const world = this.world;
    this.steps++;
    const going = world.step(bits);
    if (!going) {
      const result = world.rules.result;
      if (result?.finished) this.finish(result.time, presses);
      return false;
    }
    if (world.clock >= MAX_RUN_CLOCK) return false;
    if (prune && world.clock + this.bound.ms(world) >= this.best) return false;
    this.record(presses, lastPress);
    return true;
  }

  private finish(time: number, presses: PressNode | null): void {
    const finals = this.finals;
    if (finals.length >= this.params.keepFinals && time >= finals[finals.length - 1]!.time) return;
    const run: FinalRun = { time, presses: toArray(presses) };
    const signature = JSON.stringify(run.presses);
    if (finals.some((f) => f.time === time && JSON.stringify(f.presses) === signature)) return;
    const budget = this.params.budgetSteps;
    const allowed = this.steps < budget * 0.5 ? 0 : this.steps < budget * 0.75 ? 1 : 2;
    if (allowed !== this.allowed) {
      // A precise moment may now be part of the run: the bans start over.
      this.allowed = allowed;
      for (const node of this.banned) node.banned = false;
      this.banned.length = 0;
      this.epoch++;
    }
    const fragile = this.fragility(run.presses, allowed);
    if (fragile.count > allowed) {
      this.rejected++;
      this.ban(presses, run.presses.length - 1 - fragile.index);
      return;
    }
    finals.push(run);
    finals.sort((a, b) => a.time - b.time);
    if (finals.length > this.params.keepFinals) finals.length = this.params.keepFinals;
    this.best = Math.min(this.best, time);
  }

  /** Bans the press `back` places before the newest of `node`'s list. */
  private ban(node: PressNode | null, back: number): void {
    let n = node;
    for (let i = 0; i < back && n; i++) n = n.prev;
    if (!n || n.banned) return;
    n.banned = true;
    this.banned.push(n);
    this.epoch++;
  }

  /** Whether a press list goes through a banned press (cached per node). */
  private tainted(node: PressNode | null): boolean {
    const path: PressNode[] = [];
    let n = node;
    while (n && n.epoch !== this.epoch) {
      path.push(n);
      n = n.prev;
    }
    let bad = n ? n.bad === true : false;
    for (let i = path.length - 1; i >= 0; i--) {
      const p = path[i]!;
      bad = bad || p.banned === true;
      p.bad = bad;
      p.epoch = this.epoch;
    }
    return bad;
  }

  private pick(greed: number): Cell | null {
    const { list } = this;
    const { tournament, novelty } = this.params;
    for (let attempt = 0; attempt < 40; attempt++) {
      let chosen: Cell | null = null;
      let chosenScore = Infinity;
      for (let i = 0; i < tournament; i++) {
        const cell = list[Math.floor(this.random() * list.length)]!;
        if (cell.clock + cell.bound >= this.best || this.tainted(cell.presses)) continue;
        const score = (cell.clock + greed * cell.bound) * (1 + novelty * Math.log2(1 + cell.picks));
        if (score < chosenScore) {
          chosen = cell;
          chosenScore = score;
        }
      }
      if (chosen) {
        chosen.picks++;
        return chosen;
      }
    }
    return null;
  }

  private rollout(cell: Cell): void {
    const world = this.world;
    const { minGap, meanWait, maxWait, pressesPerRollout } = this.params;
    world.restoreState(cell.state);
    let presses = cell.presses;
    let last = cell.lastPress;
    for (let n = 0; n < pressesPerRollout; n++) {
      const wait = Math.min(maxWait, Math.floor(-Math.log(1 - this.random()) * meanWait));
      const at = Math.max(world.stepCount + wait, last + minGap);
      // The state one step before the press, for the "one step early" comparison.
      let early: WorldState | null = null;
      while (world.stepCount < at) {
        if (world.stepCount === at - 1 && at - 1 > last) early = world.saveState(false);
        if (!this.advance(0, presses, last)) return;
      }
      const key = this.chooseKey(world.player.facingRight);
      if (this.params.windowSteps > 0 && !this.hasWindow(key, early)) continue;
      presses = { step: world.stepCount, key, prev: presses };
      last = world.stepCount;
      if (!this.advance(keyBits(key, world.player.facingRight), presses, last)) return;
    }
  }

  /**
   * Whether `key` pressed now has a two-step window: pressed one step later, or one step
   * earlier (from `early`, the state a step ago), it leads to the same outcome.
   */
  private hasWindow(key: KeyCode, early: WorldState | null): boolean {
    const world = this.world;
    const before = world.saveState(false);
    const H = this.params.windowSteps;
    const now = this.probe(key, 0, H);
    world.restoreState(before);
    let ok = sameOutcome(now, this.probe(key, 1, H));
    if (!ok && early) {
      world.restoreState(early);
      ok = sameOutcome(now, this.probe(key, 0, H + 1));
    }
    world.restoreState(before);
    return ok;
  }

  /** Waits `delay` steps, presses `key`, then runs on without input until `until` steps. */
  private probe(key: KeyCode, delay: number, until: number): Probe {
    const world = this.world;
    const player = world.player;
    let failed = false;
    let finished = false;
    for (let i = 0; i < until && !finished; i++) {
      const bits = i === delay ? keyBits(key, player.facingRight) : 0;
      this.steps++;
      if (!world.step(bits)) finished = world.rules.result?.finished ?? false;
      for (const e of world.events) {
        if ((e.type === 'fail' || e.type === 'pit') && e.runner === player) failed = true;
      }
    }
    return {
      failed,
      finished,
      progress: this.mode === 'flags' ? world.rules.flagsLeft : world.rules.nextCheckpoint,
      group: player.handsAnchored ? 2 : isOnSurface(player) ? 0 : 1,
      x: player.x,
      y: player.y,
    };
  }

  private chooseKey(facingRight: boolean): KeyCode {
    let r = this.random();
    for (const a of ACTIONS) {
      r -= a.weight;
      if (r < 0) {
        switch (a.action) {
          case 'up':
            return 1;
          case 'down':
            return 2;
          case 'forward':
            return facingRight ? 3 : 4;
          case 'back':
            return facingRight ? 4 : 3;
        }
      }
    }
    return 1;
  }
}
