import { periodWindow, type Period } from '../dashboard/board/period';
import { withFaces, type FacePlayer } from './faces';
import type { EngineeringBoard } from './load';
import { engineeringOf, OMNI_MAN, type PullRequestRow, type ReviewRow, type SortKey } from './tally';

// The demo's Engineering board (PRD 612 s3), for development and OMNI_LOOP_DEMO=1: two tracked
// repositories and a month and a half of made-up pull requests and reviews, counted as a workspace's
// would be, with a player or two for their heroes. Fixed: the same `now` draws the same board. Given a
// repository (PRD 645 s2), that repository's page: the board over it alone, or not tracked.

const TRACKED = ['acme/widgets', 'acme/gears'];
const PEOPLE = ['ada', 'bob', 'carl', 'dora', 'eli', 'fay'];
const HOUR = 3_600_000;

/** The demo's players, so both kinds of face show: ada and dora draw their heroes (ada in her fleet's
 * colour, dora with no fleet), everyone else their GitHub picture. */
const PLAYERS: FacePlayer[] = [
  { login: 'ada', hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 }, color: '#e0457b' },
  { login: 'dora', hero: { v: 1, body: 'boy', skin: 2, hair: 1, suit: 1, cape: 0 }, color: null },
];

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
  };
}

function reviewOf(i: number, now: Date): ReviewRow {
  return { repo: TRACKED[i % 2], number: 100 + i, reviewer: person(i + 1), firstAt: new Date(openedAt(i, now).getTime() + HOUR).toISOString() };
}

function rows(now: Date): { pullRequests: PullRequestRow[]; reviews: ReviewRow[] } {
  const all = Array.from({ length: 90 }, (_, i) => i);
  return { pullRequests: all.map((i) => pullRequestOf(i, now)), reviews: all.map((i) => reviewOf(i, now)) };
}

export function demoEngineeringBoard(period: Period, sort: SortKey, now: Date): EngineeringBoard;
export function demoEngineeringBoard(period: Period, sort: SortKey, now: Date, repo: string): EngineeringBoard | { kind: 'not-tracked' };
export function demoEngineeringBoard(period: Period, sort: SortKey, now: Date, repo?: string): EngineeringBoard | { kind: 'not-tracked' } {
  const found = repo === undefined ? undefined : TRACKED.find((r) => r.toLowerCase() === repo.toLowerCase());
  if (repo !== undefined && !found) return { kind: 'not-tracked' };
  const board = engineeringOf({ tracked: found ? [found] : TRACKED, ...rows(now) }, periodWindow(period, now), sort);
  return { kind: 'board', name: 'Demo workspace', board: withFaces(board, PLAYERS), ...(found ? { repo: found } : {}) };
}
