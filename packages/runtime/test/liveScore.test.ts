/** The promo video's layered scores played live (`audio/LiveScore.ts`, `content/music`). */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  contestPlan,
  liveScoreProblems,
  liveSong,
  menuPlan,
  type LiveScore,
} from '../src/audio/LiveScore.ts';
import { LIVE_SCORES, liveTrack, LIVE_CONTEST, LIVE_MENU } from '../src/audio/MusicDirector.ts';
import { scoreProblems, type Score } from '../src/audio/Score.ts';
import { reverbImpulse } from '../src/audio/TrackEffects.ts';

const here = dirname(fileURLToPath(import.meta.url));
const MUSIC = join(here, '..', '..', 'content', 'music');

function load(name: string): LiveScore {
  return JSON.parse(readFileSync(join(MUSIC, `${name}.json`), 'utf8')) as LiveScore;
}

/** A two-module score: a lead in the base layer, drums in the max one. */
function tiny(patch: Partial<LiveScore> = {}): LiveScore {
  return {
    title: 't',
    bpm: 120,
    stepsPerBar: 4,
    tracks: { lead: { channel: 1, program: 81 }, drums: { channel: 9 } },
    drumKit: { K: 36 },
    patterns: { a: 'C4 D4 E4 F4', d: ['K.K.'] },
    sections: {
      build1: { bars: 1, play: { lead: ['a'], drums: ['d'] } },
      peak1: { bars: 1, play: { lead: ['a@+12'], drums: ['d'] } },
      intro1: { bars: 1, play: { lead: ['a'] } },
    },
    song: ['intro1', 'build1', 'peak1'],
    layers: { base: ['lead'], more: [], max: ['drums'] },
    ...patch,
  };
}

const STEP = 60000 / 120 / 4;

describe('live scores', () => {
  it('are all bundled, sound and English', () => {
    expect(LIVE_SCORES).toHaveLength(10);
    for (const name of LIVE_SCORES) {
      const score = load(name);
      expect(scoreProblems(score as unknown as Score), name).toEqual([]);
      expect(liveScoreProblems(score), name).toEqual([]);
      expect(JSON.stringify(score), name).not.toMatch(/[Ѐ-ӿ]/);
    }
  });

  it('loop the energetic modules A then B in a contest and the calm opening in the menus', () => {
    const day1 = load('day1');
    expect(contestPlan(day1).sections).toEqual([
      'build1',
      'peak1',
      'fall1',
      'build2',
      'peak2',
      'fall2',
    ]);
    expect(contestPlan(day1).layers).toEqual(['base', 'more', 'max']);
    expect(menuPlan(day1)).toEqual({
      sections: ['intro1', 'intro2', 'mid1', 'mid2'],
      layers: ['base', 'more', 'max'],
    });
    // Polish Pass has one variant of each module and no wind-down.
    const day4 = load('day4');
    expect(contestPlan(day4).sections).toEqual(['build', 'peak']);
    expect(menuPlan(day4).sections).toEqual(['intro', 'mid']);
  });

  it("play only the chosen layers, with their echoes and the score's patches", () => {
    const score = tiny({
      tracks: {
        lead: { channel: 1, program: 81, echo: { delay: 2, repeats: 1, feedback: 0.5 } },
        drums: { channel: 9 },
      },
      patches: {
        '81': { wave: 'square', attack: 0, decay: 0.1, sustain: 0.5, release: 0.1, gain: 0.3 },
      },
    });
    const base = liveSong(score, { sections: ['build1'], layers: ['base'] });
    expect(base.notes.every((n) => n.channel === 1)).toBe(true);
    expect(base.notes.map((n) => [n.time / STEP, n.note, n.volume])).toEqual([
      [0, 60, 1],
      [1, 62, 1],
      [2, 60, 0.5],
      [2, 64, 1],
      [3, 62, 0.5],
      [3, 65, 1],
      [4, 64, 0.5],
      [5, 65, 0.5],
    ]);
    expect(base.patches?.[81]?.wave).toBe('square');
    expect(base.voicesPerChannel).toBe(true);
    const full = liveSong(score, contestPlan(score));
    expect(full.durationMs).toBe(8 * STEP);
    expect(full.notes.some((n) => n.channel === 9)).toBe(true);
  });

  it('turn the stutters, fast-forwards, reversals and tape stops into notes', () => {
    const plan = { sections: ['intro1', 'build1'], layers: ['base'] as const };
    const at = (kind: 'stutter' | 'fast' | 'flip' | 'tape', slice?: number) => {
      const score = tiny({
        tracks: {
          lead: {
            channel: 1,
            program: 81,
            fx: { events: [{ section: 'build1', at: 0, steps: 4, kind, slice }] },
          },
          drums: { channel: 9 },
        },
      });
      const song = liveSong(score, { ...plan, layers: [...plan.layers] });
      return song.notes
        .filter((n) => n.time >= 4 * STEP)
        .map((n) => [(n.time - 4 * STEP) / STEP, n.note]);
    };
    expect(at('stutter', 1)).toEqual([
      [0, 60],
      [1, 60],
      [2, 60],
      [3, 60],
    ]);
    expect(at('fast')).toEqual([
      [0, 72],
      [0.5, 74],
      [1, 76],
      [1.5, 77],
      [2, 72],
      [2.5, 74],
      [3, 76],
      [3.5, 77],
    ]);
    expect(at('flip').map(([t, n]) => [Math.round(t! * 100) / 100, n])).toEqual([
      [0.1, 65],
      [1.1, 64],
      [2.1, 62],
      [3.1, 60],
    ]);
    // The tape reaches the first half of the slice only, ever later and lower (D4 at 71 %
    // speed: half an octave down).
    const tape = at('tape');
    expect(tape.map(([, n]) => n)).toEqual([60, 56]);
    expect(tape[1]![0]).toBeGreaterThan(1);
  });

  it("carry the tracks' effects and where each module of the pass starts", () => {
    const score = tiny({
      tracks: {
        lead: { channel: 1, program: 81, fx: { reverb: { mix: 0.2 } } },
        drums: { channel: 9, fx: { drive: 2 } },
      },
    });
    const song = liveSong(score, contestPlan(score));
    expect(song.effects?.tracks.map((t) => t.channel)).toEqual([1, 9]);
    expect(song.effects?.sections).toEqual([
      { name: 'build1', start: 0, steps: 4 },
      { name: 'peak1', start: (4 * STEP) / 1000, steps: 4 },
    ]);
    // The base layer alone leaves the drums' effects out.
    const base = liveSong(score, { sections: ['intro1'], layers: ['base'] });
    expect(base.effects?.tracks.map((t) => t.channel)).toEqual([1]);
  });

  it('number the menu and contest tracks after the scores', () => {
    expect(liveTrack(LIVE_MENU)).toEqual({ name: 'teaser', kind: 'menu' });
    expect(liveTrack(LIVE_CONTEST + 9)).toEqual({ name: 'finale', kind: 'contest' });
    expect(liveTrack(LIVE_CONTEST + 10)).toBeNull();
    expect(liveTrack(1)).toBeNull();
  });

  it("reverberate as the video's Freeverb did, and die away by the end of the response", () => {
    const [left, right] = reverbImpulse(0.7, 0.5, 48000, 1);
    expect(left).toHaveLength(48000);
    // Nothing before the shortest comb, then a dense tail; the two sides differ.
    const first = left!.findIndex((v) => v !== 0);
    expect(first).toBeGreaterThan(1000);
    expect(left!.some((v, i) => v !== right![i])).toBe(true);
    expect(Math.abs(left![left!.length - 1]!)).toBe(0);
  });
});
