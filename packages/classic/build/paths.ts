/** Folders and files the build and the dev server read and write. */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/** The game's package (`packages/classic`). */
export const CLASSIC = here('..');
/** What `npm run extract` decodes from the original jar. */
export const PLAYMAN = here('../../content/playman/extracted');
/** All game data: fonts, translations, the bosses' records and looks, our scores. */
export const CONTENT = here('../../content');
/** The bosses' folders: the looks page saves an outfit back into `<boss>/looks/<id>.json`. */
export const BOSSES = join(CONTENT, 'bosses');
/** Where the loudness pages save their measurements: the original's tracks, and our scores. */
export const LOUDNESS_FILE = join(CONTENT, 'audio', 'loudness.json');
export const LIVE_LOUDNESS_FILE = join(CONTENT, 'audio', 'live-loudness.json');
/** Local TAS runs (git-ignored), served to the dev server only (`?tas=`). */
export const TAS_OUT = here('../../tools/tas-out');
/**
 * Where the TAS reel (dev/reel.html) saves its videos: with the runs, never committed; the
 * `PARAPET_FOOTAGE` environment variable sends them to a folder of one's own instead.
 */
export const REEL_DIR = process.env.PARAPET_FOOTAGE || join(TAS_OUT, 'reel');
/** The development pages and helpers (`dev/`), served at `/dev/` by the dev server only. */
export const DEV_PAGES = here('../dev');

/** Where the promo art page saves its pictures (dev/art.html), by name. */
export const ART_FILES: Readonly<Record<string, string>> = {
  banner: here('../../../docs/banner.png'),
  'play-now': here('../../../docs/play-now.png'),
  'og-image': here('../public/og-image.png'),
  'og-race': here('../public/og-race.png'),
  collage: here('../../../docs/collage.png'),
};
