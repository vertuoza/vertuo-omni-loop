import { describe, expect, it } from 'vitest';
import { readBusiness, type BusinessDeps } from './api';

// A fake database of one workspace, Acme (GitHub org acme), whose business holds claims in every
// state. business_for_repo() is played as the migration writes it: 42501 outside the caller's
// workspaces, `none` with no business or no confirmed claim, and confirmed claims only.
const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test', member: true };
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@other.test', member: false };
const INSTALL = 'https://github.com/apps/omni-loop-invader/installations/new';

type Row = { seq: number; kind: string; value: string; source: string; state: string };

const CLAIMS: Row[] = [
  { seq: 1, kind: 'region', value: 'Belgium', source: 'pick', state: 'confirmed' },
  { seq: 2, kind: 'offering', value: 'ERP', source: 'pick', state: 'confirmed' },
  { seq: 3, kind: 'rival', value: 'Guessed', source: 'suggestion', state: 'proposed' },
  { seq: 4, kind: 'rival', value: 'Rival One', source: 'suggestion', state: 'confirmed' },
  { seq: 5, kind: 'rival', value: 'Wrong One', source: 'suggestion', state: 'rejected' },
];

function world({ business = true, claims = CLAIMS, database = true, answer }: {
  business?: boolean; claims?: Row[]; database?: boolean; answer?: unknown;
} = {}) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const users: Record<string, typeof ADA> = { 'ada-token': ADA, 'carl-token': CARL };
  const client = (token: string) => ({
    auth: {
      getUser: async (jwt: string) => ({ data: { user: users[jwt] ?? null }, error: users[jwt] ? null : { status: 401, message: 'bad jwt' } }),
    },
    rpc: async (fn: string, args: { p_repo: string }) => {
      calls.push({ fn, args });
      if (answer !== undefined) return { data: answer, error: null };
      if (!users[token].member && args.p_repo.toLowerCase().startsWith('acme/')) {
        return { data: null, error: { code: '42501', message: 'you are not a member of Acme, which owns acme/widgets' } };
      }
      if (!users[token].member) {
        return { data: null, error: { code: '42501', message: 'no workspace owns other/thing yet — install the Omni App' } };
      }
      if (!business) return { data: { state: 'none', business: null, product: null, claims: [] }, error: null };
      const listed = claims.filter((c) => c.state === 'confirmed').map((c) => ({
        id: `${c.kind}#${c.seq}`, kind: c.kind, value: c.value, source: c.source, receipt: null, lastSeen: null,
      }));
      return { data: { state: listed.length ? 'ok' : 'none', business: { name: 'Acme' }, product: null, claims: listed }, error: null };
    },
  });
  const deps: BusinessDeps = { connect: database ? (client as unknown as NonNullable<BusinessDeps['connect']>) : null, installLink: INSTALL };
  const get = async (query: string, token: string | null = 'ada-token') => {
    const response = await readBusiness(new Request(`https://omni.example/api/business${query}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }), deps);
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  };
  return { calls, get };
}

describe('GET /api/business', () => {
  it('401 without a token or with one the Auth server refuses, and asks the database nothing', async () => {
    const w = world();
    for (const token of [null, 'forged-token']) {
      const { status, body } = await w.get('?repo=acme/widgets', token);
      expect(status).toBe(401);
      expect(body.error).toEqual(expect.any(String));
    }
    expect(w.calls).toEqual([]);
  });

  it('400 for a missing or malformed repository', async () => {
    const w = world();
    for (const query of ['', '?repo=', '?repo=widgets', '?repo=acme/widgets/extra', `?repo=acme/${'x'.repeat(200)}`]) {
      expect((await w.get(query)).status).toBe(400);
    }
    expect(w.calls).toEqual([]);
  });

  it('403 for a repository outside the caller\'s workspaces, with the database\'s reason', async () => {
    const w = world();
    const other = await w.get('?repo=acme/widgets', 'carl-token');
    expect(other).toMatchObject({ status: 403, body: { error: 'you are not a member of Acme, which owns acme/widgets' } });
    const none = await w.get('?repo=other/thing', 'carl-token');
    expect(none.status).toBe(403);
    expect(none.body.error).toContain(INSTALL);
  });

  it('none when the workspace has no business', async () => {
    const { status, body, cache } = await world({ business: false }).get('?repo=acme/widgets');
    expect(status).toBe(200);
    expect(cache).toBe('no-store');
    expect(body).toEqual({ state: 'none', business: null, product: null, claims: [] });
  });

  it('none when the business holds no confirmed claim', async () => {
    const claims = CLAIMS.filter((c) => c.state !== 'confirmed');
    const { body } = await world({ claims }).get('?repo=acme/widgets');
    expect(body).toEqual({ state: 'none', business: { name: 'Acme' }, product: null, claims: [] });
  });

  it('the decision-14 body, confirmed claims only, never a proposed or rejected one', async () => {
    const w = world();
    const { status, body } = await w.get('?repo=Acme/Widgets');
    expect(status).toBe(200);
    expect(w.calls).toEqual([{ fn: 'business_for_repo', args: { p_repo: 'Acme/Widgets' } }]);
    expect(body).toEqual({
      state: 'ok',
      business: { name: 'Acme' },
      product: null,
      claims: [
        { id: 'region#1', kind: 'region', value: 'Belgium', source: 'pick', receipt: null, lastSeen: null },
        { id: 'offering#2', kind: 'offering', value: 'ERP', source: 'pick', receipt: null, lastSeen: null },
        { id: 'rival#4', kind: 'rival', value: 'Rival One', source: 'suggestion', receipt: null, lastSeen: null },
      ],
    });
    expect(JSON.stringify(body)).not.toMatch(/Guessed|Wrong One/);
  });

  it('500, and nothing of it sent on, when the database answers outside the contract', async () => {
    const leaking = { state: 'ok', business: { name: 'Acme' }, product: null, claims: [
      { id: 'rival#3', kind: 'rival', value: 'Guessed', source: 'suggestion', receipt: null, lastSeen: null, state: 'proposed' },
    ] };
    const { status, body } = await world({ answer: leaking }).get('?repo=acme/widgets');
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('Guessed');
  });

  it('503 when this deployment has no database', async () => {
    expect((await world({ database: false }).get('?repo=acme/widgets')).status).toBe(503);
  });
});
