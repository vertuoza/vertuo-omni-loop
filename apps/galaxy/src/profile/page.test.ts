import type { ReactElement } from 'react';
import type { StreamedProps } from '../skeleton/Streamed';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileScreenProps } from './ProfileScreen';

// /app/people/<login> (app/app/people/[login]/page.tsx), called as the server calls it, with its
// data sources stubbed (PRD 698 s3): it reads the login from the path and the period from the query,
// and decides the situation once.
type Given = { mode: 'demo' | 'closed' | 'supabase'; user: null | { id: string }; load: unknown };
const given = vi.hoisted((): Given => ({ mode: 'supabase', user: null, load: { kind: 'no-workspace' } }));
const demoProfile = vi.hoisted(() => vi.fn<(login: string, ...rest: unknown[]) => { kind: string; login: string }>((login) => ({ kind: 'not-member', login })));
const loadProfileBoard = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>(() => Promise.resolve(given.load)));
const getClaims = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: given.user ? { claims: { sub: given.user.id } } : null, error: null })));

vi.mock('server-only', () => ({}));
vi.mock('../data/mode', () => ({ arcadeMode: () => given.mode }));
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: () => Promise.resolve({ auth: { getClaims } }),
}));
vi.mock('./profile', () => ({ demoProfile, loadProfileBoard }));

const { Streamed } = await import('../skeleton/Streamed');
const { default: Page } = await import('../../app/app/people/[login]/page.tsx');

const pageOf = async (login: string, query: Record<string, string> = {}) =>
  (await Page({ params: Promise.resolve({ login }), searchParams: Promise.resolve(query) })) as ReactElement;

async function screenOf(element: ReactElement): Promise<ReactElement<ProfileScreenProps>> {
  if (element.type !== Streamed) return element as ReactElement<ProfileScreenProps>;
  const { read, children } = element.props as StreamedProps<unknown>;
  return children(await read) as ReactElement<ProfileScreenProps>;
}

const propsOf = async (login: string, query: Record<string, string> = {}) => (await screenOf(await pageOf(login, query))).props;

beforeEach(() => {
  Object.assign(given, { mode: 'supabase', user: null, load: { kind: 'no-workspace' } });
  for (const fn of [demoProfile, loadProfileBoard, getClaims]) fn.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('/app/people/<login> decides once', () => {
  it('in the demo: the demo profile of the login, in lower case, over the query\'s period, and no session read', async () => {
    given.mode = 'demo';
    await propsOf('Paul-E', { period: 'season' });
    expect(demoProfile).toHaveBeenCalledWith('paul-e', 'season', expect.any(Date));
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('with no database: closed', async () => {
    given.mode = 'closed';
    expect((await propsOf('ada')).view).toEqual({ kind: 'closed' });
  });

  it('signed out: the sign-in card, and nothing read', async () => {
    expect((await propsOf('ada')).view).toEqual({ kind: 'sign-in' });
    expect(loadProfileBoard).not.toHaveBeenCalled();
  });

  it('signed in: the profile of the login, as that person, over 7 days by default', async () => {
    given.user = { id: 'u-1' };
    given.load = { kind: 'not-member', login: 'ada' };
    const props = await propsOf('ADA', { period: 'forever' });
    expect(loadProfileBoard).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'u-1' }), 'ada', '7d', expect.any(Date));
    expect(props.view).toEqual({ kind: 'not-member', login: 'ada' });
  });

  it('a path that is no GitHub login names nobody, and nothing is read', async () => {
    given.user = { id: 'u-1' };
    expect((await propsOf('ada%25_x')).view).toEqual({ kind: 'not-member', login: 'ada%_x' });
    expect(loadProfileBoard).not.toHaveBeenCalled();
  });
});
