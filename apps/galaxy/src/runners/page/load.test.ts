import { describe, expect, it, vi } from 'vitest';
import type { Board } from '../runners.contract';
import type { Served } from '../runners.service';
import { loadRunnersPage, type RunnersPageReads } from './load';

// The Runners page's read (PRD 1830 s3) on fake reads: the workspace first, then the board and the
// fleets; no workspace, the notice; the board refused or a read failing, unreadable; the fleets failing
// alone, the board with no fleet to pick.

vi.mock('vertuo-omni-plan/kit/lib/log/log.ts', () => ({ log: { error: () => undefined } }));

const NOW = new Date('2026-10-13T14:00:00Z');
const WORKSPACE = { id: 'w1', slug: 'acme', name: 'Acme', theme: {} };
const BOARD: Board = { runners: [], jobs: [], viewer: { id: 'u1', owner: true, fleet: null } };
const FLEETS = [{ name: 'comets', label: 'Comets' }];
const PRDS = { 'acme/widgets#7': 'Seven' };

function reads(over: Partial<RunnersPageReads> = {}): RunnersPageReads {
  return {
    workspace: () => Promise.resolve(WORKSPACE),
    board: (): Promise<Served<Board>> => Promise.resolve({ ok: true, value: BOARD }),
    fleets: () => Promise.resolve(FLEETS),
    prds: () => Promise.resolve(PRDS),
    ...over,
  };
}

describe('loadRunnersPage', () => {
  it('reads the board and the fleets of the workspace the person joined first', async () => {
    const board = vi.fn((): Promise<Served<Board>> => Promise.resolve({ ok: true, value: BOARD }));
    const fleets = vi.fn(() => Promise.resolve(FLEETS));
    expect(await loadRunnersPage(reads({ board, fleets }), NOW)).toEqual({ kind: 'board', name: 'Acme', board: BOARD, fleets: FLEETS, prds: PRDS, now: NOW.toISOString() });
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
    expect(view).toEqual({ kind: 'board', name: 'Acme', board: BOARD, fleets: [], prds: PRDS, now: NOW.toISOString() });
  });

  it('still draws the board when only the PRD titles fail, with no PRD line', async () => {
    const view = await loadRunnersPage(reads({ prds: () => Promise.reject(new Error('down')) }), NOW);
    expect(view).toEqual({ kind: 'board', name: 'Acme', board: BOARD, fleets: FLEETS, prds: {}, now: NOW.toISOString() });
  });
});
