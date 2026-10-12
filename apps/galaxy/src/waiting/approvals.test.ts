import { describe, expect, it } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { approvalsRead, EMPTY_APPROVALS_PART, readApprovals } from './approvals';

// The waiting list's Approvals part (PRD 1322 s2): one read of GET /api/waiting/approvals, what a read
// that works or fails leaves in the part.

const ITEM = { id: 'req-1', dossierId: 'd-1322', prd: 1322, title: 'The approval handshake', repo: 'acme/mobile', askedAt: 1_000 };
const WAITING = { kind: 'approval' as const, ...ITEM, prd: parsePrd(1322) };

const answering = (status: number, body: unknown) => () => Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

describe('readApprovals', () => {
  it('reads the route, never cached, into approval items', async () => {
    const asked: Array<[string, unknown]> = [];
    const read = await readApprovals((url, init) => { asked.push([url, init]); return answering(200, { items: [ITEM] })(); });
    expect(read).toEqual({ ok: true, items: [WAITING] });
    expect(asked).toEqual([['/api/waiting/approvals', { cache: 'no-store' }]]);
  });

  it('names the kind of each failure: the network, a status, a body out of shape', async () => {
    expect(await readApprovals(() => Promise.reject(new Error('offline')))).toEqual({ ok: false, kind: 'network' });
    expect(await readApprovals(answering(401, { error: 'Sign in first' }))).toEqual({ ok: false, kind: 'status 401' });
    expect(await readApprovals(answering(200, 'not json'))).toEqual({ ok: false, kind: 'shape' });
    expect(await readApprovals(answering(200, { items: [{ ...ITEM, prd: 'x' }] }))).toEqual({ ok: false, kind: 'shape' });
  });
});

describe('approvalsRead', () => {
  it('replaces the part on a read that works, and keeps it, unreadable, on one that fails', () => {
    const part = approvalsRead(EMPTY_APPROVALS_PART, { ok: true, items: [WAITING] });
    expect(part).toEqual({ items: [WAITING], unread: false });
    expect(approvalsRead(part, { ok: false, kind: 'network' })).toEqual({ items: [WAITING], unread: true });
  });
});
