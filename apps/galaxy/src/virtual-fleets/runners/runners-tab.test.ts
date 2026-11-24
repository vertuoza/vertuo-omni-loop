import { describe, expect, it } from 'vitest';
import type { Board } from '../../runners/runners.contract';
import { DEMO_FLEETS, DEMO_MISSIONS, DEMO_PRDS, demoFleetBoard } from './runners-view.demo';
import { fleetRunnersView } from './runners-view';
import { fleetHeadOf, runnersTabOf } from './runners-tab';
import { FLEET_TABS, tabOf } from '../../dashboard/fleet/tabs';

const NOW = new Date('2027-02-01T12:00:00.000Z');
const board = demoFleetBoard(NOW);
const mission = (id: string, progress = '3 of 6 merged · 2 ready', waits: unknown[] = []) =>
  ({ id, title: 'Checkout rework', status: 'running' as const, progress, waits: waits as never[] });
const viewOf = (name: keyof typeof DEMO_MISSIONS, b: Board = board) => {
  const fleet = DEMO_FLEETS.find((f) => f.name === name) ?? { name, label: name };
  return fleetRunnersView(b, fleet, [DEMO_MISSIONS[name]], NOW, DEMO_PRDS, DEMO_FLEETS);
};

describe('the Runners tab', () => {
  it('reads Operation room · Missions · Heroes · Runners · Board · Commander, and ?tab=runners opens it', () => {
    expect(FLEET_TABS.map((tab) => tab.label)).toEqual(['Operation room', 'Missions', 'Heroes', 'Runners', 'Board', 'Commander']);
    expect(tabOf('runners')).toBe('runners');
  });

  it('AC-3: Orion\'s own runner is under Its own runners with its Engineer job, and a Terminal job', () => {
    const tab = runnersTabOf(viewOf('orion'), board);
    const [orbit] = tab.own;
    expect(orbit?.row.name).toBe('orbit-1');
    expect(orbit?.row.jobs[0]).toMatchObject({ roleWords: 'Engineer', status: 'Running 18 min' });
    expect(orbit?.terminalJob).not.toBeNull();
  });

  it('AC-4: the Shared runner running Orion\'s work says 1 for Orion and why', () => {
    const [shared] = runnersTabOf(viewOf('orion'), board).shared;
    expect(shared?.row).toMatchObject({ name: 'shared-mac-3', forFleetWords: '1 for Orion', reason: 'No runner of Orion holds acme/mobile' });
  });

  it('AC-5: Nova has no runner of its own and box-west runs its work', () => {
    const tab = runnersTabOf(viewOf('nova'), board);
    expect(tab.emptyWords).toBe('No runner of its own.');
    expect(tab.shared.map((r) => r.row.name)).toEqual(['box-west']);
  });

  it('AC-6: Atlas\'s only runner is offline with two jobs waiting', () => {
    const tab = runnersTabOf(viewOf('atlas'), board);
    expect(tab.own[0]?.row.stateWords).toBe('Offline, 2 h ago');
    expect(tab.own[0]?.note).toBe('Nothing runs.');
    expect(tab.notes).toEqual(['2 jobs wait for atlas-1.']);
    expect(tab.waiting.map((j) => j.reason)).toEqual(['Waits for atlas-1.', 'Waits for atlas-1.']);
  });

  it('a job waiting on the viewer is listed with Answer', () => {
    const asking = { ...board.jobs[0]!, id: 'a1', status: 'done' as const, outcome: 'human' as const, endedAt: NOW.toISOString() };
    expect(runnersTabOf(viewOf('orion', { ...board, jobs: [...board.jobs, asking] }), board).answers.map((j) => j.id)).toEqual(['a1']);
  });

  it('a workspace with no runner says so and how to start one', () => {
    const none: Board = { ...board, runners: [], jobs: [] };
    const view = viewOf('orion', none);
    const tab = runnersTabOf(view, none);
    expect(tab).toMatchObject({ emptyWords: 'No runner in this workspace.', startCommand: 'omni runner --name <name> --repos <dir>' });
    expect(fleetHeadOf(view, []).none).toBe('No runner yet');
  });

  it('every runner out of tokens reads Out of tokens until hh:mm above the waiting jobs', () => {
    const queued = { ...board.jobs[3]!, id: 'q', toFleet: 'orion', repo: 'acme/storefront-api', missionId: DEMO_MISSIONS.orion };
    const health = { cpu: 1, load1: 0, cores: 8, memUsed: 1, memTotal: 2, diskFree: 1, diskTotal: 2, paused: 'no tokens left', at: NOW.toISOString(), accounts: [{ id: 'a', agent: 'claude', state: 'out' as const, resetsAt: '2027-02-01T14:00:00.000Z' }] };
    const paused: Board = { ...board, jobs: [...board.jobs, queued], runners: board.runners.map((r) => (r.id === 'r-orbit-1' ? { ...r, state: 'online', used: 0, health } : r)) };
    expect(runnersTabOf(viewOf('orion', paused), paused).tokens).toBe('Out of tokens until 14:00');
  });
});

describe('the Runs on line', () => {
  it('lists the runners under the fleet\'s name, a Shared one marked with its jobs', () => {
    const head = fleetHeadOf(viewOf('orion'), [mission(DEMO_MISSIONS.orion)]);
    expect(head.runsOn.map((c) => [c.name, c.words])).toEqual([['orbit-1', 'Busy, 3 of 3'], ['shared-mac-3', 'Shared, 1 job']]);
    expect(head.mission).toEqual({ title: 'Checkout rework', merged: '3 of 6 merged', waits: null });
  });

  it('says an offline runner offline and counts what waits on the viewer', () => {
    const head = fleetHeadOf(viewOf('atlas'), [mission(DEMO_MISSIONS.atlas, '0 of 2 merged', [{}])]);
    expect(head.runsOn.map((c) => c.words)).toEqual(['Offline, 2 h ago']);
    expect(head.mission?.waits).toBe('1 waits on you');
  });

  it('says why a fleet with no runner lists none', () => {
    const none: Board = { ...board, runners: board.runners.filter((r) => r.fleet !== 'orion' && r.id !== 'r-shared-mac-3') };
    expect(fleetHeadOf(viewOf('orion', none), []).none).toBe('No runner of its own');
  });
});
