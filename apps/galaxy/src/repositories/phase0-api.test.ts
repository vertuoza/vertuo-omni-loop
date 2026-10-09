import { describe, expect, it, vi } from 'vitest';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { readPhase0, type Phase0Deps } from './phase0-api';

// GET /api/repositories/phase0?repo=<owner/name> (PRD 1299 s1), with a stubbed Supabase client: where
// the repository's phase 0 is approved, `pr` or `server`, as repository_phase0() answers it for the
// caller's workspace; `pr` for a repository the workspace does not list; and each refusal, in plain
// words.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test', member: true };
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@other.test', member: false };
const INSTALL = 'https://github.com/apps/omni-loop-invader/installations/new';
const STORED: Record<string, string> = { 'acme/widgets': 'server', 'acme/legacy': 'pr' };

type Answer = { data: unknown; error: unknown };

function world({ database = true, answer }: { database?: boolean; answer?: Answer } = {}) {
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
      return Promise.resolve({ data: STORED[args.p_repo.toLowerCase()] ?? 'pr', error: null });
    },
  });
  const deps: Phase0Deps = { connect: database ? (client as unknown as NonNullable<Phase0Deps['connect']>) : null, installLink: INSTALL };
  const get = async (query: string, token: string | null = 'ada-token') => {
    const response = await readPhase0(new Request(`https://omni.example/api/repositories/phase0${query}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }), deps);
    const body: unknown = await response.json();
    return { status: response.status, body, cache: response.headers.get('cache-control') };
  };
  return { calls, get };
}

describe('GET /api/repositories/phase0', () => {
  it("answers the repository's phase 0, never cached", async () => {
    const w = world();
    expect(await w.get('?repo=acme/widgets')).toEqual({ status: 200, body: { phase0: 'server' }, cache: 'no-store' });
    expect((await w.get('?repo=acme/legacy')).body).toEqual({ phase0: 'pr' });
    expect(w.calls).toEqual([
      { fn: 'repository_phase0', args: { p_repo: 'acme/widgets' } },
      { fn: 'repository_phase0', args: { p_repo: 'acme/legacy' } },
    ]);
  });

  it('answers pr for a repository the workspace does not list', async () => {
    expect((await world().get('?repo=acme/unlisted')).body).toEqual({ phase0: 'pr' });
  });

  it('refuses a malformed or missing repository, with no database call', async () => {
    const w = world();
    expect(await w.get('?repo=widgets')).toMatchObject({ status: 400, body: { error: '`repo` must be the repository as owner/name.' } });
    expect(await w.get('')).toMatchObject({ status: 400 });
    expect(await w.get(`?repo=acme/${'x'.repeat(200)}`)).toMatchObject({ status: 400 });
    expect(w.calls).toEqual([]);
  });

  it('refuses a call with no valid sign-in', async () => {
    expect((await world().get('?repo=acme/widgets', null)).status).toBe(401);
    expect((await world().get('?repo=acme/widgets', 'stale-token')).status).toBe(401);
  });

  it("refuses a caller outside the repository's workspace with the database's reason and the install link", async () => {
    const got = await world().get('?repo=acme/widgets', 'carl-token');
    expect(got.status).toBe(403);
    expect(propertyOf(got.body, 'error')).toContain('you are not a member of Acme');
  });

  it("answers 400 with the database's reason for a repository it refuses as out of shape", async () => {
    const got = await world({ answer: { data: null, error: { code: '22023', message: 'Repository: owner/name.' } } }).get('?repo=acme/widgets');
    expect(got).toMatchObject({ status: 400, body: { error: 'Repository: owner/name.' } });
  });

  it('answers 503 with no database here, and 500 when the database fails or answers out of shape', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await world({ database: false }).get('?repo=acme/widgets')).toMatchObject({
      status: 503, body: { error: 'Phase 0 is not available here: this deployment has no database.' },
    });
    expect(await world({ answer: { data: null, error: { code: 'XX000', message: 'boom' } } }).get('?repo=acme/widgets')).toMatchObject({
      status: 500, body: { error: 'Phase 0 could not be read. Try again.' },
    });
    expect((await world({ answer: { data: 'both', error: null } }).get('?repo=acme/widgets')).status).toBe(500);
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('phase0'));
  });
});
