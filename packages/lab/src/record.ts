/**
 * Runs a world step by step and keeps what every step did to its runners: their state, the moves
 * entered (several in one step when instant states chain), and the pose the game's animator
 * gives them (`Animator`, as `CharacterRenderer` draws them). A frame at any moment `t` (in
 * steps, fractional between two) is then drawn from the record: the animations, slow motion,
 * still frames and the Lab's scrubber all read the same steps.
 */
import { STEP, type RunnerState, type World, type WorldEvent } from '@parapet/sim';
import { Animator } from '@parapet/runtime/anim/Animator.ts';
import { TELEPORT_UNITS, type CharacterPose } from '@parapet/runtime/render/CharacterRenderer.ts';

/** A runner after one step. */
export interface RunnerStep {
  x: number;
  y: number;
  vx: number;
  vy: number;
  prevVx: number;
  prevVy: number;
  moveId: number;
  moveTimer: number;
  /** Keys pressed this step, and the press buffer `Q` after it. */
  pressed: number;
  inputBuffer: number;
  facingRight: boolean;
  handsAnchored: boolean;
  /** Moves entered during the step, in order. */
  entered: number[];
  failed: boolean;
  pose: CharacterPose;
  /** The pose jumped (a teleport, the anchor changed): not tweened from the step before. */
  cut: boolean;
}

/**
 * One runner's steps, counted as the world counts them. Step `s` is played over the moments
 * `s..s+1`: the pose glides from the runner before it to the runner after it. `steps[0]` is the
 * runner before step `start`.
 */
export class Track {
  readonly steps: RunnerStep[] = [];
  /** The world step the record starts on. */
  readonly start: number;

  constructor(start: number) {
    this.start = start;
  }

  /** The runner after world step `step` (clamped to the record). */
  after(step: number): RunnerStep {
    const i = Math.floor(step) - this.start + 1;
    return this.steps[Math.max(0, Math.min(this.steps.length - 1, i))]!;
  }

  /** The moves entered, each with the step it was entered on. */
  entries(): { step: number; id: number }[] {
    return this.steps.flatMap((s, i) => s.entered.map((id) => ({ step: this.start + i - 1, id })));
  }

  /** The stretches `[first, last]` of steps after which `test` holds for the runner. */
  spans(test: (s: RunnerStep) => boolean): [number, number][] {
    const out: [number, number][] = [];
    this.steps.forEach((s, i) => {
      if (i === 0 || !test(s)) return;
      const step = this.start + i - 1;
      const last = out.at(-1);
      if (last && last[1] === step - 1) last[1] = step;
      else out.push([step, step]);
    });
    return out;
  }

  /** The pose at moment `t`: the position glides from step to step, the keyframes do not. */
  pose(t: number): CharacterPose {
    const at = t - this.start;
    const i = Math.max(0, Math.min(this.steps.length - 1, Math.floor(at)));
    const a = this.steps[i]!;
    const b = this.steps[i + 1];
    const f = at - i;
    if (!b || b.cut || f <= 0) return a.pose;
    return {
      ...a.pose,
      x: Math.round(a.pose.x + (b.pose.x - a.pose.x) * f),
      y: Math.round(a.pose.y + (b.pose.y - a.pose.y) * f),
    };
  }
}

export interface RecordOptions {
  /** Steps to record at most (the record also ends when the run does). */
  steps: number;
  /** The keys pressed on the coming step. */
  input?: (world: World) => number;
  /** Runners to follow (default: the player). */
  runners?: (world: World) => readonly RunnerState[];
  /** Called after every step (the record of the step is the last of each track). */
  observe?: (world: World, events: readonly WorldEvent[]) => void;
  /** Animator seed (blinks). */
  seed?: number;
}

export interface Recording {
  tracks: Track[];
  /** The world clock after every step; `clocks[0]` before the first. */
  clocks: number[];
  world: World;
}

/** Runs `world` from where it is and records it. */
export function record(world: World, clips: Int16Array, opts: RecordOptions): Recording {
  const runners = opts.runners?.(world) ?? [world.player];
  const animators = runners.map((r) => {
    const a = new Animator(clips, opts.seed ?? 1);
    a.setIdle(r);
    // A runner already on the move (a demo's run-up) shows that move from the first frame.
    if (world.stepCount > 0) a.setMove(world.moves.get(r.moveId), r.moveTimer, r);
    return a;
  });
  const tracks = runners.map(() => new Track(world.stepCount));
  const clocks = [world.clock];
  const entered = runners.map((): number[] => []);
  const failed = runners.map(() => false);
  const capture = (i: number, pressed: number): void => {
    const r = runners[i]!;
    const animator = animators[i]!;
    const p = animator.drawParams(r);
    const f = animator.frames();
    const pose: CharacterPose = {
      x: p.x,
      y: p.y,
      a: f.a,
      b: f.b,
      t: f.t,
      flipX: p.flipX,
      anchored: r.handsAnchored,
    };
    const prev = tracks[i]!.steps.at(-1);
    tracks[i]!.steps.push({
      x: r.x,
      y: r.y,
      vx: r.vx,
      vy: r.vy,
      prevVx: r.prevVx,
      prevVy: r.prevVy,
      moveId: r.moveId,
      moveTimer: r.moveTimer,
      pressed,
      inputBuffer: r.inputBuffer,
      facingRight: r.facingRight,
      handsAnchored: r.handsAnchored,
      entered: entered[i]!.splice(0),
      failed: failed[i]!,
      pose,
      cut:
        !prev ||
        prev.pose.anchored !== pose.anchored ||
        Math.abs(prev.pose.x - pose.x) > TELEPORT_UNITS ||
        Math.abs(prev.pose.y - pose.y) > TELEPORT_UNITS,
    });
    failed[i] = false;
  };
  runners.forEach((_, i) => capture(i, 0));
  for (let n = 0; n < opts.steps; n++) {
    const bits = opts.input?.(world) ?? 0;
    const going = world.step(bits);
    for (const e of world.events) {
      if (e.type !== 'move' && e.type !== 'fail' && e.type !== 'pit') continue;
      const i = runners.indexOf(e.runner);
      if (i < 0) continue;
      if (e.type === 'move') {
        entered[i]!.push(e.to);
        animators[i]!.setMove(world.moves.get(e.to), e.timer, e.entry);
      } else {
        failed[i] = true;
      }
    }
    runners.forEach((r, i) => {
      animators[i]!.update(STEP, r, world.clock);
      capture(i, r === world.player ? bits : r.pressedBits);
    });
    clocks.push(world.clock);
    opts.observe?.(world, world.events);
    if (!going) break;
  }
  return { tracks, clocks, world };
}
