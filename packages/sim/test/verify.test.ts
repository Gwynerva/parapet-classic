import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contentHashes } from '../src/content/hash.ts';
import type { InputRun } from '../src/replay.ts';
import type { Replay } from '../src/replayCodec.ts';
import { createRun, type RunMode } from '../src/run.ts';
import { replayCompatibility, simulateReplay, type RunContent } from '../src/verify.ts';
import { RULESET_ID, SIM_VERSION } from '../src/version.ts';
import {
  hasContent,
  loadLevel,
  loadMissions,
  loadMoves,
  loadRival,
  loadTables,
} from './helpers/content.ts';

const DEV_REPLAY = fileURLToPath(new URL('../../classic/dev/l0-flags.json', import.meta.url));

interface DevReplay {
  levelId: number;
  mode: RunMode;
  withRival: boolean;
  input: InputRun[];
}

function content(levelId: number): RunContent {
  return {
    level: loadLevel(levelId),
    mission: loadMissions().levels[levelId]!,
    moves: loadMoves(),
    tables: loadTables(),
    rival: loadRival(levelId),
  };
}

function replayOf(c: RunContent, levelId: number, mode: RunMode, input: InputRun[]): Replay {
  return {
    simVersion: SIM_VERSION,
    rulesetId: RULESET_ID,
    contentHash: contentHashes(c.level, c.moves, c.tables),
    levelId,
    mode,
    withRival: false,
    character: 0,
    playerName: 'test',
    input,
  };
}

describe.skipIf(!hasContent())('simulateReplay', () => {
  const dev = JSON.parse(readFileSync(DEV_REPLAY, 'utf8')) as DevReplay;
  const c = content(dev.levelId);
  const replay = replayOf(c, dev.levelId, dev.mode, dev.input);

  it('agrees with a live run of the same input', () => {
    const world = createRun({
      mode: dev.mode,
      level: c.level,
      mission: c.mission,
      moves: c.moves,
      tables: c.tables,
      rival: null,
    });
    world.replay(dev.input);
    const outcome = simulateReplay(replay, c);
    expect(outcome.hash).toBe(world.hash());
    expect(outcome.steps).toBe(world.stepCount);
    expect(outcome.time).toBe(world.rules.result?.time ?? world.clock);
    expect(outcome.score).toBe(world.player.score?.score ?? 0);
  });

  it('records one split per flag, in order, before the finish', () => {
    const outcome = simulateReplay(replay, c);
    expect(outcome.finished).toBe(true);
    expect(outcome.won).toBe(true);
    expect(outcome.splits.length).toBeGreaterThan(0);
    for (let i = 1; i < outcome.splits.length; i++) {
      expect(outcome.splits[i]!).toBeGreaterThanOrEqual(outcome.splits[i - 1]!);
    }
    expect(outcome.splits[outcome.splits.length - 1]!).toBeLessThanOrEqual(outcome.time);
  });

  it('is deterministic', () => {
    expect(simulateReplay(replay, c)).toEqual(simulateReplay(replay, c));
  });

  it('tells which replays can run here', () => {
    const here = contentHashes(c.level, c.moves, c.tables);
    expect(replayCompatibility(replay, here)).toBe('ok');
    expect(replayCompatibility({ ...replay, simVersion: 'parapet-sim@0.0.1' }, here)).toBe(
      'version',
    );
    expect(
      replayCompatibility({ ...replay, contentHash: { ...here, level: here.level ^ 1 } }, here),
    ).toBe('content');
  });
});
