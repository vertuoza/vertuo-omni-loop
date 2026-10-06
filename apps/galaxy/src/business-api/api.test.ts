import { describe, expect, it } from 'vitest';
import { readBusiness, type BusinessDeps } from './api';
import { sure } from '../arcade/test/sure';
import { answerOf } from '../business/json.fake';

// A fake database of one workspace, Acme (GitHub org acme), whose business holds claims in every
// state. business_for_repo() is played as the migration writes it: 42501 outside the caller's
// workspaces, `none` with no business or no confirmed claim, and confirmed and contradicted claims only,
// each with its `state` (PRD 774, decision 12).
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
  { seq: 6, kind: 'size', value: '2-50', source: 'pick', state: 'contradicted' },
  { seq: 7, kind: 'size', value: '5-10', source: 'evidence', state: 'proposed' },
];

type Persona = { name: string; stance: string; trade: string; who: string; usage: string };

const CAST: Persona[] = [
  { name: 'Marc', stance: 'skeptical', trade: 'plumber', who: 'Runs a company of five plumbers', usage: 'Mostly the quotes' },
  { name: 'Lea', stance: 'excited', trade: 'office', who: 'Keeps a builder\'s office', usage: 'The dashboard' },
];

function world({ business = true, claims = CLAIMS, personas = [] as Persona[], database = true, answer }: {
  business?: boolean; claims?: Row[]; personas?: Persona[]; database?: boolean; answer?: unknown;
} = {}) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const users: Record<string, typeof ADA> = { 'ada-token': ADA, 'carl-token': CARL };
  const client = (token: string) => ({
    auth: {
      getUser: (jwt: string) => Promise.resolve({ data: { user: users[jwt] ?? null }, error: users[jwt] ? null : { status: 401, message: 'bad jwt' } }),
    },
    rpc: (fn: string, args: { p_repo: string }) => {
      calls.push({ fn, args });
      if (answer !== undefined) return Promise.resolve({ data: answer, error: null });
      if (!sure(users[token], 'users[token]').member && args.p_repo.toLowerCase().startsWith('acme/')) {
        return Promise.resolve({ data: null, error: { code: '42501', message: 'you are not a member of Acme, which owns acme/widgets' } });
      }
      if (!sure(users[token], 'users[token]').member) {
        return Promise.resolve({ data: null, error: { code: '42501', message: 'no workspace owns other/thing yet — install the Omni App' } });
      }
      if (!business) return Promise.resolve({ data: { state: 'none', business: null, product: null, claims: [], personas: [] }, error: null });
      const listed = claims.filter((c) => c.state === 'confirmed' || c.state === 'contradicted').map((c) => ({
        id: `${c.kind}#${c.seq}`, kind: c.kind, value: c.value, source: c.source, state: c.state, receipt: null, lastSeen: null,
      }));
      return Promise.resolve({ data: { state: listed.length ? 'ok' : 'none', business: { name: 'Acme' }, product: null, claims: listed, personas }, error: null });
    },
  });
  const deps: BusinessDeps = { connect: database ? (client as unknown as NonNullable<BusinessDeps['connect']>) : null, installLink: INSTALL };
  const get = async (query: string, token: string | null = 'ada-token') => {
    const response = await readBusiness(new Request(`https://omni.example/api/business${query}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }), deps);
    return { status: response.status, body: await answerOf(response), cache: response.headers.get('cache-control') };
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
    expect(body).toEqual({ state: 'none', business: null, product: null, claims: [], personas: [] });
  });

  it('none when the business holds no confirmed claim', async () => {
    const claims = CLAIMS.filter((c) => c.state !== 'confirmed' && c.state !== 'contradicted');
    const { body } = await world({ claims }).get('?repo=acme/widgets');
    expect(body).toEqual({ state: 'none', business: { name: 'Acme' }, product: null, claims: [], personas: [] });
  });

  it('the decision-14 body, confirmed and contradicted claims with their state, never a proposed or rejected one', async () => {
    const w = world();
    const { status, body } = await w.get('?repo=Acme/Widgets');
    expect(status).toBe(200);
    expect(w.calls).toEqual([{ fn: 'business_for_repo', args: { p_repo: 'Acme/Widgets' } }]);
    expect(body).toEqual({
      state: 'ok',
      business: { name: 'Acme' },
      product: null,
      claims: [
        { id: 'region#1', kind: 'region', value: 'Belgium', source: 'pick', state: 'confirmed', receipt: null, lastSeen: null },
        { id: 'offering#2', kind: 'offering', value: 'ERP', source: 'pick', state: 'confirmed', receipt: null, lastSeen: null },
        { id: 'rival#4', kind: 'rival', value: 'Rival One', source: 'suggestion', state: 'confirmed', receipt: null, lastSeen: null },
        { id: 'size#6', kind: 'size', value: '2-50', source: 'pick', state: 'contradicted', receipt: null, lastSeen: null },
      ],
      personas: [],
    });
    expect(JSON.stringify(body)).not.toMatch(/Guessed|Wrong One|5-10/);
  });

  it('an evidence claim carries its newest receipt and when it was last seen', async () => {
    const seen = { state: 'ok', business: { name: 'Acme' }, product: null, personas: [], claims: [
      { id: 'region#8', kind: 'region', value: 'France', source: 'evidence', state: 'confirmed',
        receipt: 'acme/widgets:README.md — "offices in France"', lastSeen: '2026-09-28T22:00:00+00:00' },
    ] };
    const { status, body } = await world({ answer: seen }).get('?repo=acme/widgets');
    expect(status).toBe(200);
    expect(body).toEqual(seen);
  });

  it('carries a product\'s Never line as a claim of kind never, up to 200 characters (PRD 839)', async () => {
    const line = 'Build for groups of companies: '.padEnd(200, 'x');
    const read = { state: 'ok', business: { name: 'Acme' }, product: null, personas: [], claims: [
      { id: 'never#9', kind: 'never', value: line, source: 'pick', state: 'confirmed', receipt: null, lastSeen: null },
    ] };
    const { status, body } = await world({ answer: read }).get('?repo=acme/widgets');
    expect(status).toBe(200);
    expect(body).toEqual(read);
  });

  it('500, and nothing of it sent on, when the database answers outside the contract', async () => {
    const claim = { id: 'rival#3', kind: 'rival', value: 'Guessed', source: 'suggestion', receipt: null, lastSeen: null };
    for (const leaked of [{ ...claim, state: 'proposed' }, { ...claim, state: 'rejected' }, claim]) {
      const leaking = { state: 'ok', business: { name: 'Acme' }, product: null, claims: [leaked] };
      const { status, body } = await world({ answer: leaking }).get('?repo=acme/widgets');
      expect(status).toBe(500);
      expect(JSON.stringify(body)).not.toContain('Guessed');
    }
  });

  it('carries the product\'s personas, oldest first as the database lists them (PRD 799)', async () => {
    const { status, body } = await world({ personas: CAST }).get('?repo=acme/widgets');
    expect(status).toBe(200);
    expect(body.personas).toEqual(CAST);
    expect(body.state).toBe('ok');
  });

  it('state is decided by claims only: personas without a confirmed claim still read none, and come back', async () => {
    const claims = CLAIMS.filter((c) => c.state !== 'confirmed' && c.state !== 'contradicted');
    const { body } = await world({ claims, personas: CAST }).get('?repo=acme/widgets');
    expect(body).toEqual({ state: 'none', business: { name: 'Acme' }, product: null, claims: [], personas: CAST });
    const without = await world({ personas: [] }).get('?repo=acme/widgets');
    const withCast = await world({ personas: CAST }).get('?repo=acme/widgets');
    expect(withCast.body.state).toBe(without.body.state);
  });

  it('personas: [] from a database that sends none', async () => {
    const older = { state: 'none', business: null, product: null, claims: [] };
    const { status, body } = await world({ answer: older }).get('?repo=acme/widgets');
    expect(status).toBe(200);
    expect(body.personas).toEqual([]);
  });

  it('500 when a persona is outside the contract', async () => {
    for (const bad of [{ ...CAST[0], stance: 'angry' }, { ...CAST[0], name: '' }, { ...CAST[0], avatar: { v: 1 } }]) {
      const answer = { state: 'none', business: { name: 'Acme' }, product: null, claims: [], personas: [bad] };
      expect((await world({ answer }).get('?repo=acme/widgets')).status).toBe(500);
    }
  });

  it('503 when this deployment has no database', async () => {
    expect((await world({ database: false }).get('?repo=acme/widgets')).status).toBe(503);
  });
});
