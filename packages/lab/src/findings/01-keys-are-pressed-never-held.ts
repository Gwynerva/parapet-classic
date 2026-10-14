/**
 * Keys are pressed, never held: the game sees a key only on the step it goes down. A press the
 * runner cannot use yet waits in the press buffer `Q` (most states clear it when entered), and
 * the moves that read the buffer fire only on a step with no new press. So a monkey vault
 * pressed anywhere during the jump starts on the same step, the landing; pressed on the landing
 * step itself, or after a press on it, it is lost.
 */
import { MoveFlag } from '@parapet/sim';
import type { DemoKey } from '@parapet/runtime/moves/MoveDemo.ts';
import { press } from '../demo.ts';
import { onlyBand } from '../experiments/sweep.ts';
import { VAULT_JUMP, vaultBands, vaultLane, vaultSweep, vaultTry } from '../experiments/vault.ts';
import { vaultChart } from '../experiments/vaultChart.ts';
import type { Facts, Finding } from '../finding.ts';
import type { Lab } from '../lab.ts';
import { INK, SERIES } from '../palette.ts';
import { gridScene } from '../scene.ts';

const KEYS: readonly DemoKey[] = ['up', 'down', 'fwd', 'back'];

interface PressFacts extends Facts {
  jumpStep: number;
  /** What the second UP gives over the sweep, band by band. */
  outcomes: string;
  /** `[first, last]` second presses that vault. */
  vaultBand: readonly number[];
  /** The steps those vaults start on (one step: the landing). */
  vaultSteps: readonly number[];
  landingStep: number;
  /** With UP waiting, the keys that still vault when pressed on the landing step. */
  vaultingLandingKeys: string;
  keepBufferStates: number;
  states: number;
}

export const keysArePressed: Finding<PressFacts> = {
  slug: '01-keys-are-pressed-never-held',
  title: 'Keys are pressed, never held',
  claim:
    'A press waits in a buffer until the runner can use it: a vault pressed anywhere in the jump starts on the same step, and one more key on that step loses it.',

  facts(lab: Lab): PressFacts {
    const tries = vaultSweep(lab);
    const b = vaultBands(tries);
    const vaults = tries.filter((t) => t.outcome === 'vault');
    const landing = vaults[0]?.landing ?? -1;
    const states = lab.src.moves.states;
    return {
      jumpStep: VAULT_JUMP,
      outcomes: b.map(([, , o]) => o).join(' '),
      vaultBand: onlyBand(b, 'vault'),
      vaultSteps: [...new Set(vaults.map((t) => t.vault))],
      landingStep: landing,
      vaultingLandingKeys: KEYS.filter(
        (k) => vaultTry(lab, [press(VAULT_JUMP + 10, 'up'), press(landing, k)]).vault >= 0,
      ).join(' '),
      keepBufferStates: states.filter((s) => (s.flags & MoveFlag.KEEP_BUFFER) !== 0).length,
      states: states.length,
    };
  },

  measured(f: PressFacts): [string, string][] {
    const after = (step: number): number => step - f.jumpStep;
    const [first, last] = f.vaultBand;
    return [
      [
        'Second UP that gives the vault',
        `${after(first!)} to ${after(last!)} steps after the jump (${last! - first! + 1} steps)`,
      ],
      [
        'Step every one of these vaults starts on',
        `${f.vaultSteps.map(after).join(', ')} steps after the jump`,
      ],
      ['Step the runner lands on the block', `${after(f.landingStep)} steps after the jump`],
      [
        'Keys that keep the vault when pressed on the landing step, UP waiting',
        f.vaultingLandingKeys || 'none of UP, DOWN, FWD, BACK',
      ],
      [
        'States that keep the buffer when entered (flag 0x40)',
        `${f.keepBufferStates} of ${f.states}`,
      ],
    ];
  },

  checks(f: PressFacts): string[] {
    const out: string[] = [];
    if (f.outcomes !== 'vault lost jump') {
      out.push(`the second press gives ${f.outcomes}, not vault, lost, jump`);
    }
    if (f.vaultBand.length !== 2 || f.vaultBand[1]! - f.vaultBand[0]! < 14) {
      out.push('no band of 15 steps that vault');
    }
    if (f.vaultSteps.length !== 1 || f.vaultSteps[0] !== f.landingStep) {
      out.push('the vaults do not all start on the landing step');
    }
    if (f.vaultingLandingKeys !== '')
      out.push(`${f.vaultingLandingKeys} on landing keep the vault`);
    return out;
  },

  clips(lab: Lab, f: PressFacts) {
    const vault = SERIES[0];
    const lanes: { presses: number[]; ink: string }[] = [
      { presses: [f.vaultBand[0]!], ink: vault },
      { presses: [VAULT_JUMP + 11], ink: vault },
      { presses: [f.vaultBand[1]!], ink: vault },
      { presses: [VAULT_JUMP + 10, f.landingStep], ink: INK.muted },
    ];
    const scenes = lanes.map((lane) =>
      vaultLane(
        lab,
        vaultTry(
          lab,
          lane.presses.map((s) => press(s, 'up')),
        ),
        lane.ink,
      ),
    );
    return [
      {
        name: 'vault',
        alt: 'Four runners jump at a low block. Three press UP once, early, midway and just before landing; the key lights up over their heads while it waits, and all three vault on the same step. The fourth presses UP and again on the landing step: no vault.',
        scene: gridScene(scenes, 2, 4),
        script: [
          { from: 104, to: 128 },
          { from: 128, to: 140, speed: 0.25 },
          { from: 140, to: 166 },
          { at: 166, holdMs: 1500 },
        ],
      },
    ];
  },

  charts(lab: Lab) {
    return [
      {
        name: 'window',
        alt: 'For every step of the second UP after the jump: from 1 to 22 steps it waits in the buffer and the vault starts on the landing step; on the landing step it is lost; later it starts a new jump.',
        svg: vaultChart(vaultSweep(lab)),
      },
    ];
  },
};
