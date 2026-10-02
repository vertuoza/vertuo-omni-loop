import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardScreenProps } from './DashboardScreen';

// /app (app/app/page.tsx), called as the server calls it, with its data sources stubbed (PRD 328):
// it reads the period from the query (PRD 572), decides the situation once, top to bottom, and hands
// it to the screen, with the query for the period switch to keep. PRD 657 s4: a member's dashboard
// streams, each part in its own block, once the workspace is known.
const given = vi.hoisted(() => ({
  mode: 'supabase' as 'demo' | 'closed' | 'supabase',
  user: null as null | { id: string; email: string },
  load: { kind: 'no-workspace' } as unknown,
  workspace: null as null | Error | { id: string },
}));
const homeParts = vi.hoisted(() => vi.fn((..._args: unknown[]) => ({ parts: 'streamed' })));
const demoDashboard = vi.hoisted(() => vi.fn((period: string, now: Date) => ({ period, demo: now.toISOString() })));
const loadDashboard = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => given.load));
const getClaims = vi.hoisted(() => vi.fn(async () => ({ data: given.user ? { claims: { sub: given.user.id, email: given.user.email } } : null, error: null })));

vi.mock('server-only', () => ({}));
vi.mock('../data/mode', () => ({ arcadeMode: () => given.mode }));
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: async () => ({ auth: { getClaims } }),
}));
vi.mock('./demo', () => ({ demoDashboard }));
vi.mock('./load', () => ({ loadDashboard }));
vi.mock('../data/workspace', () => ({
  memberWorkspace: async () => {
    if (given.workspace instanceof Error) throw given.workspace;
    return given.workspace;
  },
}));
vi.mock('./stream/home', () => ({ homeParts }));

const { default: Page } = await import('../../app/app/page.tsx');
const { HomeStream } = await import('./stream/HomeStream');

const pageOf = async (query: Record<string, string> = {}) => (await Page({ searchParams: Promise.resolve(query) })) as ReactElement;
const propsOf = async (query: Record<string, string> = {}) => ((await pageOf(query)) as ReactElement<DashboardScreenProps>).props;

beforeEach(() => {
  Object.assign(given, { mode: 'supabase', user: null, load: { kind: 'no-workspace' }, workspace: null });
  for (const fn of [demoDashboard, loadDashboard, getClaims, homeParts]) fn.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('/app decides once', () => {
  it('in the demo: the whole dashboard on the demo world, as of now, and no session read', async () => {
    given.mode = 'demo';
    const before = Date.now();
    const { view, supabase } = await propsOf();
    expect(view.kind).toBe('dashboard');
    const at = Date.parse((view as unknown as { dashboard: { demo: string } }).dashboard.demo);
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
    expect(supabase).toBeNull();
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('with no database: closed, and no session read', async () => {
    given.mode = 'closed';
    expect((await propsOf()).view).toEqual({ kind: 'closed' });
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('signed out: the sign-in card, with the reason the last sign-in was refused', async () => {
    const props = await propsOf({ signin_error: 'Not allowed' });
    expect(props.view).toEqual({ kind: 'sign-in' });
    expect(props.signinError).toBe('Not allowed');
    expect(props.supabase).toEqual({ url: 'http://127.0.0.1:54321', key: 'anon' });
    expect(loadDashboard).not.toHaveBeenCalled();
  });

  it('signed in to a workspace: streams the dashboard, each part read as that person, now', async () => {
    given.user = { id: 'u1', email: 'ada@vertuoza.com' };
    given.workspace = { id: 'w1' };
    const page = await pageOf({ period: '30d', x: '1' });
    expect(page.type).toBe(HomeStream);
    expect((page.props as { parts: unknown }).parts).toEqual({ parts: 'streamed' });
    expect((page.props as { query: unknown }).query).toEqual({ period: '30d', x: '1' });
    const [db, user, workspace, period, now, questions] = homeParts.mock.calls[0]!;
    expect((db as { auth: unknown }).auth).toBeTruthy();
    expect(user).toMatchObject(given.user!);
    expect(workspace).toBe('w1');
    expect(period).toBe('30d');
    expect(now).toBeInstanceOf(Date);
    expect(questions).toEqual(expect.any(Function));
    expect(loadDashboard).not.toHaveBeenCalled();
  });

  it('signed in, the workspace out of reach: what the loader reads as that person, now', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    given.user = { id: 'u1', email: 'ada@vertuoza.com' };
    given.workspace = new Error('down');
    given.load = { kind: 'dashboard', dashboard: { name: 'ADA' } };
    const { view } = await propsOf();
    expect(view).toEqual(given.load);
    const [db, user, period, now] = loadDashboard.mock.calls[0]!;
    expect((db as { auth: unknown }).auth).toBeTruthy();
    expect(user).toMatchObject(given.user!);
    expect(period).toBe('7d');
    expect(now).toBeInstanceOf(Date);
    expect(homeParts).not.toHaveBeenCalled();
  });

  it('reads an unknown period as 7 days, in the demo too', async () => {
    given.mode = 'demo';
    await propsOf({ period: 'forever' });
    expect(demoDashboard).toHaveBeenCalledWith('7d', expect.any(Date));
  });

  it('signed in to an account in no workspace: the page says so, and reads nothing more', async () => {
    given.user = { id: 'u2', email: 'eve@example.com' };
    expect((await propsOf()).view).toEqual({ kind: 'no-workspace' });
    expect(loadDashboard).not.toHaveBeenCalled();
    expect(homeParts).not.toHaveBeenCalled();
  });
});
