import { describe, expect, it, vi } from 'vitest';
import { ProductErrorSchema, ProductPickSchema, ProductSetSchema } from './product.contract';
import { productHandlers } from './product.controller';
import type { ProductService } from './product.service';

vi.mock('server-only', () => ({}));

// The Product picker's routes (PRD 1364 s7), on a fake service:
//
//   GET  /api/dossiers/product?dossier=<id>       → 200 {product, products, locked}
//   POST /api/dossiers/product {dossier, product} → 200 {product}
//
// The session is checked first: signed out, 401 and no service runs. Each refusal is `{error}` in plain
// words, its status by its kind.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const MOBILE = { id: '22222222-2222-4222-8222-222222222221', name: 'Mobile' };
const URL_OF = `https://omni.test/api/dossiers/product?dossier=${DOSSIER}`;

function handlers(service: Partial<ProductService> | null) {
  const calls: string[] = [];
  const logs: string[] = [];
  const full: ProductService = {
    read: (id) => { calls.push(`read ${id}`); return Promise.resolve({ ok: true, value: { product: MOBILE, products: [MOBILE], locked: null } }); },
    change: (id, product) => { calls.push(`change ${id} ${product ?? 'none'}`); return Promise.resolve({ ok: true, value: { product: MOBILE } }); },
    ...service,
  };
  const h = productHandlers({ signedIn: () => Promise.resolve(service === null ? null : full), log: (line) => { logs.push(line); } });
  return { ...h, calls, logs };
}

const post = (body: unknown, raw?: string) =>
  new Request('https://omni.test/api/dossiers/product', { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(body) });

describe('GET: what the picker shows', () => {
  it('answers the dossier\'s product, the workspace\'s products and the lock, never cached', async () => {
    const { get, calls } = handlers({});
    const answer = await get(new Request(URL_OF));
    expect(answer.status).toBe(200);
    expect(answer.headers.get('cache-control')).toBe('no-store');
    expect(ProductPickSchema.parse(await answer.json())).toEqual({ product: MOBILE, products: [MOBILE], locked: null });
    expect(calls).toEqual([`read ${DOSSIER}`]);
  });

  it('answers 401 signed out, before reading anything', async () => {
    const { get, calls } = handlers(null);
    const answer = await get(new Request(URL_OF));
    expect(answer.status).toBe(401);
    expect(ProductErrorSchema.parse(await answer.json()).error).toBe('Sign in first to change the PRD\'s product.');
    expect(calls).toEqual([]);
  });

  it('answers 400 without a dossier id, or with one that is not an id', async () => {
    for (const url of ['https://omni.test/api/dossiers/product', 'https://omni.test/api/dossiers/product?dossier=7']) {
      const { get, calls } = handlers({});
      const answer = await get(new Request(url));
      expect(answer.status).toBe(400);
      expect(calls).toEqual([]);
    }
  });

  it('answers 404 for a dossier the caller does not read, and 500 on a failed read, logged', async () => {
    const missing = handlers({ read: () => Promise.resolve({ ok: false, kind: 'missing', error: 'No such PRD.' }) });
    expect((await missing.get(new Request(URL_OF))).status).toBe(404);
    const down = handlers({ read: () => Promise.resolve({ ok: false, kind: 'database', error: 'The PRD\'s product could not be read. Try again.' }) });
    const answer = await down.get(new Request(URL_OF));
    expect(answer.status).toBe(500);
    expect(await answer.json()).toEqual({ error: 'The PRD\'s product could not be read. Try again.' });
    expect(down.logs).toEqual([`dossier product: The PRD's product could not be read. Try again. (${DOSSIER})`]);
  });
});

describe('POST: a change of product', () => {
  it('answers the product set', async () => {
    const { post: send, calls } = handlers({});
    const answer = await send(post({ dossier: DOSSIER, product: MOBILE.id }));
    expect(answer.status).toBe(200);
    expect(ProductSetSchema.parse(await answer.json())).toEqual({ product: MOBILE });
    expect(calls).toEqual([`change ${DOSSIER} ${MOBILE.id}`]);
  });

  it('sets no product with a null product', async () => {
    const { post: send, calls } = handlers({});
    expect((await send(post({ dossier: DOSSIER, product: null }))).status).toBe(200);
    expect(calls).toEqual([`change ${DOSSIER} none`]);
  });

  it('answers 401 signed out, before reading the body', async () => {
    const { post: send, calls } = handlers(null);
    expect((await send(post({ dossier: DOSSIER, product: null }))).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('answers 400 to a malformed body', async () => {
    for (const request of [post(null, '{'), post({ dossier: DOSSIER }), post({ dossier: 'd1', product: null }), post({ dossier: DOSSIER, product: 'Mobile' }), post(null, `{"dossier":"${DOSSIER}","product":null,"pad":"${'x'.repeat(5000)}"}`)]) {
      const { post: send, calls } = handlers({});
      const answer = await send(request);
      expect(answer.status).toBe(400);
      expect(ProductErrorSchema.parse(await answer.json()).error).toMatch(/^The body must be a JSON object/);
      expect(calls).toEqual([]);
    }
  });

  it('answers 409 while an approval is in force, in its own words', async () => {
    const { post: send } = handlers({ change: () => Promise.resolve({ ok: false, kind: 'locked', error: 'product is locked: PRD 7 is approved' }) });
    const answer = await send(post({ dossier: DOSSIER, product: MOBILE.id }));
    expect(answer.status).toBe(409);
    expect(await answer.json()).toEqual({ error: 'product is locked: PRD 7 is approved' });
  });

  it('refuses a product of another workspace with 400, and a dossier it does not read with 404', async () => {
    const foreign = handlers({ change: () => Promise.resolve({ ok: false, kind: 'foreign-product', error: 'Product: no such product in this workspace.' }) });
    const answer = await foreign.post(post({ dossier: DOSSIER, product: MOBILE.id }));
    expect(answer.status).toBe(400);
    expect(await answer.json()).toEqual({ error: 'Product: no such product in this workspace.' });
    const missing = handlers({ change: () => Promise.resolve({ ok: false, kind: 'missing', error: 'No such PRD.' }) });
    expect((await missing.post(post({ dossier: DOSSIER, product: null }))).status).toBe(404);
  });

  it('answers 401 when the database says the caller is signed out, and 500 on a failure, logged', async () => {
    const out = handlers({ change: () => Promise.resolve({ ok: false, kind: 'signed-out', error: 'Sign in first to change the PRD\'s product.' }) });
    expect((await out.post(post({ dossier: DOSSIER, product: null }))).status).toBe(401);
    const down = handlers({ change: () => Promise.resolve({ ok: false, kind: 'database', error: 'The PRD\'s product was not changed. Try again.' }) });
    expect((await down.post(post({ dossier: DOSSIER, product: null }))).status).toBe(500);
    expect(down.logs).toHaveLength(1);
  });
});
