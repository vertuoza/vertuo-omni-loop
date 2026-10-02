import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineeringScreenProps } from './EngineeringScreen';

// /app/engineering/<owner>/<repo> (app/app/engineering/[owner]/[repo]/page.tsx, PRD 645 s2), called as
// the server calls it, with its data sources stubbed: it reads the period from the query (7 days
// otherwise) and decides the situation once, as the board does; a repository the workspace does not
// track is not found.
const given = vi.hoisted(() => ({
  mode: 'supabase' as 'demo' | 'closed' | 'supabase',
  user: null as null | { id: string },
  load: { kind: 'no-workspace' } as unknown,
  demo: null as unknown,
}));
const demoEngineeringBoard = vi.hoisted(() => vi.fn((..._args: unknown[]) => given.demo));
const loadEngineeringRepositoryBoard = vi.hoisted(() => vi.fn((..._args: unknown[]) => Promise.resolve(given.load)));
const getClaims = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: given.user ? { claims: { sub: given.user.id } } : null, error: null })));

vi.mock('server-only', () => ({}));
vi.mock('../data/mode', () => ({ arcadeMode: () => given.mode }));
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: () => Promise.resolve({ auth: { getClaims } }),
}));
vi.mock('./demo', () => ({ demoEngineeringBoard }));
vi.mock('./load', () => ({ loadEngineeringRepositoryBoard }));

const { default: Page } = await import('../../app/app/engineering/[owner]/[repo]/page.tsx');

const open = async (owner: string, repo: string, query: Record<string, string> = {}) =>
  ((await Page({ params: Promise.resolve({ owner, repo }), searchParams: Promise.resolve(query) })) as ReactElement<EngineeringScreenProps>).props;
const notFound = { digest: expect.stringContaining('404') };

beforeEach(() => {
  Object.assign(given, { mode: 'supabase', user: null, load: { kind: 'no-workspace' }, demo: null });
  for (const fn of [demoEngineeringBoard, loadEngineeringRepositoryBoard, getClaims]) fn.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('/app/engineering/<owner>/<repo> decides once', () => {
  it('in the demo: the demo repository\'s board for the query\'s period, and no session read', async () => {
    given.mode = 'demo';
    given.demo = { kind: 'board', name: 'Demo workspace', board: {}, repo: 'acme/gears' };
    const { view, period } = await open('acme', 'gears', { period: 'season' });
    expect(view).toEqual(given.demo);
    expect(period).toBe('season');
    expect(demoEngineeringBoard).toHaveBeenCalledWith('season', 'merged', expect.any(Date), 'acme/gears');
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('in the demo: counts only merges into main on that repository, its sub-PRs on the sub-PR line (PRD 714)', async () => {
    given.mode = 'demo';
    const actual = await vi.importActual<typeof import('./demo')>('./demo');
    demoEngineeringBoard.mockImplementationOnce((...args: unknown[]) => (actual.demoEngineeringBoard as (...a: unknown[]) => unknown)(...args));
    const { view } = await open('acme', 'gears', { period: '30d' });
    const board = (view as { board: { kind: string; tiles: { merged: number }; omni: { of: number; subPrsMerged: number } } }).board;
    expect(board.kind).toBe('board');
    expect(board.omni.of).toBe(board.tiles.merged);
    expect(board.omni.subPrsMerged).toBeGreaterThan(0);
    const whole = actual.demoEngineeringBoard('30d', 'merged', new Date());
    const all = (whole as { board: { omni: { subPrsMerged: number } } }).board.omni.subPrsMerged;
    expect(board.omni.subPrsMerged).toBeLessThan(all);
  });

  it('in the demo: counts the needs-fix rate over that repository alone, and the whole board shows it (PRD 714 s4)', async () => {
    given.mode = 'demo';
    const actual = await vi.importActual<typeof import('./demo')>('./demo');
    demoEngineeringBoard.mockImplementationOnce((...args: unknown[]) => (actual.demoEngineeringBoard as (...a: unknown[]) => unknown)(...args));
    const { view } = await open('acme', 'gears', { period: '30d' });
    type Rated = { board: { omni: { subPrsMerged: number }; needsFixRate: { got: number; of: number; share: number | null } } };
    const one = (view as Rated).board;
    const whole = (actual.demoEngineeringBoard('30d', 'merged', new Date()) as Rated).board;
    expect(one.needsFixRate.of).toBe(one.omni.subPrsMerged);
    expect(whole.needsFixRate.of).toBe(whole.omni.subPrsMerged);
    expect(whole.needsFixRate.got).toBeGreaterThan(0);
    expect(one.needsFixRate.got).toBeGreaterThan(0);
    expect(one.needsFixRate.got).toBeLessThan(whole.needsFixRate.got);
  });

  it('in the demo, a repository it does not track: not found', async () => {
    given.mode = 'demo';
    given.demo = { kind: 'not-tracked' };
    await expect(open('acme', 'sprockets')).rejects.toMatchObject(notFound);
  });

  it('with no database: closed', async () => {
    given.mode = 'closed';
    expect((await open('acme', 'gears')).view).toEqual({ kind: 'closed' });
  });

  it('signed out: the sign-in card, with the refusal it came back with', async () => {
    const props = await open('acme', 'gears', { signin_error: 'nope' });
    expect(props.view).toEqual({ kind: 'sign-in' });
    expect(props.signinError).toBe('nope');
    expect(loadEngineeringRepositoryBoard).not.toHaveBeenCalled();
  });

  it('signed in to an account in no workspace: the notice', async () => {
    given.user = { id: 'u-1' };
    expect((await open('acme', 'gears')).view).toEqual({ kind: 'no-workspace' });
  });

  it('signed in, a tracked repository: its board, for 7 days when the period is unknown', async () => {
    given.user = { id: 'u-member' };
    given.load = { kind: 'board', name: 'Vertuoza', board: {}, repo: 'vertuoza/pdf-builder' };
    const { view, period } = await open('vertuoza', 'pdf-builder', { period: 'forever' });
    expect(view).toEqual(given.load);
    expect(period).toBe('7d');
    expect(loadEngineeringRepositoryBoard).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(given.user), 'vertuoza/pdf-builder', { period: '7d', sort: 'merged', now: expect.any(Date) });
  });

  it('signed in, a repository the workspace does not track: not found', async () => {
    given.user = { id: 'u-member' };
    given.load = { kind: 'not-tracked' };
    await expect(open('vertuoza', 'nope')).rejects.toMatchObject(notFound);
  });

  it('an address whose escaping is broken: not found, nothing read', async () => {
    given.user = { id: 'u-member' };
    await expect(open('vertuoza', '%E0%A4%A')).rejects.toMatchObject(notFound);
    expect(loadEngineeringRepositoryBoard).not.toHaveBeenCalled();
  });
});
