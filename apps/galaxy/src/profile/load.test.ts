import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity, Member } from '../dashboard/board/tally';
import type { DossierListRow } from '../dossier/store';
import type { PullRequestRow, ReviewRow } from '../engineering/tally';
import { loadProfile, placeOf, type ProfileReads, type ProfileRequest } from './load';
import { sure } from '../arcade/sure';
import { settled } from '../stages/settled';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

// A profile's loader on fake reads (PRD 698 s3): a member's header, board and work of the period; a
// login outside the workspace; no tracked repository; and each read failing alone.

const NOW = new Date('2026-09-26T10:00:00Z');
const member = (userId: string, login: string | null, fleet: string | null, name: string | null): Member => ({ userId, name, login, avatarUrl: null, fleet });
const ROSTER: Member[] = [
  member('u-ada', 'ada-gh', 'octo', 'ADA'),
  member('u-sol', 'Sol-GH', null, null),
  member('u-bob', 'bob-gh', 'beaver', 'BOB'),
];
const merged = (login: string, n: number): Activity => ({ kind: 'pr-merged', repo: 'acme/widgets', number: n, login, at: '2026-09-25T08:00:00Z' });
const GALAXY = {
  heroes: [{ name: 'bob-gh', points: 300 }, { name: 'ada-gh', points: 120 }, { name: 'sol-gh', points: 0 }],
  teams: [
    { name: 'beaver', label: 'BEAVER', color: '#8a5a2b', mascot: null, points: 300, rank: 1 },
    { name: 'octo', label: 'OCTO', color: '#3355ff', mascot: 'octopod', points: 120, rank: 2 },
  ],
};
const pr = (number: number, author: string, openedAt: string, mergedAt: string | null = null): PullRequestRow => ({
  repo: 'acme/widgets', number, author, authorIsBot: false, openedAt, mergedAt, closedAt: mergedAt, mergedBy: null,
  commits: 1, additions: 5, deletions: 2, omniSigned: false,
});

const dossier = (id: string, prd: number, kind: DossierListRow['kind'], opener: string | null): DossierListRow => ({
  id, workspace_id: 'w1', home_repo: 'acme/widgets', prd: parsePrd(prd), kind, title: id, opened_by: opener, created_at: '2026-09-01T08:00:00Z',
  numbered_at: null, repos: ['acme/widgets'], latest: {}, asked: 0, answered: 0, last_activity: '2026-09-25T08:00:00Z',
});
const DOSSIERS = [dossier('p7', 7, 'prd', 'u-ada'), dossier('p8', 8, 'prd', 'u-bob'), dossier('b3', 3, 'bug', 'u-ada'), dossier('v4', 4, 'visual', 'u-ada')];

type Fail = Partial<Record<keyof ProfileReads, boolean>>;
const calls: string[] = [];
function reads(fail: Fail = {}, tracked = ['acme/widgets']): ProfileReads {
  const read = <T>(name: keyof ProfileReads, value: T) => (...args: unknown[]) => settled(() => {
    calls.push(`${name}${args.length ? ` ${JSON.stringify(args)}` : ''}`);
    if (fail[name]) throw new Error(`${name} is down`);
    return value;
  });
  return {
    roster: read('roster', ROSTER),
    activity: read('activity', [merged('ada-gh', 1), merged('ada-gh', 2), merged('bob-gh', 3)]),
    answered: read('answered', [{ user_id: 'u-ada', answered: 4 }, { user_id: 'u-bob', answered: 9 }]),
    galaxy: read('galaxy', GALAXY),
    prds: read('prds', [{ stage: 'inbox', login: 'ada-gh', userId: null }, { stage: 'shipped', login: 'bob-gh', userId: null }]),
    tracked: read('tracked', tracked),
    pullRequests: read('pullRequests', [
      pr(1, 'ada-gh', '2026-09-24T08:00:00Z', '2026-09-25T08:00:00Z'),
      pr(9, 'ada-gh', '2026-08-01T08:00:00Z'),
    ]),
    reviews: read('reviews', [{ repo: 'acme/widgets', number: 3, reviewer: 'ada-gh', firstAt: '2026-09-25T09:00:00Z' }] as ReviewRow[]),
    dossiers: read('dossiers', DOSSIERS),
    stages: read('stages', new Map([['w1 acme/widgets#7', 'shipped']])),
    fixFacts: read('fixFacts', new Map()),
  };
}
const request = (over: Partial<ProfileRequest> = {}): ProfileRequest => ({ login: 'ada-gh', viewerId: 'u-bob', period: '7d', now: NOW, ...over });

beforeEach(() => { calls.length = 0; vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('a member\'s profile', () => {
  it('heads with their name, fleet and season place, and draws Home\'s *you* board for them', async () => {
    const value = await loadProfile(reads(), request());
    if (value.kind !== 'profile') throw new Error(value.kind);
    expect(value.person).toMatchObject({
      login: 'ada-gh', name: 'ADA', fleet: { name: 'octo', label: 'OCTO', color: '#3355ff', mascot: 'octopod' }, place: { rank: 2, of: 3 },
    });
    expect(value.person.face).toEqual({ kind: 'photo', url: 'https://github.com/ada-gh.png?size=48' });
    expect(value.board.tiles).toMatchObject({ prs: 2, answered: 4, repositories: 1 });
    expect(value.board.tiles.prds).toMatchObject({ inbox: 1, shipped: 0 });
    expect(value.board.people).toEqual([expect.objectContaining({ userId: 'u-ada', points: 120, prs: 2, answered: 4, you: false })]);
    expect(value.board.stageLinks.inbox).toBe('/prd?stage=inbox&who=ada-gh');
  });

  it('lists their pull requests and reviews of the period, read for their login within the period', async () => {
    const value = await loadProfile(reads(), request());
    if (value.kind !== 'profile' || value.work === 'unreadable' || value.work.kind !== 'lists') throw new Error('no lists');
    expect(value.work.pullRequests).toMatchObject({ rows: [{ number: 1, event: 'merged' }], more: false });
    expect(value.work.reviews).toMatchObject({ rows: [{ number: 3 }], more: false });
    expect(calls).toContain('pullRequests ["ada-gh","2026-09-19T22:00:00.000Z","2026-09-26T22:00:00.000Z",["acme/widgets"]]');
  });

  it('finds the login ignoring case, and names a member with no name by it; no points reads not ranked', async () => {
    const value = await loadProfile(reads(), request({ login: 'sol-gh' }));
    if (value.kind !== 'profile') throw new Error(value.kind);
    expect(value.person).toMatchObject({ name: 'sol-gh', fleet: 'solo', place: null });
  });

  it('with no tracked repository: says so, and reads no pull request', async () => {
    const value = await loadProfile(reads({}, []), request());
    if (value.kind !== 'profile') throw new Error(value.kind);
    expect(value.work).toEqual({ kind: 'no-repository' });
    expect(calls.some((c) => c.startsWith('pullRequests') || c.startsWith('reviews'))).toBe(false);
  });
});

describe('their PRDs and fixes (s5)', () => {
  it('lists the PRDs they opened and the fixes they asked for, reading the facts of the fixes only', async () => {
    const value = await loadProfile(reads(), request());
    if (value.kind !== 'profile' || value.lists === 'unreadable') throw new Error('no lists');
    expect(value.lists.prd).toMatchObject({ rows: [{ id: 'p7', stage: 'shipped' }], more: false, moreHref: '/prd?who=ada-gh' });
    expect(value.lists.bug).toMatchObject({ rows: [{ id: 'b3' }], moreHref: '/bugs?who=ada-gh' });
    expect(value.lists.visual).toMatchObject({ rows: [{ id: 'v4' }], moreHref: '/visual?who=ada-gh' });
    expect(calls.find((c) => c.startsWith('fixFacts'))).toContain('"b3"');
    expect(calls.find((c) => c.startsWith('fixFacts'))).not.toContain('"p7"');
  });

  it('the dossiers failing: the lists say so; the stages or the facts failing: the rows show none', async () => {
    const down = await loadProfile(reads({ dossiers: true }), request());
    if (down.kind !== 'profile') throw new Error(down.kind);
    expect(down.lists).toBe('unreadable');
    const bare = await loadProfile(reads({ stages: true, fixFacts: true }), request());
    if (bare.kind !== 'profile' || bare.lists === 'unreadable') throw new Error('no lists');
    expect(sure(bare.lists.prd.rows[0], 'bare.lists.prd.rows[0]').stage).toBeNull();
    expect(sure(bare.lists.bug.rows[0], 'bare.lists.bug.rows[0]').stateLabel).toBe('—');
  });
});

describe('a login no member holds', () => {
  it('is not in this workspace, and carries nothing read', async () => {
    expect(await loadProfile(reads(), request({ login: 'stranger' }))).toEqual({ kind: 'not-member', login: 'stranger' });
  });
});

describe('each read failing alone', () => {
  it('the roster: nobody can be told a member, so the page could not load', async () => {
    expect(await loadProfile(reads({ roster: true }), request())).toEqual({ kind: 'unreadable', login: 'ada-gh' });
  });

  it('the season: only the place and the points say so', async () => {
    const value = await loadProfile(reads({ galaxy: true }), request());
    if (value.kind !== 'profile') throw new Error(value.kind);
    expect(value.person.place).toBe('unreadable');
    expect(value.person.fleet).toMatchObject({ label: 'OCTO', color: null });
    expect(value.board.tiles.prs).toBe(2);
  });

  it('the tracked repositories, or one list: only that part says so', async () => {
    const none = await loadProfile(reads({ tracked: true }), request());
    if (none.kind !== 'profile') throw new Error(none.kind);
    expect(none.work).toBe('unreadable');
    const half = await loadProfile(reads({ reviews: true }), request());
    if (half.kind !== 'profile' || half.work === 'unreadable' || half.work.kind !== 'lists') throw new Error('no lists');
    expect(half.work.reviews).toBe('unreadable');
    expect(half.work.pullRequests).not.toBe('unreadable');
  });
});

describe('placeOf', () => {
  it('ranks as the galaxy does: points, then name; null with no points or no hero', () => {
    const heroes = [{ name: 'b', points: 10 }, { name: 'a', points: 10 }, { name: 'c', points: 30 }, { name: 'z', points: 0 }];
    expect(placeOf(heroes, 'c')).toEqual({ rank: 1, of: 4 });
    expect(placeOf(heroes, 'a')).toEqual({ rank: 2, of: 4 });
    expect(placeOf(heroes, 'b')).toEqual({ rank: 3, of: 4 });
    expect(placeOf(heroes, 'z')).toBeNull();
    expect(placeOf(heroes, 'nobody')).toBeNull();
  });
});
