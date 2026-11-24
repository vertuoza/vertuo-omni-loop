import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { fleetOf } from '../../dashboard/fleet/load';
import { FleetScreen } from '../../dashboard/fleet/FleetScreen';
import type { VirtualOf } from '../../dashboard/fleet/fleet';
import { MissionsTab } from './MissionsTab';
import { dailyOf, missionOf, NO_BUDGET, type BudgetRead, type MissionRow, type MissionsView } from './missions-tab';

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
    expect(draft).toMatch(/aria-label="Change for this mission"[^>]*><span class="omni-select__value">Own branch<\/span>/);
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

  it('is the Missions tab of a AI fleet, and the tab is not open without its block', () => {
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

// The token caps as the server renders them (PRD 3040, `mission-start` 1.A, 1.B and 1.C).
describe('the token caps (PRD 3040)', () => {
  const STOP = '44444444-4444-4444-8444-444444444444';
  const reads = (over: Partial<BudgetRead>): BudgetRead => ({ ...NO_BUDGET, ...over });
  const shown = (missions: MissionRow[], read: BudgetRead) => html({ workspace: WORKSPACE, fleet: 'night-shift', daily: dailyOf(read), missions: missions.map((m) => missionOf(m, [], [], [], read)) });

  it('draws the fleet\'s cap with Change for an owner only (1.A)', () => {
    const owner = text(shown([row({})], reads({ owner: true, dailyCap: 2_000_000, fleetSpent: 1_300_000 })));
    expect(owner).toContain('Tokens per day: 1.3M of 2M in the last 24 hours Change');
    expect(text(shown([row({})], reads({ owner: false })))).toContain('Tokens per day: No daily cap');
    expect(text(shown([row({ status: 'running' })], reads({ owner: false })))).not.toContain('Change');
  });

  it('draws each mission\'s budget line (AC-10), with Change on a draft only', () => {
    const budgeted = shown([row({ status: 'running', tokens: 2_000_000 })], reads({ spent: new Map([[row({}).id, 412_000]]) }));
    expect(text(budgeted)).toContain('412k of 2M tokens');
    expect(budgeted).not.toContain('Token budget for this mission');
    expect(text(shown([row({ status: 'draft' })], reads({})))).toContain('No token budget Change Token budget for this mission');
  });

  it('draws Paused: budget reached with Raise the cap and Stop the mission on the mission\'s own stop (1.B)', () => {
    const stop = { id: STOP, cap: 'mission' as const, capTokens: 2_000_000, spent: 2_000_000, missions: [row({}).id] };
    const out = shown([row({ status: 'paused', tokens: 2_000_000 })], reads({ owner: true, stops: [stop] }));
    expect(text(out)).toContain('Paused: budget reached 2.0M of 2M tokens · this mission&#x27;s budget Raise the cap Stop the mission');
    expect(text(shown([row({ status: 'paused', tokens: 2_000_000 })], reads({ owner: false, stops: [stop] })))).not.toContain('Raise the cap');
  });

  it('draws the fleet\'s cap once above the list with Resume tomorrow, Raise the cap and Stop the missions (1.C)', () => {
    const stop = { id: STOP, cap: 'fleet' as const, capTokens: 2_000_000, spent: 2_100_000, missions: [row({}).id] };
    const out = shown([row({ status: 'paused' })], reads({ owner: true, dailyCap: 2_000_000, fleetSpent: 2_100_000, stops: [stop] }));
    expect(text(out)).toContain('Paused: this fleet&#x27;s daily cap reached (2M) 2.1M of 2M tokens in the last 24 hours · this fleet&#x27;s daily cap Resume tomorrow Raise the cap Stop the missions');
    expect(out.match(/Resume tomorrow/g)).toHaveLength(1);
    expect(out).not.toContain('>Stop the mission<');
    expect(text(shown([row({ status: 'paused' })], reads({ owner: false, stops: [stop] })))).not.toContain('Raise the cap');
  });
});

// The New mission box and the goal-only rows as the server renders them (PRD omni-loop-24 s6, `mission-start` 1.A to 1.D).
describe('the New mission box (PRD omni-loop-24, `mission-start` 1.A to 1.D)', () => {
  const box = { canStart: true, refusal: null };
  const shown = (over: Partial<MissionsView>, ...missions: MissionRow[]) => html({ workspace: WORKSPACE, fleet: 'night-shift', box, requests: [], missions: missions.map((m) => missionOf(m, [])), ...over });

  it('1.B draws the box above No mission yet, with Start as its primary action and the hint', () => {
    const out = shown({});
    expect(text(out)).toContain('New mission Start Back as one pull request. No mission yet.');
    expect(out).toMatch(/<button[^>]*data-primary[^>]*disabled[^>]*>Start/);
    expect(text(out)).not.toContain('/omni:mission');
  });

  it('1.A lists a request not yet pushed as Writing the mission, and a goal-only mission as Writing the roadmap', () => {
    const requests = [{ id: 'r1', goal: 'Quotes on the phone', words: 'Writing the mission' }];
    const out = text(shown({ requests }, row({ goal: 'Quotes by text', status: 'running', level: 'alone', prds: [], goalOnly: true })));
    expect(out).toContain('Quotes on the phone Writing the mission');
    expect(out).toContain('Quotes by text Running Writing the roadmap Brief');
    expect(out).not.toContain('No mission yet');
  });

  it('1.C disables Start for a member below Works alone and says why', () => {
    const out = shown({ box: { canStart: false, refusal: 'Works alone only. Ask an owner.' } });
    expect(out).toMatch(/<input[^>]*disabled/);
    expect(out).toMatch(/<button[^>]*disabled[^>]*>Start/);
    expect(text(out)).toContain('Works alone only. Ask an owner.');
  });

  it('1.D shows No PRD written with a Why link to the brief, and Waiting on you', () => {
    const why = 'the PM wrote no PRD for the goal: /omni:roadmap ended with no PRD in its record, sent twice.';
    const out = shown({}, row({ goal: 'Quotes on the phone', status: 'waiting', level: 'alone', prds: [], goalOnly: true, waitingOn: why }));
    expect(text(out)).toContain('Quotes on the phone Waiting on you No PRD written Why');
    expect(out).toMatch(/<a href="https:\/\/github.com\/acme\/shop\/issues\/40" title="the PM wrote no PRD for the goal[^"]*">Why/);
  });

  it('has no box in the demo, which starts no mission', () => {
    expect(html({ workspace: null, fleet: 'f', missions: [] })).not.toContain('New mission');
  });
});
