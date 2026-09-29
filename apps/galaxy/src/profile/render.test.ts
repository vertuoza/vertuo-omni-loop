import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Member } from '../dashboard/board/tally';
import type { FixSummary } from '../dossier/github/fix';
import type { DossierListRow } from '../dossier/store';
import type { PullRequestRow } from '../engineering/tally';
import { profileOf, type ProfileRead } from './load';
import { ProfileScreen, type ProfileView } from './ProfileScreen';

vi.mock('server-only', () => ({}));
const { demoProfile } = await import('./profile');

// /app/people/<login> as the server renders it (PRD 698 s3), to static markup: a member's header,
// board and lists; full lists with see all; empty lists; no tracked repository; not in this
// workspace; could not load; closed, signed out, no workspace; and the demo.

const NOW = new Date('2026-09-26T10:00:00Z');
const UNREADABLE_LINE = 'Couldn’t load this. Reload in a moment.';
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const member = (userId: string, login: string, fleet: string | null, name: string): Member => ({ userId, name, login, avatarUrl: null, fleet });
const pr = (number: number, day: number, merged: boolean): PullRequestRow => {
  const at = `2026-09-${String(day).padStart(2, '0')}T08:00:00Z`;
  return {
    repo: 'acme/widgets', number, author: 'ada-gh', authorIsBot: false, openedAt: at, mergedAt: merged ? at : null, closedAt: null, mergedBy: null,
    commits: 1, additions: 1200, deletions: 30, omniSigned: false,
  };
};
const dossier = (id: string, n: number, kind: DossierListRow['kind'], day: number, opener: string | null = 'u-ada'): DossierListRow => ({
  id, workspace_id: 'w1', home_repo: 'acme/widgets', prd: n, kind, title: `The ${kind} ${n}`, opened_by: opener,
  created_at: '2026-09-01T08:00:00Z', numbered_at: null, repos: ['acme/widgets'], latest: {}, asked: 0, answered: 0,
  last_activity: `2026-09-${String(day).padStart(2, '0')}T08:00:00Z`,
});
const asked = (author: string): FixSummary => ({
  issue: { number: 5, url: 'https://github.com/acme/widgets/issues/5', state: 'open', author, createdAt: '2026-09-24T08:00:00Z', risk: null, regression: false },
  pull: { number: 6, url: 'https://github.com/acme/widgets/pull/6', state: 'merged', mergedAt: '2026-09-25T08:00:00Z', mergedBy: null },
  approvals: [], release: null,
});
const DOSSIERS: ProfileRead['dossiers'] = {
  rows: [
    dossier('d-p', 42, 'prd', 25),
    dossier('d-b', 5, 'bug', 24, null),
    dossier('d-v', 8, 'visual', 23),
    dossier('d-x', 9, 'prd', 25, 'u-sol'),
  ],
  stages: new Map([['w1 acme/widgets#42', 'outbox' as const]]),
  facts: new Map([['d-b', asked('ada-gh')]]),
};
const READ = (work: ProfileRead['work'], dossiers: ProfileRead['dossiers'] = DOSSIERS): ProfileRead => ({
  board: {
    roster: [member('u-ada', 'ada-gh', 'octo', 'ADA'), member('u-sol', 'sol-gh', null, 'SOL')],
    activity: [{ kind: 'pr-merged', repo: 'acme/widgets', number: 1, login: 'ada-gh', at: '2026-09-25T08:00:00Z' }],
    answered: [{ user_id: 'u-ada', answered: 3 }],
    prds: [],
    galaxy: { heroes: [{ name: 'ada-gh', points: 40 }], teams: [{ name: 'octo', label: 'OCTO', color: '#3355ff', mascot: 'octopod', points: 40, rank: 1 }] },
  },
  work,
  dossiers,
});
const LISTS: ProfileRead['work'] = {
  tracked: ['acme/widgets'],
  pullRequests: [pr(1, 25, true), pr(2, 24, false)],
  reviews: [{ repo: 'acme/gears', number: 7, reviewer: 'ada-gh', firstAt: '2026-09-23T09:00:00Z' }],
};
const profile = (work: ProfileRead['work'] = LISTS, login = 'ada-gh', dossiers: ProfileRead['dossiers'] = DOSSIERS) =>
  profileOf(READ(work, dossiers), { login, viewerId: 'u-sol', period: '7d', now: NOW });
const screen = (view: ProfileView, supabase: { url: string; key: string } | null = { url: 'http://x', key: 'anon' }) =>
  renderToStaticMarkup(createElement(ProfileScreen, { view, supabase, signinError: null, query: { period: '7d' } }));

describe('a member\'s profile', () => {
  it('heads with their face and name, @login to GitHub, their fleet and season place', () => {
    const html = screen(profile());
    expect(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1]).toContain('ADA');
    expect(html).toContain('<a href="https://github.com/ada-gh">@ada-gh</a>');
    expect(text(html)).toContain('OCTO');
    expect(text(html)).toContain('#1 of 1 · September');
  });

  it('draws their board, its period links staying on their profile, its PRDs counts opening /prd for them', () => {
    const html = screen(profile());
    const t = text(html);
    expect(t).toContain('PRs merged 1');
    expect(t).toContain('Questions answered 3');
    expect(t).toContain('ADA OCTO 40 1');
    expect(t).not.toContain('SOL ');
    expect(html).toContain('href="/app/people/ada-gh?period=30d"');
    expect(html).toContain('href="/prd?stage=inbox&amp;who=ada-gh"');
  });

  it('lists their pull requests (opened or merged, +/-, to GitHub) and reviews (first review date)', () => {
    const t = text(screen(profile()));
    expect(t).toContain('Pull requests acme/widgets#1 merged 25 Sept +1,200 −30 acme/widgets#2 opened 24 Sept +1,200 −30');
    expect(t).toContain('Reviews acme/gears#7 reviewed 23 Sept');
    expect(screen(profile())).toContain('href="https://github.com/acme/gears/pull/7"');
    expect(t).not.toContain('See all');
  });

  it('with more than 10 in a list: 10 rows, then see all', () => {
    const many = { ...LISTS, pullRequests: Array.from({ length: 12 }, (_, i) => pr(100 + i, 21 + (i % 5), true)) };
    const html = screen(profile(many));
    expect(html.match(/acme\/widgets#1\d\d</g)).toHaveLength(10);
    expect(html).toContain('>See all</a>');
    expect(html).toContain('href="https://github.com/search?type=pullrequests&amp;q=is%3Apr+author%3Aada-gh+repo%3Aacme%2Fwidgets"');
  });

  it('an empty list reads nothing in this period', () => {
    const t = text(screen(profile({ tracked: ['acme/widgets'], pullRequests: [], reviews: [] })));
    expect(t).toContain('Pull requests Nothing in this period');
    expect(t).toContain('Reviews Nothing in this period');
  });

  it('with no tracked repository: says so under both lists, linking to Settings › Repositories', () => {
    const html = screen(profile({ tracked: [], pullRequests: [], reviews: [] }));
    expect(html.match(/This workspace tracks no repository yet\. <a href="\/app\/settings\/repositories">Settings › Repositories<\/a>/g)).toHaveLength(2);
  });

  it('a list that could not be read says so alone', () => {
    const t = text(screen(profile({ ...LISTS, reviews: 'unreadable' })));
    expect(t).toContain(`Reviews ${UNREADABLE_LINE}`);
    expect(t).toContain('acme/widgets#1');
  });
});

describe('their PRDs, bug fixes and visual updates (s5)', () => {
  it('lists the PRDs they opened with the stage pill, and the fixes they asked for with the state pill, each to its page', () => {
    const html = screen(profile());
    const t = text(html);
    expect(t).toContain('PRDs #42 The prd 42 outbox');
    expect(t).toContain('Bug fixes #5 The bug 5 Merged');
    expect(t).toContain('Visual updates #8 The visual 8 —');
    expect(t).not.toContain('The prd 9');
    expect(html).toContain('href="/prd/d-p"');
    expect(html).toContain('href="/bugs/d-b"');
    expect(html).toContain('href="/visual/d-v"');
    expect(t).not.toContain('See all');
  });

  it('with more than 10 in a list: 10 rows, then see all to that list for them', () => {
    const rows = Array.from({ length: 11 }, (_, i) => dossier(`b${i}`, 100 + i, 'bug', 25));
    const html = screen(profile(LISTS, 'ada-gh', { rows, stages: new Map(), facts: new Map() }));
    expect(html.match(/href="\/bugs\/b\d+"/g)).toHaveLength(10);
    expect(html).toContain('<a href="/bugs?who=ada-gh">See all</a>');
    expect(html).not.toContain('/prd?who=ada-gh">See all');
  });

  it('an empty list reads nothing in this period', () => {
    const t = text(screen(profile(LISTS, 'ada-gh', { rows: [], stages: new Map(), facts: new Map() })));
    expect(t).toContain('PRDs Nothing in this period');
    expect(t).toContain('Bug fixes Nothing in this period');
    expect(t).toContain('Visual updates Nothing in this period');
  });

  it('the dossiers out of reach: the three lists say so, the rest stands', () => {
    const t = text(screen(profile(LISTS, 'ada-gh', 'unreadable')));
    expect(t).toContain(`PRDs ${UNREADABLE_LINE}`);
    expect(t).toContain(`Bug fixes ${UNREADABLE_LINE}`);
    expect(t).toContain(`Visual updates ${UNREADABLE_LINE}`);
    expect(t).toContain('acme/widgets#1');
  });
});

describe('the other situations', () => {
  it('a login outside the workspace: not in this workspace, and no data', () => {
    const html = screen(profile(LISTS, 'stranger'));
    expect(text(html)).toBe('@stranger Not in this workspace');
  });

  it('the roster out of reach: could not load', () => {
    expect(text(screen({ kind: 'unreadable', login: 'ada-gh' }))).toBe(`@ada-gh ${UNREADABLE_LINE}`);
  });

  it('closed, signed out and in no workspace, as /app/fleet', () => {
    expect(text(screen({ kind: 'closed' }))).toContain('Profiles are not open here');
    expect(text(screen({ kind: 'sign-in' }, null))).toContain('Profiles are not open here');
    expect(text(screen({ kind: 'sign-in' }))).toMatch(/Sign in/i);
    expect(text(screen({ kind: 'no-workspace' }))).toContain('Your account is not in a workspace');
  });

  it('the demo: a demo member\'s profile, and not in this workspace for anyone else', () => {
    const view = demoProfile('paul-e', 'season', NOW);
    expect(view.kind).toBe('profile');
    const t = text(screen(view));
    expect(t).toContain('PAUL');
    expect(t).toContain('Pull requests vertuoza/');
    expect(demoProfile('nobody', '7d', NOW)).toEqual({ kind: 'not-member', login: 'nobody' });
    const you = demoProfile('dam-dev', '30d', new Date());
    if (you.kind !== 'profile' || you.lists === 'unreadable') throw new Error('no demo lists');
    expect(you.lists.prd.rows.length).toBeGreaterThan(0);
  });
});
