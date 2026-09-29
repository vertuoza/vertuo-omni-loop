import type { ReactElement } from 'react';
import type { StreamedProps } from '../../skeleton/Streamed';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FleetScreenProps } from './FleetScreen';

// /app/fleet (app/app/fleet/page.tsx), called as the server calls it, with its data sources stubbed
// (PRD 572): it reads the fleet and the period from the query and decides the situation once.
const given = vi.hoisted(() => ({
  mode: 'supabase' as 'demo' | 'closed' | 'supabase',
  user: null as null | { id: string },
  load: { kind: 'no-workspace' } as unknown,
}));
const demoFleetBoard = vi.hoisted(() => vi.fn((..._args: unknown[]) => ({ kind: 'pick', fleets: [] })));
const loadFleetBoard = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => given.load));
const getClaims = vi.hoisted(() => vi.fn(async () => ({ data: given.user ? { claims: { sub: given.user.id } } : null, error: null })));

vi.mock('server-only', () => ({}));
vi.mock('../../data/mode', () => ({ arcadeMode: () => given.mode }));
vi.mock('../../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: async () => ({ auth: { getClaims } }),
}));
vi.mock('./fleet', () => ({ demoFleetBoard, loadFleetBoard }));

const { Streamed } = await import('../../skeleton/Streamed');
const { default: Page } = await import('../../../app/app/fleet/page.tsx');

const pageOf = async (query: Record<string, string> = {}) => (await Page({ searchParams: Promise.resolve(query) })) as ReactElement;

/** The screen the page draws: a signed-in person's streams in its own block (PRD 657 s4), so it is the
 * block's, once its read resolves. */
async function screenOf(element: ReactElement): Promise<ReactElement<FleetScreenProps>> {
  if (element.type !== Streamed) return element as ReactElement<FleetScreenProps>;
  const { read, children } = element.props as StreamedProps<unknown>;
  return children(await read) as ReactElement<FleetScreenProps>;
}

const propsOf = async (query: Record<string, string> = {}) => (await screenOf(await pageOf(query))).props;

beforeEach(() => {
  Object.assign(given, { mode: 'supabase', user: null, load: { kind: 'no-workspace' } });
  for (const fn of [demoFleetBoard, loadFleetBoard, getClaims]) fn.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('/app/fleet decides once', () => {
  it('in the demo: the demo fleet asked for, over the query\'s period, and no session read', async () => {
    given.mode = 'demo';
    const { query } = await propsOf({ fleet: 'builders', period: 'season' });
    expect(demoFleetBoard).toHaveBeenCalledWith('builders', 'season', expect.any(Date));
    expect(query).toEqual({ fleet: 'builders', period: 'season' });
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('reads no fleet and an unknown period as none and 7 days', async () => {
    given.mode = 'demo';
    await propsOf({ fleet: '', period: 'forever' });
    expect(demoFleetBoard).toHaveBeenCalledWith(null, '7d', expect.any(Date));
  });

  it('with no database: closed', async () => {
    given.mode = 'closed';
    expect((await propsOf()).view).toEqual({ kind: 'closed' });
  });

  it('signed out: the sign-in card, with the refusal it came back with', async () => {
    const props = await propsOf({ signin_error: 'nope' });
    expect(props.view).toEqual({ kind: 'sign-in' });
    expect(props.signinError).toBe('nope');
    expect(loadFleetBoard).not.toHaveBeenCalled();
  });

  it('signed in: the fleet\'s board for the period, as that person', async () => {
    given.user = { id: 'u-ada' };
    given.load = { kind: 'pick', fleets: [] };
    const page = await pageOf({ fleet: 'octo', period: '30d' });
    expect(page.type, 'streamed in its own block').toBe(Streamed);
    expect((await screenOf(page)).props.view).toEqual(given.load);
    expect(loadFleetBoard).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(given.user), 'octo', '30d', expect.any(Date));
  });
});
