import { buildGalaxy, demoEvents, DEMO_PROJECTS } from '@omni/galaxy';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { nestedLinks } from '../../people/nested-links';
import type { Member } from '../board/tally';
import { fleetOf } from './load';
import { FleetScreen, type FleetView } from './FleetScreen';

vi.mock('server-only', () => ({}));
const { demoFleetBoard } = await import('./fleet');

// /app/fleet as the server renders it (PRD 572), to static markup: a viewer in a fleet, a solo
// viewer, a workspace with no fleet, an unknown `?fleet`, and the demo.

const NOW = new Date('2026-09-26T10:00:00Z');
const UNREADABLE_LINE = 'Couldn’t load this. Reload in a moment.';
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const member = (userId: string, login: string | null, fleet: string | null, name: string): Member => ({ userId, name, login, avatarUrl: null, fleet });
const READ = {
  roster: [member('u-ada', 'ada-gh', 'octo', 'ADA'), member('u-paul', 'paetienne', 'octo', 'Paul Etienne'), member('u-sol', 'sol-gh', null, 'SOL')],
  activity: [{ kind: 'pr-merged', repo: 'vertuo-ai-domain', number: 1, login: 'paetienne', at: '2026-09-25T08:00:00Z' }],
  answered: [{ user_id: 'u-paul', answered: 9 }],
  prds: [],
  galaxy: {
    heroes: [{ name: 'ada-gh', points: 40 }],
    teams: [
      { name: 'beaver', label: 'BEAVER', color: '#8a5a2b', points: 90, rank: 1 },
      { name: 'octo', label: 'OCTO', color: '#3355ff', mascot: 'octopod', points: 40, rank: 2 },
    ],
  },
};
const screen = (view: FleetView, query: Record<string, string> = {}, supabase: { url: string; key: string } | null = { url: 'http://x', key: 'anon' }) =>
  renderToStaticMarkup(createElement(FleetScreen, { view, supabase, signinError: null, query }));
const fleet = (viewerId: string, asked: string | null = null, read: Record<string, unknown> = {}) =>
  fleetOf({ ...READ, ...read } as never, { asked, viewerId, period: '30d', now: NOW });

describe('/app/fleet', () => {
  it('for a viewer in a fleet: the picker, the fleet\'s name and season place, its board', () => {
    const html = screen(fleet('u-ada'), { period: '30d' });
    const t = text(html);
    expect(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1]).toContain('OCTO');
    expect(t).toContain('#2 of 2 fleets · September');
    expect(t).toContain('PRs merged 1');
    expect(t).toContain('Paul Etienne OCTO 0 1 0 · 0 · 0 9');
    expect(t).not.toContain('SOL ');
    expect(t).not.toContain('Fleets · September');
    expect(html).toMatch(/<a href="\/app\/fleet\?period=30d&amp;fleet=octo" aria-current="page">(?:(?!<\/a>)[\s\S])*OCTO/);
    expect(html).toContain('href="/app/fleet?period=30d&amp;fleet=beaver"');
    expect(t).toContain('OCTO ◀ (your fleet)');
  });

  it('shows each fleet as a chip with its mascot: every picker link and the page\'s header (PRD 652)', () => {
    const html = screen(fleet('u-ada'), { period: '30d' });
    const chip = (label: string, color: string) =>
      new RegExp(`<span class="fleet-chip is-table" style="--fleet:${color}"><span class="fleet-chip-mascot" aria-hidden="true"><svg [\\s\\S]*?<span class="fleet-chip-label">${label}</span></span>`);
    const links = [...html.matchAll(/<a href="\/app\/fleet\?[^"]*fleet=[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1]);
    expect(links).toHaveLength(2);
    expect(links[0]).toMatch(chip('BEAVER', '#8a5a2b'));
    expect(links[1]).toMatch(chip('OCTO', '#3355ff'));
    expect(links[1]).toContain('<span class="fleet-yours"><span aria-hidden="true"> ◀</span><span class="ask-sr"> (your fleet)</span></span>');
    expect(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1]).toMatch(chip('OCTO', '#3355ff'));
  });

  it('keeps each picker chip plain inside its link, and the page\'s own header unlinked, while board chips link (PRD 698)', () => {
    const html = screen(fleet('u-ada'), { period: '30d' });
    expect(nestedLinks(html)).toBe(0);
    expect(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1]).not.toContain('<a');
    expect(html).toMatch(/<a class="person-chip is-table" href="\/app\/people\/[^"]+">/);
  });

  it('the period switch keeps the fleet asked for', () => {
    const html = screen(fleet('u-ada', 'beaver'), { fleet: 'beaver', period: '30d' });
    expect(html).toContain('href="/app/fleet?fleet=beaver&amp;period=7d"');
    expect(html).toMatch(/<a href="\/app\/fleet\?period=30d&amp;fleet=beaver" aria-current="page">(?:(?!<\/a>)[\s\S])*BEAVER/);
    expect(text(html)).toContain('#1 of 2 fleets · September');
  });

  it('for a solo viewer: the picker and the line asking to pick, no board', () => {
    const t = text(screen(fleet('u-sol'), { period: '30d' }));
    expect(t).toContain('BEAVER');
    expect(t).toContain('Pick a fleet to see its board');
    expect(t).not.toContain('PRs merged');
  });

  it('for an unknown ?fleet: the picker line', () => {
    const t = text(screen(fleet('u-ada', 'ghosts'), { fleet: 'ghosts' }));
    expect(t).toContain('Pick a fleet to see its board');
    expect(t).toContain('OCTO ◀ (your fleet)');
  });

  it('for a workspace with no fleet: the line, linking to Settings › Fleets', () => {
    const html = screen(fleet('u-ada', null, { galaxy: { heroes: [], teams: [] } }));
    expect(text(html)).toContain('This workspace has no fleet yet');
    expect(html).toContain('href="/app/settings/fleets"');
  });

  it('with the galaxy down: the picker and the place say so, the board draws', () => {
    const t = text(screen(fleet('u-ada', null, { galaxy: 'unreadable' })));
    expect(t).toContain(UNREADABLE_LINE);
    expect(t).toContain('September place: couldn’t load it');
    expect(t).toContain('PRs merged 1');
  });

  it('closed, signed out and in no workspace each say so', () => {
    expect(text(screen({ kind: 'closed' }))).toContain('The fleet board is not open here');
    expect(text(screen({ kind: 'sign-in' }))).toContain('Sign in with GitHub');
    expect(text(screen({ kind: 'sign-in' }, {}, null))).toContain('The fleet board is not open here');
    expect(text(screen({ kind: 'no-workspace' }))).toContain('Your account is not in a workspace');
  });

  describe('in the demo', () => {
    const galaxy = buildGalaxy(demoEvents(NOW), { projects: DEMO_PROJECTS, now: NOW, source: 'demo' });

    it('the demo you plays solo: the picker of every demo fleet, and the line asking to pick', () => {
      const t = text(screen(demoFleetBoard(null, '7d', NOW, galaxy)));
      expect(t).toContain('Pick a fleet to see its board');
      for (const team of galaxy.teams) expect(t).toContain(team.label);
    });

    it('a fleet picked shows every part, a member at 0 points among them', () => {
      const t = text(screen(demoFleetBoard('builders', '7d', NOW, galaxy), { fleet: 'builders' }));
      expect(t).not.toContain(UNREADABLE_LINE);
      for (const part of ['PRs merged', 'PRDs', 'Repositories', 'Questions answered', 'PRs merged per day', 'PRD events per day', 'People', 'Repositories involved']) {
        expect(t).toContain(part);
      }
      expect(t).toMatch(/PAUL BUILDERS 0 \d+ /);
      expect(t).toMatch(/#\d of \d fleets · September/);
    });
  });
});
