import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardScreenProps } from './DashboardScreen';

// /app (app/app/page.tsx), called as the server calls it, with its data sources stubbed (PRD 328):
// it decides the situation once, top to bottom, and hands it to the screen.
const given = vi.hoisted(() => ({
  mode: 'supabase' as 'demo' | 'closed' | 'supabase',
  user: null as null | { id: string; email: string },
  load: { kind: 'no-workspace' } as unknown,
}));
const demoDashboard = vi.hoisted(() => vi.fn((now: Date) => ({ demo: now.toISOString() })));
const loadDashboard = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => given.load));
const getUser = vi.hoisted(() => vi.fn(async () => ({ data: { user: given.user } })));

vi.mock('server-only', () => ({}));
vi.mock('../data/mode', () => ({ arcadeMode: () => given.mode }));
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: async () => ({ auth: { getUser } }),
}));
vi.mock('./demo', () => ({ demoDashboard }));
vi.mock('./load', () => ({ loadDashboard }));

const { default: Page } = await import('../../app/app/page.tsx');

const propsOf = async (query: Record<string, string> = {}) =>
  ((await Page({ searchParams: Promise.resolve(query) })) as ReactElement<DashboardScreenProps>).props;

beforeEach(() => {
  Object.assign(given, { mode: 'supabase', user: null, load: { kind: 'no-workspace' } });
  for (const fn of [demoDashboard, loadDashboard, getUser]) fn.mockClear();
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
    expect(getUser).not.toHaveBeenCalled();
  });

  it('with no database: closed, and no session read', async () => {
    given.mode = 'closed';
    expect((await propsOf()).view).toEqual({ kind: 'closed' });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('signed out: the sign-in card, with the reason the last sign-in was refused', async () => {
    const props = await propsOf({ signin_error: 'Not allowed' });
    expect(props.view).toEqual({ kind: 'sign-in' });
    expect(props.signinError).toBe('Not allowed');
    expect(props.supabase).toEqual({ url: 'http://127.0.0.1:54321', key: 'anon' });
    expect(loadDashboard).not.toHaveBeenCalled();
  });

  it('signed in: what the loader reads as that person, now', async () => {
    given.user = { id: 'u1', email: 'ada@vertuoza.com' };
    given.load = { kind: 'dashboard', dashboard: { name: 'ADA' } };
    const { view } = await propsOf();
    expect(view).toEqual(given.load);
    const [db, user, now] = loadDashboard.mock.calls[0];
    expect((db as { auth: unknown }).auth).toBeTruthy();
    expect(user).toEqual(given.user);
    expect(now).toBeInstanceOf(Date);
  });

  it('signed in to an account in no workspace: the loader says so, and the page shows it', async () => {
    given.user = { id: 'u2', email: 'eve@example.com' };
    expect((await propsOf()).view).toEqual({ kind: 'no-workspace' });
  });
});
