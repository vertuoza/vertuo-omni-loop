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
  id: '22222222-2222-4222-8222-222222222222', repo: 'acme/shop', number: 40, title: 'Pay online', goal: 'Every quote can be paid online.', status: 'draft', waitingOn: null, prds: [parsePrd(1), parsePrd(2)], level: 'with-you', inPlan: false, ...over,
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

  it('says committee only for a plan-repository mission at alone, and offers no own-branch (PRD 2896 s14)', () => {
    const out = html(view(row({ level: 'alone', inPlan: true })));
    expect(text(out)).toContain('committee only: a person merges each target&#x27;s pull request');
    expect(out).not.toContain('value="own-branch"');
  });

  it('shows each mission\'s level, and Change for this mission on a draft alone (PRD 2896)', () => {
    const draft = html(view(row({ level: 'own-branch' })));
    expect(text(draft)).toContain('Level: Own branch');
    expect(text(draft)).toContain('Change for this mission');
    expect(draft).toMatch(/<option value="own-branch" selected/);
    const running = html(view(row({ status: 'running', level: 'alone' })));
    expect(text(running)).toContain('Level: Works alone');
    expect(running).not.toContain('<select');
    // A mission at with-you reads as it did, with the level's name added to its row.
    expect(text(html(view(row({}))))).toContain('Level: Reviews with you');
  });

  it('draws the Branch line above with-you, and none at with-you (PRD 2896 s8)', () => {
    const joined = { mission: row({}).id, kind: 'prd-joined', prd: parsePrd(1), link: null, sentence: 'PRD 1 joined mission/40-pay: #9 squash-merged.' };
    const above = renderToStaticMarkup(createElement(MissionsTab, { view: { workspace: WORKSPACE, fleet: 'night-shift', missions: [missionOf(row({ status: 'running', level: 'own-branch' }), [joined])] } }));
    expect(text(above)).toContain('Branch: PRD 1 · up to date Mission pull request');
    expect(text(above)).toContain('0 of 2 on main · 1 joined');
    expect(above).toContain('href="https://github.com/acme/shop/pulls?q=is%3Apr%20head%3Amission%2F40-pay"');
    const held = row({ status: 'waiting', level: 'alone', waitingOn: 'mission/40-pay is red (checks) since PRD 1 joined: no further PRD joins' });
    expect(text(renderToStaticMarkup(createElement(MissionsTab, { view: { workspace: WORKSPACE, fleet: 'night-shift', missions: [missionOf(held, [joined])] } })))).toContain('is red (checks)');
    expect(text(html(view(row({ status: 'running' }))))).not.toContain('Branch:');
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

  it('at Works alone shows only what was escalated under Waiting on you, and the trust line (PRD 2896 s11)', () => {
    const events = [{ mission: 'm', kind: 'decided', prd: parsePrd(2), link: null, sentence: 'The committee approved PRD 2: pm yes, architect yes, reviewer yes.' }];
    const waiting = row({ level: 'alone', status: 'waiting', waitingOn: 'PRD 3: the committee sent it to you: a locked law' });
    const alone = text(html({ workspace: WORKSPACE, fleet: 'night-shift', missions: [missionOf(waiting, events)] }));
    expect(alone).toContain('1 decisions by the fleet · 0 overturned');
    expect(alone).toContain('Waiting on you');
    expect(alone).toContain('the committee sent it to you: a locked law');
    expect(text(html(view(row({ waitingOn: 'PRD 3: merge it' }))))).not.toContain('decisions by the fleet');
  });

  it('at Works alone names the PRDs the fleet added and the rows its cap left unwritten (PRD 2896 s12)', () => {
    const events = [
      { mission: 'm', kind: 'not-written', prd: null, link: null, sentence: 'Refunds by card: not written: the cap is 1.' },
      { mission: 'm', kind: 'prd-added', prd: parsePrd(50), link: null, sentence: 'PRD 50 added by the fleet.' },
    ];
    const alone = text(html({ workspace: WORKSPACE, fleet: 'night-shift', missions: [missionOf(row({ level: 'alone', status: 'running' }), events)] }));
    expect(alone).toContain('PRD 50 added by the fleet Refunds by card: not written: the cap is 1.');
    expect(text(html(view(row({ level: 'alone', status: 'running' }))))).not.toContain('added by the fleet');
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

describe('Decide the bugs (PRD 3001, `fleet-room` 1.A and 1.B)', () => {
  it('reads Waits for you · Decide the bugs, lists each bug by issue and offers the two actions', () => {
    const out = html(view(row({ status: 'waiting', waitingOn: 'PRD 3001: decide bugs #13 #14' })));
    expect(text(out)).toContain('PRD 3001 : Waits for you · Decide the bugs #13 #14 Send on to the Reviewer Stop this PRD');
    expect(out).toContain('href="https://github.com/acme/shop/issues/13"');
    expect(out).toMatch(/<button[^>]*data-primary[^>]*>Send on to the Reviewer/);
    expect(out).toContain('>Stop this PRD</button>');
  });

  it('offers no pick for any other wait', () => {
    const out = html(view(row({ status: 'waiting', waitingOn: 'PRD 3001: approve it' })));
    expect(text(out)).toContain('approve it');
    expect(out).not.toContain('Stop this PRD');
  });
});
