import { describe, expect, it, vi } from 'vitest';
import { readPitchLook, type PitchLookDeps } from './pitch-look-api';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// GET /api/pitch-look?repo=<owner/name> (PRD 859 s1), with a stubbed Supabase client: the look of a
// tracked repository's product, arcade for a repository with no product, as pitch_look_for_repo()
// answers it; and each refusal, in plain words.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test', member: true };
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@other.test', member: false };
const INSTALL = 'https://github.com/apps/omni-loop-invader/installations/new';
const LOOKS: Record<string, string> = { 'acme/widgets': 'keynote', 'acme/legacy': 'arcade' };

function world({ database = true, answer }: { database?: boolean; answer?: { data: unknown; error: unknown } } = {}) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const users: Record<string, typeof ADA> = { 'ada-token': ADA, 'carl-token': CARL };
  const client = (token: string) => ({
    auth: {
      getUser: (jwt: string) => Promise.resolve({ data: { user: users[jwt] ?? null }, error: users[jwt] ? null : { status: 401, message: 'bad jwt' } }),
    },
    rpc: (fn: string, args: { p_repo: string }) => {
      calls.push({ fn, args });
      if (answer) return Promise.resolve(answer);
      if (!users[token]?.member) return Promise.resolve({ data: null, error: { code: '42501', message: 'you are not a member of Acme, which owns acme/widgets' } });
      return Promise.resolve({ data: LOOKS[args.p_repo.toLowerCase()] ?? 'arcade', error: null });
    },
  });
  const deps: PitchLookDeps = { connect: database ? (client as unknown as NonNullable<PitchLookDeps['connect']>) : null, installLink: INSTALL };
  const get = async (query: string, token: string | null = 'ada-token') => {
    const response = await readPitchLook(new Request(`https://omni.example/api/pitch-look${query}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }), deps);
    const body: unknown = await response.json();
    return { status: response.status, body, cache: response.headers.get('cache-control') };
  };
  return { calls, get };
}

describe('GET /api/pitch-look', () => {
  it('answers the look of a tracked repository\'s product, as pitch_look_for_repo() reads it', async () => {
    const w = world();
    expect(await w.get('?repo=acme/widgets')).toEqual({ status: 200, body: { look: 'keynote' }, cache: 'no-store' });
    expect(w.calls).toEqual([{ fn: 'pitch_look_for_repo', args: { p_repo: 'acme/widgets' } }]);
  });

  it('answers arcade for a repository with no product', async () => {
    expect((await world().get('?repo=acme/no-product')).body).toEqual({ look: 'arcade' });
  });

  it('refuses a malformed repository, with no database call', async () => {
    const w = world();
    expect(await w.get('?repo=widgets')).toMatchObject({ status: 400, body: { error: '`repo` must be the repository as owner/name.' } });
    expect(await w.get('')).toMatchObject({ status: 400 });
    expect(w.calls).toEqual([]);
  });

  it('refuses a call with no valid sign-in', async () => {
    expect((await world().get('?repo=acme/widgets', null)).status).toBe(401);
    expect((await world().get('?repo=acme/widgets', 'stale-token')).status).toBe(401);
  });

  it('refuses a repository outside the caller\'s workspaces with the database\'s reason', async () => {
    const got = await world().get('?repo=acme/widgets', 'carl-token');
    expect(got.status).toBe(403);
    expect(propertyOf(got.body, 'error')).toContain('you are not a member of Acme');
  });

  it('answers 503 with no database here, and 500 when the database fails or answers a look it does not know', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await world({ database: false }).get('?repo=acme/widgets')).status).toBe(503);
    expect((await world({ answer: { data: null, error: { code: 'XX000', message: 'boom' } } }).get('?repo=acme/widgets')).status).toBe(500);
    expect((await world({ answer: { data: 'custom', error: null } }).get('?repo=acme/widgets')).status).toBe(500);
  });
});
