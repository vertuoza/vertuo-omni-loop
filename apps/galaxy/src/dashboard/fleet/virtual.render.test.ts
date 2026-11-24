import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { fleetOf } from './load';
import { FleetScreen, type FleetView } from './FleetScreen';
import type { VirtualOf } from './fleet';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

// /app/fleet keeps the players' fleets (PRD 3233 s3, AC-1): its picker leaves AI fleets out and has no New AI fleet button, which
// lives on AI Fleet. An AI fleet's board, drawn here, links on /app/ai-fleet and has no picker. A players' fleet is made in Settings › Fleets.

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

describe('/app/fleet and AI fleets (PRD 3233 s3)', () => {
  it('lists the players\' fleets only in its picker, with no New AI fleet button', () => {
    const html = screen(board('beaver'));
    const picker = /<nav class="fleet-picker"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? '';
    expect(text(picker)).toContain('BEAVER');
    expect(text(picker)).not.toContain('Night Shift');
    expect(html).not.toContain('New AI fleet');
  });

  it('lists no AI fleet in the picker either', () => {
    expect(text(screen(board(null)))).not.toContain('Night Shift');
    expect(screen(board(null))).not.toContain('New AI fleet');
  });

  it('draws an AI fleet\'s page with no picker and no season place, its tabs on /app/ai-fleet', () => {
    const html = screen(board('night-shift'));
    expect(html).not.toContain('fleet-picker');
    expect(text(html)).not.toContain('place');
    expect(html).toContain('href="/app/ai-fleet?tab=missions"');
  });

  it('says a workspace has no fleet yet, Settings › Fleets kept, with no New AI fleet button', () => {
    const html = screen(board(null, []));
    expect(text(html)).toContain('Fleet This workspace has no fleet yet. Settings › Fleets');
    expect(html).not.toContain('New AI fleet');
  });
});
