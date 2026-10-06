import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { sure } from '../arcade/test/sure';
import { constituentsReader, readConstituents, type ConstituentsDeps } from './api';

// GET /api/constituents (PRD 871 s1) against a fake database of one workspace, Acme (GitHub org acme):
// constituents_for_repo() is played as the migration writes it, 42501 outside the caller's workspaces,
// and the repository's product's live Statement and Never lines inside them. No test calls Supabase.
const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test', member: true };
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@other.test', member: false };
const INSTALL = 'https://github.com/apps/omni-loop-invader/installations/new';

// The route's answer, read as it came: an object, with its refusal's words when it refuses.
const Answer = z.looseObject({ error: z.string().optional() });

const READ = {
  state: 'ok',
  product: { name: 'Acme UX' },
  statement: { id: 'statement', text: 'The component workshop' },
  never: [{ id: 'never#1', text: 'Calls real APIs' }, { id: 'never#3', text: 'Holds business logic' }],
  latestEventId: '12',
};

function world({ database = true, answer, error }: { database?: boolean; answer?: unknown; error?: { code: string; message: string } } = {}) {
  const calls: Array<{ fn: string; args: unknown; token: string }> = [];
  const users: Record<string, typeof ADA> = { 'ada-token': ADA, 'carl-token': CARL };
  const client = (token: string) => ({
    auth: {
      getUser: (jwt: string) => Promise.resolve({ data: { user: users[jwt] ?? null }, error: users[jwt] ? null : { status: 401, message: 'bad jwt' } }),
    },
    rpc: (fn: string, args: { p_repo: string }) => {
      calls.push({ fn, args, token });
      if (error) return Promise.resolve({ data: null, error });
      const member = sure(users[token], `the user of ${token}`).member;
      if (!member && args.p_repo.toLowerCase().startsWith('acme/')) {
        return Promise.resolve({ data: null, error: { code: '42501', message: 'you are not a member of Acme, which owns acme/widgets' } });
      }
      if (!member) {
        return Promise.resolve({ data: null, error: { code: '42501', message: 'no workspace owns other/thing yet — install the Omni App' } });
      }
      return Promise.resolve({ data: answer ?? READ, error: null });
    },
  });
  const deps: ConstituentsDeps = { connect: database ? (client as unknown as NonNullable<ConstituentsDeps['connect']>) : null, installLink: INSTALL };
  const get = async (query: string, token: string | null = 'ada-token') => {
    const response = await readConstituents(new Request(`https://omni.example/api/constituents${query}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }), deps);
    return { status: response.status, body: Answer.parse(await response.json()), cache: response.headers.get('cache-control') };
  };
  return { calls, get };
}

describe('GET /api/constituents', () => {
  it('answers a member\'s repository: the Statement, the Never list and the latest event id, as the caller, never cached', async () => {
    const w = world();
    expect(await w.get('?repo=acme/widgets')).toEqual({ status: 200, body: READ, cache: 'no-store' });
    expect(w.calls).toEqual([{ fn: 'constituents_for_repo', args: { p_repo: 'acme/widgets' }, token: 'ada-token' }]);
  });

  it('answers `none` for a product with no constituent', async () => {
    const none = { state: 'none', product: { name: 'Acme' }, statement: null, never: [], latestEventId: null };
    expect(await world({ answer: none }).get('?repo=acme/widgets')).toMatchObject({ status: 200, body: none });
  });

  it('401 without a token or with one the Auth server refuses, and asks the database nothing', async () => {
    const w = world();
    for (const token of [null, 'forged-token']) {
      const { status, body } = await w.get('?repo=acme/widgets', token);
      expect(status).toBe(401);
      expect(body.error).toEqual(expect.any(String));
    }
    expect(w.calls).toEqual([]);
  });

  it('403 outside the caller\'s workspaces, with the database\'s reason and the install link after its hint', async () => {
    const w = world();
    expect(await w.get('?repo=acme/widgets', 'carl-token')).toMatchObject({
      status: 403, body: { error: 'you are not a member of Acme, which owns acme/widgets' },
    });
    expect(await w.get('?repo=other/thing', 'carl-token')).toMatchObject({
      status: 403, body: { error: `no workspace owns other/thing yet — install the Omni App: ${INSTALL}` },
    });
  });

  it('400 for a missing or malformed repository, before the database is asked', async () => {
    const w = world();
    for (const query of ['', '?repo=', '?repo=widgets', '?repo=acme/widgets/extra', `?repo=acme/${'x'.repeat(200)}`]) {
      expect((await w.get(query)).status, query).toBe(400);
    }
    expect(w.calls).toEqual([]);
  });

  it('503 with no database here; 500 when the database fails or answers off the contract', async () => {
    expect((await world({ database: false }).get('?repo=acme/widgets')).status).toBe(503);
    expect((await world({ error: { code: 'XX000', message: 'boom' } }).get('?repo=acme/widgets')).status).toBe(500);
    expect((await world({ answer: { ...READ, state: 'none' } }).get('?repo=acme/widgets')).status).toBe(500);
  });
});

describe('the App\'s read', () => {
  it('calls constituents_for_repo_app() and checks the answer', async () => {
    const calls: unknown[] = [];
    const db = { rpc: (fn: string, args: unknown) => { calls.push([fn, args]); return Promise.resolve({ data: READ, error: null }); } };
    expect(await constituentsReader(db as never).forRepoApp('acme/widgets')).toEqual(READ);
    expect(calls).toEqual([['constituents_for_repo_app', { p_repo: 'acme/widgets' }]]);
  });
});
