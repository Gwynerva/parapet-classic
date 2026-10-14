/**
 * The recorder of the bosses' glimpses (`src/tas/glimpses.ts`). The stored runs are not in the
 * repository, so key mashes stand in for them: one arrow, then UP every few steps finishes
 * Mill Brook's flag hunt (west) and North Hill's sprint (east), slowly.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STEP, type World } from '@parapet/sim';
import { decodeGlimpse, type GlimpsePose } from '@parapet/runtime/content/glimpses.ts';
import { CharacterRenderer } from '@parapet/runtime/render/CharacterRenderer.ts';
import type { SceneRenderer } from '@parapet/runtime/render/SceneRenderer.ts';
import { levelContent, loadClipTable } from '../src/tas/content.ts';
import { EXTRACTED_DIR } from '../src/files.ts';
import type { TasRunFile } from '../src/tas/files.ts';
import {
  cutGlimpses,
  endlessWorld,
  recordPoses,
  runGlimpses,
  type PoseRecording,
} from '../src/tas/glimpses.ts';
import { formatPresses, Key, keyBits, type ContestMode, type Press } from '../src/tas/model.ts';
import { newWorld, playFull } from '../src/tas/timeline.ts';

/** One arrow on the first step, then UP every `every` steps. */
function mash(first: Press['key'], every: number): Press[] {
  const presses: Press[] = [{ step: 0, key: first }];
  for (let s = every; s < 4000; s += every) presses.push({ step: s, key: Key.UP });
  return presses;
}

const MASHES: { levelId: number; mode: ContestMode; presses: Press[] }[] = [
  { levelId: 0, mode: 'flags', presses: mash(Key.LEFT, 12) },
  { levelId: 1, mode: 'sprint', presses: mash(Key.RIGHT, 9) },
];

/** The player's physical state, to compare worlds by. */
function state(world: World): string {
  const r = world.player;
  return [r.x, r.y, r.vx, r.vy, r.handsDx, r.handsDy, r.moveId, r.moveTimer, r.facingRight].join();
}

describe.skipIf(!existsSync(join(EXTRACTED_DIR, 'moves.json')))('glimpse recorder', () => {
  for (const { levelId, mode, presses } of MASHES) {
    const content = levelContent(levelId);
    const play = playFull(content, mode, presses);
    const finishStep = play.time / STEP;

    it(`plays level ${levelId + 1} ${mode} like the run's own world, then goes on`, () => {
      expect(play.finished).toBe(true);
      expect(play.splits).toHaveLength(5);
      const run = newWorld(content, mode);
      const endless = endlessWorld(content, mode);
      const splits: number[] = [];
      let i = 0;
      for (let going = true; going;) {
        let bits = 0;
        const p = presses[i];
        if (p && p.step === run.stepCount) {
          bits = keyBits(p.key, run.player.facingRight);
          i++;
        }
        going = run.step(bits);
        expect(endless.step(bits)).toBe(true);
        expect(state(endless), `step ${run.stepCount}`).toBe(state(run));
        for (const e of endless.events) {
          if (e.type === 'flag' || e.type === 'checkpoint') splits.push(endless.clock);
        }
      }
      expect(run.stepCount).toBe(finishStep);
      expect(splits).toEqual(play.splits);
      for (let n = 0; n < 50; n++) expect(endless.step(0)).toBe(true);
    });

    it(`records level ${levelId + 1} ${mode} as the renderer draws it`, () => {
      const clips = loadClipTable();
      const until = finishStep + 40;
      const rec = recordPoses(content, mode, presses, finishStep, until, clips);
      expect(rec.splitSteps.map((n) => n * STEP)).toEqual(play.splits);
      expect(rec.order).toEqual(play.order);
      expect(rec.poses).toHaveLength(until + 1);
      // The same steps through the game's own renderer (it only draws with the scene).
      const world = endlessWorld(content, mode);
      const renderer = new CharacterRenderer({} as SceneRenderer, world.moves, clips);
      renderer.attach(world.player, { seed: 1 });
      const drawn: Omit<GlimpsePose, 'cut'>[] = [renderer.pose(world.player, 1)!];
      let i = 0;
      while (world.stepCount < until) {
        let bits = 0;
        const p = presses[i];
        if (p && p.step === world.stepCount && p.step < finishStep) {
          bits = keyBits(p.key, world.player.facingRight);
          i++;
        }
        world.step(bits);
        renderer.onEvents(world.events);
        renderer.step(world.clock, STEP);
        drawn.push(renderer.pose(world.player, 1)!);
      }
      expect(rec.poses.map(({ cut: _, ...p }) => p)).toEqual(drawn);
      expect(rec.poses[0]!.cut).toBe(true);
      expect(rec.poses.filter((p) => p.cut).length).toBeGreaterThan(1);
    });

    it(`cuts and codes the glimpses of level ${levelId + 1} ${mode}`, () => {
      const run = {
        levelId,
        mode,
        timeMs: play.time,
        splitsMs: play.splits,
        order: play.order,
        presses: formatPresses(presses),
      } as TasRunFile;
      const { clips, problems } = runGlimpses(run);
      expect(problems).toEqual([]);
      expect(clips).toHaveLength(5);
      const rec = recordPoses(content, mode, presses, finishStep, finishStep + 33, loadClipTable());
      const tracks = cutGlimpses(rec, 5);
      clips.forEach((code, i) => {
        const track = decodeGlimpse(code);
        expect(track, `flag ${i}`).toEqual(tracks[i]);
        expect(track!.at, `flag ${i}`).toBe(33);
        expect(track!.poses, `flag ${i}`).toHaveLength(67);
      });
      expect(
        runGlimpses({ ...run, splitsMs: play.splits.map((ms) => ms + STEP) }).problems,
      ).toEqual(['glimpse splits differ']);
    });
  }
});

describe('cutting glimpses', () => {
  const pose = (n: number): GlimpsePose => ({
    x: n,
    y: -n,
    a: 1,
    b: 1,
    t: 0,
    flipX: false,
    anchored: false,
    cut: n === 0,
  });
  const rec: PoseRecording = {
    poses: Array.from({ length: 150 }, (_, n) => pose(n)),
    splitSteps: [10, 50, 90, 120, 130],
    order: [0, 1, 2, 4, 3],
  };

  it('files the pieces by flag, not by the order they were taken in', () => {
    const tracks = cutGlimpses(rec, 6);
    expect(tracks).toHaveLength(6);
    expect(tracks[5]).toBeNull();
    expect(tracks[4]!.poses[tracks[4]!.at]!.x).toBe(120);
    expect(tracks[3]!.poses[tracks[3]!.at]!.x).toBe(130);
    const middle = tracks[1]!;
    expect(middle.at).toBe(33);
    expect(middle.poses.map((p) => p.x)).toEqual(Array.from({ length: 67 }, (_, k) => 17 + k));
  });

  it('stops at the ends of the recording and starts with a cut', () => {
    const tracks = cutGlimpses(rec, 5);
    expect(tracks[0]!.at).toBe(10);
    expect(tracks[0]!.poses).toHaveLength(44);
    expect(tracks[3]!.at).toBe(33);
    expect(tracks[3]!.poses).toHaveLength(150 - 97);
    for (const t of tracks) expect(t!.poses[0]!.cut).toBe(true);
    expect(tracks[1]!.poses.slice(1).every((p) => !p.cut)).toBe(true);
    expect(rec.poses[17]!.cut).toBe(false);
  });
});
