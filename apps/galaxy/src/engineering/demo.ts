import { periodWindow, type Period } from '../dashboard/board/period';
import { peopleOf } from '../people/load';
import { withPeople } from './faced';
import type { EngineeringBoard } from './load';
import { engineeringOf, OMNI_MAN, type PullRequestRow, type ReviewRow, type SortKey } from './tally';

// The demo's Engineering board (PRD 612 s3), for development and OMNI_LOOP_DEMO=1: two tracked
// repositories and a month and a half of made-up pull requests and reviews, counted as a workspace's
// would be, with a member or two for their heroes, the loop's sub-PRs into feature branches and a weekly
// develop → main promotion, which count nowhere but the sub-PR line (PRD 714), and for Loop health
// (PRD 714 s2, s3) one pull request labelled omni:needs-fix, one run held and one claim gone cold, and
// (s4) some sub-PRs that got omni:needs-fix before they merged. Fixed: the same `now` draws the same board. Given a
// repository (PRD 645 s2), that repository's page: the board over it alone, or not tracked.

const TRACKED = ['acme/widgets', 'acme/gears'];
const PEOPLE = ['ada', 'bob', 'carl', 'dora', 'eli', 'fay'];
const HOUR = 3_600_000;

/** The demo's people directory, so both kinds of face show: ada and dora draw their heroes (ada in
 * her fleet's colour, dora with no fleet), everyone else their GitHub photo. */
const DEMO_PEOPLE = peopleOf(
  [
    { user_id: 'demo-ada', name: 'Ada', github_login: 'ada', avatar_url: null, fleet: 'comets', hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } },
    { user_id: 'demo-dora', name: 'Dora', github_login: 'dora', avatar_url: null, fleet: null, hero: { v: 1, body: 'boy', skin: 2, hair: 1, suit: 1, cape: 0 } },
  ],
  [{ name: 'comets', label: 'COMETS', color: '#e0457b', mascot: null }],
);

const openedAt = (i: number, now: Date) => new Date(now.getTime() - (i * 11 + 3) * HOUR);
const isSigned = (i: number) => i % 3 === 0;
const person = (i: number) => PEOPLE[i % PEOPLE.length];

/** When the i-th pull request merges: never for every seventh, sooner when signed. */
function mergedAt(i: number, opened: Date): Date | null {
  if (i % 7 === 0) return null;
  return new Date(opened.getTime() + (isSigned(i) ? 2 + (i % 5) : 6 + (i % 23)) * HOUR);
}

function pullRequestOf(i: number, now: Date): PullRequestRow {
  const opened = openedAt(i, now);
  const merged = mergedAt(i, opened);
  const done = merged && merged < now ? merged.toISOString() : null;
  const author = isSigned(i) && i % 6 === 0 ? OMNI_MAN : person(i);
  return {
    repo: TRACKED[i % 2], number: 100 + i, author, authorIsBot: author === OMNI_MAN, openedAt: opened.toISOString(),
    mergedAt: done, closedAt: done, mergedBy: merged ? person(i + 2) : null,
    commits: 1 + (i % 6), additions: 20 + ((i * 37) % 400), deletions: 5 + ((i * 13) % 120), omniSigned: isSigned(i),
    base: 'main', head: `feat/work-${i}`,
  };
}

/** The i-th of the loop's sub-PRs (PRD 714): signed, into a feature branch, merged within the hour by
 * who ran the loop. They count on the Omni Loop panel's sub-PR line alone, and on Loop health's period
 * rate (s4): every fifth got omni:needs-fix ten minutes after it opened, before it merged, and every
 * seventh after it merged, which does not count. */
function subPrOf(i: number, now: Date): PullRequestRow {
  const opened = new Date(now.getTime() - (i * 5 + 2) * HOUR);
  const merged = new Date(opened.getTime() + (20 + (i % 30)) * 60_000).toISOString();
  const topic = `feat/demo-${Math.floor(i / 4)}`;
  const needsFixAt = i % 5 === 0 ? new Date(opened.getTime() + 10 * 60_000).toISOString()
    : i % 7 === 0 ? new Date(Date.parse(merged) + 60_000).toISOString() : null;
  return {
    repo: TRACKED[i % 2], number: 300 + i, author: person(i), authorIsBot: false, openedAt: opened.toISOString(),
    mergedAt: merged, closedAt: merged, mergedBy: person(i), commits: 2, additions: 60, deletions: 10, omniSigned: true,
    base: topic, head: `${topic}--s${(i % 4) + 1}`, needsFixAt,
  };
}

/** A promotion from develop into main, once a week: counted nowhere. */
function promotionOf(i: number, now: Date): PullRequestRow {
  const opened = new Date(now.getTime() - (i * 7 * 24 + 30) * HOUR);
  const merged = new Date(opened.getTime() + HOUR).toISOString();
  return {
    repo: TRACKED[0], number: 400 + i, author: 'dora', authorIsBot: false, openedAt: opened.toISOString(), mergedAt: merged, closedAt: merged,
    mergedBy: 'dora', commits: 30, additions: 2_000, deletions: 400, omniSigned: true, base: 'main', head: 'develop',
  };
}

/** Loop health's rows (PRD 714 s2, s3): a feature pull request labelled omni:needs-fix, open for two days,
 * a feature pull request whose run ended held, open for a day, and a sub-PR claimed three hours ago with
 * nothing beyond its claim commit. */
function stuckOf(now: Date): PullRequestRow[] {
  const at = (hours: number) => new Date(now.getTime() - hours * HOUR).toISOString();
  return [
    {
      repo: TRACKED[0], number: 500, author: 'ada', authorIsBot: false, openedAt: at(48), mergedAt: null, closedAt: null, mergedBy: null,
      commits: 9, additions: 400, deletions: 30, omniSigned: true, base: 'main', head: 'feat/demo-stuck', draft: false, labels: ['omni:feature', 'omni:needs-fix'],
      headCommittedAt: at(20),
    },
    {
      repo: TRACKED[0], number: 502, author: 'carl', authorIsBot: false, openedAt: at(26), mergedAt: null, closedAt: null, mergedBy: null,
      commits: 14, additions: 820, deletions: 95, omniSigned: true, base: 'main', head: 'feat/demo-held', draft: false, labels: ['omni:feature'],
      headCommittedAt: at(5), statusState: 'stuck',
    },
    {
      repo: TRACKED[1], number: 501, author: 'bob', authorIsBot: false, openedAt: at(3), mergedAt: null, closedAt: null, mergedBy: null,
      commits: 1, additions: 0, deletions: 0, omniSigned: true, base: 'feat/demo-cold', head: 'feat/demo-cold--s2', draft: true, labels: [],
      headCommittedAt: at(3),
    },
  ];
}

function reviewOf(i: number, now: Date): ReviewRow {
  return { repo: TRACKED[i % 2], number: 100 + i, reviewer: person(i + 1), firstAt: new Date(openedAt(i, now).getTime() + HOUR).toISOString() };
}

function rows(now: Date): { pullRequests: PullRequestRow[]; reviews: ReviewRow[] } {
  const all = Array.from({ length: 90 }, (_, i) => i);
  const subs = Array.from({ length: 200 }, (_, i) => subPrOf(i, now));
  const promotions = Array.from({ length: 7 }, (_, i) => promotionOf(i, now));
  return { pullRequests: [...all.map((i) => pullRequestOf(i, now)), ...subs, ...promotions, ...stuckOf(now)], reviews: all.map((i) => reviewOf(i, now)) };
}

export function demoEngineeringBoard(period: Period, sort: SortKey, now: Date): EngineeringBoard;
export function demoEngineeringBoard(period: Period, sort: SortKey, now: Date, repo: string): EngineeringBoard | { kind: 'not-tracked' };
export function demoEngineeringBoard(period: Period, sort: SortKey, now: Date, repo?: string): EngineeringBoard | { kind: 'not-tracked' } {
  const found = repo === undefined ? undefined : TRACKED.find((r) => r.toLowerCase() === repo.toLowerCase());
  if (repo !== undefined && !found) return { kind: 'not-tracked' };
  const board = engineeringOf({ tracked: found ? [found] : TRACKED, ...rows(now) }, periodWindow(period, now), sort, now);
  return { kind: 'board', name: 'Demo workspace', board: withPeople(board, DEMO_PEOPLE), ...(found ? { repo: found } : {}) };
}
