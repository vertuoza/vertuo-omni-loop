import { buildGalaxy, demoEvents, DEMO_PROJECTS } from '@omni/galaxy';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Board } from './Board';
import { columnLabels } from './chart';
import { demoBoard } from './demo';
import { hrefWith } from './links';
import { boardOf, type BoardRequest } from './load';
import { WorkspaceScreen, type WorkspaceView } from './WorkspaceScreen';
import type { Member } from './tally';

// A board and /app/workspace as the server renders them (PRD 572), to static markup: what a person
// sees before any script runs.

const NOW = new Date('2026-09-26T10:00:00Z');
const UNREADABLE_LINE = 'Couldn’t load this. Reload in a moment.';
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const member = (userId: string, login: string | null, fleet: string | null, name: string): Member => ({ userId, name, login, avatarUrl: null, fleet });
const ROSTER = [member('u-ada', 'ada-gh', 'octo', 'ADA'), member('u-paul', 'paetienne', null, 'Paul Etienne'), member('u-nog', null, null, 'NOGIT')];
const READ = {
  roster: ROSTER,
  activity: [
    { kind: 'pr-merged', repo: 'vertuo-ai-domain', number: 1, login: 'paetienne', at: '2026-09-25T08:00:00Z' },
    { kind: 'prd-opened', repo: 'vertuo-omni-loop', number: 12, login: 'ada-gh', at: '2026-09-26T08:00:00Z' },
  ],
  answered: [{ user_id: 'u-paul', answered: 9 }],
  prds: [
    { stage: 'shipped', login: 'ada-gh', userId: null },
    { stage: 'shipped', login: 'ada-gh', userId: null },
    { stage: 'outbox', login: 'ada-gh', userId: null },
    { stage: 'idea', login: null, userId: 'u-nog' },
  ],
  galaxy: { heroes: [{ name: 'ada-gh', points: 40 }], teams: [{ name: 'octo', label: 'OCTO', color: '#3355ff', points: 40, rank: 1 }] },
};
const REQUEST: BoardRequest = { scope: { kind: 'workspace' }, people: { kind: 'workspace' }, viewerId: 'u-ada', period: '7d', now: NOW };
const render = (read: Partial<typeof READ> | Record<string, unknown> = {}, request: Partial<BoardRequest> = {}, query = {}, fleets = true) =>
  renderToStaticMarkup(createElement(Board, {
    board: boardOf({ ...READ, ...read } as never, { ...REQUEST, ...request }), path: '/app/workspace', query, fleets,
  }));

describe('the period switch', () => {
  it('links 7 days, 30 days and Season, the current one marked, keeping the rest of the query', () => {
    const html = render({}, { period: '30d' }, { fleet: 'octo', period: '30d' });
    expect(html).toContain('href="/app/workspace?fleet=octo&amp;period=7d"');
    expect(html).toMatch(/<a href="\/app\/workspace\?fleet=octo&amp;period=30d" aria-current="page">30 days<\/a>/);
    expect(html).toContain('href="/app/workspace?fleet=octo&amp;period=season"');
  });

  it('hrefWith keeps every other value, and drops one set to null', () => {
    expect(hrefWith('/p', { a: '1', b: ['2', '3'], c: undefined }, { a: '9' })).toBe('/p?b=2&b=3&a=9');
    expect(hrefWith('/p', { a: '1' }, { a: null })).toBe('/p');
  });
});

describe('a board', () => {
  it('shows the four tiles, a 0 as 0; PRDs by the seven stages now', () => {
    const t = text(render());
    expect(t).toContain('PRs merged 1');
    expect(t).toContain('PRDs 1 idea · 0 PRD · 0 inbox · 0 building · 1 outbox · 2 shipped · 0 retro');
    expect(t).toContain('Repositories 2');
    expect(t).toContain('Questions answered 9');
  });

  it('links each PRD count to /prd at its stage, with the scope\'s filter', () => {
    const all = render();
    expect(all).toMatch(/<a class="board-stage" href="\/prd\?stage=shipped&amp;who=all"><b>2<\/b>/);
    expect(all.match(/class="board-stage" href="\/prd\?stage=/g)).toHaveLength(7);
    const you = render({}, { scope: { kind: 'you', userId: 'u-ada', login: 'ada-gh' } });
    expect(you).toContain('href="/prd?stage=outbox"');
    expect(you).not.toContain('who=all');
  });

  it('with no PRDs read, says the PRDs tile could not load, not 0', () => {
    const t = text(render({ prds: 'unreadable' }));
    expect(t).toContain(`PRDs ${UNREADABLE_LINE}`);
    expect(t).toContain('Couldn’t load the PRDs. Reload in a moment.');
  });

  it('draws both charts, each with the list a screen reader reads in its place; PRD events read opened · started · shipped', () => {
    const html = render();
    expect(text(html)).toContain('PRs merged per day · last 7 days');
    expect(text(html)).toContain('PRD events per day · last 7 days');
    expect(html).toMatch(/<ul class="board-legend"[^>]*>.*opened.*started.*shipped.*<\/ul>/);
    expect(html).toContain('Friday 25 September: 1 PR');
    expect(html).toContain('Saturday 26 September, today: 1 opened, 0 started, 0 shipped');
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(2);
  });

  it('lists every member in People: 0s kept, the viewer marked, SOLO with no fleet, dashes with no login', () => {
    const html = render();
    const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => text(m[1]));
    expect(rows).toContain('Name Fleet Points PRs PRDs open · building · shipped Questions');
    expect(rows).toContain('Paul Etienne SOLO 0 1 0 · 0 · 0 9');
    expect(rows).toContain('ADA ◀ (you) OCTO 40 0 0 · 1 · 2 0');
    expect(rows).toContain('NOGIT SOLO – – 1 · 0 · 0 0');
    expect(html).toMatch(/<tr aria-current="true"><th scope="row" class="board-name">ADA/);
  });

  it('lists the repositories involved, most active first', () => {
    const t = text(render());
    expect(t).toMatch(/Repositories involved Repository PRs merged PRD events vertuo-ai-domain 1 0 vertuo-omni-loop 0 1/);
  });

  it('ends with the season\'s fleet ranking when the page asks, yours marked', () => {
    expect(text(render())).toContain('Fleets · September Rank Fleet Points 1 OCTO ◀ (your fleet) 40');
    expect(text(render({}, {}, {}, false))).not.toContain('Fleets · September');
  });

  it('says so where a read failed, and draws the rest', () => {
    const t = text(render({ activity: 'unreadable' }));
    expect(t).toContain(`PRs merged ${UNREADABLE_LINE}`);
    expect(t).toContain(`PRs merged per day · last 7 days ${UNREADABLE_LINE}`);
    expect(t).toContain(`Repositories involved ${UNREADABLE_LINE}`);
    expect(t).toContain('Questions answered 9');
    expect(t).toContain('Couldn’t load the PRs. Reload in a moment.');
    expect(text(render({ roster: 'unreadable' }))).toContain(`People ${UNREADABLE_LINE}`);
  });

  it('names every day of a week, and every seventh day of a longer period, today always', () => {
    expect(columnLabels(['2026-09-25', '2026-09-26'])).toEqual(['Fri', 'Sat']);
    const month = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 7, 28 + i)).toISOString().slice(0, 10));
    expect(columnLabels(month).filter(Boolean)).toEqual(['29', '5', '12', '19', '26']);
  });
});

describe('/app/workspace', () => {
  const galaxy = buildGalaxy(demoEvents(NOW), { projects: DEMO_PROJECTS, now: NOW, source: 'demo' });
  const screen = (view: WorkspaceView, supabase: { url: string; key: string } | null = { url: 'http://x', key: 'anon' }) =>
    renderToStaticMarkup(createElement(WorkspaceScreen, { view, supabase, signinError: null, query: {} }));

  it('in the demo shows every part, members at 0 among them', () => {
    const board = demoBoard(galaxy, { scope: { kind: 'workspace' }, people: { kind: 'workspace' }, period: '7d', now: NOW });
    const html = screen({ kind: 'board', name: 'Demo workspace', board });
    const t = text(html);
    expect(t).not.toContain(UNREADABLE_LINE);
    for (const part of ['PRs merged', 'PRDs', 'Repositories', 'Questions answered', 'PRs merged per day', 'PRD events per day', 'People', 'Repositories involved', 'Fleets · September']) {
      expect(t).toContain(part);
    }
    expect(t).toMatch(/NEWBIE SOLO 0 0 0 · 0 · 0 0/);
    expect(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1]).toBe('Demo workspace');
  });

  it('closed, signed out and in no workspace each say so', () => {
    expect(text(screen({ kind: 'closed' }))).toContain('The workspace board is not open here');
    expect(text(screen({ kind: 'sign-in' }))).toContain('Sign in with GitHub');
    expect(text(screen({ kind: 'sign-in' }, null))).toContain('The workspace board is not open here');
    expect(text(screen({ kind: 'no-workspace' }))).toContain('Your account is not in a workspace');
  });
});
