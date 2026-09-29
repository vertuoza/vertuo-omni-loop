import type { GalaxyView } from '@omni/galaxy';
import { boardOf, type AnsweredCount, type BoardRequest, type BoardValue } from './load';
import { brusselsDay, brusselsMidnight } from './period';
import type { Activity, Member } from './tally';

// The board in the demo (PRD 572: development, or OMNI_LOOP_DEMO=1), on the demo world: its roster is
// the demo galaxy's heroes, *you* (DAM-DEV) playing solo as on the demo's Home, and two members with
// no points yet, one of them with no fleet either, so the People tables show 0s and SOLO. The demo
// world holds no merges, PRD stages or answers, so they are made up and fixed here, over the 35 days
// up to today (enough for every period), and move with the day they are shown on, today last. A
// merge by someone who is not a member (a bot) shows in the workspace's totals only.

/** The demo's *you*, as in src/dashboard/demo.ts. */
export const DEMO_VIEWER = { login: 'dam-dev', userId: 'demo:dam-dev' } as const;

/** Members with no points: Paul, in a fleet, and a newcomer with no fleet. */
const NEWCOMERS: Member[] = [
  { userId: 'demo:paul-e', name: 'PAUL', login: 'paul-e', avatarUrl: null, fleet: 'builders' },
  { userId: 'demo:new-hire', name: 'NEWBIE', login: 'new-hire', avatarUrl: null, fleet: null },
];

const REPOS = ['vertuo-core', 'vertuo-api', 'vertuo-ai-domain', 'vertuo-web', 'vertuo-mobile'];
const OUTSIDER = 'build-bot';
const DAYS = 35;
const HOUR = 3_600_000;

export function demoRoster(galaxy: Pick<GalaxyView, 'heroes'>): Member[] {
  const heroes = galaxy.heroes.map((h): Member => ({
    userId: `demo:${h.name}`,
    name: h.name.toUpperCase().slice(0, 10),
    login: h.name.toLowerCase(),
    avatarUrl: null,
    fleet: h.name.toLowerCase() === DEMO_VIEWER.login ? null : h.team,
  }));
  return [...heroes, ...NEWCOMERS];
}

/** The made-up contributions: each member merges on a fixed rhythm of their own, PRDs open every
 * three days and move on two and five days later, and a bot merges every fourth day. */
export function demoActivity(roster: readonly Member[], now: Date): Activity[] {
  const today = brusselsDay(now)!;
  const noon = (back: number) => {
    const day = new Date(Date.parse(`${today}T00:00:00Z`) - back * 24 * HOUR).toISOString().slice(0, 10);
    return new Date(brusselsMidnight(day).getTime() + 12 * HOUR).toISOString();
  };
  const rows: Activity[] = [];
  let number = 2000;
  const logins = roster.flatMap((m) => (m.login ? [m.login] : []));
  for (let back = DAYS - 1; back >= 0; back--) {
    logins.forEach((login, k) => {
      // Paul merges most days: the member a points-only board missed.
      const merges = login === 'paul-e' ? (back % 3 === 0 ? 0 : 1) : login === 'new-hire' ? 0 : (back * 7 + k * 3) % 11 < 2 ? 1 : 0;
      for (let i = 0; i < merges; i++) rows.push({ kind: 'pr-merged', repo: REPOS[(back + k) % REPOS.length], number: ++number, login, at: noon(back) });
    });
    if (back % 4 === 1) rows.push({ kind: 'pr-merged', repo: 'vertuo-core', number: ++number, login: OUTSIDER, at: noon(back) });
    if (back % 3 === 0) {
      const prd = 500 + back;
      const author = logins[back % logins.length];
      rows.push({ kind: 'prd-opened', repo: 'vertuo-omni-plan', number: prd, login: author, at: noon(back) });
      if (back >= 2) rows.push({ kind: 'prd-started', repo: 'vertuo-omni-plan', number: prd, login: author, at: noon(back - 2) });
      if (back >= 5) rows.push({ kind: 'prd-shipped', repo: 'vertuo-omni-plan', number: prd, login: author, at: noon(back - 5) });
    }
  }
  return rows;
}

/** The made-up answers: a few each, Paul nine, the newcomer none. */
export function demoAnswered(roster: readonly Member[]): AnsweredCount[] {
  return roster.map((m, k) => ({
    user_id: m.userId,
    answered: m.login === 'paul-e' ? 9 : m.login === 'new-hire' ? 0 : (k * 5) % 7,
  }));
}

/** A board of the demo world, for any scope and period. */
export function demoBoard(galaxy: GalaxyView, request: Omit<BoardRequest, 'viewerId'>): BoardValue {
  const roster = demoRoster(galaxy);
  return boardOf(
    { roster, activity: demoActivity(roster, request.now), answered: demoAnswered(roster), galaxy },
    { ...request, viewerId: DEMO_VIEWER.userId },
  );
}
