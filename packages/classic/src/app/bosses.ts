/**
 * The bosses of Parapet Classic: one per level, each holding a record in Flag hunt and in
 * Sprint (no rival), found by a tool-assisted search under human limits (`npm run tas`). The
 * times and split times ship (`bosses/contests.json`), and of the routes only two seconds around
 * each flag, as poses to watch (`bosses/glimpses.json`, `contestGlimpses`): the input of the
 * runs is never published, and a boss does not race in sight.
 *
 * A boss (`bosses/<id>/`) has outfits (`looks/`, one picked at random for every run; nobody
 * chooses), an effect (`fx.json`) and a little world for the character screen (`stage.json`).
 * Beating either of its records unlocks it for normal play; beating both (in any order) also
 * gives it its effect, which the player finds out when it happens. The two versions are two
 * character numbers (`contestCharacter`: the boss with its effect, then plain), so runs and
 * replays keep the one they were made with; the player always plays the best one they have
 * (`upgradeCharacter`). Wins are kept per level and mode, so a boss drawn later opens by itself
 * for whoever already beat its record.
 */
import { LEVEL_COUNT, RULESET_ID, SIM_VERSION, STEP } from '@parapet/sim';
import { bossProblems, type BossData, type BossRoster } from '@parapet/runtime/content/bosses.ts';
import {
  lookDataProblems,
  lookProblems,
  resolveLook,
  type LookData,
  type ResolvedLook,
} from '@parapet/runtime/render/Look.ts';
import { makeEchoColor, type EchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import { cssColor, DEFAULT_ACCENT, parseColor } from '@parapet/runtime/render/color.ts';
import type { FxFile } from '@parapet/runtime/render/fx/FxData.ts';
import { compileFx } from '@parapet/runtime/render/fx/FxSheet.ts';
import type { FxStyle } from '@parapet/runtime/render/fx/CharacterFx.ts';
import type { SpriteSwap } from '@parapet/runtime/render/SceneRenderer.ts';
import type { SkinLibrary } from '@parapet/runtime/render/SkinLibrary.ts';
import type { StageFile } from '@parapet/runtime/render/Stage.ts';
import type { MenuTint } from '@parapet/runtime/ui/Menu.ts';
import {
  isContestBeaten,
  type ContestKind,
  type ContestProgress,
} from '@parapet/runtime/storage/profile.ts';
import {
  decodeGlimpse,
  GLIMPSE_FORMAT,
  type GlimpsesFile,
  type GlimpseTrack,
} from '@parapet/runtime/content/glimpses.ts';
import contestsJson from '@content/bosses/contests.json';
import glimpsesJson from '@content/bosses/glimpses.json';
import rosterJson from '@content/bosses/bosses.json';
import { type I18n } from '@parapet/runtime/i18n/i18n.ts';

const bossFiles = import.meta.glob('@content/bosses/*/boss.json', {
  eager: true,
  import: 'default',
});
const lookFiles = import.meta.glob('@content/bosses/*/looks/*.json', {
  eager: true,
  import: 'default',
});
const fxFiles = import.meta.glob('@content/bosses/*/fx.json', { eager: true, import: 'default' });
const stageFiles = import.meta.glob('@content/bosses/*/stage.json', {
  eager: true,
  import: 'default',
});

/** The silhouette of a boss still in the workshop. */
export const WORKSHOP_COLOR: EchoColor = makeEchoColor('workshop', '#7d2a63');
export const CONTEST_KINDS: readonly ContestKind[] = ['flags', 'sprint'];
/** First character number of the bosses (the original's are 0..9). */
export const FIRST_BOSS_CHARACTER = 10;

/**
 * The colours of a boss's rows in the menus (its contests, the challenge to it): a band of its
 * dark tone, its name in its light tone, the chosen row in its colour.
 */
export function bossTint(color: EchoColor): MenuTint {
  return {
    edge: color.css,
    fill: cssColor(color.ramp.shadow),
    idle: cssColor(color.ramp.shadow, 0.45),
    label: color.light,
    value: color.css,
  };
}

export interface Boss {
  id: string;
  levelId: number;
  data: BossData;
  color: EchoColor;
  /** Its outfits, ready to draw; empty while it is in the workshop. */
  looks: ResolvedLook[];
  fx: FxFile | null;
  stage: StageFile | null;
}

/**
 * The two characters of a level's boss, in level order: with its effect (both records beaten)
 * and plain (one of them). The numbers keep the contest they once belonged to (`flags`: the
 * one with the effect) because recorded runs name them.
 */
export function contestCharacter(levelId: number, kind: ContestKind): number {
  return FIRST_BOSS_CHARACTER + 2 * levelId + (kind === 'sprint' ? 1 : 0);
}

/** The contest behind a boss character, or null for the original's characters. */
export function contestOfCharacter(
  character: number,
): { levelId: number; kind: ContestKind } | null {
  const i = character - FIRST_BOSS_CHARACTER;
  if (!Number.isInteger(i) || i < 0 || i >= 2 * LEVEL_COUNT) return null;
  return { levelId: i >> 1, kind: (i & 1) === 0 ? 'flags' : 'sprint' };
}

export interface ContestRecord {
  timeMs: number;
  /** Clock at the boss's k-th flag (or checkpoint), whichever flag it was. */
  splitsMs: number[];
}

interface ContestsFile {
  simVersion: string;
  rulesetId: string;
  levels: ({ levelId: number } & Record<ContestKind, ContestRecord & { runSha256: string }>)[];
}

const contests = contestsJson as unknown as ContestsFile;
const glimpses = glimpsesJson as unknown as GlimpsesFile;

/**
 * The share of its run a boss gives the player, the same on every level: the found runs need
 * every press within a step of its place, which nobody keeps up for a whole run, so a boss
 * races that much slower (the later levels are hard enough as they are).
 */
export const CONTEST_ALLOWANCE = 0.065;

/** A clock of the found run as the boss races it, on a step of the clock. */
function allowed(ms: number, allowance: number): number {
  return Math.round((ms * (1 + allowance)) / STEP) * STEP;
}

/**
 * The record of a level and mode as the boss races it (the found run slowed by
 * `CONTEST_ALLOWANCE`, every split with it, so each stretch gives in proportion to its length),
 * or null when there is none for this simulation (a change of the simulation needs the records
 * searched again; the tests make sure they were).
 */
export function contestRecord(levelId: number, kind: ContestKind): ContestRecord | null {
  if (contests.simVersion !== SIM_VERSION || contests.rulesetId !== RULESET_ID) return null;
  const found = contests.levels.find((l) => l.levelId === levelId)?.[kind];
  if (!found) return null;
  return {
    timeMs: allowed(found.timeMs, CONTEST_ALLOWANCE),
    splitsMs: found.splitsMs.map((ms) => allowed(ms, CONTEST_ALLOWANCE)),
  };
}

const glimpseCache = new Map<string, readonly (GlimpseTrack | null)[] | null>();

/**
 * What the boss of a level and mode did around each of its flags (by flag or checkpoint index;
 * null for one without), or null when the glimpses are not for this simulation, not of the run
 * behind the published record, or broken.
 */
export function contestGlimpses(
  levelId: number,
  kind: ContestKind,
): readonly (GlimpseTrack | null)[] | null {
  const key = `${levelId}-${kind}`;
  if (glimpseCache.has(key)) return glimpseCache.get(key)!;
  let tracks: (GlimpseTrack | null)[] | null = null;
  const record = contests.levels.find((l) => l.levelId === levelId)?.[kind];
  const set = glimpses.levels?.find((l) => l.levelId === levelId)?.[kind];
  if (
    glimpses.format === GLIMPSE_FORMAT &&
    glimpses.simVersion === SIM_VERSION &&
    glimpses.rulesetId === RULESET_ID &&
    contestRecord(levelId, kind) &&
    record &&
    set &&
    set.runSha256 === record.runSha256
  ) {
    tracks = set.clips.map((code) => (code ? decodeGlimpse(code) : null));
  }
  glimpseCache.set(key, tracks);
  return tracks;
}

function folderOf(path: string): string {
  const parts = path.split('/');
  const i = parts.lastIndexOf('bosses');
  return parts[i + 1] ?? '';
}

function load(): Boss[] {
  const allLooks = new Map<string, LookData>();
  for (const data of Object.values(lookFiles)) {
    const look = data as LookData;
    allLooks.set(look.id, look);
  }
  const byFolder = <T>(files: Record<string, unknown>): Map<string, T> =>
    new Map(Object.entries(files).map(([path, data]) => [folderOf(path), data as T]));
  const datas = byFolder<BossData>(bossFiles);
  const fxs = byFolder<FxFile>(fxFiles);
  const stages = byFolder<StageFile>(stageFiles);
  const roster = (rosterJson as BossRoster).levels;
  const out: Boss[] = [];
  roster.forEach((id, levelId) => {
    const data = datas.get(id);
    if (!data) {
      console.warn(`boss ${id}: no boss.json`);
      return;
    }
    const fx = fxs.get(id) ?? null;
    const problems: string[] = [];
    const looks: ResolvedLook[] = [];
    const lookEffects = new Map<string, string[]>();
    for (const lookId of data.looks) {
      const own = allLooks.get(lookId);
      const p = own ? lookDataProblems(own) : [];
      const look = resolveLook(lookId, allLooks, p);
      if (look) p.push(...lookProblems(look));
      if (look?.effect) lookEffects.set(lookId, look.effect);
      if (look && p.length === 0) looks.push(look);
      else problems.push(...p.map((s) => `look ${lookId}: ${s}`));
    }
    problems.push(...bossProblems(data, fx ?? undefined, new Set(allLooks.keys()), lookEffects));
    if (problems.length > 0) console.warn(`boss ${id}: ${problems.join('; ')}`);
    out.push({
      id,
      levelId,
      data,
      color: makeEchoColor(`boss-${id}`, parseColor(data.color) ? data.color : DEFAULT_ACCENT),
      looks,
      fx,
      stage: stages.get(id) ?? null,
    });
  });
  return out;
}

const BOSSES = load();

export function allBosses(): readonly Boss[] {
  return BOSSES;
}

/** The boss of a level. */
export function bossOfLevel(levelId: number): Boss | null {
  return BOSSES.find((b) => b.levelId === levelId) ?? null;
}

/** The boss a character is, the contest that unlocks it and whether it wears its effect. */
export function bossOfCharacter(
  character: number,
): { boss: Boss; levelId: number; kind: ContestKind; effects: boolean } | null {
  const contest = contestOfCharacter(character);
  if (!contest) return null;
  const boss = bossOfLevel(contest.levelId);
  if (!boss) return null;
  return { boss, ...contest, effects: contest.kind === 'flags' };
}

/** The effect variants a boss wears in an outfit. */
export function effectOf(boss: Boss, look?: ResolvedLook | null): readonly string[] {
  return look?.effect ?? boss.data.effect;
}

/** The text key of the name of a boss's effect (in an outfit). */
export function effectNameKey(boss: Boss, look?: ResolvedLook | null): string {
  return `boss.${boss.id}.fx.${effectOf(boss, look)[0] ?? ''}`;
}

/** Whether a boss is drawn (not in the workshop). */
export function isDrawn(boss: Boss | null | undefined): boolean {
  return !!boss && boss.looks.length > 0;
}

/** Puts every boss's outfits on its two characters. */
export function registerBosses(skins: SkinLibrary): void {
  for (const boss of BOSSES) {
    for (const kind of CONTEST_KINDS) {
      skins.setOutfits(contestCharacter(boss.levelId, kind), boss.looks);
    }
  }
}

/**
 * The character a player plays a level's boss as: plain once one of its two records is beaten
 * (either), with its effect once both are, null while neither is (or it is not drawn yet).
 */
export function bossCharacterFor(levelId: number, progress: ContestProgress): number | null {
  if (!isDrawn(bossOfLevel(levelId))) return null;
  const wins = CONTEST_KINDS.filter((kind) => isContestBeaten(progress, levelId, kind)).length;
  if (wins >= CONTEST_KINDS.length) return contestCharacter(levelId, 'flags');
  if (wins > 0) return contestCharacter(levelId, 'sprint');
  return null;
}

/** Whether a player may play as a boss character: a version of the boss they have won. */
export function isBossUnlocked(character: number, progress: ContestProgress): boolean {
  const found = bossOfCharacter(character);
  if (!found) return true;
  const best = bossCharacterFor(found.levelId, progress);
  if (best === null) return false;
  return found.effects ? best === character : true;
}

/**
 * The version of a boss character the player has: a plain boss gets its effect once both
 * records are beaten (and one with an effect the player has not earned falls back to plain).
 */
export function upgradeCharacter(character: number, progress: ContestProgress): number {
  const found = bossOfCharacter(character);
  if (!found) return character;
  return bossCharacterFor(found.levelId, progress) ?? character;
}

/** An outfit for a run: one of the character's, at random (0 for the others). */
export function pickOutfit(character: number, random: () => number = Math.random): number {
  const n = bossOfCharacter(character)?.boss.looks.length ?? 0;
  return n > 1 ? Math.floor(random() * n) : 0;
}

/** The colour of a boss character in an outfit: the outfit's accent, else the boss's. */
export function characterColor(character: number, outfit = 0): EchoColor {
  const found = bossOfCharacter(character);
  if (!found) return WORKSHOP_COLOR;
  const look = found.boss.looks[outfit % Math.max(1, found.boss.looks.length)];
  return look ? makeEchoColor(look.id, look.accent) : found.boss.color;
}

/**
 * The effects of a runner playing a character in an outfit (`swap`: its body-part swap by game
 * clock): the boss's effect, or only its outfit's cloth for the plain version; null for the
 * original's characters and bosses not drawn.
 */
export function characterFx(
  skins: SkinLibrary,
  character: number,
  outfit: number,
  swap: (clock: number) => SpriteSwap,
  seed = 1,
): FxStyle | null {
  const found = bossOfCharacter(character);
  if (!found || !isDrawn(found.boss)) return null;
  const look = skins.lookOf(character, outfit);
  if (!look) return null;
  const color = makeEchoColor(look.id, look.accent);
  const fx = found.effects && found.boss.fx ? compileFx(found.boss.fx, look.accent) : null;
  return {
    fx,
    variants: fx ? effectOf(found.boss, look) : [],
    color,
    source: skins.sceneFor(character, outfit),
    swap,
    ribbons: Object.values(look.ribbons),
    ribbonColor: (token) => look.palette[token] ?? token,
    seed,
  };
}

/** A boss's name in the current language ('' for none). */
export function bossName(i18n: I18n, boss: Boss | null | undefined): string {
  return boss ? i18n.t(`boss.${boss.id}.name`) : '';
}
