/**
 * The monkey vault, taken apart on the Moves menu's little level (`monkeyVault`): the runner
 * jumps at a low block (UP on step 111) and presses UP once more. The game never asks whether a
 * key is down: the second press waits in the press buffer `Q` until the runner lands on the
 * block, and the vault (state 62) starts then, whenever it was pressed. Counted on the real
 * simulation for every step of the second press.
 */
import { Input, MoveId } from '@parapet/sim';
import type { DemoPress } from '@parapet/runtime/moves/MoveDemo.ts';
import { parseDemoLevel } from '@parapet/runtime/moves/demoLevel.ts';
import { demoWorld, press } from '../demo.ts';
import { demoScene } from '../demoScene.ts';
import type { Lab } from '../lab.ts';
import { record, type Recording } from '../record.ts';
import type { Scene } from '../scene.ts';
import { bands, sweep, type Band } from './sweep.ts';

/** The jump at the block, and the steps the second UP is tried on. */
export const VAULT_JUMP = 111;
export const VAULT_FROM = 112;
export const VAULT_TO = 140;
/** The record runs to here. */
const END_STEP = 190;

export interface VaultTry {
  presses: readonly DemoPress[];
  rec: Recording;
  /** The step the vault started on, or -1. */
  vault: number;
  /** The step the runner came down from the jump (vaulting or running on), or -1. */
  landing: number;
  /** The steps a jump started on, the first one included. */
  jumps: number[];
  /** The stretches of steps UP waited in the buffer. */
  waiting: [number, number][];
}

/** The jump and then `presses`. */
export function vaultTry(lab: Lab, presses: readonly DemoPress[]): VaultTry {
  const demo = lab.demo('monkeyVault');
  const all = [press(VAULT_JUMP, 'up'), ...presses];
  const { world, input } = demoWorld(lab, demo, { presses: all });
  const rec = record(world, lab.clips, { steps: END_STEP - world.stepCount, input });
  const track = rec.tracks[0]!;
  let vault = -1;
  let landing = -1;
  const jumps: number[] = [];
  let airborne = false;
  for (const { step, id } of track.entries()) {
    if (id === MoveId.JUMP) {
      jumps.push(step);
      airborne = true;
    }
    if (id === MoveId.MONKEY_VAULT && vault < 0) vault = step;
    if (airborne && landing < 0 && (id === MoveId.MONKEY_VAULT || id === MoveId.RUN))
      landing = step;
  }
  const waiting = track.spans((s) => (s.inputBuffer & Input.UP) !== 0);
  return { presses: all, rec, vault, landing, jumps, waiting };
}

/** What the second UP gives: the vault, nothing (pressed on the landing step), a new jump. */
export type VaultOutcome = 'vault' | 'lost' | 'jump';

export interface VaultSweepTry extends VaultTry {
  press: number;
  outcome: VaultOutcome;
}

/** The second UP on every step from `VAULT_FROM` to `VAULT_TO`. */
export function vaultSweep(lab: Lab): VaultSweepTry[] {
  return sweep(VAULT_FROM, VAULT_TO, (s) => {
    const t = vaultTry(lab, [press(s, 'up')]);
    const outcome: VaultOutcome = t.vault >= 0 ? 'vault' : t.jumps.length > 1 ? 'jump' : 'lost';
    return { ...t, press: s, outcome };
  });
}

export function vaultBands(tries: readonly VaultSweepTry[]): Band<VaultOutcome>[] {
  return bands(tries.map((t) => [t.press, t.outcome] as const));
}

/** The steps a vault lane shows. */
export const VAULT_LANE = { from: 104, to: 166 };

/**
 * One try on the block: the runner, the UP waiting over its head, the vault's number while it
 * vaults, and under it the presses, the wait and the vault.
 */
export function vaultLane(lab: Lab, t: VaultTry, ink: string): Scene {
  const track = t.rec.tracks[0]!;
  return demoScene(lab, {
    level: parseDemoLevel(lab.demo('monkeyVault').rows),
    view: { x: 296, y: 84, width: 220, height: 116 },
    actors: [
      {
        track,
        ink,
        lamp: (at) => ((track.after(at).inputBuffer & Input.UP) !== 0 ? 'up' : null),
        tag: (at) => (track.after(at).moveId === MoveId.MONKEY_VAULT ? '62' : null),
      },
    ],
    ...VAULT_LANE,
    timeline: {
      ...VAULT_LANE,
      rows: [
        {
          color: ink,
          presses: t.presses.map((p) => ({ step: p.step, key: 'up' as const })),
          spans: t.waiting,
          marks: t.vault >= 0 ? [t.vault] : [],
        },
      ],
    },
  });
}
