/**
 * Experiments on the Moves menu's little levels: a demo's level and run-up, its presses moved,
 * dropped or added, and, for "what if" comparisons, a copy of the move table with a rule of the
 * original changed. The simulation itself is never touched; only the data it runs on.
 */
import { MissionType, World, type MoveDef, type MoveTableData } from '@parapet/sim';
import {
  DemoRun,
  demoKeyBits,
  type DemoKey,
  type DemoPress,
  type MoveDemoData,
} from '@parapet/runtime/moves/MoveDemo.ts';
import { parseDemoLevel, type DemoLevel } from '@parapet/runtime/moves/demoLevel.ts';
import type { Lab } from './lab.ts';

export interface DemoWorld {
  world: World;
  level: DemoLevel;
  /** The keys of `presses` due on the coming step (for `record`). */
  input: (world: World) => number;
}

/**
 * A demo's world at the end of its run-up (`from`), to be played with `presses` from there (the
 * demo's own unless given) on `moves` (the original's table unless given).
 */
export function demoWorld(
  lab: Lab,
  demo: MoveDemoData,
  opts: { presses?: readonly DemoPress[]; moves?: MoveTableData; rows?: readonly string[] } = {},
): DemoWorld {
  const presses = [...(opts.presses ?? demo.presses)].sort((a, b) => a.step - b.step);
  const level = parseDemoLevel(opts.rows ?? demo.rows);
  const run = new DemoRun(
    { ...demo, presses, rows: [...(opts.rows ?? demo.rows)] },
    { moves: opts.moves ?? lab.src.moves, tables: lab.src.tables },
    level,
  );
  return { world: run.world, level, input: pressInput(presses) };
}

/** The bits of the press due on a world's coming step, from a list sorted by step. */
export function pressInput(presses: readonly DemoPress[]): (world: World) => number {
  return (world) => {
    const p = presses.find((q) => q.step === world.stepCount);
    return p ? demoKeyBits(p.key, world.player.facingRight) : 0;
  };
}

/** A press of `key` on `step`. */
export function press(step: number, key: DemoKey): DemoPress {
  return { step, key };
}

/** An endless free run on an ASCII level (see `demoLevel.ts`), from its start cell. */
export function asciiWorld(lab: Lab, rows: readonly string[], moves?: MoveTableData): World {
  return new World({
    level: parseDemoLevel(rows).data,
    moves: moves ?? lab.src.moves,
    tables: lab.src.tables,
    rules: { missionType: MissionType.SPRINT, freeRun: true },
  });
}

/** A copy of the move table with `edit` applied to copies of the states it names. */
export function patchMoves(
  data: MoveTableData,
  edit: Record<number, (state: MoveDef) => void>,
): MoveTableData {
  const states = data.states.map((s) => {
    const change = edit[s.id];
    if (!change) return s;
    const copy: MoveDef = {
      ...s,
      transitions: s.transitions.map((t) => ({ ...t, conditions: [...t.conditions] })),
    };
    change(copy);
    return copy;
  });
  return { ...data, states };
}
