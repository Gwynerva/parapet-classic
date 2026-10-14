/**
 * The wall run, taken apart on the Moves menu's little level (`wallRun`): the runner jumps at
 * the wall (UP on step 121) and presses UP once more, on any step from 122 to 160. What that
 * second press gives, counted on the real simulation: nothing, a wall run armed in the air
 * that kicks once, or a wall run from the contact that kicks twice and climbs onto the roof.
 * The same presses run on copies of the move table with one rule of the original changed show
 * which rule does what.
 */
import type { MoveTableData } from '@parapet/sim';
import { MoveFlag, MoveId } from '@parapet/sim';
import { demoWorld, patchMoves, press } from '../demo.ts';
import type { Lab } from '../lab.ts';
import { record, type Recording } from '../record.ts';
import { parseDemoLevel } from '@parapet/runtime/moves/demoLevel.ts';
import { demoScene } from '../demoScene.ts';
import type { TimelineRow } from '../draw.ts';
import { SERIES } from '../palette.ts';
import type { Scene } from '../scene.ts';
import { drawRay, rayWatch, seeingSpans, type RayStep } from './lookahead.ts';
import { bands, sweep, type Band } from './sweep.ts';

/** The jump at the wall, and the steps the second press is tried on. */
export const JUMP_STEP = 121;
export const SWEEP_FROM = 122;
export const SWEEP_TO = 160;
/** The record runs to here. */
const END_STEP = 230;

/** The kicks off the wall: the wall run's first, second and third (`02-moves.md`). */
const KICKS = new Set([MoveId.WALL_RUN, 36, 37]);
/** Grabbing the roof's edge and climbing over. */
const LEDGE = new Set([100, 112]);

export interface WallRunTry {
  /** The step of the second UP (null: none). */
  press: number | null;
  rec: Recording;
  /** The steps a kick began on. */
  kicks: number[];
  /** The step the wall run was armed in the air (state 30), or -1. */
  armed: number;
  /** The runner grabbed the roof's edge. */
  climbed: boolean;
  /** The look-ahead ray after every step. */
  rays: Map<number, RayStep>;
}

/** The rules of the original that are changed one at a time ("what if"). */
export const VARIANTS = {
  original: (data: MoveTableData) => data,
  /** The wall run (33) clears the press buffer on entry, like most states. */
  noKeep33: (data: MoveTableData) =>
    patchMoves(data, { [MoveId.WALL_RUN]: (m) => void (m.flags &= ~MoveFlag.KEEP_BUFFER) }),
  /** The armed wall run (30) keeps the press buffer, like 33. */
  keep30: (data: MoveTableData) =>
    patchMoves(data, { [MoveId.WALL_RUN_ARMED]: (m) => void (m.flags |= MoveFlag.KEEP_BUFFER) }),
  /** No look ahead: the air state arms the wall run on contact (73) instead of the ray (68). */
  contactOnly: (data: MoveTableData) =>
    patchMoves(data, {
      10: (m) => {
        for (const t of m.transitions) {
          if (t.target === MoveId.WALL_RUN_ARMED)
            t.conditions = t.conditions.map((c) => (c === 68 ? 73 : c));
        }
      },
    }),
} as const;

export type Variant = keyof typeof VARIANTS;

/** The original's rules for the wall run, each of which can be changed for a "what if". */
export interface WallRunRules {
  /** The air states arm the wall run from the look-ahead (68), or only on contact (73). */
  lookahead: boolean;
  /** The wall run (33) keeps the presses. */
  keep33: boolean;
  /** The armed wall run (30) keeps them. */
  keep30: boolean;
}

export const ORIGINAL_RULES: WallRunRules = { lookahead: true, keep33: true, keep30: false };

/** The move table with `rules`. */
export function wallRunMoves(lab: Lab, rules: WallRunRules): MoveTableData {
  let moves = lab.src.moves;
  if (!rules.lookahead) moves = VARIANTS.contactOnly(moves);
  if (!rules.keep33) moves = VARIANTS.noKeep33(moves);
  if (rules.keep30) moves = VARIANTS.keep30(moves);
  return moves;
}

/** The jump at the wall and a second UP on `second` (none: null), on a variant or any table. */
export function wallRunTry(
  lab: Lab,
  second: number | null,
  variant: Variant | MoveTableData = 'original',
): WallRunTry {
  const demo = lab.demo('wallRun');
  const presses = [press(JUMP_STEP, 'up'), ...(second === null ? [] : [press(second, 'up')])];
  const moves = typeof variant === 'string' ? VARIANTS[variant](lab.src.moves) : variant;
  const { world, input } = demoWorld(lab, demo, { presses, moves });
  const { rays, observe } = rayWatch();
  const rec = record(world, lab.clips, { steps: END_STEP - world.stepCount, input, observe });
  const kicks: number[] = [];
  let armed = -1;
  let climbed = false;
  for (const { step, id } of rec.tracks[0]!.entries()) {
    if (KICKS.has(id)) kicks.push(step);
    if (id === MoveId.WALL_RUN_ARMED && armed < 0) armed = step;
    if (LEDGE.has(id)) climbed = true;
  }
  return { press: second, rec, kicks, armed, climbed, rays };
}

const sweeps = new WeakMap<Lab, Map<Variant, readonly WallRunTry[]>>();

/** Every second press from `SWEEP_FROM` to `SWEEP_TO` (run once per lab and variant). */
export function wallRunSweep(lab: Lab, variant: Variant = 'original'): readonly WallRunTry[] {
  let byVariant = sweeps.get(lab);
  if (!byVariant) {
    byVariant = new Map();
    sweeps.set(lab, byVariant);
  }
  let tries = byVariant.get(variant);
  if (!tries) {
    tries = sweep(SWEEP_FROM, SWEEP_TO, (s) => wallRunTry(lab, s, variant));
    byVariant.set(variant, tries);
  }
  return tries;
}

/** What a second press gives: nothing, one kick (then a fall), two kicks and a climb, or a fall. */
export type Outcome = 'none' | 'one' | 'twoClimb' | 'twoFall';

export function outcomeOf(t: WallRunTry): Outcome {
  if (t.kicks.length === 0) return 'none';
  if (t.kicks.length === 1) return 'one';
  return t.climbed ? 'twoClimb' : 'twoFall';
}

/** The bands of a sweep's outcomes. */
export function outcomeBands(tries: readonly WallRunTry[]): Band<Outcome>[] {
  return bands(tries.map((t) => [t.press!, outcomeOf(t)] as const));
}

/** The states of arming the wall run and running up it. */
export const WALL_STATES: ReadonlySet<number> = new Set([30, 33, 34, 36, 37]);

/** The runner's state over its head while it arms the wall run or runs up the wall. */
export function wallStateTag(
  t: WallRunTry,
  shown: ReadonlySet<number>,
): (at: number) => string | null {
  return (at) => {
    const id = t.rec.tracks[0]!.after(at).moveId;
    return shown.has(id) ? String(id) : null;
  };
}

/**
 * One try at the wall, the whole wall in view: the runner with its state over its head, the
 * look-ahead ray if asked, and under it the stretch the ray sees the wall, the presses and the
 * kicks.
 */
export function wallRunScene(
  lab: Lab,
  t: WallRunTry,
  opts: { ray: boolean; ink: string; from: number; to: number; tags?: ReadonlySet<number> },
): Scene {
  const track = t.rec.tracks[0]!;
  const seeing = seeingSpans(t.rays).filter(([a]) => a > JUMP_STEP);
  const rows: TimelineRow[] = [];
  if (opts.ray) rows.push({ color: SERIES[2], presses: [], spans: seeing.slice(0, 1) });
  rows.push({
    color: opts.ink,
    presses: [
      { step: JUMP_STEP, key: 'up' },
      ...(t.press === null ? [] : [{ step: t.press, key: 'up' as const }]),
    ],
    marks: t.kicks,
  });
  return demoScene(lab, {
    level: parseDemoLevel(lab.demo('wallRun').rows),
    view: { x: 248, y: -8, width: 288, height: 208 },
    actors: [{ track, tag: wallStateTag(t, opts.tags ?? WALL_STATES), ink: opts.ink }],
    from: opts.from,
    to: opts.to,
    overlay: opts.ray ? (frame, at, px) => drawRay(frame, at, px, track, t.rays) : undefined,
    timeline: { from: opts.from, to: opts.to, rows },
  });
}
