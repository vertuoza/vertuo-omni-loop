import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { boardOf, type AnsweredCount } from '../board/load';
import type { Activity, Member } from '../board/tally';
import { Dashboard } from '../Dashboard';
import type { DashboardData } from '../load';
import { seasonBounds } from '../season';
import { homeRequest, type HomeViewer } from './team';

// Home as the server renders it (PRD 572), with the real board: the hero block, Waiting for you, then
// the board with scope *you*, whose People table is **Your fleet** and your fleet's chip (PRD 652), every member of your fleet with 0s
// kept and you marked; solo, your own row and the line to Fleet; a failed read, only its parts.

const NOW = new Date('2026-09-26T10:00:00Z');
const member = (userId: string, login: string | null, fleet: string | null, name: string): Member => ({ userId, name, login, avatarUrl: null, fleet });
const ROSTER = [
  member('u-ada', 'ada-gh', 'octo', 'ADA'),
  member('u-paul', 'paetienne', 'octo', 'Paul Etienne'),
  member('u-bob', 'bob-gh', 'beaver', 'BOB'),
];
const merged = (login: string, n: number): Activity => ({ kind: 'pr-merged', repo: 'vertuo-ai-domain', number: n, login, at: '2026-09-25T08:00:00Z' });
const ACTIVITY = [merged('ada-gh', 1), merged('ada-gh', 2), merged('bob-gh', 3), merged('bob-gh', 4), merged('bob-gh', 5)];
const ANSWERED: AnsweredCount[] = [{ user_id: 'u-ada', answered: 4 }, { user_id: 'u-bob', answered: 6 }];
const GALAXY = {
  heroes: [{ name: 'ada-gh', points: 120 }, { name: 'bob-gh', points: 300 }],
  teams: [
    { name: 'octo', label: 'OCTO', color: '#3355ff', mascot: 'octopod', points: 120, rank: 2 },
    { name: 'beaver', label: 'BEAVER', color: '#8a5a2b', mascot: 'beaver', points: 300, rank: 1 },
  ],
};

function home(viewer: HomeViewer, fail: { roster?: boolean; activity?: boolean } = {}): string {
  const r = homeRequest(viewer);
  const board = boardOf({
    roster: fail.roster ? 'unreadable' : ROSTER,
    activity: fail.activity ? 'unreadable' : ACTIVITY,
    answered: ANSWERED,
    galaxy: GALAXY,
    prds: [],
  }, { scope: r.scope, people: r.people, viewerId: viewer.userId, period: '7d', now: NOW });
  const dashboard: DashboardData = {
    name: 'ADA', season: seasonBounds(NOW), you: { kind: 'no-player' }, waiting: { count: 1, href: '/ask' }, board, solo: r.solo,
  };
  return renderToStaticMarkup(createElement(Dashboard, { dashboard, query: { period: '7d' } }));
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const section = (html: string, id: string) => {
  const at = html.indexOf(`aria-labelledby="${id}"`);
  return html.slice(at, html.indexOf('</section>', at));
};
const rows = (html: string) => [...section(html, 'board-people').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].slice(1).map((m) => text(m[1]!));
const UNREADABLE_LINE = 'Couldn’t load this. Reload in a moment.';

describe('Home, with the real board', () => {
  it('in a fleet: Your fleet lists every member of the fleet, Paul at 0 included, you marked, and no one else', () => {
    const html = home({ userId: 'u-ada', login: 'ada-gh', team: 'octo' });
    const heading = /<h2 id="board-people">([\s\S]*?)<\/h2>/.exec(section(html, 'board-people'))![1]!;
    expect(text(heading)).toBe('Your fleet OCTO');
    expect(heading).toMatch(/<a class="fleet-chip is-inline" href="\/app\/fleet\?fleet=octo" style="--fleet:#3355ff"><span class="fleet-chip-mascot" aria-hidden="true"><svg /);
    expect(rows(html)).toEqual([
      'ADA ◀ (you) OCTO 120 2 0 · 0 · 0 4',
      'Paul Etienne OCTO 0 0 0 · 0 · 0 0',
    ]);
    expect(html).toMatch(/<tr aria-current="true">/);
    expect(html).not.toContain('href="/app/fleet"');
  });

  it('counts only you in the tiles: your merges and your questions, not your team\'s', () => {
    const tiles = text(home({ userId: 'u-ada', login: 'ada-gh', team: 'octo' }).split('board-charts')[0]!);
    expect(tiles).toContain('PRs merged 2');
    expect(tiles).toContain('Questions answered 4');
  });

  it('keeps Waiting for you, the period switch on /app, and shows no rankings', () => {
    const html = home({ userId: 'u-ada', login: 'ada-gh', team: 'octo' });
    expect(text(html)).toContain('Waiting for you 1 right now');
    expect(html).toContain('href="/app?period=30d"');
    expect(html).not.toContain('board-fleets');
    expect(text(html)).not.toContain('Outbox settled');
  });

  it('solo: your own row, and the line to Fleet', () => {
    const html = home({ userId: 'u-bob', login: 'bob-gh', team: null });
    expect(rows(html)).toEqual(['BOB ◀ (you) BEAVER 300 3 0 · 0 · 0 6']);
    expect(text(/<h2 id="board-people">([\s\S]*?)<\/h2>/.exec(section(html, 'board-people'))![1]!)).toBe('Your fleet · SOLO');
    expect(section(html, 'board-people')).toMatch(/<a href="\/app\/fleet">See a fleet’s board on Fleet<\/a>/);
  });

  it('the roster out of reach: only Your fleet says so, still headed by your fleet; the tiles and charts still count you', () => {
    const html = home({ userId: 'u-ada', login: 'ada-gh', team: 'octo' }, { roster: true });
    expect(text(/<h2 id="board-people">([\s\S]*?)<\/h2>/.exec(section(html, 'board-people'))![1]!)).toBe('Your fleet OCTO');
    expect(text(section(html, 'board-people'))).toContain(UNREADABLE_LINE);
    expect(text(html.split('board-charts')[0]!)).toContain('PRs merged 2');
  });

  it('the contributions out of reach: the tiles they fill and the charts say so; Questions answered and the team stay', () => {
    const html = home({ userId: 'u-ada', login: 'ada-gh', team: 'octo' }, { activity: true });
    expect(text(html.split('board-charts')[0]!)).toContain('Questions answered 4');
    expect(text(section(html, 'board-merges'))).toContain(UNREADABLE_LINE);
    expect(rows(html)).toHaveLength(2);
  });
});
