/**
 * The bosses' published data (`packages/content/bosses`): their records must belong to this
 * simulation and these levels (a change of either needs `npm run tas` again), every level has a
 * boss of its own whose outfits, effects and world are sound, and every text about them exists
 * in every language.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT, RULESET_ID, SIM_VERSION, contentHashes } from '@parapet/sim';
import type { AtlasData, AtlasFrame } from '../src/content/types.ts';
import { bossProblems, type BossData, type BossRoster } from '../src/content/bosses.ts';
import { decodePng } from '../../tools/src/png.ts';
import { lookDataProblems, lookProblems, resolveLook, type LookData } from '../src/render/Look.ts';
import { buildLookLayer } from '../src/render/LookSheet.ts';
import type { FxFile } from '../src/render/fx/FxData.ts';
import { stageProblems, type StageFile } from '../src/render/Stage.ts';
import { CONTENT_DIR, hasContent, loadLevel, loadMoves, loadTables } from './helpers/content.ts';

const here = dirname(fileURLToPath(import.meta.url));
const BOSSES_DIR = join(here, '..', '..', 'content', 'bosses');
const I18N_DIR = join(here, '..', '..', 'content', 'i18n');

interface ContestRecord {
  timeMs: number;
  splitsMs: number[];
  runSha256: string;
}

interface ContestsFile {
  simVersion: string;
  rulesetId: string;
  constraints: { minGap: number; toleranceMs: number };
  levels: { levelId: number; contentHash: unknown; flags: ContestRecord; sprint: ContestRecord }[];
}

interface MissionGoal {
  defaultTime: number;
}

interface MissionLevel {
  missionTypes: number[];
  goals: MissionGoal[];
  rivalTotalTime: number;
  rivalStartDelay: number;
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

describe.skipIf(!hasContent())("the bosses' records", () => {
  const contests = readJson<ContestsFile>(join(BOSSES_DIR, 'contests.json'));
  const missions = readJson<{ levels: MissionLevel[] }>(join(CONTENT_DIR, 'missions.json')).levels;

  it('belong to this simulation (otherwise run `npm run tas` and publish again)', () => {
    expect(contests.simVersion).toBe(SIM_VERSION);
    expect(contests.rulesetId).toBe(RULESET_ID);
  });

  it('cover every level in both modes, on these levels', () => {
    expect(contests.levels.map((l) => l.levelId)).toEqual(
      Array.from({ length: LEVEL_COUNT }, (_, i) => i),
    );
    const moves = loadMoves();
    const tables = loadTables();
    for (const entry of contests.levels) {
      expect(entry.contentHash, `level ${entry.levelId}`).toEqual(
        contentHashes(loadLevel(entry.levelId), moves, tables),
      );
    }
  });

  it('are plausible runs: 5 increasing splits, clock steps of 30 ms, a hash of the run', () => {
    for (const entry of contests.levels) {
      for (const mode of ['flags', 'sprint'] as const) {
        const r = entry[mode];
        const name = `level ${entry.levelId} ${mode}`;
        expect(r.timeMs % 30, name).toBe(0);
        expect(r.splitsMs, name).toHaveLength(5);
        for (let i = 1; i < r.splitsMs.length; i++) {
          expect(r.splitsMs[i]!, name).toBeGreaterThan(r.splitsMs[i - 1]!);
        }
        if (mode === 'flags') expect(r.splitsMs[4], name).toBe(r.timeMs);
        else expect(r.splitsMs[4]!, name).toBeLessThan(r.timeMs);
        expect(r.runSha256, name).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });

  it("beat the original's records and its rivals", () => {
    for (const entry of contests.levels) {
      const m = missions[entry.levelId]!;
      const flagsGoal = m.goals[m.missionTypes.indexOf(1)]!;
      const sprintGoal = m.goals[m.missionTypes.indexOf(0)]!;
      expect(entry.flags.timeMs).toBeLessThan(flagsGoal.defaultTime);
      expect(entry.sprint.timeMs).toBeLessThan(sprintGoal.defaultTime);
      expect(entry.sprint.timeMs).toBeLessThan(m.rivalTotalTime + m.rivalStartDelay);
    }
  });
});

describe.skipIf(!hasContent())('the bosses', () => {
  const roster = readJson<BossRoster>(join(BOSSES_DIR, 'bosses.json'));
  const looks = new Map<string, { look: LookData; file: string }>();
  for (const id of roster.levels) {
    const dir = join(BOSSES_DIR, id, 'looks');
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      const look = readJson<LookData>(join(dir, f));
      looks.set(look.id, { look, file: `${id}/looks/${f}` });
    }
  }
  const all = new Map([...looks].map(([id, v]) => [id, v.look]));
  const atlas = readJson<AtlasData>(join(CONTENT_DIR, 'atlas.json'));
  const frames: (AtlasFrame | undefined)[] = [];
  for (const [id, f] of Object.entries(atlas.frames)) frames[Number(id)] = f;
  const png = decodePng(new Uint8Array(readFileSync(join(CONTENT_DIR, 'atlas.png'))));

  it('are twelve, one of their own per level', () => {
    expect(roster.levels).toHaveLength(LEVEL_COUNT);
    expect(new Set(roster.levels).size).toBe(LEVEL_COUNT);
  });

  /** The effects of a boss's outfits that wear their own. */
  const lookEffects = (boss: BossData): Map<string, string[]> => {
    const out = new Map<string, string[]>();
    for (const l of boss.looks) {
      const effect = resolveLook(l, all)?.effect;
      if (effect) out.set(l, effect);
    }
    return out;
  };

  it('have sound data, effects and worlds', () => {
    for (const id of roster.levels) {
      const boss = readJson<BossData>(join(BOSSES_DIR, id, 'boss.json'));
      expect(boss.id, id).toBe(id);
      const fxPath = join(BOSSES_DIR, id, 'fx.json');
      const fx = existsSync(fxPath) ? readJson<FxFile>(fxPath) : undefined;
      expect(bossProblems(boss, fx, new Set(looks.keys()), lookEffects(boss)), id).toEqual([]);
      const stagePath = join(BOSSES_DIR, id, 'stage.json');
      if (existsSync(stagePath)) {
        expect(stageProblems(readJson<StageFile>(stagePath)), `${id} stage`).toEqual([]);
      }
    }
  });

  it('wear sound looks, named after their files and found once', () => {
    for (const [id, { look, file }] of looks) {
      const problems = lookDataProblems(look);
      expect(`${id}.json`, file).toBe(file.split('/').at(-1));
      const resolved = resolveLook(id, all, problems);
      expect(resolved, file).not.toBeNull();
      if (!look.abstract) {
        problems.push(...lookProblems(resolved!));
        const layer = buildLookLayer({ image: { ...png, data: png.rgba }, frames }, resolved!);
        problems.push(...layer.problems);
      }
      expect(problems, file).toEqual([]);
    }
  });

  it('have every text in every language', () => {
    for (const code of readdirSync(I18N_DIR).filter((n) => !n.includes('.'))) {
      const texts = readJson<Record<string, string>>(join(I18N_DIR, code, 'bosses.json'));
      for (const id of roster.levels) {
        const boss = readJson<BossData>(join(BOSSES_DIR, id, 'boss.json'));
        const keys = [
          'name',
          'desc',
          'briefing.flags',
          'briefing.sprint',
          'won',
          'lost',
          // The name of the effect is its first variant's.
          `fx.${boss.effect[0]}`,
          ...[...lookEffects(boss).values()].map((v) => `fx.${v[0]}`),
          ...boss.looks.map((l) => `look.${l}`),
        ];
        for (const k of keys)
          expect(texts[`boss.${id}.${k}`], `${code}: boss.${id}.${k}`).toBeTruthy();
      }
    }
  });
});
