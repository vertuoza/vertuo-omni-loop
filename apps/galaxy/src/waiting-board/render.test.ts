import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../data/supabase-server', () => ({ supabaseEnv: () => null }));

import type { TabId } from './board';
import { demoWaitingBoard } from './demo';
import { WaitingScreen } from './WaitingScreen';
import type { WaitingView } from './waiting-board.controller';

// /app/waiting as the server renders it (PRD 2377 s3), to static markup: what a person sees before any
// script runs.

const NOW = new Date('2026-10-19T12:00:00Z');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const render = (view: WaitingView, tab: TabId = 'workspace') => renderToStaticMarkup(createElement(WaitingScreen, { view, tab, signinError: null }));
const demo = (tab: TabId = 'workspace'): WaitingView => ({ kind: 'board', ...demoWaitingBoard(NOW, tab) });

describe('the Waiting board, with waits', () => {
  const html = render(demo());
  const t = text(html);

  it('is headed Waiting, with the Workspace tab current', () => {
    expect(html).toContain('<h1 class="dash-name">Waiting</h1>');
    expect(html).toMatch(/<a class="wait-tab" aria-current="page" href="\/app\/waiting\?tab=workspace">Workspace<\/a>/);
  });

  it('lists every wait, oldest first', () => {
    const order = [...html.matchAll(/<tr[ >]/g)].length - 1;
    expect(order).toBe(6);
    expect(t.indexOf('Reusable widget themes')).toBeLessThan(t.indexOf('Export a widget as an image'));
    expect(t.indexOf('Export a widget as an image')).toBeLessThan(t.indexOf('Faster gear ratios'));
  });

  it('links each PRD to its page and each pull request to GitHub', () => {
    expect(html).toContain('<a href="/prd/demo-dossier-1">PRD 41 · Reusable widget themes</a>');
    expect(html).toContain('href="https://github.com/acme/widgets/pull/310"');
  });

  it('says what each waits on, in words', () => {
    for (const words of ['review', 'merge', 'approval', 'outbox · 2 questions', 'law']) expect(t).toContain(words);
  });

  it('names whose turn it is: faces, a team by its name, any approver', () => {
    expect(html).toContain('person-chip');
    expect(t).toContain('acme/maintainers');
    expect(t).toContain('any approver');
  });

  it('counts the age in working days, today under one, and reads a late wait red', () => {
    expect(t).toContain('today');
    expect(html).toMatch(/<tr class="is-overdue">.*?5 days/s);
    expect(html.match(/class="is-overdue"/g)?.length).toBe(2);
  });

  it('names the repository last synced more than 30 minutes ago', () => {
    expect(html).toContain('role="status"');
    expect(t).toContain('acme/gears was last synced more than 30 minutes ago');
    expect(t).not.toContain('acme/widgets was last synced');
  });
});

describe('the My PRDs and My reviews tabs', () => {
  it('draws all three tabs, the current one marked, My reviews with its count', () => {
    const html = render(demo('reviews'), 'reviews');
    expect(html).toMatch(/<a class="wait-tab" aria-current="page" href="\/app\/waiting\?tab=reviews">My reviews \(2\)<\/a>/);
    expect(html).toContain('href="/app/waiting?tab=mine">My PRDs</a>');
    expect(html).toContain('href="/app/waiting?tab=workspace">Workspace</a>');
  });

  it('lists only the viewer\'s PRDs on My PRDs, their own turn first', () => {
    const html = render(demo('mine'), 'mine');
    expect([...html.matchAll(/<tr[ >]/g)].length - 1).toBe(2);
    expect(text(html)).toContain('Reusable widget themes');
    expect(text(html)).not.toContain('Faster gear ratios');
    expect(text(html)).not.toContain('Nothing waits on you.');
  });

  it('lists only what waits on the viewer on My reviews, never by a team', () => {
    const html = render(demo('reviews'), 'reviews');
    expect([...html.matchAll(/<tr[ >]/g)].length - 1).toBe(2);
    expect(text(html)).not.toContain('acme/maintainers');
  });

  it('says what each tab says when it is empty', () => {
    const empty: WaitingView = { kind: 'board', board: { rows: [], stale: [], reviews: 0 }, filter: null, productsUnreadable: false };
    expect(text(render(empty, 'mine'))).toContain('None of your PRDs waits on anyone.');
    expect(text(render(empty, 'reviews'))).toContain('Nothing waits on you.');
    expect(text(render(empty, 'workspace'))).toContain('Nothing waits on a person.');
    expect(text(render(empty, 'reviews'))).not.toContain('(0)');
  });
});

describe('the Waiting board, in its other states', () => {
  it('says nothing waits on a person, and names no stale repository when all are fresh', () => {
    const html = render({ kind: 'board', board: { rows: [], stale: [], reviews: 0 }, filter: null, productsUnreadable: false });
    expect(text(html)).toContain('Nothing waits on a person.');
    expect(html).not.toContain('wait-stale');
  });

  it('draws the product filter above the rows, and says when the products cannot be read', () => {
    const filter = { options: [{ label: 'All', href: '/app/waiting', current: true }, { label: 'Mobile', href: '/app/waiting?product=p', current: false }] };
    const html = render({ kind: 'board', board: { rows: [], stale: [], reviews: 0 }, filter, productsUnreadable: false });
    expect(html).toContain('class="product-filter"');
    expect(text(render({ kind: 'board', board: { rows: [], stale: [], reviews: 0 }, filter: null, productsUnreadable: true }))).toContain('could not be read');
  });

  it('says the page could not load when the read failed', () => {
    const html = render({ kind: 'unreadable' });
    expect(html).toContain('role="alert"');
    expect(text(html)).toContain('The waiting board could not load.');
  });

  it('says it is not open here with no database, shows the sign-in gate signed out, and the notice for no workspace', () => {
    expect(text(render({ kind: 'closed' }))).toContain('The Waiting board is not open here');
    expect(text(render({ kind: 'sign-in' }))).toContain('The Waiting board is not open here');
    expect(text(render({ kind: 'no-workspace' }))).toContain('Your account is not in a workspace');
  });
});
