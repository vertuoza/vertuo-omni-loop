import 'server-only';
import { demoGalaxy } from '../data/load-galaxy';
import { demoBoard, DEMO_VIEWER } from './board/demo';
import type { Period } from './board/period';
import { demoWaiting } from './counts/demo';
import { homeRequest } from './home/team';
import type { DashboardData } from './load';
import type { DemoInput } from './part';
import { seasonBounds } from './season';
import { DEFAULT_HERO, scoreOf, SOLO, type YouValue } from './you';

// Home in the demo (PRD 328, reshaped by PRD 572: development, or OMNI_LOOP_DEMO=1), on the demo
// world: the demo galaxy (demoGalaxy: a fictional GitHub snapshot through the real projector). *You*
// are one of its heroes, DAM-DEV, playing solo (PRD 400: the demo names no fleet of its own), wearing
// the demo guest's default hero; your points and place are the demo galaxy's own. Waiting for you is
// counts/'s demo; the board is board/'s demo world with scope *you*, and, you being solo, your own row
// in the People table and the link to Fleet.

/** The demo's *you*: one of the demo world's heroes, with no fleet. */
export const DEMO_YOU = { login: 'dam-dev', name: 'DAM-DEV', team: null } as const;

export function demoDashboard(period: Period, now: Date): DashboardData {
  const season = seasonBounds(now);
  const galaxy = demoGalaxy(now);
  const input: DemoInput = { now, season, galaxy, login: DEMO_YOU.login, team: DEMO_YOU.team };
  const you: YouValue = {
    kind: 'player',
    hero: DEFAULT_HERO,
    fleet: SOLO,
    score: scoreOf(galaxy, DEMO_YOU.login, DEMO_YOU.team),
  };
  const home = homeRequest({ userId: DEMO_VIEWER.userId, login: DEMO_YOU.login, team: DEMO_YOU.team });
  return {
    name: DEMO_YOU.name, season, you,
    waiting: demoWaiting(input),
    board: demoBoard(galaxy, { scope: home.scope, people: home.people, period, now }),
    solo: home.solo,
  };
}
