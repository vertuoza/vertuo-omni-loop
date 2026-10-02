import { describe, expect, it } from 'vitest';
import { addClaim, type BusinessDeps } from './api';

// A fake database of one workspace, Acme (GitHub org acme), whose business already holds size#3 (2-50,
// confirmed). claim_answer() is played as the migration writes it: 42501 outside the caller's
// workspaces, 22023 a kind, state or value it refuses, else the claim stored with source `answer` and
// the receipt, or the value already held named as it is.
const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test', member: true };
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@other.test', member: false };

type Args = { p_repo: string; p_kind: string; p_value: string; p_state: string; p_ref: string };
type Stored = { id: string; kind: string; value: string; source: string; state: string; receipt: string };

function world({ database = true } = {}) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const claims: Stored[] = [{ id: 'size#3', kind: 'size', value: '2-50', source: 'pick', state: 'confirmed', receipt: '' }];
  const users: Record<string, typeof ADA> = { 'ada-token': ADA, 'carl-token': CARL };
  const client = (token: string) => ({
    auth: {
      getUser: async (jwt: string) => ({ data: { user: users[jwt] ?? null }, error: users[jwt] ? null : { status: 401, message: 'bad jwt' } }),
    },
    rpc: async (fn: string, args: Args) => {
      calls.push({ fn, args });
      if (!users[token]!.member) return { data: null, error: { code: '42501', message: 'you are not a member of Acme, which owns acme/widgets' } };
      if (args.p_kind === 'size' && !/^\d+\+?-\d+\+?$/.test(args.p_value)) {
        return { data: null, error: { code: '22023', message: 'Size: <min>-<max>, each one of 1, 2, 5, 10, 20, 50, 100, 250, 500, 1000+.' } };
      }
      const held = claims.find((c) => c.kind === args.p_kind && c.value.toLowerCase() === args.p_value.toLowerCase());
      if (held) return { data: { id: held.id, state: held.state, added: false }, error: null };
      const id = `${args.p_kind}#${claims.length + 3}`;
      claims.push({ id, kind: args.p_kind, value: args.p_value, source: 'answer', state: args.p_state, receipt: args.p_ref });
      return { data: { id, state: args.p_state, added: true }, error: null };
    },
  });
  const deps: BusinessDeps = { connect: database ? (client as unknown as NonNullable<BusinessDeps['connect']>) : null };
  const post = async (body: unknown, token: string | null = 'ada-token') => {
    const response = await addClaim(new Request('https://omni.example/api/business/claims', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }), deps);
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  };
  return { calls, claims, post };
}

const ANSWER = { repo: 'acme/widgets', kind: 'size', value: '20-50', state: 'proposed', ref: 'brainstorm · PRD 822' };

describe('POST /api/business/claims', () => {
  it('401 without a token or with one the Auth server refuses, and asks the database nothing', async () => {
    const w = world();
    for (const token of [null, 'forged-token']) {
      const { status, body } = await w.post(ANSWER, token);
      expect(status).toBe(401);
      expect(body.error).toEqual(expect.any(String));
    }
    expect(w.calls).toEqual([]);
  });

  for (const state of ['proposed', 'confirmed']) {
    it(`stores a ${state} claim with source answer and the ref as its receipt`, async () => {
      const w = world();
      const { status, body, cache } = await w.post({ ...ANSWER, state });
      expect(status).toBe(200);
      expect(cache).toBe('no-store');
      expect(body).toEqual({ id: 'size#4', state, added: true });
      expect(w.calls).toEqual([{
        fn: 'claim_answer',
        args: { p_repo: 'acme/widgets', p_kind: 'size', p_value: '20-50', p_state: state, p_ref: 'brainstorm · PRD 822' },
      }]);
      expect(w.claims.at(-1)).toEqual({ id: 'size#4', kind: 'size', value: '20-50', source: 'answer', state, receipt: 'brainstorm · PRD 822' });
    });
  }

  it('names a value the business already holds, in its own state, and stores nothing', async () => {
    const w = world();
    const { status, body } = await w.post({ ...ANSWER, value: '2-50' });
    expect(status).toBe(200);
    expect(body).toEqual({ id: 'size#3', state: 'confirmed', added: false });
    expect(w.claims).toHaveLength(1);
  });

  it('403 for a repository outside the caller\'s workspaces, and nothing stored', async () => {
    const w = world();
    const { status, body } = await w.post(ANSWER, 'carl-token');
    expect(status).toBe(403);
    expect(body.error).toBe('you are not a member of Acme, which owns acme/widgets');
    expect(w.claims).toHaveLength(1);
  });

  it('400 for a bad kind or a bad state, before the database is asked', async () => {
    const w = world();
    for (const body of [
      { ...ANSWER, kind: 'colour' }, { ...ANSWER, kind: undefined }, { ...ANSWER, kind: 7 },
      { ...ANSWER, state: 'rejected' }, { ...ANSWER, state: 'contradicted' }, { ...ANSWER, state: undefined },
    ]) {
      const { status, body: reply } = await w.post(body);
      expect(status, JSON.stringify(body)).toBe(400);
      expect(reply.error).toMatch(/kind|state/);
    }
    expect(w.calls).toEqual([]);
  });

  it('400 for any other malformed body, before the database is asked', async () => {
    const w = world();
    for (const body of [
      'not json', [], 'null', { ...ANSWER, repo: 'widgets' }, { ...ANSWER, repo: 7 },
      { ...ANSWER, value: '' }, { ...ANSWER, value: '   ' }, { ...ANSWER, value: 'v'.repeat(81) }, { ...ANSWER, value: 3 },
      { ...ANSWER, ref: undefined }, { ...ANSWER, ref: '  ' }, { ...ANSWER, ref: 'r'.repeat(201) }, { ...ANSWER, ref: {} },
    ]) {
      expect((await w.post(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(w.calls).toEqual([]);
  });

  it('400 with the database\'s reason (22023) for a value it refuses, and nothing stored', async () => {
    const w = world();
    const { status, body } = await w.post({ ...ANSWER, value: 'fifty' });
    expect(status).toBe(400);
    expect(body.error).toContain('Size');
    expect(w.claims).toHaveLength(1);
  });

  it('413 for a body over its cap', async () => {
    expect((await world().post({ ...ANSWER, ref: 'r'.repeat(20 * 1024) })).status).toBe(413);
  });

  it('503 when this deployment has no database', async () => {
    expect((await world({ database: false }).post(ANSWER)).status).toBe(503);
  });
});
