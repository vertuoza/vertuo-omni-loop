import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { fleetOf } from './load';
import { FleetScreen, type FleetView } from './FleetScreen';
import type { VirtualOf } from './fleet';
import { tabOf } from './tabs';
import { HeroesTab } from '../../virtual-fleets/heroes/HeroesTab';
import type { HeroesView } from '../../virtual-fleets/heroes/heroes';
import { ENGINEER_ID } from '../../virtual-fleets/heroes/heroes.fake';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

// A Virtual Fleet's tabs and Heroes tab (PRD 2842 s6, the `fleet-frame` and `fleet-seats` screens): the
// fleet reads Operation room · Missions · Heroes · Board, an ordinary fleet only its board; Heroes shows
// each hero's sprite, name, role, skills, agent and model, limits and whether it works alone; an owner
// sees Add a hero and Remove, a member neither.

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
const heroOf = (id: string, role: 'engineer' | 'pm', skills: string[], position: number) => ({
  id, fleet: 'night-shift', name: role === 'pm' ? 'PM' : 'Engineer', role, skills, agent: 'claude', model: role === 'pm' ? 'opus' : 'sonnet',
  limits: ['It never merges into the default branch.'], position,
});
const HEROES = (canEdit: boolean): HeroesView => ({
  workspace: VIRTUAL.workspace, fleet: 'night-shift', color: '#4fb0ff', canEdit,
  heroes: [heroOf(ENGINEER_ID, 'engineer', ['yolo', 'wave'], 0), heroOf('22222222-2222-4222-8222-222222222299', 'pm', ['pitch', 'plan'], 1)],
});
const screen = (view: FleetView, query: Record<string, string> = {}) => renderToStaticMarkup(createElement(FleetScreen, { view, supabase: { url: 'http://x', key: 'anon' }, signinError: null, query }));
const board = (asked: string, heroes?: HeroesView | null) =>
  ({ ...fleetOf(READ, { asked, viewerId: 'u-ada', period: '7d', now: NOW }), virtual: VIRTUAL, ...(heroes === undefined ? {} : { heroes }) }) as FleetView;

describe('the Fleet\'s tabs', () => {
  it('reads Operation room · Missions · Heroes · Board on a virtual fleet, the Operation room first', () => {
    const html = screen(board('night-shift', HEROES(true)));
    const nav = /<nav class="fleet-tabs"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? '';
    expect(text(nav)).toBe('Operation room Missions Heroes Board');
    expect(nav).toMatch(/href="\/app\/fleet\?tab=room" aria-current="page"/);
    expect(nav).toContain('href="/app/fleet?tab=heroes"');
  });

  it('keeps the rest of the query in each tab\'s link', () => {
    const html = screen(board('night-shift', HEROES(true)), { fleet: 'night-shift', period: '30d' });
    expect(html).toContain('href="/app/fleet?fleet=night-shift&amp;period=30d&amp;tab=board"');
  });

  it('shows no tabs on an ordinary fleet, only its board', () => {
    const html = screen(board('beaver'));
    expect(html).not.toContain('fleet-tabs');
    expect(html).not.toContain('Heroes');
  });

  it('shows the board unchanged under the Board tab, and no heroes', () => {
    const html = screen(board('night-shift', HEROES(true)), { tab: 'board' });
    expect(html).toMatch(/href="\/app\/fleet\?tab=board" aria-current="page"/);
    expect(html).not.toContain('data-screen="fleet-seats"');
    expect(html).toContain('class="dash"');
  });

  it('says the tabs the next slices build are not open yet', () => {
    expect(text(screen(board('night-shift', HEROES(true)), { tab: 'missions' }))).toContain('This tab is not open yet.');
    expect(text(screen(board('night-shift', HEROES(true))))).toContain('This tab is not open yet.');
  });

  it('shows the Heroes tab, or says it could not load them', () => {
    expect(screen(board('night-shift', HEROES(true)), { tab: 'heroes' })).toContain('data-screen="fleet-seats"');
    const none = text(screen(board('night-shift', null), { tab: 'heroes' }));
    expect(none).toContain('Couldn’t load this');
  });

  it('chooses a tab from the query, the Operation room when it names none of them', () => {
    expect(tabOf('heroes')).toBe('heroes');
    expect(tabOf(['missions', 'board'])).toBe('missions');
    expect(tabOf('seats')).toBe('room');
    expect(tabOf(undefined)).toBe('room');
  });
});

describe('the Heroes tab', () => {
  const render = (view: HeroesView) => renderToStaticMarkup(createElement(HeroesTab, { view }));

  it('shows each hero\'s sprite, name and role as an agent, skills, agent and model, limits and whether it works alone', () => {
    const t = text(render(HEROES(false)));
    expect(t).toContain('Engineer · Engineer · agent Works alone /omni:yolo /omni:wave claude · sonnet It never merges into the default branch.');
    expect(t).toContain('PM · PM · agent A person does this today · Its brainstorm and roadmap need a person. /omni:pitch /omni:plan claude · opus');
    expect(render(HEROES(false)).match(/<svg /g)).toHaveLength(2);
  });

  it('shows a hero with no skill as `No skill yet`', () => {
    const view = HEROES(false);
    view.heroes = [{ ...heroOf(ENGINEER_ID, 'engineer', [], 0), role: 'engineer' }];
    expect(text(render(view))).toContain('No skill yet');
  });

  it('offers an owner Add a hero and Remove, the last hero\'s Remove disabled', () => {
    const html = render(HEROES(true));
    expect(html).toMatch(/<button type="button" class="ask-button" data-primary="">Add a hero<\/button>/);
    expect(html.match(/hero-remove/g)).toHaveLength(2);
    expect(html).not.toMatch(/hero-remove[^>]*disabled/);
    const one = HEROES(true);
    one.heroes = one.heroes.slice(0, 1);
    expect(render(one)).toMatch(/hero-remove[^>]*disabled/);
  });

  it('offers a member neither, and says only an owner changes them', () => {
    const html = render(HEROES(false));
    expect(html).not.toContain('Add a hero');
    expect(html).not.toContain('Remove');
    expect(text(html)).toContain('Only an owner of the workspace adds or removes a hero.');
  });

  it('offers no Add a hero when the fleet holds every role', () => {
    const all = HEROES(true);
    all.heroes = (['engineer', 'qa', 'reviewer', 'pm', 'architect'] as const).map((role, i) => ({ ...heroOf(`22222222-2222-4222-8222-22222222220${i}`, 'pm', [], i), role }));
    expect(render(all)).not.toContain('Add a hero');
  });

  it('names no hero after a person', () => {
    const t = text(render(HEROES(true)));
    expect(t).not.toMatch(/\b(Ada|Ben|Dan|Lea|Marc|Jan|Claire)\b/);
  });
});
