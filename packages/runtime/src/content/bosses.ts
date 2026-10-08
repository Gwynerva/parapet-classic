/**
 * The bosses of the contests (`content/bosses`): one per level, each with its outfits (looks,
 * one picked at random for every run), its effect (worn once its Flag hunt record is beaten)
 * and the little world shown behind it on the character screen. Pure shapes and checks; the app
 * loads the files.
 */
import { parseColor } from '../render/Look.ts';
import { fxProblems, type FxFile } from '../render/fx/FxData.ts';

export type BossGender = 'female' | 'male' | 'neutral';

export interface BossData {
  id: string;
  /** The boss's colour: name tags, the effect's accent where an outfit has none. */
  color: string;
  /** For the grammar of the texts about the boss. */
  gender: BossGender;
  /** Look ids of the outfits, the first one for menus; none while still in the workshop. */
  looks: string[];
  /**
   * The variants of its effect (`fx.json`) worn together; an outfit may wear others
   * (`LookData.effect`).
   */
  effect: string[];
}

/** `bosses.json`: the boss of each level, in level order. */
export interface BossRoster {
  levels: string[];
}

const GENDERS: readonly BossGender[] = ['female', 'male', 'neutral'];

/**
 * What is wrong with a boss and its effects, or nothing. `lookEffects`: the effect variants of
 * those of its outfits that wear their own.
 */
export function bossProblems(
  boss: BossData,
  fx: FxFile | undefined,
  lookIds: ReadonlySet<string>,
  lookEffects: ReadonlyMap<string, readonly string[]> = new Map(),
): string[] {
  const out: string[] = [];
  if (!/^[a-z][a-z0-9-]*$/.test(boss.id)) out.push(`id "${boss.id}" must be kebab-case`);
  if (!parseColor(boss.color)) out.push(`color ${boss.color}`);
  if (!GENDERS.includes(boss.gender)) out.push(`gender "${boss.gender}"`);
  for (const l of boss.looks) if (!lookIds.has(l)) out.push(`look "${l}" does not exist`);
  if (!fx) {
    out.push('no fx.json');
    return out;
  }
  out.push(...fxProblems(fx).map((p) => `fx: ${p}`));
  if (!Array.isArray(boss.effect) || boss.effect.length === 0) out.push('no effect');
  for (const v of boss.effect ?? []) {
    if (!(v in fx.variants)) out.push(`effect variant "${v}" does not exist`);
  }
  for (const [look, variants] of lookEffects) {
    for (const v of variants) {
      if (!(v in fx.variants)) out.push(`look ${look}: effect variant "${v}" does not exist`);
    }
  }
  if (!fx.presence?.vanish?.length || !fx.presence.appear?.length) {
    out.push('fx: presence needs vanish and appear');
  }
  return out;
}
