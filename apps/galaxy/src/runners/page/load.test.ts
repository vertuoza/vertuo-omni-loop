import { describe, expect, it, vi } from 'vitest';
import type { Board, Job } from '../runners.contract';
import type { OutboxStand } from '../../dossier/page/stage';
import type { Served } from '../runners.service';
import { answeredJobs, loadRunnersPage, type RunnersPageReads } from './load';

// The Runners page's read (PRD 1830 s3) on fake reads: the workspace first, then the board and the
// fleets; no workspace, the notice; the board refused or a read failing, unreadable; the fleets failing
// alone, the board with no fleet to pick.

vi.mock('vertuo-omni-plan/kit/lib/log/log.ts', () => ({ log: { error: () => undefined } }));

const NOW = new Date('2026-10-13T14:00:00Z');
const WORKSPACE = { id: 'w1', slug: 'acme', name: 'Acme', theme: {} };
const BOARD: Board = { runners: [], jobs: [], viewer: { id: 'u1', owner: true, fleet: null } };
const FLEETS = [{ name: 'comets', label: 'Comets' }];

function reads(over: Partial<RunnersPageReads> = {}): RunnersPageReads {
  return {
    workspace: () => Promise.resolve(WORKSPACE),
    board: (): Promise<Served<Board>> => Promise.resolve({ ok: true, value: BOARD }),
    fleets: () => Promise.resolve(FLEETS),
    stand: () => Promise.resolve(null),
    ...over,
  };
}

describe('loadRunnersPage', () => {
  it('reads the board and the fleets of the workspace the person joined first', async () => {
    const board = vi.fn((): Promise<Served<Board>> => Promise.resolve({ ok: true, value: BOARD }));
    const fleets = vi.fn(() => Promise.resolve(FLEETS));
    expect(await loadRunnersPage(reads({ board, fleets }), NOW)).toEqual({ kind: 'board', name: 'Acme', board: BOARD, fleets: FLEETS, now: NOW.toISOString(), answered: [] });
    expect(board).toHaveBeenCalledWith('w1');
    expect(fleets).toHaveBeenCalledWith('w1');
  });

  it('is the no-workspace notice for an account in no workspace', async () => {
    expect(await loadRunnersPage(reads({ workspace: () => Promise.resolve(null) }), NOW)).toEqual({ kind: 'no-workspace' });
  });

  it('is unreadable when the service refuses the board', async () => {
    const board = (): Promise<Served<Board>> => Promise.resolve({ ok: false, kind: 'forbidden', error: 'You are not a member of this workspace.' });
    expect(await loadRunnersPage(reads({ board }), NOW)).toEqual({ kind: 'unreadable' });
  });

  it('is unreadable when the workspace or the board cannot be read', async () => {
    expect(await loadRunnersPage(reads({ workspace: () => Promise.reject(new Error('down')) }), NOW)).toEqual({ kind: 'unreadable' });
    expect(await loadRunnersPage(reads({ board: () => Promise.reject(new Error('down')) }), NOW)).toEqual({ kind: 'unreadable' });
  });

  it('still draws the board when only the fleets fail, with no fleet to pick', async () => {
    const view = await loadRunnersPage(reads({ fleets: () => Promise.reject(new Error('down')) }), NOW);
    expect(view).toEqual({ kind: 'board', name: 'Acme', board: BOARD, fleets: [], now: NOW.toISOString(), answered: [] });
  });
});

describe('answeredJobs (PRD 2270 s2)', () => {
  const job = (more: Partial<Job>): Job => ({
    id: '11111111-aaaa-4000-8000-000000000001', line: '/omni:yolo 2270', repo: 'acme/widgets', toRunner: null, toFleet: null, sentBy: 'u1', sentByLogin: 'ada', sentByKey: null,
    status: 'done', runner: null, cancelRequested: false, logTail: '', prUrl: null, exitCode: 0, reason: null, outcome: 'answers', continues: null,
    queuedAt: '2026-10-13T10:00:00Z', claimedAt: null, runningAt: null, endedAt: '2026-10-13T11:00:00Z', ...more,
  });
  const ANSWERED: OutboxStand = { asked: 2, answered: 2, answers: [] };
  const standing = (stand: OutboxStand | null) => reads({ stand: () => Promise.resolve(stand) });
  const waited = job({});

  it('lists the job that waited once every asked item of its PRD is answered', async () => {
    const stand = vi.fn(() => Promise.resolve(ANSWERED));
    expect(await answeredJobs(reads({ stand }), 'w1', [waited])).toEqual([waited.id]);
    expect(stand).toHaveBeenCalledWith('w1', 'acme/widgets', 2270);
  });

  it('lists nothing while an asked item waits, when the stand is unread, or when it cannot be read', async () => {
    expect(await answeredJobs(standing({ asked: 2, answered: 1, answers: [] }), 'w1', [waited])).toEqual([]);
    expect(await answeredJobs(standing(null), 'w1', [waited])).toEqual([]);
    expect(await answeredJobs(reads({ stand: () => Promise.reject(new Error('down')) }), 'w1', [waited])).toEqual([]);
  });

  it('lists nothing for a job already continued, one still running a PRD job, or one that did not wait on answers', async () => {
    const fix = job({ id: '22222222-bbbb-4000-8000-000000000002', line: '/omni:yolo-fix 2270', continues: waited.id, status: 'running', outcome: null });
    expect(await answeredJobs(standing(ANSWERED), 'w1', [fix, waited])).toEqual([]);
    expect(await answeredJobs(standing(ANSWERED), 'w1', [job({ id: '33333333-cccc-4000-8000-000000000003', line: '/omni:pr-care 2270', status: 'running', outcome: null, queuedAt: '2026-10-13T12:00:00Z' }), waited])).toEqual([]);
    expect(await answeredJobs(standing(ANSWERED), 'w1', [job({ outcome: 'held' })])).toEqual([]);
    expect(await answeredJobs(standing(ANSWERED), 'w1', [job({ line: '/omni:bug-fix Issue 548 totals' })])).toEqual([]);
  });

  it('lists only the newest job of a PRD that waited', async () => {
    const older = job({ id: '44444444-dddd-4000-8000-000000000004', queuedAt: '2026-10-12T10:00:00Z' });
    expect(await answeredJobs(standing(ANSWERED), 'w1', [older, waited])).toEqual([waited.id]);
  });
});
