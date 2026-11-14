import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { fleetOf } from './load';
import { FleetScreen, type FleetView } from './FleetScreen';
import type { VirtualOf } from './fleet';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));
const { demoFleetBoard } = await import('./fleet');

// /app/fleet makes Virtual Fleets (PRD 2842 s1): `+ New virtual fleet` closes the row of fleet chips, and
// is the page's main button when the workspace has no fleet yet; a virtual fleet's chip says so. The
// Fleet section still cannot make a players' fleet: that stays in Settings › Fleets.

const NOW = new Date('2026-09-26T10:00:00Z');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const VIRTUAL: VirtualOf = { workspace: '11111111-1111-4111-8111-111111111111', mascots: ['beaver', 'robot'], names: ['night-shift'] };
const READ = {
  roster: [], activity: [], answered: [], prds: [],
  galaxy: {
    heroes: [],
    teams: [
      { name: 'beaver', label: 'BEAVER', color: '#8a5a2b', points: 90, rank: 1 },
      { name: 'night-shift', label: 'Night Shift', color: '#4fb0ff', mascot: 'robot', points: 0, rank: 2 },
    ],
  },
};
const screen = (view: FleetView) => renderToStaticMarkup(createElement(FleetScreen, { view, supabase: { url: 'http://x', key: 'anon' }, signinError: null, query: {} }));
const board = (asked: string | null, teams = READ.galaxy.teams) =>
  ({ ...fleetOf({ ...READ, galaxy: { ...READ.galaxy, teams } }, { asked, viewerId: 'u-ada', period: '7d', now: NOW }), virtual: VIRTUAL });

describe('/app/fleet and Virtual Fleets', () => {
  it('closes the row of fleet chips with `+ New virtual fleet`, a quiet button', () => {
    const html = screen(board('beaver'));
    const picker = /<nav class="fleet-picker"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? '';
    expect(picker).toMatch(/<li><button type="button" class="ask-button quiet vf-open">\+ New virtual fleet<\/button><\/li><\/ul><\/nav>$/);
  });

  it('marks a virtual fleet\'s chip, and only its', () => {
    const t = text(screen(board('night-shift')));
    expect(t).toContain('Night Shift Virtual');
    expect(t).not.toContain('BEAVER Virtual');
  });

  it('shows the button on the picker too', () => {
    expect(screen(board(null))).toContain('+ New virtual fleet');
  });

  it('makes it the page\'s main button when the workspace has no fleet yet, under the line that says so', () => {
    const html = screen(board(null, []));
    const t = text(html);
    expect(t).toContain('This workspace has no fleet yet. Settings › Fleets + New virtual fleet');
    expect(html).toContain('<button type="button" class="ask-button vf-open" data-primary="">+ New virtual fleet</button>');
  });

  it('shows no button when the read does not say where to make the fleet', () => {
    const { virtual: _, ...bare } = board(null, []);
    expect(screen(bare)).not.toContain('New virtual fleet');
  });

  it('offers it in the demo too, whose drawer makes none', () => {
    const demo = demoFleetBoard(null, '7d', NOW);
    expect(demo.kind === 'no-workspace' ? null : demo.virtual?.workspace).toBeNull();
    expect(screen(demo)).toContain('+ New virtual fleet');
  });
});
