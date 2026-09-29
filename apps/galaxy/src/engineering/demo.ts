import { periodWindow, type Period } from '../dashboard/board/period';
import type { EngineeringBoard } from './load';
import { engineeringOf, OMNI_MAN, type PullRequestRow, type ReviewRow, type SortKey } from './tally';

// The demo's Engineering board (PRD 612 s3), for development and OMNI_LOOP_DEMO=1: two tracked
// repositories and a month and a half of made-up pull requests and reviews, counted as a workspace's
// would be. Fixed: the same `now` draws the same board.

const TRACKED = ['acme/widgets', 'acme/gears'];
const PEOPLE = ['ada', 'bob', 'carl', 'dora', 'eli', 'fay'];
const HOUR = 3_600_000;

function rows(now: Date): { pullRequests: PullRequestRow[]; reviews: ReviewRow[] } {
  const pullRequests: PullRequestRow[] = [];
  const reviews: ReviewRow[] = [];
  for (let i = 0; i < 90; i++) {
    const repo = TRACKED[i % 2];
    const opened = new Date(now.getTime() - (i * 11 + 3) * HOUR);
    const signed = i % 3 === 0;
    const open = i % 7 === 0;
    const merged = open ? null : new Date(opened.getTime() + (signed ? 2 + (i % 5) : 6 + (i % 23)) * HOUR);
    const author = signed && i % 6 === 0 ? OMNI_MAN : PEOPLE[i % PEOPLE.length];
    pullRequests.push({
      repo, number: 100 + i, author, authorIsBot: author === OMNI_MAN, openedAt: opened.toISOString(),
      mergedAt: merged && merged < now ? merged.toISOString() : null, closedAt: merged && merged < now ? merged.toISOString() : null,
      mergedBy: merged ? PEOPLE[(i + 2) % PEOPLE.length] : null, commits: 1 + (i % 6), additions: 20 + ((i * 37) % 400), deletions: 5 + ((i * 13) % 120), omniSigned: signed,
    });
    reviews.push({ repo, number: 100 + i, reviewer: PEOPLE[(i + 1) % PEOPLE.length], firstAt: new Date(opened.getTime() + HOUR).toISOString() });
  }
  return { pullRequests, reviews };
}

export function demoEngineeringBoard(period: Period, sort: SortKey, now: Date): EngineeringBoard {
  return { kind: 'board', name: 'Demo workspace', board: engineeringOf({ tracked: TRACKED, ...rows(now) }, periodWindow(period, now), sort) };
}
