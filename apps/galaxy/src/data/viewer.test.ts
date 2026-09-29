import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { readViewing, userOfClaims, viewerOf } = await import('./viewer');
type Deps = Parameters<typeof readViewing>[0];

// Who is looking, decided once per request (PRD 657 s2): one client, one claims read, one workspace
// read and one questions read, however many times the layout and the page ask. Tested on a fake client
// that counts its calls, never on Supabase. React's cache() is what memoizes in production; a test
// memo stands in for it here.

const ENV = { url: 'https://db.example', key: 'anon' };

const CLAIMS = {
  sub: 'u-ada',
  email: 'ada@example.com',
  app_metadata: { provider: 'github', providers: ['github'] },
  user_metadata: { full_name: 'Ada Lovelace', user_name: 'ada', avatar_url: 'https://avatars.example/ada.png' },
};

function fakeClient(claims: Record<string, unknown> | null = CLAIMS) {
  const calls = { getClaims: 0, getUser: 0, workspaces: 0 };
  const client = {
    auth: {
      async getClaims() {
        calls.getClaims += 1;
        return { data: claims ? { claims } : null, error: null };
      },
      async getUser() {
        calls.getUser += 1;
        return { data: { user: null }, error: null };
      },
    },
    from(table: string) {
      if (table !== 'workspace_members') throw new Error(`fake: no table ${table}`);
      calls.workspaces += 1;
      return {
        select: () => ({
          eq: async () => ({
            data: [{ joined_at: '2026-09-01T00:00:00Z', workspace: { id: 'w-1', slug: 'acme', name: 'Acme', theme: {} } }],
            error: null,
          }),
        }),
      };
    },
  };
  return { client, calls };
}

/** One request's memo: the first call's promise, every time after. */
const perRequest = <T,>(read: () => T) => {
  let kept: { value: T } | null = null;
  return () => (kept ??= { value: read() }).value;
};

const deps = (over: Partial<Deps> = {}) => {
  const { client, calls } = fakeClient();
  let clients = 0;
  const questions = vi.fn(async () => []);
  const d: Deps = {
    mode: () => 'supabase',
    env: () => ENV,
    client: async () => {
      clients += 1;
      return client as never;
    },
    questions,
    now: () => 1_000,
    ...over,
  };
  return { d, calls, clients: () => clients, questions };
};

describe('viewer()', () => {
  it('builds one client and reads the claims, the workspace and the questions once, called three times in one request', async () => {
    const { d, calls, clients, questions } = deps();
    const viewer = viewerOf(d, perRequest);
    const [a, b, c] = await Promise.all([viewer(), viewer(), viewer()]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    if (a.kind !== 'signed-in' || b.kind !== 'signed-in' || c.kind !== 'signed-in') throw new Error(`expected signed in, got ${a.kind}`);
    await Promise.all([a.workspace(), b.workspace(), c.workspace()]);
    await Promise.all([a.questions(), c.questions()]);
    expect(clients()).toBe(1);
    expect(calls).toEqual({ getClaims: 1, getUser: 0, workspaces: 1 });
    expect(questions).toHaveBeenCalledTimes(1);
    expect(questions).toHaveBeenCalledWith(a.db, 'u-ada', 1_000);
    expect(await a.workspace()).toMatchObject({ id: 'w-1', name: 'Acme' });
    expect(a.env).toEqual(ENV);
  });

  it('never calls auth.getUser()', async () => {
    const { d, calls } = deps();
    await readViewing(d);
    expect(calls.getUser).toBe(0);
  });

  it('is the demo in demo mode, and closed with no database, building no client', async () => {
    const { d, clients } = deps({ mode: () => 'demo' });
    expect(await readViewing(d)).toEqual({ kind: 'demo' });
    const closed = deps({ mode: () => 'closed' });
    expect(await readViewing(closed.d)).toEqual({ kind: 'closed' });
    const noEnv = deps({ env: () => null });
    expect(await readViewing(noEnv.d)).toEqual({ kind: 'closed' });
    expect(clients() + closed.clients() + noEnv.clients()).toBe(0);
  });

  it('is signed out when the claims are absent, or cannot be read', async () => {
    const empty = fakeClient(null);
    expect(await readViewing(deps({ client: async () => empty.client as never }).d)).toMatchObject({ kind: 'sign-in', env: ENV });
    const failing = { auth: { getClaims: async () => ({ data: null, error: new Error('bad jwt') }) } };
    expect(await readViewing(deps({ client: async () => failing as never }).d)).toMatchObject({ kind: 'sign-in' });
    const throwing = { auth: { getClaims: async () => { throw new Error('down'); } } };
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    expect(await readViewing(deps({ client: async () => throwing as never }).d)).toMatchObject({ kind: 'sign-in' });
  });
});

describe('the user, from the claims', () => {
  it('carries the id, the email, the metadata, and the GitHub login as a linked identity', () => {
    const user = userOfClaims(CLAIMS as never);
    expect(user).toMatchObject({ id: 'u-ada', email: 'ada@example.com', user_metadata: CLAIMS.user_metadata, app_metadata: CLAIMS.app_metadata });
    expect(user.identities).toEqual([expect.objectContaining({ provider: 'github', identity_data: { user_name: 'ada', preferred_username: null } })]);
  });

  it('links no GitHub identity when the account signed in some other way, or has no login', () => {
    expect(userOfClaims({ ...CLAIMS, app_metadata: { provider: 'email', providers: ['email'] } } as never).identities).toEqual([]);
    expect(userOfClaims({ ...CLAIMS, user_metadata: {} } as never).identities).toEqual([]);
  });
});
