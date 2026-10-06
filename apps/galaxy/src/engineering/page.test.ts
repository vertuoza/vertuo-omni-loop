import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineeringScreenProps } from './EngineeringScreen';

// /app/engineering (app/app/engineering/page.tsx), called as the server calls it, with its data
// sources stubbed (PRD 612 s3): it reads the period and the sort from the query and decides the
// situation once. Any member gets the board: no role is asked.
const given = vi.hoisted((): { mode: 'demo' | 'closed' | 'supabase'; user: null | { id: string }; load: unknown } => ({
  mode: 'supabase',
  user: null,
  load: { kind: 'no-workspace' },
}));
const demoEngineeringBoard = vi.hoisted(() => vi.fn((period: string, sort: string) => ({ kind: 'board', name: 'demo', board: { period, sort } })));
const loadEngineeringBoard = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>(() => Promise.resolve(given.load)));
const getClaims = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: given.user ? { claims: { sub: given.user.id } } : null, error: null })));
const rpc = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));

const A_DATE: unknown = expect.any(Date);
vi.mock('../env', async (actual) => {
  const env = await actual<typeof import('../env')>();
  return { ...env, serverEnv: () => ({ ...env.readEnv({}), mode: given.mode }) };
});
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: () => Promise.resolve({ auth: { getClaims }, rpc }),
}));
vi.mock('./demo', () => ({ demoEngineeringBoard }));
vi.mock('./load', () => ({ loadEngineeringBoard }));

const { default: Page } = await import('../../app/app/engineering/page.tsx');

const propsOf = async (query: Record<string, string> = {}) =>
  ((await Page({ searchParams: Promise.resolve(query) })) as ReactElement<EngineeringScreenProps>).props;

beforeEach(() => {
  Object.assign(given, { mode: 'supabase', user: null, load: { kind: 'no-workspace' } });
  for (const fn of [demoEngineeringBoard, loadEngineeringBoard, getClaims, rpc]) fn.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('/app/engineering decides once', () => {
  it('in the demo: the demo board for the query\'s period and sort, and no session read', async () => {
    given.mode = 'demo';
    const { view, period, query } = await propsOf({ period: 'season', sort: 'lines' });
    expect(view.kind).toBe('board');
    expect(period).toBe('season');
    expect(demoEngineeringBoard).toHaveBeenCalledWith('season', 'lines', expect.any(Date));
    expect(query).toEqual({ period: 'season', sort: 'lines' });
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('reads an unknown period as 7 days, an unknown sort as merged', async () => {
    given.mode = 'demo';
    await propsOf({ period: 'forever', sort: 'vibes' });
    expect(demoEngineeringBoard).toHaveBeenCalledWith('7d', 'merged', expect.any(Date));
  });

  it('with no database: closed', async () => {
    given.mode = 'closed';
    expect((await propsOf()).view).toEqual({ kind: 'closed' });
  });

  it('signed out: the sign-in card, with the refusal it came back with', async () => {
    const props = await propsOf({ signin_error: 'nope' });
    expect(props.view).toEqual({ kind: 'sign-in' });
    expect(props.signinError).toBe('nope');
    expect(loadEngineeringBoard).not.toHaveBeenCalled();
  });

  it('signed in, any member: the workspace\'s board for the period and sort, as that person, no role asked', async () => {
    given.user = { id: 'u-member' };
    given.load = { kind: 'board', name: 'Vertuoza', board: {} };
    const { view } = await propsOf({ period: '30d', sort: 'opened' });
    expect(view).toEqual(given.load);
    expect(loadEngineeringBoard).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(given.user), { period: '30d', sort: 'opened', now: A_DATE });
    expect(rpc).not.toHaveBeenCalled();
  });
});
