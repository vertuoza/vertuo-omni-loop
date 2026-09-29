import { describe, expect, it } from 'vitest';
import { periodWindow } from '../dashboard/board/period';
import {
  OMNI_MAN, durationWords, engineeringOf, isBot, median, sortOf, topFive,
  type EngineeringRead, type PullRequestRow, type ReviewRow,
} from './tally';

// The Engineering board's math (PRD 612 s3), pure: the spec's counting rules over the rows the
// collector wrote, for tracked repositories only, within a period's window.

const NOW = new Date('2026-09-26T10:00:00Z');
const WEEK = periodWindow('7d', NOW); // 20 → 26 September, Brussels days
const HOUR = 3_600_000;

let serial = 0;
const pr = (over: Partial<PullRequestRow> = {}): PullRequestRow => ({
  repo: 'acme/widgets', number: ++serial, author: 'ada', authorIsBot: false,
  openedAt: '2026-09-24T08:00:00Z', mergedAt: null, closedAt: null, mergedBy: null,
  commits: 0, additions: 0, deletions: 0, omniSigned: false, ...over,
});
const merged = (hours: number, over: Partial<PullRequestRow> = {}) =>
  pr({ openedAt: '2026-09-24T08:00:00Z', mergedAt: new Date(Date.parse('2026-09-24T08:00:00Z') + hours * HOUR).toISOString(), closedAt: new Date(Date.parse('2026-09-24T08:00:00Z') + hours * HOUR).toISOString(), mergedBy: 'bob', ...over });
const review = (over: Partial<ReviewRow> = {}): ReviewRow => ({ repo: 'acme/widgets', number: 1, reviewer: 'carl', firstAt: '2026-09-25T08:00:00Z', ...over });
const read = (over: Partial<EngineeringRead> = {}): EngineeringRead => ({ tracked: ['acme/widgets', 'acme/gears'], pullRequests: [], reviews: [], ...over });
const board = (r: EngineeringRead, sort = sortOf(null)) => {
  const value = engineeringOf(r, WEEK, sort);
  if (value.kind !== 'board') throw new Error('expected a board');
  return value;
};

describe('median', () => {
  it('is the middle one of an odd count', () => expect(median([5, 1, 3])).toBe(3));
  it('is the mean of the two middle ones of an even count', () => expect(median([4, 1, 3, 10])).toBe(3.5));
  it('is null for none', () => expect(median([])).toBeNull());
});

describe('durationWords', () => {
  it('says minutes under an hour, hours under two days, days past that', () => {
    expect(durationWords(42 * 60_000)).toBe('42 min');
    expect(durationWords(4.1 * HOUR)).toBe('4.1 h');
    expect(durationWords(19.64 * HOUR)).toBe('19.6 h');
    expect(durationWords(72 * HOUR)).toBe('3.0 d');
  });
  it('says a dash for none', () => expect(durationWords(null)).toBe('–'));
});

describe('isBot', () => {
  it('is a login ending in [bot], in any case', () => {
    expect(isBot('dependabot[bot]')).toBe(true);
    expect(isBot('Renovate[BOT]')).toBe(true);
    expect(isBot(OMNI_MAN)).toBe(true);
    expect(isBot('ada')).toBe(false);
    expect(isBot(null)).toBe(false);
  });
});

describe('the tiles', () => {
  it('count opened by opened_at in the period, merged by merged_at in the period, open now whatever the period', () => {
    const rows = [
      pr({ openedAt: '2026-09-21T08:00:00Z' }), // opened in, open now
      pr({ openedAt: '2026-08-01T08:00:00Z' }), // opened before, open now
      pr({ openedAt: '2026-08-01T08:00:00Z', mergedAt: '2026-09-22T08:00:00Z', closedAt: '2026-09-22T08:00:00Z', mergedBy: 'bob' }), // merged in
      pr({ openedAt: '2026-09-22T08:00:00Z', closedAt: '2026-09-23T08:00:00Z' }), // opened in, closed unmerged
      pr({ openedAt: '2026-08-01T08:00:00Z', mergedAt: '2026-08-02T08:00:00Z', closedAt: '2026-08-02T08:00:00Z' }), // nothing in
    ];
    const { tiles } = board(read({ pullRequests: rows }));
    expect(tiles.opened).toBe(2);
    expect(tiles.merged).toBe(1);
    expect(tiles.openNow).toBe(2);
  });

  it('take the median time to merge over the PRs merged in the period, and sum their commits and lines', () => {
    const rows = [
      merged(2, { commits: 1, additions: 10, deletions: 1 }),
      merged(4, { commits: 2, additions: 20, deletions: 2 }),
      merged(9, { commits: 3, additions: 30, deletions: 3 }),
      pr({ commits: 50, additions: 500, deletions: 50 }), // open: none of its commits count
    ];
    const { tiles } = board(read({ pullRequests: rows }));
    expect(tiles.medianToMerge).toBe(4 * HOUR);
    expect(tiles.commits).toBe(6);
    expect(tiles.additions).toBe(60);
    expect(tiles.deletions).toBe(6);
  });

  it('count a bot\'s pull requests too', () => {
    const { tiles } = board(read({ pullRequests: [pr({ author: 'dependabot[bot]', authorIsBot: true })] }));
    expect(tiles.opened).toBe(1);
  });

  it('have no median with nothing merged', () => {
    expect(board(read({ pullRequests: [pr()] })).tiles.medianToMerge).toBeNull();
  });
});

describe('an untracked repository', () => {
  it('counts nowhere on the board: tiles, table, people, Omni Loop, chart', () => {
    const rows = [merged(3, { repo: 'acme/old', author: 'zed', mergedBy: 'zed', omniSigned: true, commits: 9 })];
    const value = board(read({ tracked: ['acme/widgets'], pullRequests: rows, reviews: [review({ repo: 'acme/old', number: rows[0].number, reviewer: 'zed' })] }));
    expect(value.tiles).toMatchObject({ opened: 0, merged: 0, openNow: 0, commits: 0 });
    expect(value.repositories.map((r) => r.repo)).toEqual(['acme/widgets']);
    expect(value.people).toEqual({ opened: [], merged: [], reviews: [] });
    expect(value.omni.merged).toBe(0);
    expect(value.perDay.every((d) => d.signed + d.rest === 0)).toBe(true);
  });
});

describe('the per-repository table', () => {
  it('lists every tracked repository, a 0 as 0, with the same counts as the tiles', () => {
    const rows = [merged(2, { repo: 'acme/gears', commits: 2, additions: 5, deletions: 1 }), pr({ repo: 'acme/gears' })];
    const value = board(read({ pullRequests: rows }));
    expect(value.repositories).toEqual([
      { repo: 'acme/gears', opened: 2, merged: 1, openNow: 1, medianToMerge: 2 * HOUR, commits: 2, lines: 6 },
      { repo: 'acme/widgets', opened: 0, merged: 0, openNow: 0, medianToMerge: null, commits: 0, lines: 0 },
    ]);
  });

  it('sorts by the column asked, most first, the name breaking ties; by merged when none is asked', () => {
    const rows = [pr({ repo: 'acme/widgets' }), pr({ repo: 'acme/widgets' }), merged(1, { repo: 'acme/gears' })];
    expect(board(read({ pullRequests: rows }), sortOf('opened')).repositories.map((r) => r.repo)).toEqual(['acme/widgets', 'acme/gears']);
    expect(board(read({ pullRequests: rows })).repositories.map((r) => r.repo)).toEqual(['acme/gears', 'acme/widgets']);
    expect(board(read({ pullRequests: rows }), sortOf('repo')).repositories.map((r) => r.repo)).toEqual(['acme/gears', 'acme/widgets']);
    expect(sortOf('nonsense')).toBe('merged');
  });

  it('puts a repository with no median last when sorted by time to merge', () => {
    const rows = [merged(2, { repo: 'acme/gears' })];
    expect(board(read({ pullRequests: rows }), sortOf('time')).repositories.map((r) => r.repo)).toEqual(['acme/gears', 'acme/widgets']);
  });
});

describe('the three top-5 lists', () => {
  it('credit opened to the author, merged to who pressed Merge, reviews to the reviewer', () => {
    const a = merged(1, { author: 'ada', mergedBy: 'bob' });
    const value = board(read({ pullRequests: [a], reviews: [review({ number: a.number, reviewer: 'carl' })] }));
    expect(value.people.opened).toEqual([{ login: 'ada', count: 1 }]);
    expect(value.people.merged).toEqual([{ login: 'bob', count: 1 }]);
    expect(value.people.reviews).toEqual([{ login: 'carl', count: 1 }]);
  });

  it('hold at most five, most first, ties in login order', () => {
    const rows = ['fay', 'eve', 'dan', 'cid', 'bea', 'abe', 'abe'].map((author) => pr({ author }));
    expect(board(read({ pullRequests: rows })).people.opened).toEqual([
      { login: 'abe', count: 2 }, { login: 'bea', count: 1 }, { login: 'cid', count: 1 }, { login: 'dan', count: 1 }, { login: 'eve', count: 1 },
    ]);
  });

  it('leave out bots and Omni-man, whose work still counts in the tiles', () => {
    const rows = [
      pr({ author: 'dependabot[bot]', authorIsBot: true }),
      pr({ author: 'robo', authorIsBot: true }),
      pr({ author: OMNI_MAN, authorIsBot: true, omniSigned: true }),
      merged(1, { author: 'ada', mergedBy: OMNI_MAN }),
    ];
    const value = board(read({ pullRequests: rows, reviews: [review({ reviewer: 'github-actions[bot]' }), review({ reviewer: OMNI_MAN, number: 2 })] }));
    expect(value.people.opened).toEqual([{ login: 'ada', count: 1 }]);
    expect(value.people.merged).toEqual([]);
    expect(value.people.reviews).toEqual([]);
    expect(value.tiles.opened).toBe(4);
  });

  it('keep a signed PR\'s credit with the person who opened it', () => {
    expect(board(read({ pullRequests: [pr({ author: 'ada', omniSigned: true })] })).people.opened).toEqual([{ login: 'ada', count: 1 }]);
  });

  it('count a review by its first date, and never one by the PR\'s author', () => {
    const a = pr({ author: 'ada' });
    const value = board(read({
      pullRequests: [a],
      reviews: [review({ number: a.number, reviewer: 'ada' }), review({ number: a.number, reviewer: 'bob', firstAt: '2026-08-01T08:00:00Z' }), review({ number: a.number, reviewer: 'carl' })],
    }));
    expect(value.people.reviews).toEqual([{ login: 'carl', count: 1 }]);
  });

  it('topFive ranks counts by login', () => {
    expect(topFive(['b', 'a', 'b', null])).toEqual([{ login: 'b', count: 2 }, { login: 'a', count: 1 }]);
  });
});

describe('the Omni Loop panel', () => {
  it('shows the share of merged PRs Omni-man signed, both medians and the signed PRs\' lines', () => {
    const rows = [
      merged(2, { omniSigned: true, additions: 10, deletions: 4 }),
      merged(4, { omniSigned: true, additions: 1, deletions: 1 }),
      merged(20),
      merged(30),
      pr({ omniSigned: true }), // open: not merged, not counted
    ];
    expect(board(read({ pullRequests: rows })).omni).toEqual({
      merged: 2, of: 4, share: 50, medianSigned: 3 * HOUR, medianRest: 25 * HOUR, additions: 11, deletions: 5,
    });
  });

  it('has no share with nothing merged', () => {
    expect(board(read()).omni).toEqual({ merged: 0, of: 0, share: null, medianSigned: null, medianRest: null, additions: 0, deletions: 0 });
  });
});

describe('merged per day', () => {
  it('has a column per day of the period, the signed part apart, on the Brussels day of the merge', () => {
    const rows = [
      pr({ mergedAt: '2026-09-25T22:30:00Z', omniSigned: true }), // 26 September in Brussels
      pr({ mergedAt: '2026-09-26T08:00:00Z' }),
      pr({ mergedAt: '2026-09-20T08:00:00Z' }),
    ];
    const days = board(read({ pullRequests: rows })).perDay;
    expect(days.map((d) => d.date)).toEqual(WEEK.days);
    expect(days.at(-1)).toEqual({ date: '2026-09-26', signed: 1, rest: 1 });
    expect(days[0]).toEqual({ date: '2026-09-20', signed: 0, rest: 1 });
  });
});

describe('the period', () => {
  it('bounds 7d, 30d and season as the other boards do', () => {
    const at = (period: '7d' | '30d' | 'season') => {
      const w = periodWindow(period, NOW);
      return [w.days[0], w.days.at(-1), w.days.length];
    };
    expect(at('7d')).toEqual(['2026-09-20', '2026-09-26', 7]);
    expect(at('30d')).toEqual(['2026-08-28', '2026-09-26', 30]);
    expect(at('season')).toEqual(['2026-09-01', '2026-09-26', 26]);
  });

  it('counts a PR merged just before the window\'s first instant nowhere, one at it in', () => {
    const before = new Date(WEEK.from.getTime() - 1).toISOString();
    const first = WEEK.from.toISOString();
    const value = board(read({ pullRequests: [pr({ mergedAt: before, openedAt: before }), pr({ mergedAt: first, openedAt: first })] }));
    expect(value.tiles.merged).toBe(1);
    expect(value.tiles.opened).toBe(1);
  });
});

describe('no tracked repository', () => {
  it('is the empty state, whatever rows are left', () => {
    expect(engineeringOf(read({ tracked: [], pullRequests: [pr()] }), WEEK, 'merged')).toEqual({ kind: 'empty', window: WEEK });
  });
});

describe('one repository (PRD 645 s2)', () => {
  it('fed one tracked repository, counts only its pull requests and reviews: tiles, people, the Omni panel and per day', () => {
    const gears = merged(4, { repo: 'acme/gears', author: 'ada', mergedBy: 'bob', commits: 3, additions: 7, deletions: 2, omniSigned: true });
    const widgets = merged(20, { repo: 'acme/widgets', author: 'carl', mergedBy: 'dora', commits: 9, additions: 100, deletions: 50 });
    const rows = [gears, pr({ repo: 'Acme/Gears', author: 'eli' }), widgets, pr({ repo: 'acme/widgets', author: 'fay' })];
    const reviews = [
      review({ repo: 'acme/gears', number: gears.number, reviewer: 'carl' }),
      review({ repo: 'acme/widgets', number: widgets.number, reviewer: 'bob' }),
    ];
    const b = board(read({ tracked: ['Acme/Gears'], pullRequests: rows, reviews }));
    expect(b.tiles).toEqual({ opened: 2, merged: 1, openNow: 1, medianToMerge: 4 * HOUR, commits: 3, additions: 7, deletions: 2 });
    expect(b.people.opened.map((p) => p.login)).toEqual(['ada', 'eli']);
    expect(b.people.merged).toEqual([{ login: 'bob', count: 1 }]);
    expect(b.people.reviews).toEqual([{ login: 'carl', count: 1 }]);
    expect(b.omni).toMatchObject({ merged: 1, of: 1, share: 100, additions: 7, deletions: 2 });
    expect(b.perDay.reduce((s, d) => s + d.signed + d.rest, 0)).toBe(1);
    expect(b.repositories.map((r) => r.repo)).toEqual(['acme/gears']);
  });
});
