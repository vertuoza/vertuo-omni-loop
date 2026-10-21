import { describe, expect, it } from 'vitest';
import { parseOutboxItemId, parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { questionsClient } from './questions.client';

// The Questions tab's call from the browser (PRD 1548 s9), on a stubbed fetch: the request it sends, the
// settlement it reads, the route's refusal in its own words, and what it says when the network or the
// reply fails.

const REQUEST = { prdId: parseProductPrdId('mobile-12'), item: parseOutboxItemId('s2-01-quote-totals'), answer: 'A' };
const REPLY = { item: 's2-01-quote-totals', prdId: 'mobile-12', verdict: 'agreed', settledAt: '2026-10-11T11:00:00Z' };

function stub(res: Response | Error) {
  const sent: { url: string; init: RequestInit }[] = [];
  const client = questionsClient((url, init) => { sent.push({ url, init }); return res instanceof Error ? Promise.reject(res) : Promise.resolve(res); });
  return { sent, client };
}

describe('the Questions tab\'s client', () => {
  it('posts the answer with the sign-in cookie and reads the settlement', async () => {
    const { sent, client } = stub(Response.json(REPLY));
    expect(await client.answer(REQUEST)).toEqual({ ok: true, reply: REPLY });
    expect(sent).toEqual([{
      url: '/api/outbox/answer',
      init: { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify(REQUEST) },
    }]);
  });

  it('answers the route\'s refusal in its own words', async () => {
    const { client } = stub(Response.json({ error: 'No PRD mobile-12 in your workspaces.' }, { status: 404 }));
    expect(await client.answer(REQUEST)).toEqual({ ok: false, message: 'No PRD mobile-12 in your workspaces.' });
  });

  it('says so when the network fails, a refusal has no words, or a reply is out of shape', async () => {
    expect(await stub(new Error('offline')).client.answer(REQUEST)).toEqual({ ok: false, message: 'Nothing was sent. Check your connection and try again.' });
    expect(await stub(new Response('oops', { status: 502 })).client.answer(REQUEST)).toEqual({ ok: false, message: 'The answer was not saved (502). Try again.' });
    expect(await stub(Response.json({ nope: true })).client.answer(REQUEST))
      .toEqual({ ok: false, message: 'The answer was sent, but its reply was unreadable (200). Reload the page.' });
  });
});
