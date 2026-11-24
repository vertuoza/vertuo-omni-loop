import { describe, expect, it } from 'vitest';
import type { Board, Job } from '../../runners/runners.contract';
import { DEMO_FLEETS, DEMO_MISSIONS, DEMO_PRDS, demoFleetBoard } from './runners-view.demo';
import { fleetRunnersView } from './runners-view';

const NOW = new Date('2027-02-01T12:00:00.000Z');
const board = demoFleetBoard(NOW);
const fleet = (name: string) => DEMO_FLEETS.find((f) => f.name === name) ?? DEMO_FLEETS[0]!;
const viewOf = (name: keyof typeof DEMO_MISSIONS, b: Board = board) => fleetRunnersView(b, fleet(name), [DEMO_MISSIONS[name]], NOW, DEMO_PRDS, DEMO_FLEETS);

describe('the fleet runners view', () => {
  it('AC-2: a fleet shows its own busy runner and the Shared runner running its work', () => {
    const view = viewOf('orion');
    expect(view.own.map((r) => [r.name, r.stateWords, r.slotsWords])).toEqual([['orbit-1', 'Busy', '3 of 3']]);
    expect(view.runsOn.map((r) => [r.name, r.shared])).toEqual([['orbit-1', false], ['shared-mac-3', true]]);
  });

  it('AC-3: a job row says its role, PRD, status and time', () => {
    const [row] = viewOf('orion').own[0]?.jobs ?? [];
    expect(row).toMatchObject({ roleWords: 'Engineer', status: 'Running 18 min', since: '18 min', tone: 'run', canAnswer: false });
    expect(row?.prd).toMatchObject({ number: 412, title: 'Checkout totals' });
  });

  it('AC-4: work on a Shared runner says how many jobs and why', () => {
    const [shared] = viewOf('orion').shared;
    expect(shared).toMatchObject({ name: 'shared-mac-3', shared: true, forFleetWords: '1 for Orion', reason: 'No runner of Orion holds acme/mobile' });
    expect(shared?.jobs[0]?.roleWords).toBe('QA');
  });

  it('AC-5: a fleet with no runner of its own reads so and lists the Shared runner running its work', () => {
    const view = viewOf('nova');
    expect(view.own).toEqual([]);
    expect(view.emptyWords).toBe('No runner of its own.');
    expect(view.warning).toBe('No runner of its own');
    expect(view.shared.map((r) => r.name)).toEqual(['box-west']);
  });

  it('AC-6: a fleet whose only runner is offline says when and who waits', () => {
    const view = viewOf('atlas');
    expect(view.own[0]).toMatchObject({ name: 'atlas-1', stateWords: 'Offline, 2 h ago', offline: true });
    expect(view.notes).toEqual(['2 jobs wait for atlas-1.']);
    expect(view.warning).toBe('Its only runner is offline');
    expect(view.waiting.map((j) => j.reason)).toEqual(['Waits for atlas-1.', 'Waits for atlas-1.']);
  });

  it('a job of the fleet is one sent to it or one of its missions, and no other', () => {
    const view = viewOf('orion');
    expect(view.own[0]?.jobs).toHaveLength(1);
    expect(view.shared.flatMap((r) => r.jobs)).toHaveLength(1);
    expect(view.waiting).toEqual([]);
  });

  it('no runner in the workspace gives the start command', () => {
    const view = viewOf('orion', { ...board, runners: [], jobs: [] });
    expect(view).toMatchObject({ empty: 'none-in-workspace', emptyWords: 'No runner in this workspace.', startCommand: 'omni runner --name <name> --repos <dir>' });
  });

  it('a queued job says which busy runner it waits for', () => {
    const queued: Job = { ...board.jobs[3]!, id: 'q1', toFleet: 'orion', repo: 'acme/storefront-api', missionId: DEMO_MISSIONS.orion };
    const view = viewOf('orion', { ...board, jobs: [...board.jobs, queued] });
    expect(view.waiting.map((j) => j.reason)).toEqual(['Waits for orbit-1: 3 of 3 busy']);
  });

  it('a queued job no runner holds reads Cannot run', () => {
    const queued: Job = { ...board.jobs[3]!, id: 'q2', toFleet: 'orion', repo: 'acme/ghost', missionId: DEMO_MISSIONS.orion };
    const view = viewOf('orion', { ...board, jobs: [...board.jobs, queued] });
    expect(view.waiting[0]).toMatchObject({ reason: 'Cannot run: No runner of Orion holds acme/ghost', status: 'Cannot run', tone: 'fail' });
  });

  it('runners paused or out of tokens wait in a few words', () => {
    const queued: Job = { ...board.jobs[3]!, id: 'q3', toFleet: 'orion', repo: 'acme/storefront-api', missionId: DEMO_MISSIONS.orion };
    const health = (paused: string, resetsAt?: string) => ({
      cpu: 1, load1: 0, cores: 8, memUsed: 1, memTotal: 2, diskFree: 1, diskTotal: 2, paused, at: NOW.toISOString(),
      ...(resetsAt === undefined ? {} : { accounts: [{ id: 'a', agent: 'claude', state: 'out' as const, resetsAt }] }),
    });
    const withHealth = (h: ReturnType<typeof health>): Board => ({
      ...board, jobs: [...board.jobs, queued], runners: board.runners.map((r) => (r.id === 'r-orbit-1' ? { ...r, state: 'online', used: 0, health: h } : r)),
    });
    expect(viewOf('orion', withHealth(health('memory 91%'))).waiting[0]?.reason).toBe('orbit-1 is paused');
    expect(viewOf('orion', withHealth(health('no tokens left', '2027-02-01T15:30:00.000Z'))).waiting[0]?.reason).toBe('Out of tokens until 15:30');
  });

  it('a job that waits on the viewer carries Answer', () => {
    const asking: Job = { ...board.jobs[0]!, id: 'a1', status: 'done', outcome: 'human', endedAt: NOW.toISOString() };
    const view = viewOf('orion', { ...board, jobs: [...board.jobs, asking] });
    expect(view.answers.map((j) => [j.id, j.canAnswer])).toEqual([['a1', true]]);
  });
});
