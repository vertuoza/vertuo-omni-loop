import { describe, expect, it } from 'vitest';
import { repositoriesTabClient } from './repositories-tab.client';

// The Repositories & approvers tab's browser calls (PRD 1364 s11), on a stubbed fetch: each goes to its
// route with the cookie, its answer parsed; a refusal answers the route's own words, and a lost
// connection says nothing was saved.

const PRODUCT = '22222222-2222-4222-8222-222222222221';
const LINK = { repo: 'acme/api', role: 'api', knowledge: 'own', readAt: null, readOnly: false, consumes: [], addedBy: 'person' };

function stub(status: number, body: unknown) {
  const sent: { url: string; init: RequestInit }[] = [];
  const fetchFn = (url: string, init: RequestInit) => { sent.push({ url, init }); return Promise.resolve(Response.json(body, { status })); };
  return { sent, client: repositoriesTabClient(PRODUCT, fetchFn) };
}

describe('the calls', () => {
  it('saves a link with a POST of every field', async () => {
    const { sent, client } = stub(200, { link: LINK });
    const write = { repo: 'acme/api', role: 'api', knowledge: 'own' as const, readAt: null, readOnly: false, consumes: [] };
    expect(await client.saveLink(write)).toEqual({ ok: true, link: LINK });
    expect(sent[0]?.url).toBe(`/app/products/${PRODUCT}/repositories/links`);
    expect(sent[0]?.init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(sent[0]?.init.body))).toEqual(write);
  });

  it('removes a link and an approver with a DELETE naming it, and sets an approver with a POST', async () => {
    const removed = stub(200, { repo: 'acme/api', removed: true });
    expect(await removed.client.removeLink('acme/api')).toEqual({ ok: true, repo: 'acme/api' });
    expect(removed.sent[0]).toMatchObject({ url: `/app/products/${PRODUCT}/repositories/links?repo=acme%2Fapi`, init: { method: 'DELETE' } });
    const set = stub(200, { member: 'u-1', state: 'skipped' });
    expect(await set.client.setApprover('u-1', 'skipped')).toEqual({ ok: true, state: 'skipped' });
    expect(set.sent[0]?.url).toBe(`/app/products/${PRODUCT}/repositories/approvers`);
    const unset = stub(200, { member: 'u-1', removed: true });
    expect(await unset.client.removeApprover('u-1')).toEqual({ ok: true });
    expect(unset.sent[0]?.url).toBe(`/app/products/${PRODUCT}/repositories/approvers?member=u-1`);
  });

  it('answers a refusal in the route\'s words, and a lost connection as nothing saved', async () => {
    expect(await stub(422, { error: 'Role: X is not one kebab-case word.' }).client.removeLink('acme/api')).toEqual({ ok: false, message: 'Role: X is not one kebab-case word.' });
    expect(await stub(500, 'no json').client.removeLink('acme/api')).toEqual({ ok: false, message: 'Nothing was saved (500). Try again.' });
    const offline = repositoriesTabClient(PRODUCT, () => Promise.reject(new Error('offline')));
    expect(await offline.removeApprover('u-1')).toEqual({ ok: false, message: 'Nothing was saved. Check your connection and try again.' });
  });
});
