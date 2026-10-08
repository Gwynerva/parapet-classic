/**
 * `npm run icons`: writes the app icons (packages/classic/public/icons, and `favicon.ico` next
 * to the page) from the pixel art in `icons.ts`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_FILES, RACE_ICON_ART, renderIco, renderIcon, renderIconSvg } from './icons.ts';

export const ICONS_DIR = fileURLToPath(new URL('../../classic/public/icons', import.meta.url));

mkdirSync(ICONS_DIR, { recursive: true });
for (const file of ICON_FILES) {
  writeFileSync(join(ICONS_DIR, file.name), renderIcon(file.scale, file.size));
  console.log(`${file.name}  ${file.size}×${file.size}`);
}
writeFileSync(join(ICONS_DIR, 'icon.svg'), renderIconSvg());
console.log('icon.svg');
// The race (challenge links): its picture for the link preview (dev/art.html draws it).
writeFileSync(join(ICONS_DIR, 'race-32.png'), renderIcon(1, 32, RACE_ICON_ART));
console.log('race-32.png');
const ico = join(ICONS_DIR, '..', 'favicon.ico');
writeFileSync(ico, renderIco([32, 64].map((size) => ({ size, png: renderIcon(size / 32, size) }))));
console.log('favicon.ico  32, 64');
