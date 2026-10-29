/**
 * Glitch hunt, second round: the same Go-Explore without human limits as `hunt.ts`, with new
 * detectors: move transitions no stored record ever makes, height gained in the air without
 * touching anything, the body inside solid tiles while not hanging, and the top speed reached;
 * every air-run launch is flown on to its landing. Usage:
 *   node src/optimal/hunt2.ts <level> <flags|sprint> [budgetSteps=40M] [seed=1]
 */
import { readdirSync } from 'node:fs';
import { LEVEL_COUNT } from '@parapet/sim';
import {
  Engine,
  FLAGS,
  HDX,
  HDY,
  MASK,
  MOVE,
  PRESSES,
  STATE_INTS,
  VX,
  X,
  Y,
  type Successor,
} from './engine.ts';
import { SOLID } from './guide.ts';
import { readArgs, writeResult } from './common.ts';
import { readRun, TAS_OUT_DIR } from '../tas/files.ts';
import { levelContent } from '../tas/content.ts';
import { rng } from '../tas/search.ts';
import { newWorld } from '../tas/timeline.ts';
import { CONTEST_MODES, keyBits, parsePresses } from '../tas/model.ts';
import { pressText } from './route.ts';

const { level, mode } = readArgs(process.argv.slice(2), { level: 0, mode: 'flags' });
const budget = Number(process.argv[4] ?? 40e6);
const rand = rng(Number(process.argv[5] ?? 1));

const content = levelContent(level);
const engine = new Engine(content, mode);
const lvl = engine.world.level;
const HANDS_SURFACE = 44 + 11;
const GROUND_MOVES = new Set([2, 3, 4, 5, 6, 8]);
const FEET_SURFACE = 44 + 2 * 12 + 11;

function onSurface(a: Int32Array): boolean {
  if ((a[FLAGS]! & 4) !== 0) {
    const k = a[HANDS_SURFACE]!;
    return k === 12 || k === 11 || k === 9 || k === 8 || k === 17;
  }
  const k = a[FEET_SURFACE]!;
  return k !== 0 && k !== 17 && k !== 9 && k !== 8;
}

// Transitions the stored runs make (every level and mode, optimal and stylish).
const normal = new Set<number>();
{
  const variants = ['', ...readdirSync(TAS_OUT_DIR).filter((d) => d.startsWith('style-'))];
  for (const variant of variants) {
    for (let l = 0; l < LEVEL_COUNT; l++) {
      for (const m of CONTEST_MODES) {
        const run = readRun(l, m, variant);
        if (!run) continue;
        const presses = parsePresses(run.presses);
        const w = newWorld(levelContent(l), m);
        let i = 0;
        while (!w.finished && w.clock < 240000) {
          let b = 0;
          if (presses[i] && presses[i]!.step === w.stepCount)
            b = keyBits(presses[i++]!.key, w.player.facingRight);
          const from = w.player.moveId;
          w.step(b);
          normal.add(from * 1000 + w.player.moveId);
        }
      }
    }
  }
}

interface Path {
  parent: Path | null;
  bits: number[];
}
function flatten(p: Path | null): number[] {
  const parts: number[][] = [];
  for (let q = p; q; q = q.parent) parts.push(q.bits);
  return parts.reverse().flat();
}
interface Cell {
  row: Int32Array;
  path: Path | null;
  steps: number;
  picks: number;
  idx: number;
}
const cells = new Map<string, Cell>();
const cellList: Cell[] = [];
const cellKey = (a: Int32Array): string =>
  `${a[MASK]! & 31},${(a[X]! + (a[HDX]! >> 1)) >> 10},${(a[Y]! + (a[HDY]! >> 1)) >> 10},${a[MOVE]},${a[FLAGS]! & 2}`;

interface Finding {
  kind: string;
  detail: string;
  steps: number;
  presses: string;
}
const findings = new Map<string, Finding>();
const counts: Record<string, number> = {};
function report(
  kind: string,
  key: string,
  detail: string,
  path: Path | null,
  extra: number[],
): void {
  counts[kind] = (counts[kind] ?? 0) + 1;
  const k = `${kind}/${key}`;
  if (findings.has(k)) return;
  const bits = [...flatten(path), ...extra];
  findings.set(k, { kind, detail, steps: bits.length, presses: pressText(bits) });
}
let topSpeed = { vx: 0, steps: 0, presses: '' };
/** Air-run flights: from the launch (|vx| over the cap) played on without input to landing. */
interface Flight {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  flightSteps: number;
  launchStep: number;
  vx: number;
  presses: string;
}
const flights = new Map<string, Flight>();
const flyRow = new Int32Array(STATE_INTS);
const flyOut = new Int32Array(STATE_INTS * 16);
const flySucc: Successor[] = [];
function fly(launch: Int32Array): { x: number; y: number; steps: number } {
  flyRow.set(launch.subarray(0, STATE_INTS));
  for (let t = 1; t <= 200; t++) {
    engine.expand(flyRow, 0, flyOut, 0, flySucc, [0]);
    flyRow.set(flyOut.subarray(0, STATE_INTS));
    if (onSurface(flyRow) || flyRow[MOVE] === 11 || flySucc[0]!.finished)
      return { x: flyRow[X]!, y: flyRow[Y]!, steps: t };
  }
  return { x: flyRow[X]!, y: flyRow[Y]!, steps: 200 };
}

const start = new Int32Array(STATE_INTS);
engine.start(start);
const first: Cell = { row: start, path: null, steps: 0, picks: 0, idx: 0 };
cells.set(cellKey(start), first);
cellList.push(first);
const out = new Int32Array(STATE_INTS * 16);
const cur = new Int32Array(STATE_INTS);
const succ: Successor[] = [];
const t0 = performance.now();

while (engine.steps < budget) {
  let cell = cellList[Math.floor(rand() * cellList.length)]!;
  for (let k = 0; k < 3; k++) {
    const c = cellList[Math.floor(rand() * cellList.length)]!;
    if (c.picks < cell.picks) cell = c;
  }
  cell.picks++;
  cur.set(cell.row);
  const bits: number[] = [];
  const base = cell.path;
  let airTop = onSurface(cur) ? cur[Y]! : Infinity;
  let takeoff = cur[Y]!;
  let inWall = 0;
  let groundInAir = 0;
  let enteredFrom = -1;
  const len = 40 + Math.floor(rand() * 100);
  for (let s = 0; s < len; s++) {
    const press = rand() < 0.3 ? PRESSES[1 + Math.floor(rand() * 15)]! : 0;
    engine.expand(cur, 0, out, 0, succ, [press]);
    bits.push(press);
    const from = cur[MOVE]!,
      to = out[MOVE]!;
    if (!normal.has(from * 1000 + to))
      report('transition', `${from}-${to}`, `move ${from} → ${to}`, base, bits);
    // Height gained in the air: from the last surface (or pit) to the highest point.
    const grounded = onSurface(out) || (out[FLAGS]! & 4) !== 0;
    if (grounded || to === 11) {
      takeoff = out[Y]!;
      airTop = out[Y]!;
    } else {
      airTop = Math.min(airTop, out[Y]!);
      const rise = takeoff - airTop;
      if (rise > 3 * 1024)
        report(
          'air-rise',
          `${Math.floor(rise / 1024)}`,
          `${(rise / 1024).toFixed(1)} tiles up without touching anything (move ${to})`,
          base,
          bits,
        );
    }
    // A ground move (run, slopes, stop, turns) held in the air: how the air run starts.
    if (GROUND_MOVES.has(to) && !onSurface(out) && (out[FLAGS]! & 4) === 0) {
      if (groundInAir === 0) enteredFrom = from;
      groundInAir++;
      if (groundInAir === 5)
        report(
          'ground-move-in-air',
          `${enteredFrom}-${to}`,
          `move ${to} (entered from ${enteredFrom}) held 5 steps in the air`,
          base,
          bits,
        );
    } else groundInAir = 0;
    const cx = (out[X]! + (out[HDX]! >> 1)) >> 10;
    const cy = (out[Y]! + (out[HDY]! >> 1)) >> 10;
    const hy = (out[Y]! + out[HDY]!) >> 10;
    const wall =
      (out[FLAGS]! & 4) === 0 && SOLID.has(lvl.tileAt(cx, cy)) && SOLID.has(lvl.tileAt(cx, hy));
    inWall = wall ? inWall + 1 : 0;
    if (inWall === 8)
      report(
        'in-wall',
        `${lvl.tileAt(cx, cy)}-${to}`,
        `body and head in solid tiles 8 steps (tile ${lvl.tileAt(cx, cy)} at ${cx},${cy}, move ${to})`,
        base,
        bits,
      );
    if (Math.abs(out[VX]!) > 5300 && Math.abs(cur[VX]!) <= 5300) {
      const k = `${out[X]! >> 10},${out[Y]! >> 10},${out[VX]! > 0 ? 'R' : 'L'}`;
      const steps = cell.steps + bits.length;
      const known = flights.get(k);
      if (!known || known.launchStep > steps) {
        const land = fly(out);
        flights.set(k, {
          fromX: out[X]! >> 10,
          fromY: out[Y]! >> 10,
          toX: land.x >> 10,
          toY: land.y >> 10,
          flightSteps: land.steps,
          launchStep: steps,
          vx: out[VX]!,
          presses: pressText([...flatten(base), ...bits]),
        });
      }
    }
    if (Math.abs(out[VX]!) > Math.abs(topSpeed.vx)) {
      topSpeed = {
        vx: out[VX]!,
        steps: cell.steps + bits.length,
        presses: pressText([...flatten(base), ...bits]),
      };
    }
    cur.set(out.subarray(0, STATE_INTS));
    if (succ[0]!.finished) break;
    const key = cellKey(cur);
    const known = cells.get(key);
    const steps = cell.steps + bits.length;
    if (!known || known.steps > steps) {
      const c: Cell = {
        row: cur.slice(),
        path: { parent: base, bits: bits.slice() },
        steps,
        picks: known?.picks ?? 0,
        idx: known?.idx ?? cellList.length,
      };
      if (!known) cellList.push(c);
      else cellList[known.idx] = c;
      cells.set(key, c);
    }
  }
}

const result = {
  level,
  mode,
  budget,
  cells: cells.size,
  normalTransitions: normal.size,
  seconds: Math.round((performance.now() - t0) / 1000),
  counts,
  topSpeed,
  flights: [...flights.values()].sort(
    (a, b) => Math.abs(b.toX - b.fromX) - Math.abs(a.toX - a.fromX),
  ),
  findings: [...findings.values()],
};
writeResult('hunt2', `${level}-${mode}`, result);
console.log(
  `level ${level} ${mode}: ${cells.size} cells, counts ${JSON.stringify(counts)}, top |vx| ${Math.abs(topSpeed.vx)}, ${flights.size} air-run launches (longest ${Math.max(0, ...[...flights.values()].map((f) => Math.abs(f.toX - f.fromX)))} tiles), new transitions ${[...findings.keys()].filter((k) => k.startsWith('transition')).length}`,
);
