import { describe, expect, it, vi } from 'vitest';
import { BUSINESS_HREF, BUSINESS_ROUTE, EMPTY_BUSINESS_PART, businessRead, readBusinessCount } from './business';

// The waiting list's Business part (PRD 774, s5): how many things wait to be checked on Settings ›
// Business, read from GET /api/waiting/business; a failed read keeps the last count.

describe('reading the business route', () => {
  const answer = (status: number, body: unknown) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

  it('asks GET /api/waiting/business and gives its count', async () => {
    const fetch = answer(200, { count: 3 });
    expect(await readBusinessCount(fetch)).toEqual({ ok: true, count: 3 });
    expect(fetch).toHaveBeenCalledWith(BUSINESS_ROUTE, { cache: 'no-store' });
    expect(BUSINESS_ROUTE).toBe('/api/waiting/business');
    expect(BUSINESS_HREF).toBe('/app/settings/business');
  });

  it('fails on a status that is not 200, naming it', async () => {
    expect(await readBusinessCount(answer(401, { error: 'Sign in' }))).toEqual({ ok: false, kind: 'status 401' });
  });

  it('fails on an answer it cannot read, and when the network fails', async () => {
    expect(await readBusinessCount(answer(200, { count: 'two' }))).toEqual({ ok: false, kind: 'shape' });
    expect(await readBusinessCount(answer(200, { count: -1 }))).toEqual({ ok: false, kind: 'shape' });
    expect(await readBusinessCount(answer(200, { count: 1.5 }))).toEqual({ ok: false, kind: 'shape' });
    expect(await readBusinessCount(vi.fn(() => Promise.reject(new Error('offline'))))).toEqual({ ok: false, kind: 'network' });
  });
});

describe('the Business part after a read', () => {
  it('starts at zero and readable', () => {
    expect(EMPTY_BUSINESS_PART).toEqual({ count: 0, unread: false });
  });

  it('takes a read\'s count, and keeps the last one, unreadable, when a read fails', () => {
    const next = businessRead(EMPTY_BUSINESS_PART, { ok: true, count: 2 });
    expect(next).toEqual({ count: 2, unread: false });
    expect(businessRead(next, { ok: false, kind: 'network' })).toEqual({ count: 2, unread: true });
  });
});
