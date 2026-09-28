import 'server-only';
import { demoFleets, demoGalaxy } from '../data/load-galaxy';
import { demoCounts } from './counts/demo';
import type { DashboardData } from './load';
import type { DemoInput } from './part';
import { demoRankings } from './rankings/demo';
import { seasonBounds } from './season';
import { demoWeek } from './week/demo';
import { DEFAULT_HERO, scoreOf, type YouValue } from './you';

// The dashboard in the demo (PRD 328: development, or OMNI_LOOP_DEMO=1), on the demo world: the demo
// galaxy (demoGalaxy: a fictional GitHub snapshot through the real projector) and its fleets. *You*
// are one of its heroes, DAM-DEV of BEAVER, wearing the demo guest's default hero; your points and
// places are the demo galaxy's own. Each part's demo is its folder's own (demo.ts there), given the
// same demo world: what the world holds they read from it, and what it does not (merges, counts) they
// make up and fix there.

/** The demo's *you*: one of the demo world's heroes, and their fleet. */
export const DEMO_YOU = { login: 'dam-dev', name: 'DAM-DEV', team: 'beaver' } as const;

export function demoDashboard(now: Date): DashboardData {
  const season = seasonBounds(now);
  const galaxy = demoGalaxy(now);
  const input: DemoInput = { now, season, galaxy, login: DEMO_YOU.login, team: DEMO_YOU.team };
  const fleet = demoFleets().find((f) => f.name === DEMO_YOU.team);
  const you: YouValue = {
    kind: 'player',
    hero: DEFAULT_HERO,
    fleet: fleet ? { name: fleet.name, label: fleet.label, color: fleet.color } : null,
    score: scoreOf(galaxy, DEMO_YOU.login, DEMO_YOU.team),
  };
  return {
    name: DEMO_YOU.name, season, you,
    week: demoWeek(input), counts: demoCounts(input), rankings: demoRankings(input),
  };
}
