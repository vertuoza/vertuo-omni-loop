import { describe, expect, it } from 'vitest';
import { PRODUCT_ROUTE } from './product.contract';
import { productClient } from './product.client';

// The Product picker's calls from the browser (PRD 1364 s7): the page's /api/dossiers/product route, each
// answer parsed with the contract. A read the person may not make (signed out, or a PRD they do not read)
// is null, and the picker hides; a change answers the product set, or the route's own words.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const MOBILE = { id: '22222222-2222-4222-8222-222222222221', name: 'Mobile' };
const PICK = { product: MOBILE, products: [MOBILE], locked: null };

function client(status: number, body: unknown) {
  const sent: Array<{ url: string; init: RequestInit }> = [];
  const c = productClient((url, init) => {
    sent.push({ url, init });
    return Promise.resolve(typeof body === 'string' ? new Response(body, { status }) : Response.json(body, { status }));
  });
  return { c, sent };
}

describe('the read', () => {
  it('asks the route for the dossier, with the session cookie, and parses the answer', async () => {
    const { c, sent } = client(200, PICK);
    expect(await c.read(DOSSIER)).toEqual(PICK);
    expect(sent).toEqual([{ url: `${PRODUCT_ROUTE}?dossier=${DOSSIER}`, init: { headers: { accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin' } }]);
  });

  it('answers null signed out or for a PRD the person does not read', async () => {
    expect(await client(401, { error: 'Sign in first.' }).c.read(DOSSIER)).toBe(null);
    expect(await client(404, { error: 'No such PRD.' }).c.read(DOSSIER)).toBe(null);
  });

  it('throws on a failure or an answer out of shape', async () => {
    await expect(client(500, { error: 'down' }).c.read(DOSSIER)).rejects.toThrow('read the PRD\'s product: 500');
    await expect(client(200, { product: 'Mobile' }).c.read(DOSSIER)).rejects.toThrow();
  });
});

describe('a change', () => {
  it('posts the dossier and the product, and answers the product set', async () => {
    const { c, sent } = client(200, { product: MOBILE });
    expect(await c.change(DOSSIER, MOBILE.id)).toEqual({ ok: true, product: MOBILE });
    expect(sent[0]?.url).toBe(PRODUCT_ROUTE);
    expect(sent[0]?.init.method).toBe('POST');
    expect(JSON.parse(typeof sent[0]?.init.body === 'string' ? sent[0].init.body : '')).toEqual({ dossier: DOSSIER, product: MOBILE.id });
  });

  it('answers the route\'s own words on a refusal, and a plain line when it has none', async () => {
    expect(await client(409, { error: 'product is locked: PRD 7 is approved' }).c.change(DOSSIER, null))
      .toEqual({ ok: false, locked: true, error: 'product is locked: PRD 7 is approved' });
    expect(await client(400, { error: 'Product: no such product in this workspace.' }).c.change(DOSSIER, MOBILE.id))
      .toEqual({ ok: false, locked: false, error: 'Product: no such product in this workspace.' });
    expect(await client(502, 'bad gateway').c.change(DOSSIER, null))
      .toEqual({ ok: false, locked: false, error: 'The product was not changed (502). Try again.' });
  });

  it('answers a plain line when the network fails', async () => {
    const c = productClient(() => Promise.reject(new TypeError('offline')));
    expect(await c.change(DOSSIER, null)).toEqual({ ok: false, locked: false, error: 'The product was not changed. Check your connection and try again.' });
  });
});
