import { describe, expect, it } from 'vitest';
import { citeClaims, type BusinessDeps } from './api';

// A fake database of one workspace, Acme (GitHub org acme), whose business holds region#1 and rival#4.
// claims_cite() is played as the migration writes it: 42501 outside the caller's workspaces, 22023 a
// malformed id, P0002 an id the business does not hold, else one citation appended per id.
const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test', member: true };
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@other.test', member: false };
const HELD = ['region#1', 'rival#4'];

function world({ database = true } = {}) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const log: Array<{ id: string; by: string; ref: string | null }> = [];
  const users: Record<string, typeof ADA> = { 'ada-token': ADA, 'carl-token': CARL };
  const client = (token: string) => ({
    auth: {
      getUser: async (jwt: string) => ({ data: { user: users[jwt] ?? null }, error: users[jwt] ? null : { status: 401, message: 'bad jwt' } }),
    },
    rpc: async (fn: string, args: { p_repo: string; p_ids: string[]; p_by: string; p_ref: string | null }) => {
      calls.push({ fn, args });
      if (!users[token].member) return { data: null, error: { code: '42501', message: 'you are not a member of Acme, which owns acme/widgets' } };
      for (const id of args.p_ids) {
        if (!/^(region|offering|size|trade|rival)#[1-9]\d*$/.test(id)) return { data: null, error: { code: '22023', message: `Ids: ${id} is not a claim id like rival#4.` } };
        if (!HELD.includes(id)) return { data: null, error: { code: 'P0002', message: `Ids: this business holds no ${id}.` } };
      }
      for (const id of args.p_ids) log.push({ id, by: args.p_by, ref: args.p_ref });
      return { data: args.p_ids.length, error: null };
    },
  });
  const deps: BusinessDeps = { connect: database ? (client as unknown as NonNullable<BusinessDeps['connect']>) : null };
  const post = async (body: unknown, token: string | null = 'ada-token') => {
    const response = await citeClaims(new Request('https://omni.example/api/business/citations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }), deps);
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  };
  return { calls, log, post };
}

const CITE = { repo: 'acme/widgets', ids: ['rival#4'], by: 'think-big', ref: 'concept #9' };

describe('POST /api/business/citations', () => {
  it('401 without a token or with one the Auth server refuses, and asks the database nothing', async () => {
    const w = world();
    for (const token of [null, 'forged-token']) {
      const { status, body } = await w.post(CITE, token);
      expect(status).toBe(401);
      expect(body.error).toEqual(expect.any(String));
    }
    expect(w.calls).toEqual([]);
  });

  it('appends one citation per id, and answers how many', async () => {
    const w = world();
    const { status, body, cache } = await w.post(CITE);
    expect(status).toBe(200);
    expect(cache).toBe('no-store');
    expect(body).toEqual({ cited: 1 });
    expect(w.calls).toEqual([{ fn: 'claims_cite', args: { p_repo: 'acme/widgets', p_ids: ['rival#4'], p_by: 'think-big', p_ref: 'concept #9' } }]);
    expect(w.log).toEqual([{ id: 'rival#4', by: 'think-big', ref: 'concept #9' }]);
  });

  it('cites several ids at once, and a missing ref is sent as null', async () => {
    const w = world();
    const { body } = await w.post({ repo: 'acme/widgets', ids: ['region#1', 'rival#4'], by: 'think-big' });
    expect(body).toEqual({ cited: 2 });
    expect(w.log).toEqual([
      { id: 'region#1', by: 'think-big', ref: null },
      { id: 'rival#4', by: 'think-big', ref: null },
    ]);
  });

  it('403 for a repository outside the caller\'s workspaces, and nothing appended', async () => {
    const w = world();
    const { status, body } = await w.post(CITE, 'carl-token');
    expect(status).toBe(403);
    expect(body.error).toBe('you are not a member of Acme, which owns acme/widgets');
    expect(w.log).toEqual([]);
  });

  it('400 for a malformed body, before the database is asked', async () => {
    const w = world();
    for (const body of [
      'not json', [], { ...CITE, repo: 'widgets' }, { ...CITE, ids: [] }, { ...CITE, ids: 'rival#4' },
      { ...CITE, ids: [4] }, { ...CITE, by: '' }, { ...CITE, by: undefined }, { ...CITE, ref: 9 },
    ]) {
      expect((await w.post(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(w.calls).toEqual([]);
  });

  it('400 with the database\'s reason for an id that is not a claim id', async () => {
    const { status, body } = await world().post({ ...CITE, ids: ['rival-4'] });
    expect(status).toBe(400);
    expect(body.error).toContain('rival-4');
  });

  it('404 for an id the business does not hold, and nothing appended', async () => {
    const w = world();
    const { status, body } = await w.post({ ...CITE, ids: ['rival#4', 'rival#99'] });
    expect(status).toBe(404);
    expect(body.error).toContain('rival#99');
    expect(w.log).toEqual([]);
  });

  it('503 when this deployment has no database', async () => {
    expect((await world({ database: false }).post(CITE)).status).toBe(503);
  });
});
