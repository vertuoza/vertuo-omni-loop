import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceScreenProps } from './WorkspaceScreen';

// /app/workspace (app/app/workspace/page.tsx), called as the server calls it, with its data sources
// stubbed (PRD 572): it reads the period from the query and decides the situation once.
const given = vi.hoisted(() => ({
  mode: 'supabase' as 'demo' | 'closed' | 'supabase',
  user: null as null | { id: string },
  load: { kind: 'no-workspace' } as unknown,
}));
const demoWorkspaceBoard = vi.hoisted(() => vi.fn((period: string, now: Date) => ({ kind: 'board', name: 'demo', board: { period, at: now.toISOString() } })));
const loadWorkspaceBoard = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => given.load));
const getUser = vi.hoisted(() => vi.fn(async () => ({ data: { user: given.user } })));

vi.mock('server-only', () => ({}));
vi.mock('../../data/mode', () => ({ arcadeMode: () => given.mode }));
vi.mock('../../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: async () => ({ auth: { getUser } }),
}));
vi.mock('./workspace', () => ({ demoWorkspaceBoard, loadWorkspaceBoard }));

const { default: Page } = await import('../../../app/app/workspace/page.tsx');

const propsOf = async (query: Record<string, string> = {}) =>
  ((await Page({ searchParams: Promise.resolve(query) })) as ReactElement<WorkspaceScreenProps>).props;

beforeEach(() => {
  Object.assign(given, { mode: 'supabase', user: null, load: { kind: 'no-workspace' } });
  for (const fn of [demoWorkspaceBoard, loadWorkspaceBoard, getUser]) fn.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('/app/workspace decides once', () => {
  it('in the demo: the demo board for the query\'s period, and no session read', async () => {
    given.mode = 'demo';
    const { view, query } = await propsOf({ period: 'season' });
    expect(view.kind).toBe('board');
    expect(demoWorkspaceBoard).toHaveBeenCalledWith('season', expect.any(Date));
    expect(query).toEqual({ period: 'season' });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('reads an unknown period as 7 days', async () => {
    given.mode = 'demo';
    await propsOf({ period: 'forever' });
    expect(demoWorkspaceBoard).toHaveBeenCalledWith('7d', expect.any(Date));
  });

  it('with no database: closed', async () => {
    given.mode = 'closed';
    expect((await propsOf()).view).toEqual({ kind: 'closed' });
  });

  it('signed out: the sign-in card, with the refusal it came back with', async () => {
    const props = await propsOf({ signin_error: 'nope' });
    expect(props.view).toEqual({ kind: 'sign-in' });
    expect(props.signinError).toBe('nope');
    expect(loadWorkspaceBoard).not.toHaveBeenCalled();
  });

  it('signed in: the workspace\'s board for the period, as that person', async () => {
    given.user = { id: 'u-ada' };
    given.load = { kind: 'board', name: 'Vertuoza', board: {} };
    const { view } = await propsOf({ period: '30d' });
    expect(view).toEqual(given.load);
    expect(loadWorkspaceBoard).toHaveBeenCalledWith(expect.anything(), given.user, '30d', expect.any(Date));
  });
});
