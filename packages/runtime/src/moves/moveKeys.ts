/** Our dictionary keys of the twenty moves, in the order of the original's demos (strings 36-55 / 56-75). */
export const MOVE_KEYS = [
  'run',
  'jump',
  'landing',
  'ladder',
  'slide',
  'wallJump',
  'wallRun',
  'ledge',
  'roll',
  'frontFlip',
  'backFlip',
  'tigerJump',
  'wallFlip',
  'monkeyVault',
  'dash',
  'monkeyFlip',
  'spiderJump',
  'poleSlide',
  'poleJump',
  'poleSpin',
] as const;

export type MoveKey = (typeof MOVE_KEYS)[number];
