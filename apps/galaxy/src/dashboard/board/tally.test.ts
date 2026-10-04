import { describe, expect, it } from 'vitest';
import { STAGES } from '../../stages/stage';
import { periodWindow } from './period';
import {
  circleOf, eventCounts, groupsOf, inCircle, inPeriod, mergesPerDay, openedBy, peopleRows, perStage, prdEventsPerDay, prdsNow, repositoriesOf, stageTally, tilesOf,
  type Activity, type Member, type PrdNow,
} from './tally';
import { sure } from '../../arcade/test/sure';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

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

  it('PRD events per day: opened, started, shipped', () => {
    const days = prdEventsPerDay(rows, WEEK.days);
    expect(days).toHaveLength(7);
    expect(days.find((d) => d.date === '2026-09-24')).toEqual({ date: '2026-09-24', opened: 1, started: 1, shipped: 0 });
    expect(days.at(-1)).toEqual({ date: '2026-09-26', opened: 1, started: 0, shipped: 1 });
    expect(days[0]).toEqual({ date: '2026-09-20', opened: 0, started: 0, shipped: 0 });
  });

  it('event counts: opened, started, shipped', () => {
    expect(eventCounts(rows)).toEqual({ opened: 2, started: 1, shipped: 1 });
    expect(eventCounts([])).toEqual({ opened: 0, started: 0, shipped: 0 });
  });

  it('repositories involved: each with its PRs and PRD events, most active first, then by name', () => {
    expect(repositoriesOf(rows)).toEqual([
      { repo: 'vertuo-omni-loop', prs: 0, prdEvents: 4 },
      { repo: 'vertuo-core', prs: 2, prdEvents: 0 },
      { repo: 'vertuo-api', prs: 1, prdEvents: 0 },
    ]);
  });

  it('the tiles: PRs merged, PRDs by their stage now, repositories, questions answered', () => {
    const prds: PrdNow[] = [{ stage: 'shipped', login: 'ada-gh', userId: null }, { stage: 'inbox', login: null, userId: null }];
    expect(tilesOf(rows, 4, prds)).toEqual({
      prs: 3, prds: { idea: 0, prd: 0, inbox: 1, building: 0, outbox: 0, shipped: 1, retro: 0 }, repositories: 3, answered: 4,
    });
  });

  it('an unknown kind counts for nothing', () => {
    const odd = inPeriod([act('pr-opened', 'ada-gh', '2026-09-26T08:00:00Z')], WEEK);
    expect(tilesOf(odd, 0, [])).toMatchObject({ prs: 0, repositories: 0, answered: 0 });
  });
});

describe('peopleRows', () => {
  const rows = inPeriod([
    ...Array.from({ length: 7 }, (_, i) => act('pr-merged', 'PaEtienne', '2026-09-25T08:00:00Z', 'vertuo-ai-domain', 100 + i)),
    act('pr-merged', 'ada-gh', '2026-09-25T08:00:00Z', 'vertuo-core', 5),
    act('prd-opened', 'ada-gh', '2026-09-25T08:00:00Z', 'vertuo-omni-loop', 12),
    act('pr-merged', 'stranger', '2026-09-25T08:00:00Z', 'vertuo-core', 6),
  ], WEEK);
  const FLEETS = [{ name: 'octo', label: 'OCTO', color: '#3355ff', mascot: null }, { name: 'beaver', label: 'BEAVER', color: '#8a5a2b', mascot: 'beaver' }];
  const HEROES = [{ name: 'Ada-GH', points: 120 }, { name: 'bob-gh', points: 300 }];
  const answered = new Map([['u-paul', 9], ['u-ada', 1]]);
  const PRDS: PrdNow[] = [
    { stage: 'prd', login: 'ada-gh', userId: null },
    { stage: 'outbox', login: 'ADA-gh', userId: null },
    { stage: 'shipped', login: 'ada-gh', userId: null },
    { stage: 'retro', login: 'ada-gh', userId: null },
    { stage: 'idea', login: null, userId: 'u-nog' },
    { stage: 'shipped', login: 'stranger', userId: null },
  ];
  const input = (over: Partial<Parameters<typeof peopleRows>[1]> = {}) =>
    ({ activity: rows, answered, heroes: HEROES, fleets: FLEETS, prds: PRDS, ...over });

  it('lists every member, 0s kept: Paul, with no points, has his 7 PRs and 9 answers', () => {
    const people = peopleRows(ROSTER, input(), 'u-ada');
    const paul = sure(people.find((p) => p.userId === 'u-paul'), 'the item found');
    expect(paul).toMatchObject({ name: 'Paul Etienne', prs: 7, answered: 9, points: 0, fleet: { label: 'OCTO' }, you: false });
    expect(paul.prds).toEqual({ open: 0, building: 0, shipped: 0 });
    expect(people).toHaveLength(5);
    expect(people.find((p) => p.userId === 'u-bob')).toMatchObject({ prs: 0, points: 300, answered: 0 });
  });

  it('sorts by PRs merged, then points, then name', () => {
    const people = peopleRows(ROSTER, input(), 'u-ada');
    expect(people.map((p) => p.userId)).toEqual(['u-paul', 'u-ada', 'u-bob', 'u-sol', 'u-nog']);
  });

  it('marks the viewer, reads SOLO with no fleet, and dashes the GitHub-counted columns with no login', () => {
    const people = peopleRows(ROSTER, input(), 'u-ada');
    expect(people.filter((p) => p.you).map((p) => p.userId)).toEqual(['u-ada']);
    expect(sure(people.find((p) => p.userId === 'u-sol'), 'the item found').fleet).toBe('solo');
    expect(people.find((p) => p.userId === 'u-nog')).toMatchObject({ prs: null, points: null, answered: 0 });
  });

  it('PRDs now: the PRDs each person opened, by login or by account, as open · building · shipped', () => {
    const people = peopleRows(ROSTER, input(), 'u-ada');
    expect(sure(people.find((p) => p.userId === 'u-ada'), 'the item found').prds).toEqual({ open: 1, building: 1, shipped: 2 });
    expect(sure(people.find((p) => p.userId === 'u-nog'), 'the item found').prds).toEqual({ open: 1, building: 0, shipped: 0 });
    expect(sure(people.find((p) => p.userId === 'u-bob'), 'the item found').prds).toEqual({ open: 0, building: 0, shipped: 0 });
  });

  it('names a member by their name, else their login, else as a member', () => {
    const people = peopleRows([member('a', 'x-gh', null), member('b', null, null)], { activity: [], answered: new Map(), heroes: [], fleets: [], prds: [] }, null);
    expect(people.map((p) => p.name).sort()).toEqual(['A member', 'x-gh']);
  });

  it('a fleet the galaxy does not know still shows, by its name in capitals', () => {
    const people = peopleRows([member('a', 'x-gh', 'ghost')], { activity: [], answered: new Map(), heroes: [], fleets: [], prds: [] }, null);
    expect(sure(people[0], 'people[0]').fleet).toEqual({ name: 'ghost', label: 'GHOST', color: null, mascot: null });
  });

  it('a column whose read failed reads unreadable for everyone, and the rest still count', () => {
    const people = peopleRows(ROSTER, input({ activity: 'unreadable', heroes: 'unreadable', prds: 'unreadable' }), null);
    const paul = sure(people.find((p) => p.userId === 'u-paul'), 'the item found');
    expect(paul).toMatchObject({ prs: 'unreadable', prds: 'unreadable', points: 'unreadable', answered: 9 });
    expect(people.find((p) => p.userId === 'u-nog')).toMatchObject({ prs: null, points: null, prds: 'unreadable' });
  });

  it('the PRDs alone unreadable: only that column says so', () => {
    const paul = sure(peopleRows(ROSTER, input({ prds: 'unreadable' }), null).find((p) => p.userId === 'u-paul'), 'the item found');
    expect(paul).toMatchObject({ prs: 7, prds: 'unreadable' });
  });
});

describe('PRDs now (PRD 587): each PRD at its current stage, and who opened it', () => {
  const STAGES_READ = [
    { repository: 'vertuoza/vertuo-omni-loop', prd: parsePrd(12), stage: 'shipped' as const },
    { repository: 'vertuoza/vertuo-omni-loop', prd: parsePrd(13), stage: 'building' as const },
    { repository: 'vertuoza/vertuo-core', prd: parsePrd(4), stage: 'prd' as const },
  ];
  const OPENERS = [
    { repo: 'vertuo-omni-loop', number: 12, login: 'Ada-GH' },
    { repo: 'vertuo-core', number: 13, login: 'bob-gh' }, // another repository's #13
  ];
  const DOSSIERS = [
    { home_repo: 'vertuoza/vertuo-omni-loop', prd: parsePrd(13), opened_by: 'u-bob', answered: 2 },
    { home_repo: 'vertuoza/vertuo-core', prd: null, opened_by: 'u-sol', answered: 1 },
    { home_repo: 'vertuoza/vertuo-core', prd: null, opened_by: 'u-ada', answered: 0 },
  ];

  it('a stored PRD gets its opener\'s login from its prd-opened row, matched by repository name and number, and its dossier\'s opener', () => {
    expect(prdsNow({ stages: STAGES_READ, openers: OPENERS, dossiers: DOSSIERS })).toEqual([
      { stage: 'shipped', login: 'ada-gh', userId: null },
      { stage: 'building', login: null, userId: 'u-bob' },
      { stage: 'prd', login: null, userId: null },
      { stage: 'idea', login: null, userId: 'u-sol' },
    ]);
  });

  it('a draft lights idea only once a question is answered', () => {
    expect(prdsNow({ stages: [], openers: [], dossiers: DOSSIERS }).map((p) => p.userId)).toEqual(['u-sol']);
  });

  it('the tile\'s seven counts, by stage in track order; shipped and retro are never open', () => {
    const tally = stageTally(prdsNow({ stages: STAGES_READ, openers: OPENERS, dossiers: DOSSIERS }));
    expect(Object.keys(tally)).toEqual(['idea', 'prd', 'inbox', 'building', 'outbox', 'shipped', 'retro']);
    expect(tally).toEqual({ idea: 1, prd: parsePrd(1), inbox: 0, building: 1, outbox: 0, shipped: 1, retro: 0 });
    expect(groupsOf([{ stage: 'shipped', login: null, userId: null }, { stage: 'retro', login: null, userId: null }]))
      .toEqual({ open: 0, building: 0, shipped: 2 });
  });

  it('one value per stage, every stage in track order, each asked for once', () => {
    const asked: string[] = [];
    const record = perStage((stage) => { asked.push(stage); return stage.length; });
    expect(Object.keys(record)).toEqual([...STAGES]);
    expect(asked).toEqual([...STAGES]);
    expect(record).toEqual({ idea: 4, prd: parsePrd(3), inbox: 5, building: 8, outbox: 6, shipped: 7, retro: 5 });
  });

  it('who opened a PRD: you by login or account, a fleet by its members\', the workspace every PRD', () => {
    const ada: PrdNow = { stage: 'shipped', login: 'ada-gh', userId: null };
    const bobs: PrdNow = { stage: 'building', login: null, userId: 'u-bob' };
    const nobody: PrdNow = { stage: 'prd', login: null, userId: null };
    const you = circleOf({ kind: 'you', userId: 'u-ada', login: 'ADA-gh' }, ROSTER);
    expect([ada, bobs, nobody].map((p) => openedBy(you, p))).toEqual([true, false, false]);
    const beaver = circleOf({ kind: 'fleet', fleet: 'beaver' }, ROSTER);
    expect([ada, bobs, nobody].map((p) => openedBy(beaver, p))).toEqual([false, true, false]);
    const all = circleOf({ kind: 'workspace' }, ROSTER);
    expect([ada, bobs, nobody].map((p) => openedBy(all, p))).toEqual([true, true, true]);
  });
});
