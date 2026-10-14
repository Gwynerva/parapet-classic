/**
 * The parkour is a table: every move of the original is a few states of one table of 135 records
 * of 14 numbers, and a list of transitions per state ("if these conditions hold, go there"). The
 * code is a small engine that runs any such table. Read as a whole, the table shows its shared
 * lists, its instant states, a state only the code enters and two transitions that never fire.
 */
import { parseDemoLevel } from '@parapet/runtime/moves/demoLevel.ts';
import { arrowOf } from '../draw.ts';
import { demoWorld } from '../demo.ts';
import { demoScene } from '../demoScene.ts';
import {
  enteredByTable,
  instantStates,
  reachable,
  shadowedTransitions,
} from '../experiments/table.ts';
import {
  drawTablePanel,
  periodicTable,
  recordChart,
  tableLook,
  tablePanelSize,
} from '../experiments/tableArt.ts';
import type { Facts, Finding } from '../finding.ts';
import type { Frame } from '../frame.ts';
import type { Lab } from '../lab.ts';
import { RGB, SERIES } from '../palette.ts';
import { record } from '../record.ts';
import { gridScene, type Scene } from '../scene.ts';

/** Ints per state record in the original's table. */
const RECORD_INTS = 14;
/** The state whose record the chart decodes: the wall run. */
const SHOWN = 33;

interface TableFacts extends Facts {
  states: number;
  recordInts: number;
  transitions: number;
  /** Shared transition lists, and the distinct lists. */
  lists: number;
  conditions: number;
  impulseTypes: number;
  snapTypes: number;
  /** States that are only a shared list: no transition or timer enters them. */
  onlyLists: readonly number[];
  /** Entered by the table, but by nothing reachable from the start. */
  unreachable: readonly number[];
  instant: number;
  /** Transitions an earlier one of their list always beats: `state: hidden → by`. */
  neverFire: string;
  withPoints: number;
}

export const parkourIsATable: Finding<TableFacts> = {
  slug: '04-the-parkour-is-a-table',
  title: 'The parkour is a table',
  claim:
    'Every move is a few rows of one table of 135 states; the code only runs it. Read whole, the table has instant states, a state only the code enters and transitions that never fire.',

  facts(lab: Lab): TableFacts {
    const states = lab.src.moves.states;
    const entered = enteredByTable(states);
    const reach = reachable(states);
    const used = <T>(f: (s: (typeof states)[number]) => T): number =>
      new Set(states.map(f).filter((v) => v !== -1)).size;
    return {
      states: states.length,
      recordInts: RECORD_INTS,
      transitions: states.reduce((n, s) => n + s.transitions.length, 0),
      lists: used((s) => s.transitionList),
      conditions: new Set(states.flatMap((s) => s.transitions.flatMap((t) => t.conditions))).size,
      impulseTypes: used((s) => s.impulseType),
      snapTypes: used((s) => s.snapType),
      onlyLists: states.filter((s) => !entered.has(s.id)).map((s) => s.id),
      unreachable: states.filter((s) => entered.has(s.id) && !reach.has(s.id)).map((s) => s.id),
      instant: instantStates(states).length,
      neverFire: shadowedTransitions(states)
        .map(
          (x) =>
            `${x.state}: ${x.hidden.conditions.join('+')}→${x.hidden.target} behind ${x.by.conditions.join('+')}→${x.by.target}`,
        )
        .join('; '),
      withPoints: states.filter((s) => s.points > 0).length,
    };
  },

  measured(f: TableFacts): [string, string][] {
    return [
      [
        'States, and numbers per state',
        `${f.states} × ${f.recordInts} = ${f.states * f.recordInts} ints`,
      ],
      ['Transitions, in transition lists', `${f.transitions} in ${f.lists} lists`],
      [
        'Conditions, impulse types, snap types used',
        `${f.conditions}, ${f.impulseTypes}, ${f.snapTypes}`,
      ],
      ['States that are only a shared list (never entered)', f.onlyLists.join(', ')],
      ['States the table enters but the start never reaches', f.unreachable.join(', ')],
      ['Instant states (no time, the next follows in the same step)', String(f.instant)],
      ['Transitions that can never fire', f.neverFire],
      ['States that score points', String(f.withPoints)],
    ];
  },

  checks(f: TableFacts): string[] {
    const out: string[] = [];
    if (f.states !== 135) out.push(`${f.states} states, not 135`);
    if (f.onlyLists.join() !== '1,9,10,55') out.push(`shared lists ${f.onlyLists.join()}`);
    if (f.unreachable.join() !== '5') out.push(`unreachable ${f.unreachable.join()}`);
    if (f.neverFire.split(';').length !== 2) out.push(`never firing: ${f.neverFire}`);
    if (f.instant < 20) out.push('fewer than 20 instant states');
    return out;
  },

  clips(lab: Lab) {
    const states = lab.src.moves.states;
    const look = tableLook(states);
    const demo = lab.demo('wallRun');
    const { world, input } = demoWorld(lab, demo);
    const rec = record(world, lab.clips, { steps: demo.steps - world.stepCount, input });
    const track = rec.tracks[0]!;
    const entries = track.entries();
    const panel = tablePanelSize(states.length);
    const runner = demoScene(lab, {
      level: parseDemoLevel(demo.rows),
      view: { x: 216, y: -16, width: panel.width + 16, height: 208 },
      actors: [{ track, tag: (at) => String(track.after(at).moveId) }],
      from: 112,
      to: 226,
      timeline: {
        from: 112,
        to: 226,
        rows: [
          {
            color: SERIES[0],
            presses: demo.presses.map((p) => ({ step: p.step, key: arrowOf(p.key, true) })),
          },
        ],
      },
    });
    const table: Scene = {
      width: panel.width + 16,
      height: panel.height + 16,
      from: 112,
      to: 226,
      draw(frame: Frame, t: number) {
        frame.clear(RGB.card);
        const now = Math.floor(t);
        const recent = new Map<number, number>();
        const visited = new Set<number>([2]);
        for (const e of entries) {
          if (e.step > now) break;
          visited.add(e.id);
          const age = t - e.step;
          if (age < 8) recent.set(e.id, Math.max(recent.get(e.id) ?? 0, 1 - age / 8));
        }
        drawTablePanel(
          frame,
          lab.fonts.small,
          8,
          8,
          look,
          track.after(now).moveId,
          recent,
          visited,
        );
      },
    };
    return [
      {
        name: 'trace',
        alt: 'The runner jumps at a wall, runs up it, grabs the roof and climbs over; under it the table of 135 states, the current one lit and those just left outlined. At the grab two states light up in the same step.',
        scene: gridScene([runner, table], 1, 0),
        script: [
          { from: 112, to: 140 },
          { from: 140, to: 172, speed: 0.4 },
          { from: 172, to: 226 },
          { at: 226, holdMs: 1500 },
        ],
      },
    ];
  },

  charts(lab: Lab) {
    const states = lab.src.moves.states;
    return [
      {
        name: 'table',
        alt: 'All 135 states of the move table as cells, coloured by the shared list each one falls back on, with the instant states, the shared lists that are never entered and the one state no transition reaches marked.',
        svg: periodicTable(states),
      },
      {
        name: 'record',
        alt: 'State 33, the wall run, as the table stores it: 14 numbers (duration, next state, impulse type and its parameters, animation, flags, snap type, parent, transition list, scoring) and its seven transitions, each a packed word of conditions and a target state.',
        svg: recordChart(states[SHOWN]!, 'One state of the table: the wall run'),
      },
    ];
  },
};
