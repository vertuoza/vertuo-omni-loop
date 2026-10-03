import type { ReactElement } from 'react';
import type { StreamedProps } from '../../skeleton/Streamed';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceScreenProps } from './WorkspaceScreen';

// /app/workspace (app/app/workspace/page.tsx), called as the server calls it, with its data sources
// stubbed (PRD 572): it reads the period from the query and decides the situation once.
type Given = { mode: 'demo' | 'closed' | 'supabase'; user: null | { id: string }; load: unknown };
const given = vi.hoisted((): Given => ({ mode: 'supabase', user: null, load: { kind: 'no-workspace' } }));
const demoWorkspaceBoard = vi.hoisted(() => vi.fn((period: string, now: Date) => ({ kind: 'board', name: 'demo', board: { period, at: now.toISOString() } })));
const loadWorkspaceBoard = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>(() => Promise.resolve(given.load)));
const getClaims = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: given.user ? { claims: { sub: given.user.id } } : null, error: null })));

vi.mock('server-only', () => ({}));
vi.mock('../../env', async (actual) => {
  const env = await actual<typeof import('../../env')>();
  return { ...env, serverEnv: () => ({ ...env.readEnv({}), mode: given.mode }) };
});
vi.mock('../../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: () => Promise.resolve({ auth: { getClaims } }),
}));
vi.mock('./workspace', () => ({ demoWorkspaceBoard, loadWorkspaceBoard }));

const { Streamed } = await import('../../skeleton/Streamed');
const { default: Page } = await import('../../../app/app/workspace/page.tsx');

const pageOf = async (query: Record<string, string> = {}) => (await Page({ searchParams: Promise.resolve(query) })) as ReactElement;

/** The screen the page draws: a signed-in person's streams in its own block (PRD 657 s4), so it is the
 * block's, once its read resolves. */
async function screenOf(element: ReactElement): Promise<ReactElement<WorkspaceScreenProps>> {
  if (element.type !== Streamed) return element as ReactElement<WorkspaceScreenProps>;
  const { read, children } = element.props as StreamedProps<unknown>;
  return children(await read) as ReactElement<WorkspaceScreenProps>;
}

const propsOf = async (query: Record<string, string> = {}) => (await screenOf(await pageOf(query))).props;

beforeEach(() => {
  Object.assign(given, { mode: 'supabase', user: null, load: { kind: 'no-workspace' } });
  for (const fn of [demoWorkspaceBoard, loadWorkspaceBoard, getClaims]) fn.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('/app/workspace decides once', () => {
  it('in the demo: the demo board for the query\'s period, and no session read', async () => {
    given.mode = 'demo';
    const { view, query } = await propsOf({ period: 'season' });
    expect(view.kind).toBe('board');
    expect(demoWorkspaceBoard).toHaveBeenCalledWith('season', expect.any(Date));
    expect(query).toEqual({ period: 'season' });
    expect(getClaims).not.toHaveBeenCalled();
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
    const page = await pageOf({ period: '30d' });
    expect(page.type, 'streamed in its own block').toBe(Streamed);
    expect((await screenOf(page)).props.view).toEqual(given.load);
    expect(loadWorkspaceBoard).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(given.user), '30d', expect.any(Date));
  });
});
