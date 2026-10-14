/** Every finding, in the order the gallery tells them. */
import type { Facts, Finding } from '../finding.ts';
import { keysArePressed } from './01-keys-are-pressed-never-held.ts';
import { armedNotTimed } from './02-armed-not-timed.ts';
import { onePressTwoKicks } from './03-one-press-two-kicks.ts';
import { parkourIsATable } from './04-the-parkour-is-a-table.ts';
import { landingKeepsSpeed } from './05-landing-keeps-horizontal-speed.ts';
import { fixedPointMaths } from './06-fixed-point-maths.ts';
import { slowPhonesSlowDown } from './07-slow-phones-slow-down.ts';
import { oneVectorRunner } from './08-one-vector-runner.ts';
import { vectorBackgrounds } from './09-vector-backgrounds.ts';
import { theCamera } from './10-the-camera.ts';
import { rivalsAreReplays } from './11-rivals-are-replays.ts';
import { levelMapQuirks } from './12-level-map-quirks.ts';
import { scoreNeverDrops } from './13-the-score-never-drops.ts';

export const FINDINGS: readonly Finding<Facts>[] = [
  keysArePressed,
  armedNotTimed,
  onePressTwoKicks,
  parkourIsATable,
  landingKeepsSpeed,
  fixedPointMaths,
  slowPhonesSlowDown,
  oneVectorRunner,
  vectorBackgrounds,
  theCamera,
  rivalsAreReplays,
  levelMapQuirks,
  scoreNeverDrops,
];
