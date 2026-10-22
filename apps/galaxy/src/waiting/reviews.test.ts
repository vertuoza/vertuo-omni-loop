import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { EMPTY_REVIEWS_PART, readReviews, reviewsRead } from './reviews';

// The waiting list's Reviews part (PRD 2377 s5): one read of GET /api/waiting/reviews, what a read that
// works or fails leaves in the part.

const ITEM = { kind: 'review' as const, id: 'w1', prd: 7, pr: 70, repo: 'acme/widgets', since: 1_000 };
const WAITING = { ...ITEM, prd: parsePrd(7), pr: parsePr(70) };

const answering = (status: number, body: unknown) => () => Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

describe('readReviews', () => {
  it('reads the route, never cached, into waits, a fix with no PRD included', async () => {
    const asked: Array<[string, unknown]> = [];
    const fix = { ...ITEM, id: 'w2', kind: 'merge' as const, prd: null };
    const read = await readReviews((url, init) => { asked.push([url, init]); return answering(200, { items: [ITEM, fix] })(); });
    expect(read).toEqual({ ok: true, items: [WAITING, { ...fix, pr: parsePr(70) }] });
    expect(asked).toEqual([['/api/waiting/reviews', { cache: 'no-store' }]]);
  });

  it('names the kind of each failure: the network, a status, a body out of shape', async () => {
    expect(await readReviews(() => Promise.reject(new Error('offline')))).toEqual({ ok: false, kind: 'network' });
    expect(await readReviews(answering(401, { error: 'signed-out' }))).toEqual({ ok: false, kind: 'status 401' });
    expect(await readReviews(answering(200, 'not json'))).toEqual({ ok: false, kind: 'shape' });
    expect(await readReviews(answering(200, { items: [{ ...ITEM, kind: 'approval' }] }))).toEqual({ ok: false, kind: 'shape' });
  });
});

describe('reviewsRead', () => {
  it('replaces the part on a read that works, and keeps it, unreadable, on one that fails', () => {
    const part = reviewsRead(EMPTY_REVIEWS_PART, { ok: true, items: [WAITING] });
    expect(part).toEqual({ items: [WAITING], unread: false });
    expect(reviewsRead(part, { ok: false, kind: 'network' })).toEqual({ items: [WAITING], unread: true });
  });
});
