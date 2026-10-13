/**
 * Every flourish of an effect at once, for the dev pages that show effects (the showcase, the
 * promotional pictures): to look at them, not as the game plays them.
 */
import type { FxFile, FxTrigger } from '@parapet/runtime/render/fx/FxData.ts';

/** Tricks: what an emitter on a clock may be kept to (a gust now and then while she flips). */
const TRICKS: readonly FxTrigger[] = ['flip', 'vault', 'wall', 'roll'];
/** How often such a rare one comes when every flourish is asked for: on every trick. */
const FORCED_PER_SECOND = 4;

/** Every chance emitter (and snapshot) of an effect firing every time, and the rare ones on a
 * clock during tricks on every trick. */
export function forced(file: FxFile): FxFile {
  const copy = JSON.parse(JSON.stringify(file)) as FxFile;
  for (const em of Object.values(copy.emitters ?? {})) {
    if (em.chance !== undefined) em.chance = 1;
    const during = em.while ?? [];
    const trickOnly = during.length > 0 && during.every((t) => TRICKS.includes(t));
    if (trickOnly && em.perSecond !== undefined && em.perSecond < FORCED_PER_SECOND) {
      em.perSecond = FORCED_PER_SECOND;
    }
  }
  for (const v of Object.values(copy.variants ?? {})) {
    if (v.afterimage?.chance !== undefined) v.afterimage.chance = 1;
  }
  return copy;
}
