/**
 * One demo of the Moves screen: a runner on a little level of grey blocks, pressing the keys
 * of the move at fixed steps. The runner gets a run-up before the move and some running after
 * it, then the demo starts over. `checkDemo` proves that a demo shows its move (tests and the
 * authoring tool use it).
 */
import { World, type MoveTableData, type PhysicsTables, type WorldEvent } from '@parapet/sim';
import { parseDemoLevel, type DemoLevel } from './demoLevel.ts';

export type DemoKey = 'up' | 'down' | 'fwd' | 'back';

export interface DemoPress {
  step: number;
  key: DemoKey;
}

export interface MoveDemoData {
  /** The move's key in `MOVE_KEYS` (and its i18n key `moves.<move>`). */
  move: string;
  rows: string[];
  presses: DemoPress[];
  /**
   * Steps played at once on every start: the runner starts at full speed a few tiles before
   * the move instead of accelerating from a standstill on screen.
   */
  from: number;
  /** Step at which the demo starts over (counted from the world's first step). */
  steps: number;
  /** Move states that must follow one another (an inner list: any of them). */
  expect: (number | number[])[];
}

export interface DemoContent {
  moves: MoveTableData;
  tables: PhysicsTables;
}

/** Press bits of a key, like a keyboard: arrows resolve to FORWARD/BACK by the facing. */
export function demoKeyBits(key: DemoKey, facingRight: boolean): number {
  switch (key) {
    case 'up':
      return 1;
    case 'down':
      return 2;
    case 'fwd':
      return facingRight ? 4 | 16 : 8 | 16;
    case 'back':
      return facingRight ? 8 | 32 : 4 | 32;
  }
}

/** Steps of run-up a demo gives before its move, and of running after it. */
export const DEMO_LEAD_IN = 20;
export const DEMO_LEAD_OUT = 24;

/** Fails, crashes and falls: a demo shows none of them. */
export const FAIL_STATES: readonly number[] = [54, 71, 72, 73, 82, 84, 85, 87];

export class DemoRun {
  readonly level: DemoLevel;
  readonly data: MoveDemoData;
  world: World;
  private readonly content: DemoContent;
  private next = 0;

  constructor(data: MoveDemoData, content: DemoContent, level?: DemoLevel) {
    this.data = data;
    this.content = content;
    this.level = level ?? parseDemoLevel(data.rows);
    this.world = this.createWorld();
    this.fastForward();
  }

  private createWorld(): World {
    return new World({
      level: this.level.data,
      moves: this.content.moves,
      tables: this.content.tables,
      rules: { missionType: 0, freeRun: true },
    });
  }

  /** Back to the start (the runner already at speed). */
  restart(): void {
    this.world = this.createWorld();
    this.next = 0;
    this.fastForward();
  }

  private fastForward(): void {
    while (this.world.stepCount < this.data.from) this.step();
  }

  get stepCount(): number {
    return this.world.stepCount;
  }

  get done(): boolean {
    return this.world.stepCount >= this.data.steps;
  }

  /** One step with the press due at it; returns the step's events. */
  step(): readonly WorldEvent[] {
    let bits = 0;
    const presses = this.data.presses;
    while (this.next < presses.length && presses[this.next]!.step < this.world.stepCount)
      this.next++;
    const press = presses[this.next];
    if (press && press.step === this.world.stepCount) {
      bits = demoKeyBits(press.key, this.world.player.facingRight);
      this.next++;
    }
    this.world.step(bits);
    return this.world.events;
  }
}

export interface DemoTrace {
  /** The player's move state after each step. */
  states: number[];
  /** Feet position (tiles, fractional) after each step. */
  x: number[];
  y: number[];
  /** A fail or pit event happened. */
  failed: boolean;
}

/** Every step of a demo from the world's first one (the fast-forwarded steps included). */
export function traceDemo(data: MoveDemoData, content: DemoContent): DemoTrace {
  const run = new DemoRun({ ...data, from: 0 }, content);
  const trace: DemoTrace = { states: [], x: [], y: [], failed: false };
  while (!run.done) {
    const events = run.step();
    for (const e of events) {
      if ((e.type === 'fail' || e.type === 'pit') && e.runner === run.world.player)
        trace.failed = true;
    }
    const p = run.world.player;
    trace.states.push(p.moveId);
    trace.x.push(p.x / 1024);
    trace.y.push(p.y / 1024);
  }
  return trace;
}

/** Steps at which the expected states occur in order, or null when they do not. */
export function matchExpected(
  states: readonly number[],
  expect: MoveDemoData['expect'],
): number[] | null {
  const at: number[] = [];
  let i = 0;
  for (const want of expect) {
    const options = Array.isArray(want) ? want : [want];
    while (i < states.length && !options.includes(states[i]!)) i++;
    if (i >= states.length) return null;
    at.push(i);
    i++;
  }
  return at;
}

/** What is wrong with a demo (empty when it shows its move cleanly). */
export function checkDemo(data: MoveDemoData, content: DemoContent): string[] {
  const problems: string[] = [];
  let trace: DemoTrace;
  try {
    trace = traceDemo(data, content);
  } catch (err) {
    return [String(err)];
  }
  const at = matchExpected(trace.states, data.expect);
  if (!at) problems.push(`expected states ${JSON.stringify(data.expect)} do not occur`);
  else {
    if (at[0]! < data.from + DEMO_LEAD_IN) {
      problems.push(`the move starts at step ${at[0]}, before the run-up on screen ends`);
    }
    if (at[at.length - 1]! > data.steps - DEMO_LEAD_OUT)
      problems.push(`the move ends at step ${at[at.length - 1]}, too close to the restart`);
  }
  if (trace.failed) problems.push('the runner fails or falls');
  const bad = trace.states.find((s) => FAIL_STATES.includes(s));
  if (bad !== undefined) problems.push(`fail state ${bad}`);
  const level = parseDemoLevel(data.rows);
  if (trace.x.some((x) => x < 0.5 || x > level.width - 0.5))
    problems.push('the runner leaves the level');
  if (trace.y.some((y) => y > level.height)) problems.push('the runner drops out of the level');
  return problems;
}
