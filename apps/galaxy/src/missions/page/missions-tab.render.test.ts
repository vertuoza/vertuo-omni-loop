import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { fleetOf } from '../../dashboard/fleet/load';
import { FleetScreen } from '../../dashboard/fleet/FleetScreen';
import type { VirtualOf } from '../../dashboard/fleet/fleet';
import { MissionsTab } from './MissionsTab';
import { missionOf, type MissionRow, type MissionsView } from './missions-tab';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

// The Missions tab as the server renders it (PRD 2842 s7, the `mission-start` screen): each mission's goal,
// status, progress, the PRDs it waits on with their links, and the one button its status allows.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const row = (over: Partial<MissionRow>): MissionRow => ({
  id: '22222222-2222-4222-8222-222222222222', repo: 'acme/shop', number: 40, title: 'Pay online', goal: 'Every quote can be paid online.', status: 'draft', waitingOn: null, prds: [parsePrd(1), parsePrd(2)], ...over,
});
const view = (...missions: MissionRow[]): MissionsView => ({ workspace: WORKSPACE, fleet: 'night-shift', missions: missions.map((m) => missionOf(m, [])) });
const html = (v: MissionsView) => renderToStaticMarkup(createElement(MissionsTab, { view: v }));

describe('MissionsTab', () => {
  it('says there is no mission yet', () => {
    expect(text(html(view()))).toContain('No mission yet');
  });

  it('shows a draft with Start as its primary action', () => {
    const out = html(view(row({})));
    expect(text(out)).toContain('Every quote can be paid online. Draft Not started Brief');
    expect(out).toMatch(/<button[^>]*data-primary[^>]*>Start/);
    expect(out).toContain('href="https://github.com/acme/shop/issues/40"');
  });

  it('shows a waiting mission with the PRD it waits on, linked, and Pause', () => {
    const out = html(view(row({ status: 'waiting', waitingOn: 'PRD 2803: approve it' })));
    expect(text(out)).toContain('Waiting on you');
    expect(text(out)).toContain('PRD 2803 : approve it');
    expect(out).toContain('href="https://github.com/acme/shop/issues/2803"');
    expect(out).not.toContain('data-primary');
    expect(text(out)).toContain('Pause');
  });

  it('shows Resume on a paused mission, and no button on a delivered one', () => {
    expect(text(html(view(row({ status: 'paused' }))))).toContain('Resume');
    expect(html(view(row({ status: 'delivered' })))).not.toContain('<button');
  });

  it('is the Missions tab of a virtual fleet, and the tab is not open without its block', () => {
    const read = { roster: [], activity: [], answered: [], prds: [], galaxy: { heroes: [], teams: [{ name: 'night-shift', label: 'Night Shift', color: '#4fb0ff', mascot: 'robot', points: 0, rank: 1 }] } };
    const virtual: VirtualOf = { workspace: WORKSPACE, mascots: ['robot'], names: ['night-shift'] };
    const board = { ...fleetOf(read, { asked: 'night-shift', viewerId: 'u', period: '30d', now: new Date('2026-09-26T10:00:00Z') }), virtual };
    const screen = (missions?: React.ReactNode) => renderToStaticMarkup(createElement(FleetScreen, { view: board, supabase: null, signinError: null, query: { tab: 'missions' }, missions }));
    expect(text(screen(createElement(MissionsTab, { view: view(row({})) })))).toContain('Every quote can be paid online.');
    expect(text(screen())).toContain('This tab is not open yet.');
  });
});
