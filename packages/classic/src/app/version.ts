/**
 * The build a run was played on, for speedrun submissions: the game's release and the version
 * of the simulation that replays are checked against (a replay runs only on its own).
 */
import { SIM_VERSION } from '@parapet/sim';
import { version } from '../../../../package.json';

/** The simulation's version without its package name: `sim 0.2.0` for `parapet-sim@0.2.0`. */
const SHORT_SIM_VERSION = `sim ${SIM_VERSION.replace(/^parapet-sim@/, '')}`;

/** What the results screen and About show: `Parapet 1.2.0 · sim 0.2.0`. */
export const BUILD_VERSION = `Parapet ${version} · ${SHORT_SIM_VERSION}`;
