import { describe, expect, it } from 'vitest';
import type { FixSummary } from '../dossier/github/fix';
import type { DossierListRow } from '../dossier/store';
import type { PullRequestRow, ReviewRow } from '../engineering/tally';
import {
  capped, fixesOf, githubPullUrl, moreHref, prdsOf, profileLogin, profilePath, profileStageLinks, pullRequestsOf, reviewsOf, seeAllHref,
  PROFILE_LIMIT,
} from './select';

// The profile's pure choices (PRD 698 s3): one person's pull requests and reviews of one period,
// newest first, at most 10 and whether more exist; the login a path names; where each link goes.

const WINDOW = { from: new Date('2026-09-22T22:00:00Z'), to: new Date('2026-09-29T22:00:00Z') };

const pr = (number: number, author: string | null, openedAt: string, mergedAt: string | null = null): PullRequestRow => ({
  repo: 'acme/widgets', number, author, authorIsBot: false, openedAt, mergedAt, closedAt: mergedAt, mergedBy: null,
  commits: 1, additions: 10 + number, deletions: number, omniSigned: false,
});
const review = (number: number, reviewer: string, firstAt: string): ReviewRow => ({ repo: 'acme/gears', number, reviewer, firstAt });

describe('capped', () => {
  it('keeps the first 10 and says whether more exist', () => {
    const rows = Array.from({ length: 12 }, (_, i) => i);
    expect(capped(rows)).toEqual({ rows: rows.slice(0, PROFILE_LIMIT), more: true });
    expect(capped(rows.slice(0, 10))).toEqual({ rows: rows.slice(0, 10), more: false });
    expect(capped([])).toEqual({ rows: [], more: false });
  });
});

describe('pullRequestsOf', () => {
  it('keeps the person\'s own, ignoring case, merged or opened within the period, newest first', () => {
    const rows = [
      pr(1, 'Ada', '2026-09-20T08:00:00Z', '2026-09-24T08:00:00Z'), // opened before, merged within
      pr(2, 'ada', '2026-09-25T08:00:00Z'), // opened within, open
      pr(3, 'ada', '2026-09-10T08:00:00Z', '2026-09-12T08:00:00Z'), // both before
      pr(4, 'bob', '2026-09-26T08:00:00Z'), // someone else
      pr(5, null, '2026-09-26T08:00:00Z'), // no author
      pr(6, 'ada', '2026-09-27T08:00:00Z', '2026-09-28T08:00:00Z'), // opened and merged within
      pr(7, 'ada', '2026-09-30T08:00:00Z'), // after the period
    ];
    expect(pullRequestsOf(rows, 'ADA', WINDOW)).toEqual({
      rows: [
        { repo: 'acme/widgets', number: 6, url: 'https://github.com/acme/widgets/pull/6', event: 'merged', at: '2026-09-28T08:00:00Z', additions: 16, deletions: 6 },
        { repo: 'acme/widgets', number: 2, url: 'https://github.com/acme/widgets/pull/2', event: 'opened', at: '2026-09-25T08:00:00Z', additions: 12, deletions: 2 },
        { repo: 'acme/widgets', number: 1, url: 'https://github.com/acme/widgets/pull/1', event: 'merged', at: '2026-09-24T08:00:00Z', additions: 11, deletions: 1 },
      ],
      more: false,
    });
  });

  it('caps at 10 and says more exist', () => {
    const rows = Array.from({ length: 11 }, (_, i) => pr(i + 1, 'ada', `2026-09-2${3 + (i % 5)}T0${i % 10}:00:00Z`));
    const got = pullRequestsOf(rows, 'ada', WINDOW);
    expect(got.rows).toHaveLength(10);
    expect(got.more).toBe(true);
  });
});

describe('reviewsOf', () => {
  it('keeps the person\'s first reviews given within the period, newest first', () => {
    const rows = [
      review(1, 'ada', '2026-09-24T08:00:00Z'),
      review(2, 'ADA', '2026-09-28T08:00:00Z'),
      review(3, 'ada', '2026-09-01T08:00:00Z'),
      review(4, 'bob', '2026-09-26T08:00:00Z'),
    ];
    expect(reviewsOf(rows, 'ada', WINDOW)).toEqual({
      rows: [
        { repo: 'acme/gears', number: 2, url: 'https://github.com/acme/gears/pull/2', at: '2026-09-28T08:00:00Z' },
        { repo: 'acme/gears', number: 1, url: 'https://github.com/acme/gears/pull/1', at: '2026-09-24T08:00:00Z' },
      ],
      more: false,
    });
  });
});

describe('the addresses', () => {
  it('reads a login from a path: a GitHub login, in lower case; anything else names nobody', () => {
    expect(profileLogin('Ada-GH')).toBe('ada-gh');
    expect(profileLogin('a')).toBe('a');
    expect(profileLogin('')).toBeNull();
    expect(profileLogin('-ada')).toBeNull();
    expect(profileLogin('ada_gh')).toBeNull();
    expect(profileLogin('ada%')).toBeNull();
    expect(profileLogin('a'.repeat(40))).toBeNull();
  });

  it('builds the profile path, the GitHub pull request and the stage counts\' /prd links', () => {
    expect(profilePath('ada-gh')).toBe('/app/people/ada-gh');
    expect(githubPullUrl('acme/widgets', 7)).toBe('https://github.com/acme/widgets/pull/7');
    expect(profileStageLinks('ada-gh').inbox).toBe('/prd?stage=inbox&who=ada-gh');
  });

  it('sends see all to a GitHub search of the tracked repositories', () => {
    expect(moreHref('authored', 'ada-gh', ['acme/widgets', 'acme/gears'])).toBe(
      'https://github.com/search?type=pullrequests&q=is%3Apr+author%3Aada-gh+repo%3Aacme%2Fwidgets+repo%3Aacme%2Fgears',
    );
    expect(moreHref('reviewed', 'ada-gh', ['acme/widgets'])).toBe(
      'https://github.com/search?type=pullrequests&q=is%3Apr+reviewed-by%3Aada-gh+repo%3Aacme%2Fwidgets',
    );
  });
});

// PRD 698 s5: the PRDs they opened and the fixes they asked for, of the period, by the rule the lists'
// who=<login> uses, at most 10 each.

const dossier = (id: string, over: Partial<DossierListRow> = {}): DossierListRow => ({
  id, workspace_id: 'w1', home_repo: 'acme/widgets', prd: Number(id.replace(/\D/g, '')) || null, kind: 'prd', title: `Title ${id}`,
  opened_by: 'u-ada', created_at: '2026-09-01T08:00:00Z', numbered_at: null, repos: ['acme/widgets'], latest: {}, asked: 0, answered: 0,
  last_activity: '2026-09-25T08:00:00Z', ...over,
});
const fact = (author: string): FixSummary => ({
  issue: { number: 1, url: 'https://github.com/acme/widgets/issues/1', state: 'open', author, createdAt: '2026-09-24T08:00:00Z', risk: 'omni:risk-high', regression: true },
  pull: null, approvals: [], release: null,
});
const ADA = new Set(['u-ada']);

describe('prdsOf', () => {
  it('keeps the PRDs they opened, active within the period, newest first, with each one\'s stage', () => {
    const rows = [
      dossier('p1', { last_activity: '2026-09-24T08:00:00Z' }),
      dossier('p2', { last_activity: '2026-09-28T08:00:00Z' }),
      dossier('p3', { last_activity: '2026-09-01T08:00:00Z' }), // before the period
      dossier('p4', { opened_by: 'u-bob' }), // someone else's
      dossier('p5', { opened_by: null }), // nobody's
      dossier('v6', { kind: 'visual' }), // a fix, not a PRD
    ];
    const stages = new Map([['w1 acme/widgets#2', 'shipped' as const]]);
    const got = prdsOf(rows, 'ada-gh', ADA, WINDOW, stages);
    expect(got.more).toBe(false);
    expect(got.rows.map((r) => [r.heading, r.title, r.href, r.stage])).toEqual([
      ['#2', 'Title p2', '/prd/p2', 'shipped'],
      ['#1', 'Title p1', '/prd/p1', null],
    ]);
  });

  it('caps at 10 and says more exist', () => {
    const rows = Array.from({ length: 11 }, (_, i) => dossier(`p${i + 1}`));
    const got = prdsOf(rows, 'ada-gh', ADA, WINDOW, new Map());
    expect(got.rows).toHaveLength(PROFILE_LIMIT);
    expect(got.more).toBe(true);
  });
});

describe('fixesOf', () => {
  it('keeps the fixes of one kind they asked for (pushed, or their issue), active within the period', () => {
    const rows = [
      dossier('b1', { kind: 'bug' }), // they pushed it
      dossier('b2', { kind: 'bug', opened_by: null, last_activity: '2026-09-27T08:00:00Z' }), // their issue
      dossier('b3', { kind: 'bug', opened_by: 'u-bob' }), // someone else's issue
      dossier('b4', { kind: 'bug', last_activity: '2026-09-01T08:00:00Z' }), // before the period
      dossier('v5', { kind: 'visual' }), // the other kind
    ];
    const facts = new Map([['b2', fact('Ada-GH')], ['b3', fact('bob-gh')]]);
    const got = fixesOf(rows, 'bug', 'ada-gh', ADA, WINDOW, facts);
    expect(got.rows.map((r) => [r.heading, r.href, r.stateLabel, r.risk, r.regression])).toEqual([
      ['#2', '/bugs/b2', 'Asked', 'omni:risk-high', true],
      ['#1', '/bugs/b1', '—', null, false],
    ]);
    expect(fixesOf(rows, 'visual', 'ada-gh', ADA, WINDOW, facts).rows.map((r) => r.href)).toEqual(['/visual/v5']);
  });

  it('caps at 10 and says more exist', () => {
    const rows = Array.from({ length: 12 }, (_, i) => dossier(`v${i + 1}`, { kind: 'visual' }));
    expect(fixesOf(rows, 'visual', 'ada-gh', ADA, WINDOW, new Map())).toMatchObject({ more: true });
  });
});

describe('seeAllHref', () => {
  it('opens each list for that person', () => {
    expect(seeAllHref('prd', 'ada-gh')).toBe('/prd?who=ada-gh');
    expect(seeAllHref('bug', 'ada-gh')).toBe('/bugs?who=ada-gh');
    expect(seeAllHref('visual', 'ada-gh')).toBe('/visual?who=ada-gh');
  });
});
