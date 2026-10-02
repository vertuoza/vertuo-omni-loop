import { describe, expect, it } from 'vitest';
import type { StoredClaim } from './model';
import { suggestRivalsRoute, SuggestStoreError, type SuggestDeps, type SuggestStore } from './suggest-api';
import type { SuggestInput } from './suggest';
import { z } from 'zod';

// The rows the route answers, parsed: the fields a test reads.
const Rows = z.object({ claims: z.array(z.object({ value: z.string(), state: z.string(), source: z.string() })) });

// POST /api/business/suggest-rivals (PRD 748 s3), with a fake store and a fake suggester: signed out
// is 401; a body without a workspace and a product is 400; with offering, trade and region confirmed,
// the model's names are stored as proposed rivals (claim_pick with source `suggestion`) and answered;
// with no suggester, too few picks, or a model that fails, the answer is no claim, never an error.

const row = (seq: number, kind: string, value: string, over: Partial<StoredClaim> = {}): StoredClaim =>
  ({ id: `c-${seq}`, seq, kind, value, source: 'pick', state: 'confirmed', product_id: kind === 'region' ? null : 'p-1', ...over });

const PICKED: StoredClaim[] = [
  row(1, 'offering', 'ERP'),
  row(2, 'trade', 'construction'),
  row(3, 'region', 'Belgium'),
  row(4, 'rival', 'Gone Co', { state: 'rejected' }),
  row(5, 'offering', 'CRM', { product_id: 'p-2' }),
];

function fakeStore(claims: StoredClaim[], { refuse }: { refuse?: Record<string, string> } = {}) {
  const proposed: Array<[string, string, string]> = [];
  const read: Array<[string, string]> = [];
  let seq = Math.max(...claims.map((c) => c.seq), 0);
  const store: SuggestStore = {
    claims(workspace, product) {
      read.push([workspace, product]);
      if (refuse?.read) return Promise.reject(new SuggestStoreError('read the claims', refuse.read, 'no'));
      return Promise.resolve(claims);
    },
    propose(workspace, product, name) {
      proposed.push([workspace, product, name]);
      if (refuse?.[name]) return Promise.reject(new SuggestStoreError('propose', refuse[name], 'no'));
      const kept = claims.find((c) => c.kind === 'rival' && c.value.toLowerCase() === name.toLowerCase());
      if (kept) return Promise.resolve(kept);
      seq += 1;
      return Promise.resolve(row(seq, 'rival', name, { source: 'suggestion', state: 'proposed' }));
    },
  };
  return { store, proposed, read };
}

const post = (body: unknown) =>
  new Request('https://galaxy.test/api/business/suggest-rivals', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });

const deps = (store: SuggestStore | null, names: string[] | null = ['Alpha', 'Beta'], asked: SuggestInput[] = []): SuggestDeps => ({
  store: () => Promise.resolve(store),
  suggest: (input) => { asked.push(input); return Promise.resolve(names); },
});

const BODY = { workspace: 'ws-1', product: 'p-1' };

describe('POST /api/business/suggest-rivals', () => {
  it('is 401 signed out', async () => {
    const res = await suggestRivalsRoute(post(BODY), deps(null));
    expect(res.status).toBe(401);
  });

  it('is 400 without a workspace and a product', async () => {
    const { store } = fakeStore(PICKED);
    for (const body of ['nope', {}, { workspace: 'ws-1' }, { workspace: 'ws-1', product: 7 }]) {
      expect((await suggestRivalsRoute(post(body), deps(store))).status).toBe(400);
    }
  });

  it('stores each name as a proposed rival and answers the rows, from the product and the business region', async () => {
    const f = fakeStore(PICKED);
    const asked: SuggestInput[] = [];
    const res = await suggestRivalsRoute(post(BODY), deps(f.store, ['Alpha', 'Beta'], asked));
    expect(res.status).toBe(200);
    const body = Rows.parse(await res.json());
    expect(body.claims.map((c) => [c.value, c.state, c.source])).toEqual([['Alpha', 'proposed', 'suggestion'], ['Beta', 'proposed', 'suggestion']]);
    expect(f.read).toEqual([['ws-1', 'p-1']]);
    expect(f.proposed).toEqual([['ws-1', 'p-1', 'Alpha'], ['ws-1', 'p-1', 'Beta']]);
    expect(asked).toEqual([{ offering: ['ERP'], trade: ['construction'], region: ['Belgium'], exclude: ['Gone Co'] }]);
  });

  it('never answers a rival the business already holds, a rejected one above all', async () => {
    const f = fakeStore(PICKED);
    const res = await suggestRivalsRoute(post(BODY), deps(f.store, ['gone co', 'Alpha']));
    expect(Rows.parse(await res.json()).claims.map((c) => c.value)).toEqual(['Alpha']);
  });

  it('skips a name the database refuses as invalid, and keeps the others', async () => {
    const f = fakeStore(PICKED, { refuse: { Alpha: '22023' } });
    const res = await suggestRivalsRoute(post(BODY), deps(f.store));
    expect(Rows.parse(await res.json()).claims.map((c) => c.value)).toEqual(['Beta']);
  });

  it('answers no claim, and asks no model, before offering, trade and region are picked', async () => {
    const f = fakeStore(PICKED.filter((c) => c.kind !== 'region'));
    const asked: SuggestInput[] = [];
    const res = await suggestRivalsRoute(post(BODY), deps(f.store, ['Alpha'], asked));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ claims: [] });
    expect(asked).toEqual([]);
  });

  it('answers no claim with no model key, and when the model fails', async () => {
    const f = fakeStore(PICKED);
    const none = await suggestRivalsRoute(post(BODY), { store: () => Promise.resolve(f.store), suggest: null });
    expect([none.status, await none.json()]).toEqual([200, { claims: [] }]);
    const failed = await suggestRivalsRoute(post(BODY), deps(f.store, null));
    expect([failed.status, await failed.json()]).toEqual([200, { claims: [] }]);
    expect(f.proposed).toEqual([]);
  });

  it('is 403 for a workspace the caller is not a member of', async () => {
    const f = fakeStore(PICKED, { refuse: { Alpha: '42501' } });
    expect((await suggestRivalsRoute(post(BODY), deps(f.store))).status).toBe(403);
  });

  it('is 500 when the claims cannot be read', async () => {
    const f = fakeStore(PICKED, { refuse: { read: 'XX000' } });
    expect((await suggestRivalsRoute(post(BODY), deps(f.store))).status).toBe(500);
  });
});
