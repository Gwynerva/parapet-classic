/**
 * Rivals are replays: each level's rival is the developers' own run, recorded as presses and
 * played back through the same physics as the player's. Every press lasts one tick, the file
 * ends without a marker (its last entry written twice), and two of the twelve blobs sit in each
 * other's places.
 */
import { MoveId } from '@parapet/sim';
import { cameraRun, viewScene } from '../experiments/camera.ts';
import {
  blobChart,
  ENTRY_BYTES,
  keyOf,
  pressChart,
  pressesOf,
  rollScene,
  SNAPSHOT_BYTES,
} from '../experiments/rivals.ts';
import type { Facts, Finding } from '../finding.ts';
import type { Lab } from '../lab.ts';
import { gridScene } from '../scene.ts';

/** The level of the replay animation and of the byte layout: the shortest recording. */
const SHOWN = 7;
const REPLAY_STEPS = 150;

interface RivalFacts extends Facts {
  recordings: number;
  snapshotBytes: number;
  entryBytes: number;
  /** Presses in all, and how many last longer than one tick. */
  presses: number;
  longPresses: number;
  /** Fewest and most presses of a level, and their levels' names. */
  fewest: number;
  fewestLevel: string;
  most: number;
  mostLevel: string;
  /** Recordings whose total time is 30 ms × (their ticks − the last entry's). */
  totalMatches: number;
  /** Levels whose rival blob is not 4 + level, and their names. */
  swapped: readonly number[];
  swappedNames: string;
  /** Start delays, shortest and longest (ms). */
  delays: readonly number[];
  /** The rival's first jump falls on its first UP: the replay lines up. */
  linedUp: boolean;
}

export const rivalsAreReplays: Finding<RivalFacts> = {
  slug: '11-rivals-are-replays',
  title: 'Rivals are replays',
  claim:
    'The rivals are the developers’ own runs: presses recorded tick by tick and played back through the player’s physics. No AI.',

  facts(lab: Lab): RivalFacts {
    const recs = [...lab.src.rivals.values()].sort((a, b) => a.level - b.level);
    const counts = recs.map((r) => pressesOf(r).length);
    const entries = recs.flatMap((r) => r.entries.filter((e) => e.input !== 0));
    const levels = lab.src.missions.levels;
    const lo = Math.min(...counts);
    const hi = Math.max(...counts);
    const run = cameraRun(lab, SHOWN);
    const rec = lab.src.rivals.get(SHOWN)!;
    const start = Math.ceil(levels[SHOWN]!.rivalStartDelay / 30);
    const firstUp = pressesOf(rec).find((p) => keyOf(p.input)?.name === 'UP');
    const firstJump = run.track.entries().find((e) => e.id === MoveId.JUMP);
    return {
      recordings: recs.length,
      snapshotBytes: SNAPSHOT_BYTES,
      entryBytes: ENTRY_BYTES,
      presses: entries.length,
      longPresses: entries.filter((e) => e.ticks !== 1).length,
      fewest: lo,
      fewestLevel: lab.levelName(recs[counts.indexOf(lo)]!.level),
      most: hi,
      mostLevel: lab.levelName(recs[counts.indexOf(hi)]!.level),
      totalMatches: recs.filter(
        (r) =>
          r.totalTime ===
          30 * (r.entries.reduce((n, e) => n + e.ticks, 0) - r.entries.at(-1)!.ticks),
      ).length,
      swapped: levels.filter((l) => l.rivalBlob !== 4 + l.id).map((l) => l.id),
      swappedNames: levels
        .filter((l) => l.rivalBlob !== 4 + l.id)
        .map((l) => lab.levelName(l.id))
        .join(' and '),
      delays: [
        Math.min(...levels.map((l) => l.rivalStartDelay)),
        Math.max(...levels.map((l) => l.rivalStartDelay)),
      ],
      linedUp: !!firstUp && firstJump?.step === start + firstUp.tick,
    };
  },

  measured(f: RivalFacts): [string, string][] {
    return [
      ['Recordings, one per level', String(f.recordings)],
      ['Snapshot, and an entry', `${f.snapshotBytes} bytes, ${f.entryBytes} bytes`],
      ['Presses in all, and those longer than one tick', `${f.presses}, ${f.longPresses}`],
      ['Fewest and most presses', `${f.fewest} (${f.fewestLevel}), ${f.most} (${f.mostLevel})`],
      ['Total time = 30 ms × (ticks − the last entry’s)', `${f.totalMatches} of ${f.recordings}`],
      ['Levels whose rival blob is out of order', f.swappedNames],
      ['Start delays', `${f.delays[0]} to ${f.delays[1]} ms`],
    ];
  },

  checks(f: RivalFacts): string[] {
    const out: string[] = [];
    if (f.longPresses !== 0) out.push(`${f.longPresses} presses last longer than a tick`);
    if (f.totalMatches !== f.recordings) out.push('a total time does not follow from the entries');
    if (f.swapped.join() !== '9,10') out.push(`swapped blobs: ${f.swapped.join()}`);
    if (!f.linedUp) out.push('the replayed rival does not jump on its first UP');
    return out;
  },

  clips(lab: Lab) {
    const run = cameraRun(lab, SHOWN);
    const rec = lab.src.rivals.get(SHOWN)!;
    const start = Math.ceil(lab.src.missions.levels[SHOWN]!.rivalStartDelay / 30);
    // The stretch with the most presses.
    const ticks = pressesOf(rec).map((p) => p.tick + start);
    let best = run.track.start;
    let most = -1;
    for (let s = run.track.start; s + REPLAY_STEPS < run.end; s += 5) {
      const n = ticks.filter((t) => t >= s + 20 && t < s + REPLAY_STEPS - 20).length;
      if (n > most) {
        most = n;
        best = s;
      }
    }
    const view = viewScene(lab, run, best, best + REPLAY_STEPS, false);
    const roll = rollScene(rec, start, best, best + REPLAY_STEPS, view.width);
    const scene = gridScene([view, roll], 1, 0);
    return [
      {
        name: 'replay',
        alt: `The rival of ${lab.levelName(SHOWN)} on the original’s screen, and under it the roll of its recorded presses passing the playhead: every jump, flip and roll starts on the tick its press was recorded on.`,
        scene,
        gifScale: 1,
        script: [
          { from: scene.from, to: scene.to },
          { at: scene.to, holdMs: 800 },
        ],
      },
    ];
  },

  charts(lab: Lab) {
    const recs = [...lab.src.rivals.values()].sort((a, b) => a.level - b.level);
    return [
      {
        name: 'presses',
        alt: 'Twelve rows, one per level: the presses of the developers’ recorded runs over time, coloured by key (UP, DOWN, FORWARD, BACK).',
        svg: pressChart(recs, (level) => lab.levelName(level)),
      },
      {
        name: 'blob',
        alt: `The recording of ${lab.levelName(SHOWN)} as stored: a 114-byte snapshot, the total time, the entries of 5 bytes and the last entry once more.`,
        svg: blobChart(lab.src.rivals.get(SHOWN)!, lab.levelName(SHOWN)),
      },
    ];
  },
};
