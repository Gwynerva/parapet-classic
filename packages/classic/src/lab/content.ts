/**
 * The Lab's sources in the browser: the game's own content (`assets/content.ts`) and fonts,
 * their pictures read back into bytes, and the Moves menu's demos.
 */
import demosJson from '@content/moves/demos.json';
import { Lab } from '@parapet/lab/lab.ts';
import type { MoveDemoData } from '@parapet/runtime/moves/MoveDemo.ts';
import type { RgbaImage } from '@parapet/runtime/render/Raster.ts';
import type { BitmapFont } from '@parapet/runtime/text/BitmapFont.ts';
import type { RasterFont } from '@parapet/runtime/text/RasterText.ts';
import { loadContent } from '../assets/content.ts';
import { loadFonts } from '../assets/fonts.ts';
import { createI18n } from '../i18n/locales.ts';

/** A loaded picture's pixels. */
function pixels(image: CanvasImageSource & { width: number; height: number }): RgbaImage {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2D canvas');
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, image.width, image.height);
  return { width: data.width, height: data.height, data: data.data };
}

function rasterFont(font: BitmapFont): RasterFont {
  if (!font.image) throw new Error('a font without its picture');
  return { font, atlas: pixels(font.image as HTMLImageElement) };
}

/** The Lab in `locale`: the levels' names in it. */
export async function loadLab(locale: string): Promise<Lab> {
  const [content, fonts] = await Promise.all([loadContent(), loadFonts()]);
  const i18n = createI18n(locale);
  return new Lab({
    moves: content.moves,
    tables: content.tables,
    anims: content.anims,
    scenes: [...content.scenes.values()],
    levels: content.levels,
    missions: content.missions,
    rivals: content.rivals,
    atlas: { image: pixels(content.atlas.image), frames: content.atlas.frames },
    fonts: { small: rasterFont(fonts.small), text: rasterFont(fonts.text) },
    demos: (demosJson as { demos: MoveDemoData[] }).demos,
    levelNames: content.levels.map((_, id) => i18n.t(`level.names.${id}`)),
  });
}
