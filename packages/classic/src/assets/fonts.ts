/** The game's bitmap fonts (`packages/content/fonts`, built by `npm run build-font`). */
import { BitmapFont, type BitmapFontData } from '@parapet/runtime/text/BitmapFont.ts';
import type { Fonts } from '../app/Context.ts';
import text12 from '../../../content/fonts/text-12.json';
import text12Png from '../../../content/fonts/text-12.png';
import text16 from '../../../content/fonts/text-16.json';
import text16Png from '../../../content/fonts/text-16.png';
import display16 from '../../../content/fonts/display-16.json';
import display16Png from '../../../content/fonts/display-16.png';
import display24 from '../../../content/fonts/display-24.json';
import display24Png from '../../../content/fonts/display-24.png';

export async function loadFonts(): Promise<Fonts> {
  const [small, text, display, title] = await Promise.all([
    BitmapFont.fromData(text12 as BitmapFontData, text12Png),
    BitmapFont.fromData(text16 as BitmapFontData, text16Png),
    BitmapFont.fromData(display16 as BitmapFontData, display16Png),
    BitmapFont.fromData(display24 as BitmapFontData, display24Png),
  ]);
  return { small, text, display, title };
}
