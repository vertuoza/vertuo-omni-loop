import 'server-only';
import { demoGalaxy } from '../data/load-galaxy';
import { demoCounts } from './counts/demo';
import type { DashboardData } from './load';
import type { DemoInput } from './part';
import { demoRankings } from './rankings/demo';
import { seasonBounds } from './season';
import { demoWeek } from './week/demo';
import { DEFAULT_HERO, scoreOf, SOLO, type YouValue } from './you';

// The dashboard in the demo (PRD 328: development, or OMNI_LOOP_DEMO=1), on the demo world: the demo
// galaxy (demoGalaxy: a fictional GitHub snapshot through the real projector). *You* are one of its
// heroes, DAM-DEV, playing solo (PRD 400: the demo names no fleet of its own), wearing the demo
// guest's default hero; your points and place are the demo galaxy's own. Each part's demo is its
// folder's own (demo.ts there), given the same demo world: what the world holds they read from it,
// and what it does not (merges, counts) they make up and fix there.

/** The demo's *you*: one of the demo world's heroes, with no fleet. */
export const DEMO_YOU = { login: 'dam-dev', name: 'DAM-DEV', team: null } as const;

export function demoDashboard(now: Date): DashboardData {
  const season = seasonBounds(now);
  const galaxy = demoGalaxy(now);
  const input: DemoInput = { now, season, galaxy, login: DEMO_YOU.login, team: DEMO_YOU.team };
  const you: YouValue = {
    kind: 'player',
    hero: DEFAULT_HERO,
    fleet: SOLO,
    score: scoreOf(galaxy, DEMO_YOU.login, DEMO_YOU.team),
  };
  return {
    name: DEMO_YOU.name, season, you,
    week: demoWeek(input), counts: demoCounts(input), rankings: demoRankings(input),
  };
}
