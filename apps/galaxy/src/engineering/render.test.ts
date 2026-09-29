import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UNREADABLE } from '../dashboard/part';
import { periodWindow } from '../dashboard/board/period';
import { demoEngineeringBoard } from './demo';
import { EngineeringScreen, type EngineeringView } from './EngineeringScreen';
import { engineeringOf, OMNI_MAN, type PullRequestRow } from './tally';

// /app/engineering as the server renders it (PRD 612 s3), to static markup: what a person sees
// before any script runs.

const NOW = new Date('2026-09-26T10:00:00Z');
const WEEK = periodWindow('7d', NOW);
const HOUR = 3_600_000;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

let serial = 0;
const pr = (over: Partial<PullRequestRow> = {}): PullRequestRow => ({
  repo: 'acme/widgets', number: ++serial, author: 'ada', authorIsBot: false, openedAt: '2026-09-24T08:00:00Z', mergedAt: null, closedAt: null,
  mergedBy: null, commits: 0, additions: 0, deletions: 0, omniSigned: false, ...over,
});
const mergedAfter = (hours: number, over: Partial<PullRequestRow> = {}) => {
  const at = new Date(Date.parse('2026-09-24T08:00:00Z') + hours * HOUR).toISOString();
  return pr({ mergedAt: at, closedAt: at, mergedBy: 'bob', commits: 2, additions: 10, deletions: 3, ...over });
};
const ROWS = [
  mergedAfter(4, { omniSigned: true }),
  mergedAfter(20, { repo: 'acme/gears', author: 'carl' }),
  pr({ author: 'dependabot[bot]', authorIsBot: true }),
  pr({ author: OMNI_MAN, authorIsBot: true, omniSigned: true }),
];

const board = (rows = ROWS, tracked = ['acme/widgets', 'acme/gears']): EngineeringView =>
  ({ kind: 'board', name: 'Vertuoza', board: engineeringOf({ tracked, pullRequests: rows, reviews: [{ repo: 'acme/widgets', number: ROWS[0].number, reviewer: 'dora', firstAt: '2026-09-25T08:00:00Z' }] }, WEEK, 'merged') });
const render = (view: EngineeringView, query: Record<string, string> = {}) =>
  renderToStaticMarkup(createElement(EngineeringScreen, { view, period: '7d', supabase: null, signinError: null, query }));

describe('the Engineering board, with data', () => {
  const html = render(board(), { period: '7d' });
  const t = text(html);

  it('is headed by the workspace\'s name, under the period switch', () => {
    expect(html).toContain('<h1 class="dash-name">Vertuoza</h1>');
    expect(html).toMatch(/<a href="\/app\/engineering\?period=7d" aria-current="page">7 days<\/a>/);
    expect(html).toContain('href="/app/engineering?period=season"');
  });

  it('shows the six tiles', () => {
    expect(t).toContain('PRs opened 4');
    expect(t).toContain('PRs merged 2');
    expect(t).toContain('Open now 2');
    expect(t).toContain('Median time to merge 12.0 h');
    expect(t).toContain('Commits 4');
    expect(t).toContain('Lines +/− +20 −6');
  });

  it('shows the Omni Loop panel: the share, both medians and the lines', () => {
    expect(t).toContain('Omni Loop 1 of 2 merged PRs signed by Omni-man (50%)');
    expect(t).toContain('Median time to merge: 4.0 h signed vs 20.0 h the rest');
    expect(t).toContain('Lines signed: +10 −3');
  });

  it('draws merged per day with the signed part, and the list a screen reader reads in its place', () => {
    expect(html).toContain('eng-bar-signed');
    expect(html).toContain('eng-bar-rest');
    expect(t).toContain('Thursday 24 September: 1 merged, 1 signed by Omni-man');
    expect(t).toContain('Saturday 26 September, today: 0 merged, 0 signed by Omni-man');
  });

  it('lists every tracked repository in a table sorted by merged, each heading a sort link keeping the period', () => {
    expect(t).toContain('acme/gears 1 1 0 20.0 h 2 13');
    expect(t).toContain('acme/widgets 3 1 2 4.0 h 2 13');
    expect(html).toContain('href="/app/engineering?period=7d&amp;sort=opened"');
    expect(html).toMatch(/aria-sort="descending"><a class="eng-sort" href="[^"]*sort=merged">Merged<\/a>/);
  });

  it('shows the three top-5 lists, without bots or Omni-man', () => {
    expect(t).toContain('Most opened ada 1 carl 1 Most merged bob 2 Most reviews dora 1');
    expect(t).not.toContain('dependabot');
    expect(t).not.toMatch(/Most opened[^M]*omni-loop-invader/);
  });
});

describe('the Engineering board, empty', () => {
  it('with no tracked repository: the empty state, linking Settings → Repositories, and no tiles', () => {
    const html = render(board([], []));
    expect(text(html)).toContain('No tracked repositories yet → Settings → Repositories');
    expect(html).toContain('href="/app/settings/repositories"');
    expect(html).not.toContain('board-tiles');
  });

  it('when it could not be read: says so', () => {
    expect(text(render({ kind: 'board', name: 'Vertuoza', board: UNREADABLE }))).toContain('Couldn’t load this. Reload in a moment.');
  });
});

describe('the other situations', () => {
  it('closed, signed out with no database and no workspace each say so', () => {
    expect(text(render({ kind: 'closed' }))).toContain('The Engineering board is not open here');
    expect(text(render({ kind: 'sign-in' }))).toContain('The Engineering board is not open here');
    expect(text(render({ kind: 'no-workspace' }))).toContain('Your account is not in a workspace');
  });
});

describe('the demo', () => {
  it('draws a board for every period, the same one for the same now', () => {
    for (const period of ['7d', '30d', 'season'] as const) {
      const view = demoEngineeringBoard(period, 'merged', NOW);
      expect(view.kind === 'board' && view.board !== UNREADABLE && view.board.kind).toBe('board');
      expect(render(view)).toBe(render(demoEngineeringBoard(period, 'merged', NOW)));
    }
  });
});
