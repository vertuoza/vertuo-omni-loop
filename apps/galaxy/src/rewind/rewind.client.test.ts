import { describe, expect, it, vi } from 'vitest';
import { decideFinding } from './rewind.client';

// The browser's side of a decision (PRD 2410, s7): the route is called once with the body as given, and its
// answer read back as the reply, or as the route's own words when it refuses.

const ID = '6f1c1b1e-8a0e-4c1f-9d55-2c1f7b0e9a11';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('decideFinding', () => {
  it('posts the decision to the route and reads the reply', async () => {
    const reply = { state: 'approved', followUp: { done: true, words: 'Queued.', link: '/app/runners' } };
    const fetch = vi.fn(() => Promise.resolve(json(200, reply)));
    expect(await decideFinding({ finding: ID, verdict: 'approve' }, fetch)).toEqual({ ok: true, reply });
    expect(fetch).toHaveBeenCalledWith('/api/rewind/decide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ finding: ID, verdict: 'approve' }) });
  });

  it('reads a reject with no follow-up', async () => {
    const fetch = () => Promise.resolve(json(200, { state: 'rejected', followUp: null }));
    expect(await decideFinding({ finding: ID, verdict: 'reject', reason: 'No' }, fetch)).toEqual({ ok: true, reply: { state: 'rejected', followUp: null } });
  });

  it('answers the route\'s words when it refuses, and its own when it has none', async () => {
    expect(await decideFinding({ finding: ID, verdict: 'approve' }, () => Promise.resolve(json(409, { error: 'Already approved.' })))).toEqual({ ok: false, error: 'Already approved.' });
    expect(await decideFinding({ finding: ID, verdict: 'reject' }, () => Promise.resolve(new Response('oops', { status: 502 })))).toEqual({ ok: false, error: 'The finding was not rejected (502). Try again.' });
  });

  it('says so when the network fails', async () => {
    expect(await decideFinding({ finding: ID, verdict: 'approve' }, () => Promise.reject(new Error('offline')))).toEqual({
      ok: false, error: 'The finding was not approved. Check your connection and try again.',
    });
  });
});
