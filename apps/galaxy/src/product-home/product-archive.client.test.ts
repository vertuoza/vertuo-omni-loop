import { describe, expect, it } from 'vitest';
import { productArchiveClient } from './product-archive.client';

// The browser's Archive and Restore (PRD 2232 s1), on a stubbed fetch (no test calls the network): each
// call's route and method, its answer parsed, a refusal in the route's words, and the connection lost.

function stub(status: number, body: unknown) {
  const calls: [string, RequestInit][] = [];
  const fetchFn = (url: string, init: RequestInit) => {
    calls.push([url, init]);
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  };
  return { calls, client: productArchiveClient('p 1', fetchFn) };
}

describe('the product archive client', () => {
  it('posts Archive and Restore to the product\'s own routes, and answers the product as it was left', async () => {
    const archived = stub(200, { id: 'p 1', name: 'Mobile', archivedAt: '2026-10-20T09:00:00Z' });
    expect(await archived.client.archive()).toEqual({ ok: true, product: { id: 'p 1', name: 'Mobile', archivedAt: '2026-10-20T09:00:00Z' } });
    expect(archived.calls).toEqual([['/app/products/p%201/archive', { method: 'POST', credentials: 'same-origin', cache: 'no-store' }]]);
    const restored = stub(200, { id: 'p 1', name: 'Mobile', archivedAt: null });
    expect(await restored.client.restore()).toEqual({ ok: true, product: { id: 'p 1', name: 'Mobile', archivedAt: null } });
    expect(restored.calls.map(([url]) => url)).toEqual(['/app/products/p%201/restore']);
  });

  it('answers a refusal in the route\'s words, or its status when it sends none', async () => {
    expect(await stub(403, { error: 'Only an owner of the workspace archives Mobile.' }).client.archive())
      .toEqual({ ok: false, message: 'Only an owner of the workspace archives Mobile.' });
    expect(await stub(502, 'bad gateway').client.restore()).toEqual({ ok: false, message: 'Nothing changed (502). Try again.' });
    expect(await stub(200, { id: 'p 1' }).client.archive()).toEqual({ ok: false, message: 'Nothing changed (200). Reload the page.' });
  });

  it('says nothing changed when the connection fails', async () => {
    const client = productArchiveClient('p-1', () => Promise.reject(new Error('offline')));
    expect(await client.archive()).toEqual({ ok: false, message: 'Nothing changed. Check your connection and try again.' });
  });
});
