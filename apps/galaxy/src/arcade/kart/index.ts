// The one way into OMNI KART (PRD 1359): the arcade imports this file with a dynamic `import()` when
// the cabinet opens, never before, so a page that never opens the game never downloads anything under
// arcade/kart/. Nothing outside this folder imports it at run time (guard.test.ts).
import type { KartGame } from '../scenes/kart.ts';
import { createKart, type LiveRace } from './art';
import { circuitOf } from './circuits';
import { parseTrack } from './track';

export { createKart, type KartOptions } from './art';
// MULTI's grid (PRD 1572): joined over the workspace's link when MULTI is picked.
export { openGrid, type GridSession, type RaceStart } from './hub';

/** MULTI's race (PRD 1572): the game for a race the grid started, talking over the grid's session. */
export function joinRace(live: LiveRace): KartGame {
  return createKart({ seed: live.start.seed, live, track: parseTrack(circuitOf(live.start.track).source) });
}
