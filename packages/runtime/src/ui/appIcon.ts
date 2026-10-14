/**
 * The app icon of Parapet Classic as pixel art: a runner leaping off a rooftop parapet, our own
 * (nothing from the original game). The tools render it into the favicons and app icons
 * (`packages/tools/src/icons.ts`); the mission menu draws it on a card for the free run.
 * Legend: `.` background, `a` / `A` the runner (lit / shaded), `d` speed lines and mortar, `G` the
 * parapet's coping, `g` its bricks.
 */
export const APP_ICON_ART: readonly string[] = ([] = [
  '................................',
  '................................',
  '................................',
  '....................aa..........',
  '...................aaaa.........',
  '...................aaaa.........',
  '...................aaa..........',
  '..dddddddd......................',
  '.................Aaaaa....aa....',
  '................Aaaaaaa.aaaa....',
  '..............AAAaaaaaaaaaa.....',
  'ddddddd......AAAaaaa..aaa.......',
  '.............AA.aaaa............',
  '............AAAaaaa.............',
  '.......AA...AAAaaaaa............',
  '.......AAAA.AAAaaaaaaa..........',
  '........AAAAAA.....aaa..........',
  '...ddd....AAA.......aa..........',
  '....................aaa.........',
  '.....................aa.........',
  '.....................aaa........',
  'GGGGGGGGGGGGGGGGGGG.............',
  'ddddddddddddddddddd.............',
  'gggggdgggggggdggggd.............',
  'gggggdgggggggdggggd.............',
  'gggggdgggggggdggggd.............',
  'ddddddddddddddddddd.............',
  'gggggggggdgggggggdd.............',
  'gggggggggdgggggggdd.............',
  'gggggggggdgggggggdd.............',
  'ddddddddddddddddddd.............',
  'ggggggggggggggggggd.............',
]);
