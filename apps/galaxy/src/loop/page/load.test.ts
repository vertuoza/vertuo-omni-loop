import { describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { loadLoopPage, loopIdOf, type LoopPageReads } from './load';
import type { LoopRow, PlanRow, TickRow } from './rows';

// The Loop page's read (PRD 1139 s5) on fake reads: the workspace first, then the list or one loop,
// a loop of another workspace not found, and a roster that cannot be read failing soft.

const NOW = new Date('2026-10-07T14:25:00Z');
const ID = '0b7c6a2e-1f00-4d6a-9c55-2f1f3e4a5b6c';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const loop = (id: string, workspace: string): LoopRow => ({
  id, user_id: 'u-ada', workspace_id: workspace, repo: 'acme/widgets', prds: [parsePrd(1030)], state: 'running', parked: [],
  started_at: '2026-10-07T13:00:00Z', seen_at: '2026-10-07T14:21:00Z', last_tick_at: '2026-10-07T14:21:00Z', next_wake_at: '2026-10-07T14:32:00Z', stopped_at: null,
});
const tick: TickRow = {
  id: 1, loop_id: ID, at: '2026-10-07T14:21:00Z', step: 1, steps: 1, prd: parsePrd(1030), action: 'wave', result: '1 sub-PR', link: null, merged: [], items: [], next_wake_at: null,
};
const plan: PlanRow = { loop_id: ID, version: 1, reason: 'first plan', plan: { steps: [{ step: 1, prd: 1030, slice: 's1' }] }, created_at: '2026-10-07T13:00:00Z' };

function reads(over: Partial<LoopPageReads> = {}): LoopPageReads {
  return {
    workspace: () => Promise.resolve({ id: 'w-acme', slug: 'acme', name: 'Acme', theme: {} }),
    loops: () => Promise.resolve([loop(ID, 'w-acme'), loop(OTHER, 'w-other')]),
    loop: (id) => Promise.resolve([loop(ID, 'w-acme'), loop(OTHER, 'w-other')].find((l) => l.id === id) ?? null),
    ticks: () => Promise.resolve([tick]),
    plans: () => Promise.resolve([plan]),
    roster: () => Promise.resolve([{ user_id: 'u-ada', name: 'Ada', github_login: 'ada', avatar_url: null, fleet: null }]),
    ...over,
  };
}

describe('loadLoopPage', () => {
  it('lists the workspace\'s loops only, each named by who runs it', async () => {
    const view = await loadLoopPage(reads(), null, NOW);
    expect(view.kind).toBe('list');
    if (view.kind !== 'list') return;
    expect(view.name).toBe('Acme');
    expect(view.loops.map((l) => [l.id, l.who.name, l.state])).toEqual([[ID, 'Ada', 'sleeping']]);
  });

  it('opens one loop with its ledger and plans; a loop of another workspace, or none, is not found', async () => {
    const view = await loadLoopPage(reads(), ID, NOW);
    expect(view.kind === 'loop' && [view.loop.ledger.length, view.loop.versions.length, view.loop.current]).toEqual([1, 1, { step: 1, steps: 1 }]);
    expect(await loadLoopPage(reads(), OTHER, NOW)).toEqual({ kind: 'not-found' });
    expect(await loadLoopPage(reads(), '00000000-0000-4000-8000-000000000000', NOW)).toEqual({ kind: 'not-found' });
  });

  it('in no workspace, the notice; a workspace that cannot be read, unreadable, its error logged', async () => {
    expect(await loadLoopPage(reads({ workspace: () => Promise.resolve(null) }), null, NOW)).toEqual({ kind: 'no-workspace' });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadLoopPage(reads({ workspace: () => Promise.reject(new Error('down')) }), null, NOW)).toEqual({ kind: 'unreadable' });
    expect(error).toHaveBeenCalledWith('loop: your workspace could not be read (down)');
    error.mockRestore();
  });

  it('names every runner "A member" when the roster cannot be read, its error logged', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = await loadLoopPage(reads({ roster: () => Promise.reject(new Error('nope')) }), null, NOW);
    expect(view.kind === 'list' && view.loops.map((l) => l.who.name)).toEqual(['A member']);
    expect(error).toHaveBeenCalledWith('loop: the workspace\'s members could not be read (nope)');
    error.mockRestore();
  });
});

describe('loopIdOf', () => {
  it('takes a loop\'s id as a path names it, in lower case, and nothing else', () => {
    expect(loopIdOf(ID.toUpperCase())).toBe(ID);
    for (const part of ['', 'abc', `${ID}x`, '../x']) expect(loopIdOf(part)).toBeNull();
  });
});
