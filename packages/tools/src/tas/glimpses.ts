/**
 * The bosses' glimpses (`packages/runtime/src/content/glimpses.ts`): a stored run is played
 * again with the renderer's animation and cut into a piece of poses around each flag or
 * checkpoint, from a second before it is taken to a second after.
 *
 * The run is played in an endless world (`freeRun`): it takes the flags step for step like the
 * run's own world but never finishes, so after the presses run out (at the finish) the runner
 * goes on by itself for the second after the last flag.
 */
import { STEP, World, missionTypeForMode, timeLimitForMode, type RunContent } from '@parapet/sim';
import { Animator } from '@parapet/runtime/anim/Animator.ts';
import { TELEPORT_UNITS } from '@parapet/runtime/render/CharacterRenderer.ts';
import {
  GLIMPSE_AFTER_STEPS,
  GLIMPSE_BEFORE_STEPS,
  encodeGlimpse,
  type GlimpsePose,
  type GlimpseTrack,
} from '@parapet/runtime/content/glimpses.ts';
import { levelContent, loadClipTable } from './content.ts';
import type { TasRunFile } from './files.ts';
import { keyBits, parsePresses, type ContestMode, type Press } from './model.ts';

/** A world of `mode` on `content` that takes its flags but never finishes. */
export function endlessWorld(content: RunContent, mode: ContestMode): World {
  return new World({
    level: content.level,
    moves: content.moves,
    tables: content.tables,
    levelId: content.level.id,
    rules: {
      missionType: missionTypeForMode(mode),
      freeRun: true,
      timeLimit: timeLimitForMode(content.mission, mode),
    },
  });
}

export interface PoseRecording {
  /** The player's pose after every step; `poses[0]` is the one before the first step. */
  poses: GlimpsePose[];
  /** Steps after which the flags or checkpoints were taken, in the order taken. */
  splitSteps: number[];
  /** Flag or checkpoint index in the order taken. */
  order: number[];
}

/**
 * Plays `presses` (those before `finishStep`, the run's step count) and then no input, up to
 * `untilStep` steps, and records the pose `CharacterRenderer` gives the player after every
 * step (its animator, seed 1, its teleports as cuts). A fall into a pit after the finish ends
 * the recording before the pose of that step: the runner is put back up there.
 */
export function recordPoses(
  content: RunContent,
  mode: ContestMode,
  presses: readonly Press[],
  finishStep: number,
  untilStep: number,
  clips: Int16Array,
): PoseRecording {
  const world = endlessWorld(content, mode);
  const runner = world.player;
  const animator = new Animator(clips, 1);
  animator.setIdle(runner);
  const pose = (cut: boolean): GlimpsePose => {
    const p = animator.drawParams(runner);
    const f = animator.frames();
    return {
      x: p.x,
      y: p.y,
      a: f.a,
      b: f.b,
      t: f.t,
      flipX: p.flipX,
      anchored: runner.handsAnchored,
      cut,
    };
  };
  const poses = [pose(true)];
  const splitSteps: number[] = [];
  const order: number[] = [];
  let i = 0;
  while (world.stepCount < untilStep) {
    let bits = 0;
    const p = presses[i];
    if (p && p.step === world.stepCount && p.step < finishStep) {
      bits = keyBits(p.key, runner.facingRight);
      i++;
    }
    world.step(bits);
    let pit = false;
    for (const e of world.events) {
      if (e.type === 'flag' || e.type === 'checkpoint') {
        splitSteps.push(world.stepCount);
        order.push(e.index);
      } else if (e.type === 'move' && e.runner === runner) {
        animator.setMove(world.moves.get(e.to), e.timer, e.entry);
      } else if (e.type === 'pit' && e.runner === runner) {
        pit = true;
      }
    }
    if (pit && world.stepCount > finishStep) break;
    animator.update(STEP, runner, world.clock);
    const prev = poses[poses.length - 1]!;
    const next = pose(false);
    next.cut =
      next.anchored !== prev.anchored ||
      Math.abs(next.x - prev.x) > TELEPORT_UNITS ||
      Math.abs(next.y - prev.y) > TELEPORT_UNITS;
    poses.push(next);
  }
  return { poses, splitSteps, order };
}

/**
 * The glimpse of each flag or checkpoint by its index (null for one never taken): the poses
 * from `GLIMPSE_BEFORE_STEPS` before the step it was taken on to `GLIMPSE_AFTER_STEPS` after,
 * as far as the recording goes, the first one a cut.
 */
export function cutGlimpses(rec: PoseRecording, flagCount: number): (GlimpseTrack | null)[] {
  const out: (GlimpseTrack | null)[] = Array.from({ length: flagCount }, () => null);
  rec.splitSteps.forEach((n, k) => {
    const index = rec.order[k]!;
    if (index < 0 || index >= flagCount) return;
    const from = Math.max(0, n - GLIMPSE_BEFORE_STEPS);
    const to = Math.min(rec.poses.length, n + GLIMPSE_AFTER_STEPS + 1);
    const poses = rec.poses.slice(from, to);
    poses[0] = { ...poses[0]!, cut: true };
    out[index] = { poses, at: n - from };
  });
  return out;
}

/** The coded glimpses of a stored run, by flag or checkpoint index, and what went wrong. */
export function runGlimpses(run: TasRunFile): { clips: string[]; problems: string[] } {
  const problems: string[] = [];
  const content = levelContent(run.levelId);
  const finishStep = run.timeMs / STEP;
  const splitSteps = run.splitsMs.map((ms) => ms / STEP);
  if (![finishStep, ...splitSteps].every(Number.isInteger)) {
    return { clips: [], problems: ['times are not whole steps'] };
  }
  const untilStep = Math.max(0, ...splitSteps) + GLIMPSE_AFTER_STEPS;
  const presses = parsePresses(run.presses);
  const rec = recordPoses(content, run.mode, presses, finishStep, untilStep, loadClipTable());
  if (rec.splitSteps.join() !== splitSteps.join()) problems.push('glimpse splits differ');
  if (rec.order.join() !== run.order.join()) problems.push('glimpse order differs');
  const section = content.level.missions[String(missionTypeForMode(run.mode))];
  const tracks = cutGlimpses(rec, section?.checkpoints.length ?? 0);
  const clips = tracks.map((track, i) => {
    if (!track) {
      problems.push(`flag ${i} has no glimpse`);
      return '';
    }
    try {
      return encodeGlimpse(track);
    } catch (error) {
      problems.push(`flag ${i}: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  });
  return { clips, problems };
}
