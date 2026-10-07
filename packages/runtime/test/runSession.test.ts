import { describe, expect, it } from 'vitest';
import {
  createRun,
  simulateReplay,
  type InputRun,
  type MissionInfo,
  type Replay,
  type RunMode,
} from '@parapet/sim';
import { RunSession, type RunData, type RunSetup } from '../src/app/RunSession.ts';
import {
  hasContent,
  loadLevel,
  loadMissions,
  loadMoves,
  loadRival,
  loadTables,
} from './helpers/content.ts';

function data(levelId: number): RunData {
  return {
    level: loadLevel(levelId),
    mission: loadMissions().levels[levelId] as unknown as MissionInfo,
    moves: loadMoves(),
    tables: loadTables(),
    rival: loadRival(levelId),
  };
}

/** Presses UP every 17 steps and FORWARD every 29 for `steps` steps. */
function input(steps: number): InputRun[] {
  const out: InputRun[] = [];
  for (let i = 0; i < steps; i++) {
    const bits = i % 17 === 5 ? 1 : i % 29 === 11 ? 16 : 0;
    const last = out[out.length - 1];
    if (last && last.bits === bits) last.ticks++;
    else out.push({ ticks: 1, bits });
  }
  return out;
}

/** Runs a session with a scripted player until it finishes or `maxSteps` pass. */
function play(setup: RunSetup, d: RunData, maxSteps: number): RunSession {
  const session = new RunSession(setup, d);
  // 35 ms of real time is exactly one 30-unit step of game time.
  for (let i = 0; i < maxSteps && !session.finished; i++) session.advance(35);
  return session;
}

describe.skipIf(!hasContent())('RunSession with a ghost', () => {
  const levelId = 1;
  const mode: RunMode = 'sprint';
  const d = data(levelId);
  const ghostInput = input(900);
  const playerInput = input(700).map((r) => ({ ...r, bits: r.bits === 1 ? 16 : r.bits }));

  function ghostReplay(): Replay {
    const probe = new RunSession(
      { levelId, mode, withRival: true, playerName: '', character: 0 },
      d,
    );
    return {
      simVersion: 'parapet-sim@0.2.0',
      rulesetId: 'classic',
      contentHash: probe.contentHash,
      levelId,
      mode,
      withRival: true,
      character: 3,
      playerName: 'ghost',
      input: ghostInput,
    };
  }

  it('leaves the player run exactly as it is without a ghost', () => {
    const base: RunSetup = {
      levelId,
      mode,
      withRival: false,
      playerName: 'me',
      character: 0,
      script: playerInput,
    };
    const replay = ghostReplay();
    const alone = play(base, d, 800);
    const raced = play(
      { ...base, ghost: { kind: 'challenger', replay, outcome: simulateReplay(replay, d) } },
      d,
      800,
    );
    expect(raced.world.hash()).toBe(alone.world.hash());
    expect(raced.world.stepCount).toBe(alone.world.stepCount);
    expect(raced.splits).toEqual(alone.splits);
  });

  it('runs the ghost exactly like the headless replay', () => {
    const replay = ghostReplay();
    const outcome = simulateReplay(replay, d);
    const session = play(
      {
        levelId,
        mode,
        withRival: false,
        playerName: 'me',
        character: 0,
        script: input(2000).map(() => ({ ticks: 1, bits: 0 })),
        ghost: { kind: 'challenger', replay, outcome },
      },
      d,
      outcome.steps + 5,
    );
    const ghost = session.ghostWorld!;
    expect(ghost.stepCount).toBe(outcome.steps);
    expect(ghost.hash()).toBe(outcome.hash);

    const reference = createRun({
      mode,
      level: d.level,
      mission: d.mission,
      moves: d.moves,
      tables: d.tables,
      rival: d.rival,
    });
    reference.replay(ghostInput);
    expect(ghost.hash()).toBe(reference.hash());
  });

  it('builds a replay of the finished run', () => {
    const session = play(
      { levelId, mode, withRival: false, playerName: ' me\n ', character: 2, script: playerInput },
      d,
      5000,
    );
    if (!session.finished) return;
    const replay = session.buildReplay()!;
    expect(replay.playerName).toBe('me');
    expect(replay.character).toBe(2);
    expect(simulateReplay(replay, d).hash).toBe(session.world.hash());
  });
});
