import { describe, expect, it } from 'vitest';
import { periodWindow } from './period';
import {
  circleOf, inCircle, inPeriod, mergesPerDay, peopleRows, prdEventsPerDay, repositoriesOf, stageCounts, tilesOf,
  type Activity, type Member,
} from './tally';

// The board's pure functions (PRD 572): who is in the scope, what of the workspace's contributions
// falls in the period, and every number the tiles, the charts, the repositories and the People table
// show. Logins match ignoring case; a merge by a GitHub author who is not a member counts in the
// workspace's totals and gets no row.

/** Saturday 26 September 2026, noon in Brussels. */
const NOW = new Date('2026-09-26T10:00:00Z');
const WEEK = periodWindow('7d', NOW);

const member = (userId: string, login: string | null, fleet: string | null, name: string | null = null): Member =>
  ({ userId, name, login, avatarUrl: null, fleet });
const ROSTER: Member[] = [
  member('u-ada', 'ada-gh', 'octo', 'ADA'),
  member('u-paul', 'paetienne', 'octo', 'Paul Etienne'),
  member('u-sol', 'sol-gh', null, 'SOL'),
  member('u-nog', null, 'octo', 'No Github'),
  member('u-bob', 'bob-gh', 'beaver', 'BOB'),
];
const act = (kind: string, login: string, at: string, repo = 'vertuo-core', number = 1): Activity => ({ kind, repo, number, login, at });

describe('circleOf and inCircle: who the scope holds', () => {
  it('you: your login, ignoring case, and your account', () => {
    const c = circleOf({ kind: 'you', userId: 'u-ada', login: 'Ada-GH' }, ROSTER);
    expect(inCircle(c, act('pr-merged', 'ADA-gh', '2026-09-26T08:00:00Z'))).toBe(true);
    expect(inCircle(c, act('pr-merged', 'paetienne', '2026-09-26T08:00:00Z'))).toBe(false);
    expect(c.userIds).toEqual(new Set(['u-ada']));
  });

  it('you with no login: no activity, still your account for the questions', () => {
    const c = circleOf({ kind: 'you', userId: 'u-nog', login: null }, ROSTER);
    expect(inCircle(c, act('pr-merged', 'ada-gh', '2026-09-26T08:00:00Z'))).toBe(false);
    expect(c.userIds).toEqual(new Set(['u-nog']));
  });

  it('a fleet: the logins and accounts of the roster members in it', () => {
    const c = circleOf({ kind: 'fleet', fleet: 'octo' }, ROSTER);
    expect(c.logins).toEqual(new Set(['ada-gh', 'paetienne']));
    expect(c.userIds).toEqual(new Set(['u-ada', 'u-paul', 'u-nog']));
    expect(inCircle(c, act('pr-merged', 'PaEtienne', '2026-09-26T08:00:00Z'))).toBe(true);
    expect(inCircle(c, act('pr-merged', 'bob-gh', '2026-09-26T08:00:00Z'))).toBe(false);
  });

  it('the workspace: every row, a non-member\'s included', () => {
    const c = circleOf({ kind: 'workspace' }, ROSTER);
    expect(inCircle(c, act('pr-merged', 'stranger', '2026-09-26T08:00:00Z'))).toBe(true);
    expect(c.userIds).toBe('all');
  });
});

describe('inPeriod', () => {
  it('keeps the rows whose Brussels day is one of the period\'s, with that day', () => {
    const rows = [
      act('pr-merged', 'ada-gh', '2026-09-19T21:59:59Z'), // 19 Sept, 23:59 in Brussels: before
      act('pr-merged', 'ada-gh', '2026-09-19T22:00:00Z'), // 20 Sept, 00:00: the first day
      act('pr-merged', 'ada-gh', '2026-09-26T21:00:00Z'), // today, 23:00
      act('pr-merged', 'ada-gh', '2026-09-26T22:00:00Z'), // tomorrow
      act('pr-merged', 'ada-gh', 'garbled'),
    ];
    expect(inPeriod(rows, WEEK).map((r) => r.day)).toEqual(['2026-09-20', '2026-09-26']);
  });
});

describe('the charts', () => {
  const rows = inPeriod([
    act('pr-merged', 'ada-gh', '2026-09-26T08:00:00Z'),
    act('pr-merged', 'bob-gh', '2026-09-26T09:00:00Z', 'vertuo-api', 2),
    act('pr-merged', 'ada-gh', '2026-09-20T08:00:00Z'),
    act('prd-opened', 'ada-gh', '2026-09-24T08:00:00Z', 'vertuo-omni-loop', 12),
    act('prd-started', 'ada-gh', '2026-09-24T09:00:00Z', 'vertuo-omni-loop', 12),
    act('prd-shipped', 'ada-gh', '2026-09-26T09:00:00Z', 'vertuo-omni-loop', 12),
    act('prd-opened', 'bob-gh', '2026-09-26T09:00:00Z', 'vertuo-omni-loop', 13),
  ], WEEK);

  it('PRs merged per day: every day of the period, 0s kept, today last', () => {
    expect(mergesPerDay(rows, WEEK.days)).toEqual([
      { date: '2026-09-20', count: 1 }, { date: '2026-09-21', count: 0 }, { date: '2026-09-22', count: 0 },
      { date: '2026-09-23', count: 0 }, { date: '2026-09-24', count: 0 }, { date: '2026-09-25', count: 0 },
      { date: '2026-09-26', count: 2 },
    ]);
  });

  it('PRD events per day, by stage', () => {
    const days = prdEventsPerDay(rows, WEEK.days);
    expect(days).toHaveLength(7);
    expect(days.find((d) => d.date === '2026-09-24')).toEqual({ date: '2026-09-24', drafted: 1, inProgress: 1, shipped: 0 });
    expect(days.at(-1)).toEqual({ date: '2026-09-26', drafted: 1, inProgress: 0, shipped: 1 });
    expect(days[0]).toEqual({ date: '2026-09-20', drafted: 0, inProgress: 0, shipped: 0 });
  });

  it('stage counts: drafted, in progress, shipped', () => {
    expect(stageCounts(rows)).toEqual({ drafted: 2, inProgress: 1, shipped: 1 });
    expect(stageCounts([])).toEqual({ drafted: 0, inProgress: 0, shipped: 0 });
  });

  it('repositories involved: each with its PRs and PRD events, most active first, then by name', () => {
    expect(repositoriesOf(rows)).toEqual([
      { repo: 'vertuo-omni-loop', prs: 0, prdEvents: 4 },
      { repo: 'vertuo-core', prs: 2, prdEvents: 0 },
      { repo: 'vertuo-api', prs: 1, prdEvents: 0 },
    ]);
  });

  it('the tiles: PRs merged, PRDs by stage, repositories, questions answered', () => {
    expect(tilesOf(rows, 4)).toEqual({ prs: 3, prds: { drafted: 2, inProgress: 1, shipped: 1 }, repositories: 3, answered: 4 });
  });

  it('an unknown kind counts for nothing', () => {
    const odd = inPeriod([act('pr-opened', 'ada-gh', '2026-09-26T08:00:00Z')], WEEK);
    expect(tilesOf(odd, 0)).toEqual({ prs: 0, prds: { drafted: 0, inProgress: 0, shipped: 0 }, repositories: 0, answered: 0 });
  });
});

describe('peopleRows', () => {
  const rows = inPeriod([
    ...Array.from({ length: 7 }, (_, i) => act('pr-merged', 'PaEtienne', '2026-09-25T08:00:00Z', 'vertuo-ai-domain', 100 + i)),
    act('pr-merged', 'ada-gh', '2026-09-25T08:00:00Z', 'vertuo-core', 5),
    act('prd-opened', 'ada-gh', '2026-09-25T08:00:00Z', 'vertuo-omni-loop', 12),
    act('pr-merged', 'stranger', '2026-09-25T08:00:00Z', 'vertuo-core', 6),
  ], WEEK);
  const FLEETS = [{ name: 'octo', label: 'OCTO', color: '#3355ff' }, { name: 'beaver', label: 'BEAVER', color: '#8a5a2b' }];
  const HEROES = [{ name: 'Ada-GH', points: 120 }, { name: 'bob-gh', points: 300 }];
  const answered = new Map([['u-paul', 9], ['u-ada', 1]]);

  it('lists every member, 0s kept: Paul, with no points, has his 7 PRs and 9 answers', () => {
    const people = peopleRows(ROSTER, { activity: rows, answered, heroes: HEROES, fleets: FLEETS }, 'u-ada');
    const paul = people.find((p) => p.userId === 'u-paul')!;
    expect(paul).toMatchObject({ name: 'Paul Etienne', prs: 7, answered: 9, points: 0, fleet: { label: 'OCTO' }, you: false });
    expect(paul.prds).toEqual({ drafted: 0, inProgress: 0, shipped: 0 });
    expect(people).toHaveLength(5);
    expect(people.find((p) => p.userId === 'u-bob')).toMatchObject({ prs: 0, points: 300, answered: 0 });
  });

  it('sorts by PRs merged, then points, then name', () => {
    const people = peopleRows(ROSTER, { activity: rows, answered, heroes: HEROES, fleets: FLEETS }, 'u-ada');
    expect(people.map((p) => p.userId)).toEqual(['u-paul', 'u-ada', 'u-bob', 'u-sol', 'u-nog']);
  });

  it('marks the viewer, reads SOLO with no fleet, and dashes the GitHub-counted columns with no login', () => {
    const people = peopleRows(ROSTER, { activity: rows, answered, heroes: HEROES, fleets: FLEETS }, 'u-ada');
    expect(people.filter((p) => p.you).map((p) => p.userId)).toEqual(['u-ada']);
    expect(people.find((p) => p.userId === 'u-sol')!.fleet).toBe('solo');
    expect(people.find((p) => p.userId === 'u-nog')).toMatchObject({ prs: null, prds: null, points: null, answered: 0 });
  });

  it('names a member by their name, else their login, else as a member', () => {
    const people = peopleRows([member('a', 'x-gh', null), member('b', null, null)], { activity: [], answered: new Map(), heroes: [], fleets: [] }, null);
    expect(people.map((p) => p.name).sort()).toEqual(['A member', 'x-gh']);
  });

  it('a fleet the galaxy does not know still shows, by its name in capitals', () => {
    const people = peopleRows([member('a', 'x-gh', 'ghost')], { activity: [], answered: new Map(), heroes: [], fleets: [] }, null);
    expect(people[0].fleet).toEqual({ name: 'ghost', label: 'GHOST', color: null });
  });

  it('a column whose read failed reads unreadable for everyone, and the rest still count', () => {
    const people = peopleRows(ROSTER, { activity: 'unreadable', answered, heroes: 'unreadable', fleets: FLEETS }, null);
    const paul = people.find((p) => p.userId === 'u-paul')!;
    expect(paul).toMatchObject({ prs: 'unreadable', prds: 'unreadable', points: 'unreadable', answered: 9 });
    expect(people.find((p) => p.userId === 'u-nog')).toMatchObject({ prs: null, points: null });
  });
});
