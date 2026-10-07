import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoopScreenProps } from './LoopScreen';

// /app/loop and /app/loop/<id> (app/app/loop/page.tsx and app/app/loop/[id]/page.tsx), called as the
// server calls them, with their data sources stubbed (PRD 1139 s5): each decides the situation once.
const LOOP = '0b7c6a2e-1f00-4d6a-9c55-2f1f3e4a5b6c';
const given = vi.hoisted((): { session: { kind: string; db?: unknown; user?: { id: string } }; demo: unknown; load: unknown } => ({
  session: { kind: 'sign-in' },
  demo: null,
  load: { kind: 'no-workspace' },
}));
const demoLoopPage = vi.hoisted(() => vi.fn(() => given.demo));
const loadLoopPage = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>(() => Promise.resolve(given.load)));
const supabaseLoopPageReads = vi.hoisted(() => vi.fn(() => ({ reads: true })));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  notFound: () => { throw new Error('not found'); },
}));
vi.mock('../../data/member-session', () => ({
  firstParam: (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null,
  memberSession: () => Promise.resolve(given.session),
}));
vi.mock('../../data/supabase-server', () => ({ supabaseEnv: () => null, supabaseServer: () => Promise.reject(new Error('no database in this test')) }));
vi.mock('./demo', () => ({ demoLoopPage }));
vi.mock('./load', async (actual) => ({
  ...(await actual<typeof import('./load')>()),
  loadLoopPage,
  supabaseLoopPageReads,
}));

const { default: ListPage } = await import('../../../app/app/loop/page.tsx');
const { default: DetailPage } = await import('../../../app/app/loop/[id]/page.tsx');

const listView = async (query: Record<string, string> = {}) =>
  ((await ListPage({ searchParams: Promise.resolve(query) })) as ReactElement<LoopScreenProps>).props;
const detailView = async (id: string, query: Record<string, string> = {}) =>
  ((await DetailPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(query) })) as ReactElement<LoopScreenProps>).props;

const SIGNED_IN = { kind: 'signed-in', db: { db: true }, user: { id: 'u-member' } };
const LIST = { kind: 'list', name: 'Vertuoza', loops: [] };
const ONE = { kind: 'loop', name: 'Vertuoza', loop: { id: LOOP } };

beforeEach(() => {
  Object.assign(given, { session: { kind: 'sign-in' }, demo: null, load: { kind: 'no-workspace' } });
  for (const fn of [demoLoopPage, loadLoopPage, supabaseLoopPageReads]) fn.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('/app/loop decides once', () => {
  it('in the demo: the demo list, and nothing read', async () => {
    given.session = { kind: 'demo' };
    given.demo = LIST;
    expect((await listView()).view).toBe(LIST);
    expect(demoLoopPage).toHaveBeenCalledWith(expect.any(Date));
    expect(loadLoopPage).not.toHaveBeenCalled();
  });

  it('in the demo with no list: unreadable', async () => {
    given.session = { kind: 'demo' };
    expect((await listView()).view).toEqual({ kind: 'unreadable' });
  });

  it('closed or signed out: the session as the view, with the refusal it came back with', async () => {
    given.session = { kind: 'closed' };
    expect((await listView()).view).toEqual({ kind: 'closed' });
    given.session = { kind: 'sign-in' };
    const props = await listView({ signin_error: 'nope' });
    expect(props.view).toEqual({ kind: 'sign-in' });
    expect(props.signinError).toBe('nope');
    expect(loadLoopPage).not.toHaveBeenCalled();
  });

  it('signed in: the workspace\'s list, read as that person', async () => {
    given.session = SIGNED_IN;
    given.load = LIST;
    expect((await listView()).view).toBe(LIST);
    expect(supabaseLoopPageReads).toHaveBeenCalledWith(SIGNED_IN.db, SIGNED_IN.user);
    expect(loadLoopPage).toHaveBeenCalledWith({ reads: true }, null, expect.any(Date));
  });

  it('signed in, the list not found: unreadable', async () => {
    given.session = SIGNED_IN;
    given.load = { kind: 'not-found' };
    expect((await listView()).view).toEqual({ kind: 'unreadable' });
  });
});

describe('/app/loop/<id> decides once', () => {
  it('a path that names no loop is not found, before any session is read', async () => {
    await expect(detailView('not-a-loop')).rejects.toThrow('not found');
    expect(demoLoopPage).not.toHaveBeenCalled();
    expect(loadLoopPage).not.toHaveBeenCalled();
  });

  it('in the demo: the demo loop of that id, or not found', async () => {
    given.session = { kind: 'demo' };
    given.demo = ONE;
    expect((await detailView(LOOP.toUpperCase())).view).toBe(ONE);
    expect(demoLoopPage).toHaveBeenCalledWith(expect.any(Date), LOOP);
    given.demo = null;
    await expect(detailView(LOOP)).rejects.toThrow('not found');
  });

  it('closed or signed out: the session as the view', async () => {
    given.session = { kind: 'closed' };
    expect((await detailView(LOOP)).view).toEqual({ kind: 'closed' });
    given.session = { kind: 'sign-in' };
    expect((await detailView(LOOP, { signin_error: 'nope' })).signinError).toBe('nope');
    expect(loadLoopPage).not.toHaveBeenCalled();
  });

  it('signed in: the loop, read as that person; one the workspace does not hold is not found', async () => {
    given.session = SIGNED_IN;
    given.load = ONE;
    expect((await detailView(LOOP)).view).toBe(ONE);
    expect(loadLoopPage).toHaveBeenCalledWith({ reads: true }, LOOP, expect.any(Date));
    given.load = { kind: 'not-found' };
    await expect(detailView(LOOP)).rejects.toThrow('not found');
  });
});
